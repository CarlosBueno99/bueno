import { action, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
      console.log(`Fetching match ${i + 1}...`);
      
      const response = await fetch(url);
      console.log(`Response status: ${response.status}`);
      
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
    
    // Only include the starting share code if it was provided by the user (not from DB)
    // This avoids re-fetching matches we already have
    const shareCodes: string[] = args.knownCode 
      ? [startingCode, ...shareCodesResult.shareCodes]
      : shareCodesResult.shareCodes;
    
    console.log(`Total share codes: ${shareCodes.length}`);
    
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
          matchId: match.matchId || existing.matchId,
          matchTime: match.matchTime || existing.matchTime,
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
          matchId: match.matchId,
          matchTime: match.matchTime,
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
      matchId: v.optional(v.string()),
      matchTime: v.optional(v.string()),
      fetchedAt: v.number(),
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
      matchId: m.matchId,
      matchTime: m.matchTime,
      fetchedAt: m.fetchedAt,
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
      matchId: v.optional(v.string()),
      matchTime: v.optional(v.string()),
      fetchedAt: v.number(),
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
      matchId: m.matchId,
      matchTime: m.matchTime,
      fetchedAt: m.fetchedAt,
    }));
  },
});
