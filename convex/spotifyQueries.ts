import { query } from "./_generated/server";
import { v } from "convex/values";

// Get Spotify data for the current user
export const getSpotifyData = query({
  args: {},
  returns: v.union(v.null(), v.object({
    _id: v.id("spotifyData"),
    _creationTime: v.number(),
    userId: v.id("users"),
    topArtists: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        genres: v.array(v.string()),
        popularity: v.number(),
        imageUrl: v.string(),
      })
    ),
    topGenres: v.array(
      v.object({
        name: v.string(),
        count: v.number(),
      })
    ),
    lastUpdated: v.number(),
  })),
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

    const spotifyData = await ctx.db
      .query("spotifyData")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!spotifyData) return null;
    return {
      _id: spotifyData._id,
      _creationTime: spotifyData._creationTime,
      userId: spotifyData.userId,
      lastUpdated: spotifyData.lastUpdated,
      topArtists: spotifyData.topArtists,
      topGenres: spotifyData.topGenres,
    };
  },
});

// Get Spotify data for any user - requires viewer permission
export const getUserSpotifyData = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.object({
    _id: v.id("spotifyData"),
    _creationTime: v.number(),
    userId: v.id("users"),
    topArtists: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        genres: v.array(v.string()),
        popularity: v.number(),
        imageUrl: v.string(),
      })
    ),
    topGenres: v.array(
      v.object({
        name: v.string(),
        count: v.number(),
      })
    ),
    lastUpdated: v.number(),
  })),
  handler: async (ctx, args) => {
    // Removed permission check for public access
    return await ctx.db
      .query("spotifyData")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
