import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ConvexError } from 'convex/values';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface LocationData {
  userId: Id<"users">;
  url: string;
  insertedDate: string;
  latitude: number;
  longitude: number;
  displayName: string;
  altitude?: number;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  region?: string;
  phoneNumber?: string;
  label?: string;
  full?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const insertedDate = new Date().toISOString();
    
    // Prepare location data with required fields
    const locationData: LocationData = {
      userId: data.userId as Id<"users">,
      url: data.url,
      insertedDate,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      displayName: data.full,
    };

    // Add optional fields if they exist
    if (data.altitude) locationData.altitude = Number(data.altitude);
    if (data.street) locationData.street = data.street;
    if (data.city) locationData.city = data.city;
    if (data.state) locationData.state = data.state;
    if (data.zip) locationData.zip = data.zip;
    if (data.region) locationData.region = data.region;
    if (data.phoneNumber) locationData.phoneNumber = data.phoneNumber;
    if (data.label) locationData.label = data.label;
    if (data.full) locationData.full = data.full;

    // Save to Convex
    await convex.mutation(api.locations.addLocation, locationData);

    return NextResponse.json({ success: true, data: { insertedDate } });
    
  } catch (error: unknown) {
    // Handle ConvexError (e.g., "User does not exist")
    if (error instanceof ConvexError) {
      return NextResponse.json(
        { error: String(error.data) },
        { status: 400 }
      );
    }
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes("ArgumentValidationError")) {
      return NextResponse.json(
        { error: "Invalid arguments provided", details: error.message },
        { status: 400 }
      );
    }
    
    // Handle Convex server errors that contain ConvexError data
    if (error instanceof Error && error.message.includes("ConvexError")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    // Handle other errors as 500
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

