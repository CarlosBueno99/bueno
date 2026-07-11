import { action, mutation, query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Resolve a vanity URL to Steam ID64 using Steam API
async function resolveVanityUrl(vanityUrl: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityUrl)}`
    );
    const data = await response.json();
    
    if (data.response?.success === 1 && data.response?.steamid) {
      return data.response.steamid;
    }
    return null;
  } catch (error) {
    console.error('Error resolving vanity URL:', error);
    return null;
  }
}

// Check if a string is a valid Steam ID64
function isSteamId64(input: string): boolean {
  return /^7656119\d{10}$/.test(input);
}

// Get match sharing codes using Steam Web API
async function getMatchSharingCodes(
  steamId: string, 
  authCode: string, 
  steamApiKey: string,
  startingKnownCode: string,
  maxMatches: number = 10
): Promise<{ shareCodes: string[]; error?: string }> {
  const shareCodes: string[] = [];
  let knownCode = startingKnownCode;
  let retryCount = 0;
  const maxRetries = 3;
  
  for (let i = 0; i < maxMatches; i++) {
    try {
      const url = `https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1?key=${steamApiKey}&steamid=${steamId}&steamidkey=${authCode}&knowncode=${knownCode}`;
      const redactedUrl = url.replace(steamApiKey, '[REDACTED]');
      console.log(`Fetching match ${i + 1}: ${redactedUrl}`);
      
      const response = await fetch(url);
      console.log(`Response status: ${response.status}`);
      
      // Handle HTTP error status codes
      if (!response.ok) {
        // Handle rate limiting (429 Too Many Requests)
        if (response.status === 429) {
          if (retryCount < maxRetries) {
            retryCount++;
            const waitTime = 2000 * retryCount; // 2s, 4s, 6s
            console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, waitTime));
            i--; // Retry the same match
            continue;
          } else {
            console.log('Max retries reached due to rate limiting. Returning partial results.');
            return { shareCodes, error: `Rate limited by Steam API. Got ${shareCodes.length} matches before limit.` };
          }
        }
        
        // Handle 403 Forbidden - usually means invalid auth code or wrong Steam ID
        if (response.status === 403) {
          console.error('Steam API returned 403 Forbidden');
          return { 
            shareCodes, 
            error: 'Access denied by Steam API (403). This usually means:\n' +
              '• The CS2 Authentication Code is invalid or expired (regenerate it in CS2: Settings → Game → Authentication Code)\n' +
              '• The Authentication Code doesn\'t match the target Steam account\n' +
              '• The target account\'s match history is set to private'
          };
        }
        
        // Handle 401 Unauthorized - invalid API key
        if (response.status === 401) {
          console.error('Steam API returned 401 Unauthorized');
          return { shareCodes, error: 'Steam API key is invalid or expired (401). Please check the STEAM_API_KEY configuration.' };
        }
        
        // Handle other error status codes
        console.error(`Steam API returned status ${response.status}`);
        const errorText = await response.text();
        return { 
          shareCodes, 
          error: `Steam API error (${response.status}): ${errorText.substring(0, 200)}` 
        };
      }
      
      // Reset retry count on successful request
      retryCount = 0;
      
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        return { shareCodes, error: `Failed to parse API response: ${responseText.substring(0, 200)}` };
      }
      
      if (data.error) {
        console.error('API returned error:', data.error);
        return { shareCodes, error: `Steam API error: ${JSON.stringify(data.error)}` };
      }
      
      if (data.result?.nextcode && data.result.nextcode !== 'n/a') {
        knownCode = data.result.nextcode;
        shareCodes.push(knownCode);
        console.log(`Got share code ${i + 1}: ${knownCode}`);
        
        // Add delay between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      } else {
        console.log('No more matches available.');
        break;
      }
    } catch (error) {
      console.error('Error fetching match sharing code:', error);
      return { shareCodes, error: `Fetch error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  
  return { shareCodes };
}

/**
 * Internal query to get the latest share code for a Steam ID.
 */
export const getLatestShareCodeForSteamId = internalQuery({
  args: {
    steamId: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("cs2Matches")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.steamId))
      .collect();

    if (matches.length === 0) {
      return null;
    }

    // Sort by matchTime (descending), falling back to fetchedAt
    const sorted = matches.sort((a, b) => {
      const timeA = a.matchTime ? new Date(a.matchTime).getTime() : a.fetchedAt;
      const timeB = b.matchTime ? new Date(b.matchTime).getTime() : b.fetchedAt;
      return timeB - timeA;
    });

    return sorted[0].shareCode;
  },
});

