"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Navbar } from "../../components/Navbar";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// Dynamically import MapContainer and related components to avoid SSR issues
const MapContainer: any = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer: any = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const Marker: any = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });
const Popup: any = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });
const useMap: any = dynamic(() => import("react-leaflet").then(mod => mod.useMap), { ssr: false });

// ChangeView component to handle map center updates
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

function extractCoordinatesFromAppleMapsUrl(url: string) {
  try {
    const match = url.match(/[?&](q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      return {
        latitude: parseFloat(match[2]),
        longitude: parseFloat(match[3]),
      };
    }
    return null;
  } catch (error) {
    console.error("Error parsing Apple Maps URL:", error);
    return null;
  }
}

export default function LocationHistoryPage() {
  const user = useQuery(api.auth.getMe);
  const permission = useQuery(api.auth.getUserPermission);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchError, setSearchError] = useState("");
  const [currentLocation, setCurrentLocation] = useState<any | null>(null);
  const getOwnerUserId = useAction(api.users.getOwnerUserIdAction);
  const [ownerId, setOwnerId] = useState<Id<'users'> | null>(null);

  // Find the owner userId for fallback
  useEffect(() => {
    if (permission && user) {
      if (["relatives", "owner"].includes(permission)) {
        // If user is owner, use their own id as ownerId
        if (permission === "owner") {
          setOwnerId(user._id);
        } else {
          // Otherwise, fetch the owner from Convex action
          getOwnerUserId({}).then((id) => setOwnerId(id ? id as Id<'users'> : null));
        }
      }
    }
  }, [permission, user, getOwnerUserId]);

  // Use the logged-in user's _id if they have permission
  const userHasPermission = user && typeof permission === "string" && ["relatives", "owner"].includes(permission);
  const userIdToQuery = userHasPermission ? user._id : null;
  const userLocations = useQuery(
    api.locations.getLocationHistory,
    userIdToQuery ? { userId: userIdToQuery } : "skip"
  );
  const ownerLocations = useQuery(
    api.locations.getLocationHistory,
    ownerId && (!userLocations || userLocations.length === 0) ? { userId: ownerId } : "skip"
  );
  const locations = userLocations && userLocations.length > 0 ? userLocations : ownerLocations;

  // Set the latest location as the current location
  useEffect(() => {
    if (locations && locations.length > 0) {
      setCurrentLocation({
        ...locations[0],
        appleMapsUrl: locations[0].url,
        timestamp: locations[0].insertedDate,
      });
      // Update map view when locations change
      if (mapRef.current) {
        mapRef.current.setView(
          [locations[0].latitude, locations[0].longitude],
          16
        );
      }
    }
  }, [locations]);

  // Map ref for imperative actions
  const mapRef = useRef<any>(null);

  async function searchLocation(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSearchError("");
    try {
      if (searchAddress.includes("maps.apple.com")) {
        const coords = extractCoordinatesFromAppleMapsUrl(searchAddress);
        if (coords) {
          // Reverse geocode
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`
          );
          const data = await response.json();
          setCurrentLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            displayName: data.display_name,
            appleMapsUrl: searchAddress,
            timestamp: new Date().toISOString(),
          });
          // Center map
          if (mapRef.current) {
            mapRef.current.setView([coords.latitude, coords.longitude], 16);
          }
          return;
        }
      }
      // Search by address
      const encoded = encodeURIComponent(searchAddress);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`
      );
      const searchData = await response.json();
      if (searchData && searchData.length > 0) {
        setCurrentLocation({
          latitude: parseFloat(searchData[0].lat),
          longitude: parseFloat(searchData[0].lon),
          displayName: searchData[0].display_name,
          appleMapsUrl: `https://maps.apple.com/?q=${searchData[0].lat},${searchData[0].lon}&ll=${searchData[0].lat},${searchData[0].lon}`,
          timestamp: new Date().toISOString(),
        });
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(searchData[0].lat), parseFloat(searchData[0].lon)], 16);
        }
      } else {
        setSearchError("Location not found");
      }
    } catch (error) {
      setSearchError("Error searching location");
    }
  }

  async function copyAppleMapsUrl() {
    if (currentLocation?.appleMapsUrl) {
      await navigator.clipboard.writeText(currentLocation.appleMapsUrl);
      // Optionally show a toast
    }
  }

  function getGoogleMapsUrl() {
    if (!currentLocation) return "#";
    return `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;
  }

  function getWazeUrl() {
    if (!currentLocation) return "#";
    return `https://waze.com/ul?ll=${currentLocation.latitude},${currentLocation.longitude}&navigate=yes`;
  }

  function refreshLocation() {
    if (locations && locations.length > 0) {
      setCurrentLocation({
        ...locations[0],
        appleMapsUrl: locations[0].url,
        timestamp: locations[0].insertedDate,
      });
      if (mapRef.current) {
        mapRef.current.setView([locations[0].latitude, locations[0].longitude], 16);
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow w-full max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Location History</h1>
        {(permission === undefined || user === undefined) ? (
          <p>Loading...</p>
        ) : !(typeof permission === "string" && ["relatives", "owner"].includes(permission)) ? (
          <div className="text-center text-red-500 font-medium py-12">
            You do not have permission to view this page.
          </div>
        ) : (
          <>
            {/* Map and controls */}
            <div className="mb-8">
              <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
                <form onSubmit={searchLocation} className="flex-1 flex gap-2">
                  <input
                    value={searchAddress}
                    onChange={e => setSearchAddress(e.target.value)}
                    type="text"
                    id="address"
                    placeholder="Search address or paste Apple Maps link"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition-colors text-sm"
                  >
                    Search
                  </button>
                </form>
                <div className="flex gap-2">
                  <button
                    onClick={refreshLocation}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors text-sm"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={copyAppleMapsUrl}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors text-sm"
                  >
                    Copy Apple Maps Link
                  </button>
                  <a
                    href={getGoogleMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors text-sm"
                  >
                    Google Maps
                  </a>
                  <a
                    href={getWazeUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors text-sm"
                  >
                    Waze
                  </a>
                </div>
              </div>
              {searchError && <p className="mt-2 text-red-500 text-sm">{searchError}</p>}
              {currentLocation && (
                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Current:</span> {currentLocation.displayName}
                  </div>
                  <div className="text-xs text-gray-400 mb-1">
                    Last Updated: {new Date(currentLocation.timestamp).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    Coordinates: {currentLocation.latitude}, {currentLocation.longitude}
                  </div>
                </div>
              )}
              <div className="w-full h-[350px] rounded-lg overflow-hidden border border-gray-200">
                {typeof window !== "undefined" && currentLocation && (
                  <MapContainer
                    center={[Number(currentLocation.latitude), Number(currentLocation.longitude)]}
                    zoom={16}
                    style={{ height: "100%", width: "100%" }}
                    ref={mapRef}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="© OpenStreetMap contributors"
                    />
                    <Marker position={[Number(currentLocation.latitude), Number(currentLocation.longitude)]}>
                      <Popup>
                        Location: {currentLocation.displayName}
                      </Popup>
                    </Marker>
                  </MapContainer>
                )}
              </div>
            </div>
            {/* Table of history */}
            <div className="overflow-x-auto">
              {!locations ? (
                <p>Loading...</p>
              ) : locations.length === 0 ? (
                <p>No locations found.</p>
              ) : (
                <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 border">Date</th>
                      <th className="px-4 py-2 border">Latitude</th>
                      <th className="px-4 py-2 border">Longitude</th>
                      <th className="px-4 py-2 border">Display Name</th>
                      <th className="px-4 py-2 border">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc: {
                      _id: string;
                      insertedDate: string;
                      latitude: number;
                      longitude: number;
                      displayName: string;
                      url: string;
                    }) => {
                      const googleMapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
                      const wazeUrl = `https://waze.com/ul?ll=${loc.latitude},${loc.longitude}&navigate=yes`;
                      const maxLength = 40;
                      const isClipped = loc.displayName.length > maxLength;
                      const clipped = isClipped ? loc.displayName.slice(0, maxLength) + "..." : loc.displayName;
                      return (
                        <tr key={loc._id}>
                          <td className="px-4 py-2 border">{new Date(loc.insertedDate).toLocaleString()}</td>
                          <td className="px-4 py-2 border">{loc.latitude}</td>
                          <td className="px-4 py-2 border">{loc.longitude}</td>
                          <td className="px-4 py-2 border">
                            {isClipped ? (
                              <span className="cursor-pointer underline decoration-dotted" title={loc.displayName}>
                                {clipped}
                              </span>
                            ) : (
                              loc.displayName
                            )}
                          </td>
                          <td className="px-4 py-2 border">
                            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">
                              Google Maps
                            </a>
                            <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-gray-500 underline">
                              Waze
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
