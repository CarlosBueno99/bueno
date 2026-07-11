import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();



crons.interval(
  "Refresh Spotify data for all users every 10 minutes",
  { minutes: 10 },
  internal.spotifyActions.refreshAllSpotifyData
);

// Add a cron to refresh Steam data every hour for the main user
crons.interval(
  "Refresh Steam data for main user every 1 hour",
  { hours: 1 },
  internal.steamApi.refreshMainUserSteamData
);

// Fetch new CS2 match share codes every 30 minutes
crons.interval(
  "Fetch new Counter-Strike games every 30 minutes",
  { minutes: 30 },
  internal.cs2Actions.fetchNewCounterStrikeGames,
  {}
);

export default crons;
