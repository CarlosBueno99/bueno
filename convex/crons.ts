import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

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

// Archive CS2 demos to S3 every 30 minutes
crons.interval(
  "Archive CS2 demos to S3 every 30 minutes",
  { minutes: 30 },
  internal.cs2DemoArchiver.downloadPendingDemos
);

export default crons; 