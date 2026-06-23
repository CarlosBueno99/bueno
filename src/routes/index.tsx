import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useConvexAuth, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Navbar } from "../../components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { useEffect, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { LucidePlay, LucidePause } from "lucide-react";

// Add types for Spotify track data
interface SpotifyTrack {
  name: string;
  artists: string[];
  album: string;
  imageUrl: string;
  playedAt?: string;
}
interface CurrentlyPlaying {
  name: string;
  artists: string[];
  album: string;
  imageUrl: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

// Floating card for currently playing (or paused) track of the main user
function FloatingNowPlaying() {
  const getOwnerUserId = useAction(api.users.getOwnerUserIdAction);
  const getCurrentlyPlayingTrack = useAction(api.spotify.getCurrentlyPlayingTrack);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<any | null>(null);
  useEffect(() => {
    let isActive = true;
    async function fetchOwnerAndTrack() {
      const id = await getOwnerUserId({});
      if (!isActive || !id) return;
      setOwnerUserId(id);
      try {
        const result = await getCurrentlyPlayingTrack({ userId: id as Id<'users'> });
        setCurrentlyPlaying(result ?? null);
      } catch {
        setCurrentlyPlaying(null);
      }
    }
    fetchOwnerAndTrack();
    const interval = setInterval(fetchOwnerAndTrack, 10000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [getOwnerUserId, getCurrentlyPlayingTrack]);
  if (!currentlyPlaying) return null;
  const handleClick = () => {
    if (currentlyPlaying.id) {
      window.open(`https://open.spotify.com/track/${currentlyPlaying.id}`, "_blank");
    }
  };
  const clickable = Boolean(currentlyPlaying.id);
  return (
    <div
      className={`fixed z-50 bottom-6 right-6 max-w-xs w-[320px] bg-card border shadow-lg rounded-xl p-4 flex items-center gap-4 animate-fade-in transition hover:shadow-2xl ${clickable ? "cursor-pointer hover:bg-accent" : ""}`}
      onClick={clickable ? handleClick : undefined}
      title={clickable ? "Open in Spotify" : undefined}
    >
      {currentlyPlaying.isPlaying ? (
        <LucidePlay className="text-green-600 w-7 h-7 shrink-0" />
      ) : (
        <LucidePause className="text-red-600 w-7 h-7 shrink-0" />
      )}
      {currentlyPlaying.imageUrl && (
        <img src={currentlyPlaying.imageUrl} alt={currentlyPlaying.name} className="w-12 h-12 rounded-md object-cover shrink-0" />
      )}
      <div className="truncate">
        <div className="font-medium text-base truncate">{currentlyPlaying.name}</div>
        <div className="text-xs text-muted-foreground truncate">{currentlyPlaying.artists?.join(", ")}</div>
        <div className={currentlyPlaying.isPlaying ? "text-xs text-green-600" : "text-xs text-red-600"}>
          {currentlyPlaying.isPlaying ? "Playing" : "Paused"}
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { isAuthenticated } = useConvexAuth();
  const createUser = useMutation(api.auth.createUser);

  // When a user signs in, create their user record
  useEffect(() => {
    if (isAuthenticated) {
      createUser({});
    }
  }, [isAuthenticated, createUser]);

  try {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
          
          <DashboardContent />
        </main>
        <FloatingNowPlaying />
      </div>
    );
  } catch {
    return <div>Something went wrong. Please try again later.</div>;
  }
}

function DashboardContent() {
  const user = useQuery(api.auth.getMe);
  const steamData = useQuery(api.steamQueries.getSteamData);
  const spotifyData = useQuery(api.spotify.getSpotifyData);

  // Dynamically fetch the owner user id for fallback
  const getOwnerUserId = useAction(api.users.getOwnerUserIdAction);
  const [ownerUserId, setOwnerUserId] = useState<Id<'users'> | null>(null);
  useEffect(() => {
    getOwnerUserId({}).then((id) => setOwnerUserId(id ? id as Id<'users'> : null));
  }, [getOwnerUserId]);
  const mainSteamData = useQuery(api.steamQueries.getUserSteamData, ownerUserId ? { userId: ownerUserId } : "skip");
  const mainSpotifyData = useQuery(api.spotify.getUserSpotifyData, ownerUserId ? { userId: ownerUserId } : "skip");

  // --- Spotify: Last Songs Played and Currently Playing ---
  const spotifyUserId: Id<'users'> | undefined = user?._id ?? ownerUserId ?? undefined;
  const getCurrentlyPlayingTrack = useAction(api.spotify.getCurrentlyPlayingTrack);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlaying | null>(null);
  useEffect(() => {
    let isActive = true;
    async function fetchTrack() {
      if (!isActive || !spotifyUserId) return;
      try {
        const result = await getCurrentlyPlayingTrack({ userId: spotifyUserId });
        setCurrentlyPlaying(result ?? null);
      } catch {
        setCurrentlyPlaying(null);
      }
    }
    function onVisibilityChange() {
      isActive = !document.hidden;
      if (isActive) fetchTrack();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    fetchTrack();
    const interval = setInterval(fetchTrack, 10000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, [spotifyUserId, getCurrentlyPlayingTrack]);
  // --- End Spotify sections ---

  try {
    // If any of the queries are still loading, show a loading state
    if (
      user === undefined ||
      steamData === undefined ||
      spotifyData === undefined ||
      mainSteamData === undefined ||
      mainSpotifyData === undefined
    ) {
      return <div className="animate-pulse">Loading data...</div>;
    }

    // Use fallback if not authenticated or if no data for current user
    const showMainSteam = !user || !steamData;
    const showMainSpotify = !user || !spotifyData;

    return (
      <div className="space-y-6">
        {/* Steam Section */}
        {showMainSteam && !mainSteamData && (
          <Alert>
            <AlertTitle>No Steam data available</AlertTitle>
            <AlertDescription>
              Connect your Steam account to see your gaming stats.
            </AlertDescription>
          </Alert>
        )}
        {(showMainSteam ? mainSteamData : steamData) && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Recent Games</CardTitle>
                <CardDescription>
                  Last updated {formatDistanceToNow((showMainSteam ? mainSteamData! : steamData!).lastUpdated)} ago
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(showMainSteam ? mainSteamData! : steamData!).recentGames.map((game) => (
                    <div 
                      key={game.appId} 
                      className="flex items-center p-3 rounded-md border bg-card text-card-foreground"
                    >
                      <div className="aspect-[2/1] w-32 mr-3 rounded-md overflow-hidden bg-muted">
                        <img
                          src={game.headerImageUrl}
                          alt={game.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div>
                        <h3 className="font-medium">{game.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {Math.round(game.playtime2Weeks / 60)} hrs last 2 weeks
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(game.playtimeForever / 60)} hrs total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {(showMainSteam ? mainSteamData! : steamData!)?.csStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Counter-Strike Stats</CardTitle>
                  <CardDescription>
                    Last updated {formatDistanceToNow((showMainSteam ? mainSteamData! : steamData!).lastUpdated)} ago
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Total Kills</p>
                      <p className="text-2xl font-bold">{(showMainSteam ? mainSteamData! : steamData!)?.csStats?.kills?.toLocaleString?.() ?? "-"}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Total Deaths</p>
                      <p className="text-2xl font-bold">{(showMainSteam ? mainSteamData! : steamData!)?.csStats?.deaths?.toLocaleString?.() ?? "-"}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Total Time</p>
                      <p className="text-2xl font-bold">{Math.round(((showMainSteam ? mainSteamData! : steamData!)?.csStats?.timePlayed ?? 0) / 3600)} hrs</p>
                    </div>
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Total Wins</p>
                      <p className="text-2xl font-bold">{(showMainSteam ? mainSteamData! : steamData!)?.csStats?.wins?.toLocaleString?.() ?? "-"}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-md col-span-2 md:col-span-4">
                      <p className="text-sm text-muted-foreground">K/D Ratio</p>
                      <p className="text-2xl font-bold">
                        {(() => {
                          const csStats = (showMainSteam ? mainSteamData! : steamData!)?.csStats;
                          if (!csStats) return "-";
                          return (csStats.kills / Math.max(1, csStats.deaths)).toFixed(2);
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
        {/* Spotify Section */}
        {showMainSpotify && !mainSpotifyData && (
          <Alert>
            <AlertTitle>No Spotify data available</AlertTitle>
            <AlertDescription>
              Connect your Spotify account to see your music stats.
            </AlertDescription>
          </Alert>
        )}
        {(showMainSpotify ? mainSpotifyData : spotifyData) && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Top Artists</CardTitle>
                <CardDescription>
                  Last updated {formatDistanceToNow((showMainSpotify ? mainSpotifyData! : spotifyData!).lastUpdated)} ago
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {(showMainSpotify ? mainSpotifyData! : spotifyData!).topArtists.map((artist) => (
                    <div 
                      key={artist.id} 
                      className="flex flex-col items-center p-3 rounded-md border bg-card text-card-foreground"
                    >
                      <img 
                        src={artist.imageUrl} 
                        alt={artist.name} 
                        className="w-24 h-24 rounded-md mb-3" 
                      />
                      <h3 className="font-medium text-center">{artist.name}</h3>
                      <p className="text-xs text-muted-foreground text-center">
                        {artist.genres.slice(0, 2).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Genres</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {(showMainSpotify ? mainSpotifyData! : spotifyData!).topGenres.map((genre) => (
                    <div 
                      key={genre.name} 
                      className="p-4 bg-muted rounded-md flex flex-col items-center justify-center"
                    >
                      <p className="text-lg font-medium text-center">{genre.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {genre.count} artist{genre.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* --- Last Songs Played Section --- */}
            <Card>
              <CardHeader>
                <CardTitle>Last Songs Played</CardTitle>
              </CardHeader>
              <CardContent>
                {(showMainSpotify ? mainSpotifyData! : spotifyData!).recentlyPlayedTracks && (showMainSpotify ? mainSpotifyData! : spotifyData!).recentlyPlayedTracks.length > 0 ? (
                  <ul className="space-y-2">
                    {(showMainSpotify ? mainSpotifyData! : spotifyData!).recentlyPlayedTracks.map((track: SpotifyTrack, i: number) => (
                      <li key={i} className="flex items-center gap-3">
                        <img src={track.imageUrl} alt={track.name} className="w-10 h-10 rounded-md" />
                        <div>
                          <div className="font-medium">{track.name}</div>
                          <div className="text-xs text-muted-foreground">{track.artists.join(", ")}</div>
                          <div className="text-xs text-muted-foreground">{track.album}</div>
                          <div className="text-xs text-muted-foreground">{track.playedAt ? new Date(track.playedAt).toLocaleTimeString() : ""}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground">No recent songs found.</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  } catch {
    return <div>Something went wrong loading your dashboard.</div>;
  }
}

export const Route = createFileRoute('/')({
  component: Home,
})
