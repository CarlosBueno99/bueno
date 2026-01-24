import { action, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// --- Internal mutation to save refresh token (called from action) ---
export const saveSpotifyRefreshTokenInternal = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    refreshToken: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    // Find user by tokenIdentifier
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    
    if (!user) {
      return { success: false as const, error: "user_not_found" };
    }

    // Upsert website settings
    const existing = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { spotifyRefreshToken: args.refreshToken });
    } else {
      await ctx.db.insert("websiteSettings", {
        userId: user._id,
        spotifyRefreshToken: args.refreshToken,
      });
    }

    return { success: true as const };
  },
});

// --- Spotify OAuth Exchange (authenticated, saves token internally, never returns token) ---
export const exchangeSpotifyCodeForToken = action({
  args: { 
    code: v.string(),
    redirectUri: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args): Promise<{ success: true } | { success: false; error: string }> => {
    // 1. Verify the user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      return { success: false as const, error: "not_authenticated" };
    }

    // 2. Exchange code for tokens with Spotify (server-side only)
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = args.redirectUri;

    if (!clientId || !clientSecret || !redirectUri) {
      return { success: false as const, error: "spotify_not_configured" };
    }

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: args.code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.refresh_token) {
        return { success: false as const, error: "token_exchange_failed" };
      }

      // 3. Save the refresh token internally (token never leaves Convex)
      const saveResult = await ctx.runMutation(internal.spotifyActions.saveSpotifyRefreshTokenInternal, {
        tokenIdentifier: identity.tokenIdentifier,
        refreshToken: data.refresh_token,
      });

      if (!saveResult.success) {
        return { success: false as const, error: saveResult.error };
      }

      // 4. Return only success status - NEVER return the token
      return { success: true as const };
    } catch {
      return { success: false as const, error: "token_exchange_failed" };
    }
  },
});

// --- Internal Queries ---
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// --- Internal Actions ---
export const refreshSpotifyData = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<any> => {
    // Delegate to the unified logic in convex/spotify.ts
    return await ctx.runAction(internal.spotify.refreshSpotifyData, { userId: args.userId });
  },
});

export const refreshAllSpotifyData = internalAction({
  args: {},
  handler: async (ctx: any): Promise<void> => {
    // Dynamically find the user with 'owner' permission
    const mainUserId = await ctx.runQuery(internal.users.getOwnerUserId, {});
    
    if (!mainUserId) {
      return;
    }
    
    try {
      await ctx.runAction(
        internal.spotify.refreshSpotifyData,
        { userId: mainUserId }
      );
    } catch {
      // Silently handle refresh errors
    }
  },
});

// --- Public Actions ---
export const triggerSpotifyRefresh = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.spotifyActions.refreshSpotifyData, { userId: args.userId });
  },
});
