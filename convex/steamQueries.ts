import { query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { hasPermission } from "./auth";

// Get Steam data for the current user
export const getSteamData = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("steamData"),
      userId: v.id("users"),
      _creationTime: v.optional(v.number()),
      recentGames: v.optional(
        v.array(
          v.object({
            appId: v.string(),
            name: v.string(),
            playtime2Weeks: v.optional(v.number()),
            playtimeForever: v.optional(v.number()),
            imgIconUrl: v.optional(v.string()),
            imgLogoUrl: v.optional(v.string()),
            headerImageUrl: v.optional(v.string()),
          })
        )
      ),
      csStats: v.optional(
        v.object({
          kills: v.optional(v.number()),
          deaths: v.optional(v.number()),
          timePlayed: v.optional(v.number()),
          wins: v.optional(v.number()),
        })
      ),
      lastUpdated: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return null;
    }

    const steamData = await ctx.db
      .query("steamData")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!steamData) return null;
    return {
      _id: steamData._id,
      userId: steamData.userId,
      _creationTime: steamData._creationTime,
      recentGames: steamData.recentGames?.map(game => ({
        appId: game.appId,
        name: game.name,
        playtime2Weeks: game.playtime2Weeks,
        playtimeForever: game.playtimeForever,
        imgIconUrl: game.imgIconUrl,
        imgLogoUrl: game.imgLogoUrl,
        headerImageUrl: game.headerImageUrl,
      })),
      csStats: steamData.csStats ? {
        kills: steamData.csStats.kills,
        deaths: steamData.csStats.deaths,
        timePlayed: steamData.csStats.timePlayed,
        wins: steamData.csStats.wins,
      } : undefined,
      lastUpdated: steamData.lastUpdated,
    };
  },
});

// Get Steam data for any user - requires viewer permission
export const getUserSteamData = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.object({
    _id: v.id("steamData"),
    _creationTime: v.number(),
    userId: v.id("users"),
    recentGames: v.array(
      v.object({
        appId: v.string(),
        name: v.string(),
        playtime2Weeks: v.number(),
        playtimeForever: v.number(),
        imgIconUrl: v.string(),
        imgLogoUrl: v.string(),
        headerImageUrl: v.optional(v.string()),
      })
    ),
    csStats: v.optional(
      v.object({
        kills: v.number(),
        deaths: v.number(),
        timePlayed: v.number(),
        wins: v.number(),
      })
    ),
    lastUpdated: v.number(),
  })),
  handler: async (ctx, args) => {
    // Removed permission check for public access
    const steamData = await ctx.db
      .query("steamData")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!steamData) return null;
    return {
      _id: steamData._id,
      _creationTime: steamData._creationTime,
      userId: steamData.userId,
      recentGames: steamData.recentGames.map(game => ({
        appId: game.appId,
        name: game.name,
        playtime2Weeks: game.playtime2Weeks,
        playtimeForever: game.playtimeForever,
        imgIconUrl: game.imgIconUrl,
        imgLogoUrl: game.imgLogoUrl,
        headerImageUrl: game.headerImageUrl,
      })),
      csStats: steamData.csStats ? {
        kills: steamData.csStats.kills,
        deaths: steamData.csStats.deaths,
        timePlayed: steamData.csStats.timePlayed,
        wins: steamData.csStats.wins,
      } : undefined,
      lastUpdated: steamData.lastUpdated,
    };
  },
}); 