type Cs2FetchTarget = {
  userId: Id<"users">;
  targetSteamId: string;
  authCode: string;
  startingKnownCode: string | null;
};

/**
 * Internal query for scheduled CS2 match fetches.
 * A user is eligible when they have a Steam ID or vanity name, plus a CS2
 * share-code auth token. The latest saved match is preferred as the cursor.
 */
export const getConfiguredCs2FetchTargets = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      targetSteamId: v.string(),
      authCode: v.string(),
      startingKnownCode: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx): Promise<Cs2FetchTarget[]> => {
    const settings = await ctx.db.query("websiteSettings").collect();
    const targets: Cs2FetchTarget[] = [];

    for (const setting of settings) {
      const targetSteamId = setting.steamId || setting.cs2SteamUsername;
      const authCode = setting.cs2ShareCodeAuthToken;
      if (!targetSteamId || !authCode) continue;

      const matches = await ctx.db
        .query("cs2Matches")
        .withIndex("by_steamId", (q) => q.eq("steamId", targetSteamId))
        .collect();

      const latestMatch = matches.sort((a, b) => {
        const timeA = a.matchTime ? new Date(a.matchTime).getTime() : a.fetchedAt;
        const timeB = b.matchTime ? new Date(b.matchTime).getTime() : b.fetchedAt;
        return timeB - timeA;
      })[0];

      targets.push({
        userId: setting.userId,
        targetSteamId,
        authCode,
        startingKnownCode: latestMatch?.shareCode ?? setting.cs2LastShareCode ?? null,
      });
    }

    return targets;
  },
});

/**
 * Internal mutation used by the scheduled fetcher to persist newly discovered
 * share codes without requiring an authenticated browser session.
 */
export const saveFetchedShareCodes = internalMutation({
  args: {
    userId: v.id("users"),
    steamId: v.string(),
    shareCodes: v.array(v.string()),
  },
  returns: v.object({
    saved: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    let saved = 0;
    let updated = 0;
    const now = Date.now();

    for (const shareCode of args.shareCodes) {
      const existing = await ctx.db
        .query("cs2Matches")
        .withIndex("by_shareCode", (q) => q.eq("shareCode", shareCode))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { fetchedAt: now });
        updated++;
      } else {
        await ctx.db.insert("cs2Matches", {
          userId: args.userId,
          steamId: args.steamId,
          shareCode,
          demoUrlStatus: "pending",
          fetchedAt: now,
        });
        saved++;
      }
    }

    const settings = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const latestShareCode = args.shareCodes.at(-1);
    if (settings && latestShareCode) {
      await ctx.db.patch(settings._id, {
        cs2LastShareCode: latestShareCode,
      });
    }

    return { saved, updated };
  },
});

export const saveDemoUrlResults = internalMutation({
  args: {
    results: v.array(v.object({
      shareCode: v.string(),
      demoUrl: v.optional(v.string()),
      error: v.optional(v.string()),
      s3ObjectKey: v.optional(v.string()),
      archiveError: v.optional(v.string()),
      matchId: v.optional(v.string()),
      matchTime: v.optional(v.string()),
      teamScores: v.optional(v.array(v.number())),
      matchResult: v.optional(v.number()),
      targetPlayerTeam: v.optional(v.number()),
      playerStats: v.optional(v.object({
        kills: v.number(),
        deaths: v.number(),
        assists: v.number(),
        headshots: v.number(),
        mvps: v.number(),
        score: v.number(),
      })),
    })),
  },
  returns: v.object({ available: v.number(), missing: v.number() }),
  handler: async (ctx, args) => {
    let available = 0;
    let missing = 0;
    const attemptedAt = Date.now();

    for (const result of args.results) {
      const match = await ctx.db
        .query("cs2Matches")
        .withIndex("by_shareCode", (q) => q.eq("shareCode", result.shareCode))
        .unique();
      if (!match) continue;

      const status: "available" | "missing" = result.demoUrl ? "available" : "missing";
      if (result.demoUrl) available++;
      else missing++;

      await ctx.db.patch(match._id, {
        demoUrl: result.demoUrl ?? match.demoUrl,
        demoUrlStatus: status,
        demoUrlLastAttemptAt: attemptedAt,
        demoUrlError: result.demoUrl ? undefined : (result.error ?? "No demo URL returned"),
        s3ObjectKey: result.s3ObjectKey ?? match.s3ObjectKey,
        archiveStatus: result.s3ObjectKey ? "archived" : (result.demoUrl ? "failed" : match.archiveStatus),
        archiveLastAttemptAt: result.demoUrl ? attemptedAt : match.archiveLastAttemptAt,
        archiveError: result.s3ObjectKey ? undefined : result.archiveError,
        matchId: result.matchId ?? match.matchId,
        matchTime: result.matchTime ?? match.matchTime,
        teamScores: result.teamScores ?? match.teamScores,
        matchResult: result.matchResult ?? match.matchResult,
        targetPlayerTeam: result.targetPlayerTeam ?? match.targetPlayerTeam,
        playerStats: result.playerStats ?? match.playerStats,
      });
    }

    return { available, missing };
  },
});

