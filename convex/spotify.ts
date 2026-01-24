import { action, query, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// --- Centralized Token Refresh Helper ---
async function getSpotifyAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || "<YOUR_SPOTIFY_CLIENT_ID>";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "<YOUR_SPOTIFY_CLIENT_SECRET>";
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) return null;
    return data.access_token;
  } catch {
    return null;
  }
}

// --- Queries ---

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserSpotifyRefreshToken = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("websiteSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return settings?.spotifyRefreshToken ?? null;
  },
});

export const refreshSpotifyData = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const user = await ctx.runQuery(internal.spotifyActions.getUserById, { userId });
    if (!user) {
      return { success: false, error: "User not found" };
    }
    const refreshToken = await ctx.runQuery(internal.spotify.getUserSpotifyRefreshToken, { userId });
    if (!refreshToken) {
      return { success: false, error: "No Spotify refresh token found" };
    }
    const accessToken = await getSpotifyAccessToken(refreshToken);
    if (!accessToken) {
      return { success: false, error: "Failed to get access token" };
    }
    // Fetch top artists
    let topArtists: any[] = [];
    let topGenres: Record<string, number> = {};
    let recentlyPlayedTracks: any[] = [];
    try {
      const response: Response = await fetch("https://api.spotify.com/v1/me/top/artists?limit=10", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: any = await response.json();
      if (!response.ok || !data.items) {
        return { success: false, error: String(data.error?.message || "Failed to fetch top artists") };
      }
      topArtists = data.items.map((artist: any) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        imageUrl: artist.images[0]?.url || "",
      }));
      for (const artist of data.items) {
        for (const genre of artist.genres) {
          topGenres[genre] = (topGenres[genre] || 0) + 1;
        }
      }
    } catch (err: any) {
      return { success: false, error: "Failed to fetch top artists: " + (err instanceof Error ? err.message : String(err)) };
    }
    // Fetch recently played tracks
    try {
      const response = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=10", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (response.ok && data.items) {
        recentlyPlayedTracks = data.items.map((item: any) => ({
          name: item.track.name,
          artists: item.track.artists.map((a: any) => a.name),
          album: item.track.album.name,
          imageUrl: item.track.album.images[0]?.url,
          playedAt: item.played_at,
        }));
      }
    } catch {
      // Non-fatal: just skip if error
      recentlyPlayedTracks = [];
    }
    const topGenresArr = Object.entries(topGenres)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 5);
    try {
      await ctx.runMutation(internal._internal.spotifyData.storeSpotifyData, {
        userId,
        topArtists,
        topGenres: topGenresArr,
        lastUpdated: Date.now(),
        recentlyPlayedTracks: recentlyPlayedTracks ?? [],
      });
    } catch (err: any) {
      return { success: false, error: "Failed to save Spotify data: " + (err instanceof Error ? err.message : String(err)) };
    }
    return { success: true };
  },
});

export const triggerSpotifyRefresh = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.spotifyActions.refreshSpotifyData, { userId: args.userId });
  },
});

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
    recentlyPlayedTracks: v.array(
      v.object({
        name: v.string(),
        artists: v.array(v.string()),
        album: v.string(),
        imageUrl: v.string(),
        playedAt: v.string(),
      })
    ),
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
      recentlyPlayedTracks: spotifyData.recentlyPlayedTracks ?? [],
    };
  },
});

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
    recentlyPlayedTracks: v.array(
      v.object({
        name: v.string(),
        artists: v.array(v.string()),
        album: v.string(),
        imageUrl: v.string(),
        playedAt: v.string(),
      })
    ),
  })),
  handler: async (ctx, args) => {
    const spotifyData = await ctx.db
      .query("spotifyData")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!spotifyData) return null;
    return {
      _id: spotifyData._id,
      _creationTime: spotifyData._creationTime,
      userId: spotifyData.userId,
      lastUpdated: spotifyData.lastUpdated,
      topArtists: spotifyData.topArtists,
      topGenres: spotifyData.topGenres,
      recentlyPlayedTracks: spotifyData.recentlyPlayedTracks ?? [],
    };
  },
});

export const getCurrentlyPlayingTrack = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const refreshToken = await ctx.runQuery(internal.spotify.getUserSpotifyRefreshToken, { userId: args.userId });
    if (!refreshToken) {
      return null;
    }
    const accessToken = await getSpotifyAccessToken(refreshToken);
    if (!accessToken) {
      return null;
    }
    const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 204) {
      return null; // No track currently playing
    }
    const data = await response.json();
    if (!response.ok || !data.item) {
      return null;
    }
    return {
      id: data.item.id,
      name: data.item.name,
      artists: data.item.artists.map((a: any) => a.name),
      album: data.item.album.name,
      imageUrl: data.item.album.images[0]?.url,
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
    };
  },
}); 