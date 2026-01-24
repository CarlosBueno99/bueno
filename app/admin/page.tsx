"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "../../components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import { useEffect, useState, Suspense } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Id } from "../../convex/_generated/dataModel";
import { Badge } from "../../components/ui/badge";
import { formatDistanceToNow } from "date-fns";

function AdminPage() {
  const router = useRouter();
  const user = useQuery(api.auth.getMe);
  const permission = useQuery(api.auth.getUserPermission);
  const updateUserPermission = useMutation(api.auth.updateUserPermission);
  const searchParams = useSearchParams();
  const triggerSpotifyRefresh = useAction(api.spotify.triggerSpotifyRefresh);
  const fetchMatchShareCodes = useAction(api.cs2Actions.fetchMatchShareCodes);
  const saveMatchResults = useMutation(api.cs2Actions.saveMatchResults);

  const [email, setEmail] = useState("");
  const [newPermission, setNewPermission] = useState("viewer");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // CS2 Demo state
  const [shareCode, setShareCode] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [cs2Loading, setCs2Loading] = useState(false);
  const [cs2Error, setCs2Error] = useState("");
  
  // CS2 Recent Matches state
  const [newlyFetchedMatches, setNewlyFetchedMatches] = useState<any[]>([]); // Matches just fetched
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [targetSteamId, setTargetSteamId] = useState("");
  const [authCode, setAuthCode] = useState(""); // CS2 Authentication Code for GetNextMatchSharingCode API
  const [knownCode, setKnownCode] = useState(""); // Starting share code to get matches after
  
  // Get Steam settings from Convex
  const websiteSettings = useQuery(api.websiteSettings.getMyWebsiteSettings);
  
  // Get Spotify connection status
  const spotifyStatus = useQuery(api.websiteSettings.getSpotifyConnectionStatus);
  
  // Get saved matches from Convex
  const savedMatches = useQuery(api.cs2Actions.getMyMatches);
  
  // Check if user has at least admin permissions
  useEffect(() => {
    if (permission === null && user) {
      // User is logged in but has no permissions, redirect to home
      router.push("/");
    }
  }, [permission, user, router]);

  useEffect(() => {
    if (searchParams.get("spotify") === "connected") {
      setSuccessMessage("Spotify connected successfully! Your token is up to date.");
      // Immediately refresh Spotify data for the current user
      if (user?._id) {
        triggerSpotifyRefresh({ userId: user._id });
      }
      // Optionally, remove the query param from the URL
      router.replace("/admin", { scroll: false });
    }
  }, [searchParams, router, user?._id, triggerSpotifyRefresh]);

  // If still loading or not authenticated, show loading state
  if (!user || !permission) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow w-full max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <p>Loading...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Check if has at least admin permission
  if (!["admin", "owner"].includes(permission)) {
    router.push("/");
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow w-full max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <p>You need admin permissions to view this page.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleUpdatePermission = async () => {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      
      // This is a simplified example - in a real implementation, you would:
      // 1. Find the user by email
      // 2. Get their ID
      // 3. Update their permission
      
      // For this demo, let's assume we have the user ID already
      const targetUserId = "user123" as Id<"users">;
      
      await updateUserPermission({
        userId: targetUserId,
        role: newPermission
      });
      
      setSuccessMessage(`Successfully updated user permission to ${newPermission}`);
      setEmail("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
    }
  };

  const handleFetchDemoUrl = async () => {
    if (!shareCode) {
      setCs2Error("Please enter a share code.");
      return;
    }

    setCs2Loading(true);
    setCs2Error("");
    setDemoUrl("");

    try {
      // Only send shareCode - Steam credentials are read from server-side env vars
      const response = await fetch(`/api/cs/download?shareCode=${encodeURIComponent(shareCode)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch demo URL");
      }

      if (data.demoUrl) {
        setDemoUrl(data.demoUrl);
      } else {
        throw new Error("No demo URL returned");
      }
    } catch (error) {
      setCs2Error(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setCs2Loading(false);
    }
  };

  const handleFetchRecentMatches = async () => {
    const effectiveTargetId = targetSteamId || websiteSettings?.steamId;
    if (!effectiveTargetId) {
      setMatchesError("Please enter a Steam ID64 or vanity URL, or save your Steam ID in settings.");
      return;
    }

    if (!authCode) {
      setMatchesError("Please enter your CS2 Authentication Code. Find it in CS2: Settings -> Game -> Authentication Code.");
      return;
    }

    setMatchesLoading(true);
    setMatchesError("");
    setNewlyFetchedMatches([]);

    try {
      // Step 1: Get share codes via Convex action (uses Steam Web API)
      // knownCode is optional - if not provided, will use latest saved match
      const shareCodesResult = await fetchMatchShareCodes({
        targetSteamId: effectiveTargetId,
        authCode,
        ...(knownCode && { knownCode }),
        maxMatches: 30,
      });

      if (!shareCodesResult.success) {
        throw new Error(shareCodesResult.error || "Failed to fetch share codes");
      }

      if (!shareCodesResult.shareCodes || shareCodesResult.shareCodes.length === 0) {
        setMatchesError("No share codes found.");
        return;
      }

      // Step 2: Get demo URLs via Next.js API route (uses Steam GC)
      const response = await fetch(`/api/cs/matches?shareCodes=${shareCodesResult.shareCodes.join(',')}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch demo URLs");
      }

      if (data.matches && data.matches.length > 0) {
        setNewlyFetchedMatches(data.matches);

        // Step 3: Save results to Convex
        const saveResult = await saveMatchResults({
          targetSteamId: shareCodesResult.steamId || effectiveTargetId,
          matches: data.matches.map((m: any) => ({
            shareCode: m.shareCode,
            demoUrl: m.demoUrl || undefined,
            matchId: m.matchId || undefined,
            matchTime: m.matchTime || undefined,
          })),
        });

        if (saveResult.success) {
          // Clear newly fetched after saving (they'll appear in savedMatches)
          setTimeout(() => setNewlyFetchedMatches([]), 2000);
        }
      } else {
        setMatchesError("No new matches found.");
      }
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setMatchesLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage User Permissions</CardTitle>
              <CardDescription>Change a user's permission level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">User Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="permission" className="text-sm font-medium">New Permission Level</label>
                  <select
                    id="permission"
                    value={newPermission}
                    onChange={(e) => setNewPermission(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    {permission === "owner" && <option value="owner">Owner</option>}
                  </select>
                </div>
                
                {errorMessage && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {errorMessage}
                  </div>
                )}
                
                {successMessage && (
                  <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">
                    {successMessage}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleUpdatePermission}
                disabled={!email}
              >
                Update Permission
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Administrative Control</CardTitle>
              <CardDescription>Your current permission level: {permission}</CardDescription>
            </CardHeader>
            <CardContent>
              <p>As an administrator, you can:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Change user permission levels</li>
                <li>Manage system settings</li>
                <li>Monitor site activity</li>
                <li>Configure security policies</li>
              </ul>
              
              <div className="mt-6">
                <p className="font-medium">Permission hierarchy:</p>
                <div className="flex flex-col gap-2 mt-2">
                  <Badge variant="outline" className="justify-start">Viewer - Basic read access</Badge>
                  <Badge variant="outline" className="justify-start">Editor - Content management</Badge>
                  <Badge variant="secondary" className="justify-start">Admin - System administration (You are here)</Badge>
                  <Badge variant="outline" className="justify-start">Owner - Full system control</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Spotify Connect Card */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Spotify Integration</CardTitle>
                  <CardDescription>
                    Connect your admin account to Spotify to enable site-wide Spotify features.
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {spotifyStatus === undefined ? (
                    <Badge variant="secondary" className="bg-gray-400 text-white">Loading...</Badge>
                  ) : spotifyStatus === null ? (
                    <Badge variant="secondary" className="bg-gray-400 text-white">Unknown</Badge>
                  ) : spotifyStatus.isConnected ? (
                    <Badge className="bg-green-600">Connected</Badge>
                  ) : (
                    <Badge variant="destructive">Not Connected</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {spotifyStatus === undefined ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Checking Spotify connection...</p>
                  </div>
                </div>
              ) : spotifyStatus === null ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Unable to check connection status</p>
                      <p className="text-xs text-gray-500">Please sign in to check Spotify status</p>
                    </div>
                  </div>
                </div>
              ) : spotifyStatus.isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Spotify is connected</p>
                      {spotifyStatus.lastDataUpdate && (
                        <p className="text-xs text-green-600">
                          Last synced {formatDistanceToNow(spotifyStatus.lastDataUpdate)} ago
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (user?._id) {
                          triggerSpotifyRefresh({ userId: user._id });
                          setSuccessMessage("Refreshing Spotify data...");
                        }
                      }}
                    >
                      Refresh Data Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "<YOUR_SPOTIFY_CLIENT_ID>";
                        const redirectUri = encodeURIComponent(`${window.location.origin}/api/spotify-callback`);
                        const scopes = encodeURIComponent("user-top-read user-read-email user-read-recently-played user-read-currently-playing");
                        window.location.href =
                          `https://accounts.spotify.com/authorize?client_id=${clientId}` +
                          `&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}`;
                      }}
                    >
                      Reconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-red-800">Spotify is not connected</p>
                      <p className="text-xs text-red-600">
                        Connect your Spotify account to enable music features
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "<YOUR_SPOTIFY_CLIENT_ID>";
                      const redirectUri = encodeURIComponent(`${window.location.origin}/api/spotify-callback`);
                      const scopes = encodeURIComponent("user-top-read user-read-email user-read-recently-played user-read-currently-playing");
                      window.location.href =
                        `https://accounts.spotify.com/authorize?client_id=${clientId}` +
                        `&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}`;
                    }}
                  >
                    Connect to Spotify
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CS2 Demo Lookup Card */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>CS2 Demo Lookup</CardTitle>
              <CardDescription>
                Paste a CS2 match share code to get the demo download link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="shareCode" className="text-sm font-medium">Share Code</label>
                  <Input
                    id="shareCode"
                    type="text"
                    placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
                    value={shareCode}
                    onChange={(e) => setShareCode(e.target.value)}
                  />
                </div>

                {cs2Error && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {cs2Error}
                  </div>
                )}

                {demoUrl && (
                  <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">
                    <p className="font-medium mb-2">Demo Download Link:</p>
                    <a 
                      href={demoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {demoUrl}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleFetchDemoUrl}
                disabled={cs2Loading || !shareCode}
              >
                {cs2Loading ? "Fetching Demo URL..." : "Get Demo Link"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* CS2 Recent Matches Card */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>CS2 Match History</CardTitle>
              <CardDescription>
                View and fetch CS2 matches with demo download links. Saved matches are shown below. Click "Fetch New Matches" to get the latest matches since the last fetch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="targetSteamId" className="text-sm font-medium">Target Steam ID or Vanity URL</label>
                    <Input
                      id="targetSteamId"
                      type="text"
                      placeholder={websiteSettings?.steamId || "76561198xxxxxxxxx or vanity URL"}
                      value={targetSteamId}
                      onChange={(e) => setTargetSteamId(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Steam ID64 or vanity URL. Leave empty to use your saved Steam ID: {websiteSettings?.steamId || '(not set)'}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="authCode" className="text-sm font-medium">CS2 Authentication Code</label>
                    <Input
                      id="authCode"
                      type="text"
                      placeholder="XXXX-XXXXX-XXXX"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Find in CS2: Settings → Game → Authentication Code
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="knownCode" className="text-sm font-medium">Starting Share Code <span className="text-gray-400 font-normal">(optional)</span></label>
                  <Input
                    id="knownCode"
                    type="text"
                    placeholder="Leave empty to continue from last saved match"
                    value={knownCode}
                    onChange={(e) => setKnownCode(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    A share code to start from. The API will return matches <strong>after</strong> this code chronologically. 
                    You can get this from a recent match in your match history.
                  </p>
                </div>
                
                
                {matchesError && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {matchesError}
                  </div>
                )}

                {/* Newly fetched matches (temporary display) */}
                {newlyFetchedMatches.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="font-medium text-sm text-green-700 mb-2">
                      ✓ Fetched {newlyFetchedMatches.length} new matches! Saving...
                    </p>
                  </div>
                )}

                {/* Saved matches from database */}
                {savedMatches && savedMatches.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-600">
                        {savedMatches.length} saved matches ({savedMatches.filter(m => m.demoUrl).length} with demo links)
                      </p>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {[...savedMatches]
                        .sort((a, b) => {
                          // Sort by matchTime descending (newest first)
                          const timeA = a.matchTime ? new Date(a.matchTime).getTime() : 0;
                          const timeB = b.matchTime ? new Date(b.matchTime).getTime() : 0;
                          return timeB - timeA;
                        })
                        .map((match, idx) => {
                          // Check if match is older than 30 days
                          const matchDate = match.matchTime ? new Date(match.matchTime) : null;
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          const isExpired = matchDate && matchDate < thirtyDaysAgo;
                          
                          return (
                            <div 
                              key={match.shareCode || match.matchId || idx} 
                              className="p-3 bg-gray-50 rounded-md border"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {match.matchTime ? (
                                      <>
                                        {new Date(match.matchTime).toLocaleDateString()} {new Date(match.matchTime).toLocaleTimeString()}
                                      </>
                                    ) : (
                                      `Match #${idx + 1}`
                                    )}
                                  </span>
                                  {match.demoUrl ? (
                                    isExpired ? (
                                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Expired Demo</Badge>
                                    ) : (
                                      <Badge variant="default" className="bg-green-600">Demo Available</Badge>
                                    )
                                  ) : (
                                    <Badge variant="secondary">No Demo</Badge>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 font-mono">
                                  {match.shareCode}
                                </span>
                                {match.targetSteamId && (
                                  <span className="text-xs text-gray-400">
                                    Steam ID: {match.targetSteamId}
                                  </span>
                                )}
                                {match.demoUrl && (
                                  <a 
                                    href={match.demoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-sm break-all mt-1"
                                  >
                                    Download Demo
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-md text-center text-gray-500 text-sm">
                    No saved matches yet. Enter your credentials above and click "Fetch New Matches" to get started.
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2">
              {!authCode && (
                <p className="text-xs text-yellow-600">
                  Enter the target user's CS2 Authentication Code to fetch new matches.
                </p>
              )}
              <Button 
                onClick={handleFetchRecentMatches}
                disabled={matchesLoading || !authCode || (!targetSteamId && !websiteSettings?.steamId)}
              >
                {matchesLoading ? "Fetching..." : savedMatches && savedMatches.length > 0 ? "Fetch New Matches" : "Fetch Matches"}
              </Button>
              <p className="text-xs text-gray-500">
                {savedMatches && savedMatches.length > 0 
                  ? "Will fetch matches newer than the latest saved match."
                  : "First fetch requires a starting share code."}
              </p>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}

// Suspense wrapper for AdminPage
export default function AdminPageWrapper() {
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
} 