export const getMatchesPendingDemoUrl = internalQuery({
  args: { steamId: v.string(), limit: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("cs2Matches")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.steamId))
      .collect();

    return matches
      .filter((match) => !match.s3ObjectKey)
      .sort((a, b) => {
        const attemptA = a.demoUrlLastAttemptAt ?? 0;
        const attemptB = b.demoUrlLastAttemptAt ?? 0;
        return attemptA - attemptB || a.fetchedAt - b.fetchedAt;
      })
      .slice(0, args.limit)
      .map((match) => match.shareCode);
  },
});

type ScheduledFetchResult = {
  usersChecked: number;
  usersConfigured: number;
  shareCodesFound: number;
  saved: number;
  updated: number;
  demoUrlsAvailable: number;
  demoUrlsMissing: number;
  demosArchived: number;
  errors: string[];
};

/**
 * Scheduled fetch for new CS2 matches.
 * This stores new share codes. Demo URL and detailed metadata enrichment still
 * happens through the Hono Steam GC routes because that integration requires
 * the Node-specific Steam libraries used by the API server.
 */
export const fetchNewCounterStrikeGames = internalAction({
  args: {
    maxMatches: v.optional(v.number()),
  },
  returns: v.object({
    usersChecked: v.number(),
    usersConfigured: v.number(),
    shareCodesFound: v.number(),
    saved: v.number(),
    updated: v.number(),
    demoUrlsAvailable: v.number(),
    demoUrlsMissing: v.number(),
    demosArchived: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<ScheduledFetchResult> => {
    const steamApiKey = process.env.STEAM_API_KEY;
    if (!steamApiKey) {
      return {
        usersChecked: 0,
        usersConfigured: 0,
        shareCodesFound: 0,
        saved: 0,
        updated: 0,
        demoUrlsAvailable: 0,
        demoUrlsMissing: 0,
        demosArchived: 0,
        errors: ["Steam API key not configured. Set STEAM_API_KEY environment variable."],
      };
    }

    const targets: Cs2FetchTarget[] = await ctx.runQuery(
      internal.cs2Actions.getConfiguredCs2FetchTargets,
      {}
    );

    const result: ScheduledFetchResult = {
      usersChecked: targets.length,
      usersConfigured: targets.length,
      shareCodesFound: 0,
      saved: 0,
      updated: 0,
      demoUrlsAvailable: 0,
      demoUrlsMissing: 0,
      demosArchived: 0,
      errors: [],
    };

    for (const target of targets) {
      if (!target.startingKnownCode) {
        result.errors.push(
          `Skipping ${target.targetSteamId}: no saved match or CS2 last share code configured.`
        );
        continue;
      }

      let steamId = target.targetSteamId;
      if (!isSteamId64(steamId)) {
        const resolvedId = await resolveVanityUrl(steamId, steamApiKey);
        if (!resolvedId) {
          result.errors.push(`Skipping ${target.targetSteamId}: could not resolve vanity URL.`);
          continue;
        }
        steamId = resolvedId;
      }

      const shareCodesResult = await getMatchSharingCodes(
        steamId,
        target.authCode,
        steamApiKey,
        target.startingKnownCode,
        args.maxMatches ?? 30
      );

      if (shareCodesResult.error) {
        result.errors.push(`${steamId}: ${shareCodesResult.error}`);
      }

      if (shareCodesResult.shareCodes.length > 0) {
        const saveResult: { saved: number; updated: number } = await ctx.runMutation(
          internal.cs2Actions.saveFetchedShareCodes,
          {
            userId: target.userId,
            steamId,
            shareCodes: shareCodesResult.shareCodes,
          }
        );

        result.shareCodesFound += shareCodesResult.shareCodes.length;
        result.saved += saveResult.saved;
        result.updated += saveResult.updated;
      }

      const shareCodesToEnrich: string[] = await ctx.runQuery(
        internal.cs2Actions.getMatchesPendingDemoUrl,
        { steamId, limit: args.maxMatches ?? 30 }
      );
      if (shareCodesToEnrich.length === 0) continue;

      const apiBaseUrl = process.env.CS2_API_BASE_URL?.replace(/\/$/, "");
      const internalSecret = process.env.CS2_ARCHIVE_INTERNAL_SECRET;
      if (!apiBaseUrl || !internalSecret) {
        result.errors.push(
          `${steamId}: demo enrichment is not configured; set CS2_API_BASE_URL and CS2_ARCHIVE_INTERNAL_SECRET in Convex.`
        );
        continue;
      }

      // Keep each GC request below the Hono route's timeout while still
      // processing every newly discovered share code.
      for (let offset = 0; offset < shareCodesToEnrich.length; offset += 4) {
        const batch = shareCodesToEnrich.slice(offset, offset + 4);
        const url = new URL(`${apiBaseUrl}/api/cs/matches`);
        url.searchParams.set("shareCodes", batch.join(","));
        url.searchParams.set("targetSteamId", steamId);

        try {
          const response = await fetch(url, {
            headers: { "x-cs2-internal-secret": internalSecret },
          });
          const payload = await response.json();
          if (!response.ok || !Array.isArray(payload.matches)) {
            result.errors.push(
              `${steamId}: demo enrichment failed (${response.status}): ${payload.error ?? "Invalid response"}`
            );
            continue;
          }

          const normalized = payload.matches.map((match: any) => ({
            shareCode: String(match.shareCode),
            ...(match.demoUrl ? { demoUrl: String(match.demoUrl) } : {}),
            ...(match.error ? { error: String(match.error) } : {}),
            ...(match.s3ObjectKey ? { s3ObjectKey: String(match.s3ObjectKey) } : {}),
            ...(match.archiveError ? { archiveError: String(match.archiveError) } : {}),
            ...(match.matchId ? { matchId: String(match.matchId) } : {}),
            ...(match.matchTime ? { matchTime: String(match.matchTime) } : {}),
            ...(Array.isArray(match.teamScores) ? { teamScores: match.teamScores.map(Number) } : {}),
            ...(typeof match.matchResult === "number" ? { matchResult: match.matchResult } : {}),
            ...(typeof match.targetPlayerTeam === "number" ? { targetPlayerTeam: match.targetPlayerTeam } : {}),
            ...(match.playerStats ? { playerStats: match.playerStats } : {}),
          }));
          const savedUrls: { available: number; missing: number } = await ctx.runMutation(
            internal.cs2Actions.saveDemoUrlResults,
            { results: normalized }
          );
          result.demoUrlsAvailable += savedUrls.available;
          result.demoUrlsMissing += savedUrls.missing;
          result.demosArchived += normalized.filter((match: any) => match.s3ObjectKey).length;
        } catch (error) {
          result.errors.push(
            `${steamId}: demo enrichment request failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return result;
  },
});

export const triggerCs2Automation = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    usersChecked: v.number(),
    shareCodesFound: v.number(),
    demoUrlsAvailable: v.number(),
    demoUrlsMissing: v.number(),
    demosArchived: v.number(),
    errors: v.array(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, usersChecked: 0, shareCodesFound: 0, demoUrlsAvailable: 0, demoUrlsMissing: 0, demosArchived: 0, errors: [], error: "Not authenticated" };
    }
    const permission = await ctx.runQuery(api.auth.getUserPermission, {});
    if (!permission || !["admin", "owner"].includes(permission)) {
      return { success: false, usersChecked: 0, shareCodesFound: 0, demoUrlsAvailable: 0, demoUrlsMissing: 0, demosArchived: 0, errors: [], error: "Insufficient permissions" };
    }

    const result: ScheduledFetchResult = await ctx.runAction(
      internal.cs2Actions.fetchNewCounterStrikeGames,
      { maxMatches: 30 }
    );
    return {
      success: result.errors.length === 0,
      usersChecked: result.usersChecked,
      shareCodesFound: result.shareCodesFound,
      demoUrlsAvailable: result.demoUrlsAvailable,
      demoUrlsMissing: result.demoUrlsMissing,
      demosArchived: result.demosArchived,
      errors: result.errors,
    };
  },
});

/**
 * Fetch CS2 match share codes using Steam Web API.
 * This action only fetches share codes - the demo URLs must be fetched
 * separately via the Next.js API route which connects to the Steam GC.
 * 
 * If knownCode is not provided, it will try to use the latest saved share code.
 */
export const fetchMatchShareCodes = action({
  args: {
    targetSteamId: v.string(), // Steam ID64 or vanity URL
    authCode: v.string(), // CS2 Authentication Code from target user
    knownCode: v.optional(v.string()), // Starting share code (optional if we have saved matches)
    maxMatches: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    steamId: v.optional(v.string()),
    shareCodes: v.optional(v.array(v.string())),
    usedKnownCode: v.optional(v.string()), // The share code that was used as starting point
  }),
  handler: async (ctx, args) => {
    // Get Steam API key from environment variable
    const steamApiKey = process.env.STEAM_API_KEY;
    
    if (!steamApiKey) {
      return { 
        success: false, 
        error: 'Steam API key not configured. Set STEAM_API_KEY environment variable.' 
      };
    }
    
    const maxMatches = args.maxMatches || 8;
    
    // Resolve vanity URL if needed
    let targetSteamId = args.targetSteamId;
    
    if (!isSteamId64(args.targetSteamId)) {
      console.log('Resolving vanity URL:', args.targetSteamId);
      const resolvedId = await resolveVanityUrl(args.targetSteamId, steamApiKey);
      
      if (!resolvedId) {
        return { 
          success: false, 
          error: `Could not resolve vanity URL "${args.targetSteamId}" to a Steam ID.` 
        };
      }
      
      targetSteamId = resolvedId;
      console.log('Resolved to Steam ID64:', targetSteamId);
    }
    
    // Determine the starting share code
    let knownCode: string | undefined = args.knownCode;
    
    if (!knownCode) {
      // Try to get the latest saved share code from the database
      console.log('No knownCode provided, checking for saved matches...');
      const latestShareCode: string | null = await ctx.runQuery(
        internal.cs2Actions.getLatestShareCodeForSteamId,
        { steamId: targetSteamId }
      );
      
      if (latestShareCode) {
        console.log('Using latest saved share code:', latestShareCode);
        knownCode = latestShareCode;
      } else {
        return { 
          success: false, 
          error: 'No starting share code provided and no saved matches found. Please provide a share code to start from.',
          steamId: targetSteamId,
        };
      }
    }
    
    // At this point knownCode is guaranteed to be a string
    const startingCode: string = knownCode;
    
    // Get share codes using Steam Web API
    console.log('Fetching match sharing codes starting from:', startingCode);
    const shareCodesResult = await getMatchSharingCodes(
      targetSteamId, 
      args.authCode, 
      steamApiKey, 
      startingCode, 
      maxMatches
    );
    
    if (shareCodesResult.error) {
      return { 
        success: false, 
        error: shareCodesResult.error,
        steamId: targetSteamId,
      };
    }
    
    // The startingCode is just a cursor/starting point - only return NEW matches after it
    // Never include the starting code itself to avoid re-fetching matches we already have
    const shareCodes: string[] = shareCodesResult.shareCodes;
    
    console.log(`Found ${shareCodes.length} new share codes after ${startingCode}`);
    
    return {
      success: true,
      steamId: targetSteamId,
      shareCodes,
      usedKnownCode: startingCode,
    };
  },
});

/**
 * Save CS2 match results to the database.
 * Upserts based on shareCode - updates if exists, inserts if new.
 */
export const saveMatchResults = mutation({
  args: {
    targetSteamId: v.string(),
    matches: v.array(
      v.object({
        shareCode: v.string(),
        demoUrl: v.optional(v.string()),
        matchId: v.optional(v.string()),
        matchTime: v.optional(v.string()),
        // Match metadata from GC
        teamScores: v.optional(v.array(v.number())),
        matchResult: v.optional(v.number()),
        targetPlayerTeam: v.optional(v.number()),
        playerStats: v.optional(v.object({
          kills: v.number(),
          deaths: v.number(),
          assists: v.number(),
          headshots: v.number(),
          mvps: v.number(),
          score: v.number(),
        })),
      })
    ),
  },
  returns: v.object({
    success: v.boolean(),
    saved: v.number(),
    updated: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, saved: 0, updated: 0, error: "Not authenticated" };
    }

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return { success: false, saved: 0, updated: 0, error: "User not found" };
    }

    let saved = 0;
    let updated = 0;
    const now = Date.now();

    for (const match of args.matches) {
      // Check if this match already exists (by shareCode)
      const existing = await ctx.db
        .query("cs2Matches")
        .withIndex("by_shareCode", (q) => q.eq("shareCode", match.shareCode))
        .unique();

      if (existing) {
        // Update existing record
        await ctx.db.patch(existing._id, {
          demoUrl: match.demoUrl || existing.demoUrl,
          demoUrlStatus: match.demoUrl ? "available" : (existing.demoUrlStatus ?? "missing"),
          demoUrlLastAttemptAt: now,
          demoUrlError: match.demoUrl ? undefined : (existing.demoUrlError ?? "No demo URL returned"),
          matchId: match.matchId || existing.matchId,
          matchTime: match.matchTime || existing.matchTime,
          teamScores: match.teamScores || existing.teamScores,
          matchResult: match.matchResult ?? existing.matchResult,
          targetPlayerTeam: match.targetPlayerTeam ?? existing.targetPlayerTeam,
          playerStats: match.playerStats || existing.playerStats,
          fetchedAt: now,
        });
        updated++;
      } else {
        // Insert new record
        await ctx.db.insert("cs2Matches", {
          userId: user._id,
          steamId: args.targetSteamId,
          shareCode: match.shareCode,
          demoUrl: match.demoUrl,
          demoUrlStatus: match.demoUrl ? "available" : "missing",
          demoUrlLastAttemptAt: now,
          demoUrlError: match.demoUrl ? undefined : "No demo URL returned",
          matchId: match.matchId,
          matchTime: match.matchTime,
          teamScores: match.teamScores,
          matchResult: match.matchResult,
          targetPlayerTeam: match.targetPlayerTeam,
          playerStats: match.playerStats,
          fetchedAt: now,
        });
        saved++;
      }
    }

    return { success: true, saved, updated };
  },
});

/**
 * Get saved CS2 matches for a target Steam ID.
 */
export const getMatchesBySteamId = query({
  args: {
    targetSteamId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("cs2Matches"),
      shareCode: v.string(),
      demoUrl: v.optional(v.string()),
      demoUrlStatus: v.optional(v.union(v.literal("pending"), v.literal("available"), v.literal("missing"))),
      demoUrlLastAttemptAt: v.optional(v.number()),
      demoUrlError: v.optional(v.string()),
      archiveStatus: v.optional(v.union(v.literal("pending"), v.literal("archived"), v.literal("failed"))),
      archiveLastAttemptAt: v.optional(v.number()),
      archiveError: v.optional(v.string()),
      matchId: v.optional(v.string()),
      matchTime: v.optional(v.string()),
      fetchedAt: v.number(),
      s3ObjectKey: v.optional(v.string()),
      teamScores: v.optional(v.array(v.number())),
      matchResult: v.optional(v.number()),
      targetPlayerTeam: v.optional(v.number()),
      playerStats: v.optional(v.object({
        kills: v.number(),
        deaths: v.number(),
        assists: v.number(),
        headshots: v.number(),
        mvps: v.number(),
        score: v.number(),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("cs2Matches")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.targetSteamId))
      .collect();

    return matches.map((m) => ({
      _id: m._id,
      shareCode: m.shareCode,
      demoUrl: m.demoUrl,
      demoUrlStatus: m.demoUrlStatus,
      demoUrlLastAttemptAt: m.demoUrlLastAttemptAt,
      demoUrlError: m.demoUrlError,
      archiveStatus: m.archiveStatus,
      archiveLastAttemptAt: m.archiveLastAttemptAt,
      archiveError: m.archiveError,
      matchId: m.matchId,
      matchTime: m.matchTime,
      fetchedAt: m.fetchedAt,
      s3ObjectKey: m.s3ObjectKey,
      teamScores: m.teamScores,
      matchResult: m.matchResult,
      targetPlayerTeam: m.targetPlayerTeam,
      playerStats: m.playerStats,
    }));
  },
});

/**
 * Get the latest saved CS2 match for a target Steam ID.
 * Returns the match with the most recent matchTime (or fetchedAt if no matchTime).
 */
export const getLatestMatchBySteamId = query({
  args: {
    targetSteamId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("cs2Matches"),
      shareCode: v.string(),
      demoUrl: v.optional(v.string()),
      matchId: v.optional(v.string()),
      matchTime: v.optional(v.string()),
      fetchedAt: v.number(),
      s3ObjectKey: v.optional(v.string()),
      teamScores: v.optional(v.array(v.number())),
      matchResult: v.optional(v.number()),
      targetPlayerTeam: v.optional(v.number()),
      playerStats: v.optional(v.object({
        kills: v.number(),
        deaths: v.number(),
        assists: v.number(),
        headshots: v.number(),
        mvps: v.number(),
        score: v.number(),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("cs2Matches")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.targetSteamId))
      .collect();

    if (matches.length === 0) {
      return null;
    }

    // Sort by matchTime (descending), falling back to fetchedAt
    const sorted = matches.sort((a, b) => {
      const timeA = a.matchTime ? new Date(a.matchTime).getTime() : a.fetchedAt;
      const timeB = b.matchTime ? new Date(b.matchTime).getTime() : b.fetchedAt;
      return timeB - timeA;
    });

    const latest = sorted[0];
    return {
      _id: latest._id,
      shareCode: latest.shareCode,
      demoUrl: latest.demoUrl,
      matchId: latest.matchId,
      matchTime: latest.matchTime,
      fetchedAt: latest.fetchedAt,
      s3ObjectKey: latest.s3ObjectKey,
      teamScores: latest.teamScores,
      matchResult: latest.matchResult,
      targetPlayerTeam: latest.targetPlayerTeam,
      playerStats: latest.playerStats,
    };
  },
});

/**
 * Get all saved CS2 matches for the current user.
 */
export const getMyMatches = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("cs2Matches"),
      targetSteamId: v.string(),
      shareCode: v.string(),
      demoUrl: v.optional(v.string()),
      demoUrlStatus: v.optional(v.union(v.literal("pending"), v.literal("available"), v.literal("missing"))),
      demoUrlLastAttemptAt: v.optional(v.number()),
      demoUrlError: v.optional(v.string()),
      archiveStatus: v.optional(v.union(v.literal("pending"), v.literal("archived"), v.literal("failed"))),
      archiveLastAttemptAt: v.optional(v.number()),
      archiveError: v.optional(v.string()),
      matchId: v.optional(v.string()),
      matchTime: v.optional(v.string()),
      fetchedAt: v.number(),
      s3ObjectKey: v.optional(v.string()),
      teamScores: v.optional(v.array(v.number())),
      matchResult: v.optional(v.number()),
      targetPlayerTeam: v.optional(v.number()),
      playerStats: v.optional(v.object({
        kills: v.number(),
        deaths: v.number(),
        assists: v.number(),
        headshots: v.number(),
        mvps: v.number(),
        score: v.number(),
      })),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return [];

    const matches = await ctx.db
      .query("cs2Matches")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return matches.map((m) => ({
      _id: m._id,
      targetSteamId: m.steamId,
      shareCode: m.shareCode,
      demoUrl: m.demoUrl,
      demoUrlStatus: m.demoUrlStatus,
      demoUrlLastAttemptAt: m.demoUrlLastAttemptAt,
      demoUrlError: m.demoUrlError,
      archiveStatus: m.archiveStatus,
      archiveLastAttemptAt: m.archiveLastAttemptAt,
      archiveError: m.archiveError,
      matchId: m.matchId,
      matchTime: m.matchTime,
      fetchedAt: m.fetchedAt,
      s3ObjectKey: m.s3ObjectKey,
      teamScores: m.teamScores,
      matchResult: m.matchResult,
      targetPlayerTeam: m.targetPlayerTeam,
      playerStats: m.playerStats,
    }));
  },
});

// ==========================================
// S3 Demo Archiving Functions
// ==========================================

/**
 * Internal query to get matches pending download (for cron and manual trigger).
 * Returns matches where:
 * - demoUrl exists
 * - s3ObjectKey is undefined
 * - matchTime is within 30 days
 */
export const getMatchesPendingDownload = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("cs2Matches"),
      shareCode: v.string(),
      demoUrl: v.string(),
      matchTime: v.optional(v.string()),
      steamId: v.string(),
      teamScores: v.optional(v.array(v.number())),
      matchResult: v.optional(v.number()),
      targetPlayerTeam: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Get all matches - we'll filter in memory since we need multiple conditions
    const allMatches = await ctx.db.query("cs2Matches").collect();
    
    const pendingMatches = allMatches.filter((m) => {
      // Must have demoUrl
      if (!m.demoUrl) return false;
      
      // Must not already be archived
      if (m.s3ObjectKey) return false;
      
      // Must be within 30 days (if matchTime exists)
      if (m.matchTime) {
        const matchDate = new Date(m.matchTime).getTime();
        if (matchDate < thirtyDaysAgo) return false;
      }
      
      return true;
    });
    
    return pendingMatches.map((m) => ({
      _id: m._id,
      shareCode: m.shareCode,
      demoUrl: m.demoUrl!,
      matchTime: m.matchTime,
      steamId: m.steamId,
      teamScores: m.teamScores,
      matchResult: m.matchResult,
      targetPlayerTeam: m.targetPlayerTeam,
    }));
  },
});

/**
 * Internal mutation to update a match with its S3 object key.
 */
export const updateMatchS3Key = internalMutation({
  args: {
    matchId: v.id("cs2Matches"),
    s3ObjectKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.matchId, {
      s3ObjectKey: args.s3ObjectKey,
    });
    return null;
  },
});

/**
 * Generate a filename for the archived demo.
 * Format: {steamId}-{date}-{W|L}-{score}-{shareCodePrefix}.dem.bz2
 */
function generateDemoFilename(
  steamId: string,
  matchTime: string | undefined,
  teamScores: number[] | undefined,
  matchResult: number | undefined,
  targetPlayerTeam: number | undefined,
  shareCode: string
): string {
  // Get date part
  const date = matchTime 
    ? new Date(matchTime).toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];
  
  // Determine win/loss
  let winLoss = 'U'; // Unknown
  if (matchResult !== undefined && targetPlayerTeam !== undefined) {
    winLoss = matchResult === targetPlayerTeam ? 'W' : 'L';
  }
  
  // Get score string
  let scoreStr = '0-0';
  if (teamScores && teamScores.length === 2 && targetPlayerTeam !== undefined) {
    // Put the target player's team score first
    if (targetPlayerTeam === 1) {
      scoreStr = `${teamScores[0]}-${teamScores[1]}`;
    } else {
      scoreStr = `${teamScores[1]}-${teamScores[0]}`;
    }
  }
  
  // Get share code prefix (first segment)
  const shareCodePrefix = shareCode.replace('CSGO-', '').split('-')[0] || shareCode.substring(0, 5);
  
  return `${steamId}-${date}-${winLoss}-${scoreStr}-${shareCodePrefix}.dem.bz2`;
}

// Type for archive result (used by triggerDemoArchive)
type ArchiveResult = {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
};

// Type for trigger archive result
type TriggerArchiveResult = {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  error?: string;
};

/**
 * Public action to trigger demo archiving manually (from admin UI).
 * Validates user permissions before running.
 */
export const triggerDemoArchive = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    processed: v.number(),
    successful: v.number(),
    failed: v.number(),
    errors: v.array(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<TriggerArchiveResult> => {
    // Check if user is authenticated and has admin/owner permissions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { 
        success: false, 
        processed: 0, 
        successful: 0, 
        failed: 0, 
        errors: [], 
        error: 'Not authenticated' 
      };
    }
    
    // Get user and check permissions
    const user = await ctx.runQuery(api.auth.getMe, {});
    if (!user) {
      return { 
        success: false, 
        processed: 0, 
        successful: 0, 
        failed: 0, 
        errors: [], 
        error: 'User not found' 
      };
    }
    
    const permission = await ctx.runQuery(api.auth.getUserPermission, {});
    if (!permission || !['admin', 'owner'].includes(permission)) {
      return { 
        success: false, 
        processed: 0, 
        successful: 0, 
        failed: 0, 
        errors: [], 
        error: 'Insufficient permissions. Admin or owner role required.' 
      };
    }
    
    // Backwards-compatible alias for clients that still call the old action.
    const automation: ScheduledFetchResult = await ctx.runAction(
      internal.cs2Actions.fetchNewCounterStrikeGames,
      { maxMatches: 30 }
    );
    const result: ArchiveResult = {
      processed: automation.demoUrlsAvailable + automation.demoUrlsMissing,
      successful: automation.demosArchived,
      failed: automation.demoUrlsMissing + automation.errors.length,
      errors: automation.errors,
    };
    
    return {
      success: true,
      ...result,
    };
  },
});
