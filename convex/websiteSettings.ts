import { mutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

export const saveWebsiteSettings = mutation({
  args: {
    steamApiKey: v.optional(v.string()),
    steamId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    // Upsert website settings (create or update)
    const existing = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        steamApiKey: args.steamApiKey ?? existing.steamApiKey,
        steamId: args.steamId ?? existing.steamId,
      });
    } else {
      await ctx.db.insert("websiteSettings", {
        userId: user._id,
        steamApiKey: args.steamApiKey ?? "",
        steamId: args.steamId ?? "",
      });
    }
    return null;
  },
});

// Save CS2 settings to websiteSettings (partial update - only non-empty fields)
export const saveCs2Settings = mutation({
  args: {
    steamUsername: v.optional(v.string()),
    lastShareCode: v.optional(v.string()),
    shareCodeAuthToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    // Build update object - only update fields that are provided and not empty
    const updates: {
      cs2SteamUsername?: string;
      cs2LastShareCode?: string;
      cs2ShareCodeAuthToken?: string;
    } = {};

    // Only update if the value is provided and not an empty string
    if (args.steamUsername !== undefined && args.steamUsername !== "") {
      updates.cs2SteamUsername = args.steamUsername;
    }
    if (args.lastShareCode !== undefined && args.lastShareCode !== "") {
      updates.cs2LastShareCode = args.lastShareCode;
    }
    if (args.shareCodeAuthToken !== undefined && args.shareCodeAuthToken !== "") {
      updates.cs2ShareCodeAuthToken = args.shareCodeAuthToken;
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("websiteSettings", {
        userId: user._id,
        ...updates,
      });
    }

    return null;
  },
});

// Query to get current user's CS2 settings
export const getMyCs2Settings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      steamUsername: v.optional(v.string()),
      lastShareCode: v.optional(v.string()),
      shareCodeAuthToken: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const settings = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!settings) return null;

    return {
      steamUsername: settings.cs2SteamUsername,
      lastShareCode: settings.cs2LastShareCode,
      shareCodeAuthToken: settings.cs2ShareCodeAuthToken,
    };
  },
});

// Note: This mutation is kept for backwards compatibility but the preferred
// method is to use the Convex action exchangeSpotifyCodeForToken which handles
// the token exchange entirely server-side.
export const saveSpotifyRefreshToken = mutation({
  args: { refreshToken: v.string() },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false as const, error: "not_authenticated" };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      return { success: false as const, error: "user_not_found" };
    }
    const existing = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    try {
      if (existing) {
        await ctx.db.patch(existing._id, { spotifyRefreshToken: args.refreshToken });
      } else {
        await ctx.db.insert("websiteSettings", {
          userId: user._id,
          spotifyRefreshToken: args.refreshToken,
        });
      }
    } catch {
      return { success: false as const, error: "save_failed" };
    }
    return { success: true as const };
  },
});

export const getWebsiteSettings = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Public query to get current user's website settings (non-sensitive data only)
export const getMyWebsiteSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      steamId: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const settings = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!settings) return null;

    // Only return non-sensitive data - API keys should never be exposed to client
    return {
      steamId: settings.steamId,
    };
  },
});

// Query to check Spotify connection status (without exposing the token)
export const getSpotifyConnectionStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      isConnected: v.boolean(),
      lastDataUpdate: v.union(v.number(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    // Check if refresh token exists
    const settings = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const hasToken = !!(settings?.spotifyRefreshToken);

    // Get last data update from spotifyData
    const spotifyData = await ctx.db
      .query("spotifyData")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    return {
      isConnected: hasToken,
      lastDataUpdate: spotifyData?.lastUpdated ?? null,
    };
  },
}); 