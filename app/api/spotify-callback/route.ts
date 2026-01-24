import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { auth } from '@clerk/nextjs/server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function getBaseUrl(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const host = forwardedHost || request.headers.get("host");
  const protocol = forwardedProto;
  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const baseUrl = getBaseUrl(request);

  if (!code) {
    return NextResponse.redirect(new URL('/admin?error=no_code_provided', baseUrl));
  }

  try {
    // Get Clerk session and JWT for Convex authentication
    const { userId, getToken } = await auth();
    
    if (!userId) {
      return NextResponse.redirect(new URL('/admin?error=not_authenticated', baseUrl));
    }
    
    const jwt = await getToken({ template: 'convex' });
    
    if (!jwt) {
      return NextResponse.redirect(new URL('/admin?error=auth_error', baseUrl));
    }
    
    // Set auth for Convex client
    convex.setAuth(jwt);
    
    // Build the redirect URI from the current request URL
    const redirectUri = `${baseUrl}/api/spotify-callback`;

    // Call Convex action to exchange code and save token (all server-side)
    // The action handles: code exchange -> token save -> returns only success/error
    const result = await convex.action(api.spotifyActions.exchangeSpotifyCodeForToken, { code, redirectUri });

    if (result.success) {
      return NextResponse.redirect(new URL('/admin?spotify=connected', baseUrl));
    } else {
      // Return generic error codes, not detailed error messages
      return NextResponse.redirect(new URL(`/admin?error=${result.error}`, baseUrl));
    }
  } catch {
    // Generic error for any unexpected failures
    return NextResponse.redirect(new URL('/admin?error=spotify_auth_failed', baseUrl));
  }
} 