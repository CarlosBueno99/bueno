import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// @ts-ignore
const SteamUser = require('steam-user');
// @ts-ignore
const GlobalOffensive = require('globaloffensive');

// Get demo URL for a single share code using the GC
async function getDemoUrlForShareCode(
  csgo: any,
  shareCode: string,
  timeoutMs: number = 15000
): Promise<{ shareCode: string; demoUrl: string | null; matchId: string | null; matchTime: string | null; error?: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    
    const handleMatchList = (matches: any) => {
      if (resolved) return;
      resolved = true;
      
      csgo.removeListener('matchList', handleMatchList);
      
      if (!matches || matches.length === 0) {
        resolve({
          shareCode,
          demoUrl: null,
          matchId: null,
          matchTime: null,
          error: 'No match found for this share code'
        });
        return;
      }
      
      const match = matches[0];
      // Demo URL is in roundstatsall -> last item -> map field
      const demoUrl = match?.['roundstatsall']?.at?.(-1)?.['map'] || null;
      const matchId = match?.['matchid']?.toString() || null;
      const matchTime = match?.['matchtime'] ? new Date(match['matchtime'] * 1000).toISOString() : null;
      
      resolve({
        shareCode,
        demoUrl,
        matchId,
        matchTime,
      });
    };
    
    csgo.on('matchList', handleMatchList);
    
    console.log(`Requesting game for share code: ${shareCode}`);
    csgo.requestGame(shareCode);
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        csgo.removeListener('matchList', handleMatchList);
        resolve({
          shareCode,
          demoUrl: null,
          matchId: null,
          matchTime: null,
          error: 'Timeout waiting for match data'
        });
      }
    }, timeoutMs);
  });
}

/**
 * GET /api/cs/matches
 * 
 * Fetches demo URLs for the provided share codes by connecting to Steam GC.
 * Steam credentials are read from environment variables.
 * 
 * Query params:
 * - shareCodes: comma-separated list of CS2 share codes
 */
export async function GET(request: NextRequest) {
  // Verify user is authenticated via Clerk
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ 
      error: 'Unauthorized. You must be logged in to access this endpoint.' 
    }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shareCodesParam = searchParams.get('shareCodes');

  // Read Steam credentials from environment variables
  const username = process.env.STEAM_USERNAME;
  const password = process.env.STEAM_PASSWORD;

  if (!username || !password) {
    return NextResponse.json({ 
      error: 'Steam credentials not configured. Set STEAM_USERNAME and STEAM_PASSWORD environment variables.' 
    }, { status: 500 });
  }
  
  if (!shareCodesParam) {
    return NextResponse.json({ 
      error: 'Missing required query parameter: shareCodes (comma-separated list of share codes)' 
    }, { status: 400 });
  }

  const shareCodes = shareCodesParam.split(',').map(c => c.trim()).filter(c => c);

  if (shareCodes.length === 0) {
    return NextResponse.json({ 
      error: 'No valid share codes provided' 
    }, { status: 400 });
  }

  console.log(`Fetching demo URLs for ${shareCodes.length} share codes...`);

  // Connect to Steam and GC, then fetch demo URLs for each share code
  return new Promise<NextResponse>((resolve) => {
    const client = new SteamUser();
    const csgo = new GlobalOffensive(client);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
      }
      try {
        client.logOff();
      } catch (e) {
        // Ignore logoff errors
      }
    };

    // Build login options
    const logOnOptions: any = {
      accountName: username,
      password: password,
    };


    client.logOn(logOnOptions);

    client.on('loggedOn', () => {
      console.log('Logged into Steam as ' + client.steamID.getSteam3RenderedID());
      client.setPersona(SteamUser.EPersonaState.Online);
      client.gamesPlayed([730]);
    });

    client.on('error', (err: any) => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json({ 
          error: 'Steam login error: ' + (err?.message || String(err)),
        }, { status: 500 }));
      }
    });

    csgo.on('connectedToGC', async () => {
      console.log('Connected to CS2 GC, fetching demo URLs...');
      
      try {
        const results = [];
        for (const shareCode of shareCodes) {
          const result = await getDemoUrlForShareCode(csgo, shareCode, 10000);
          results.push(result);
          console.log(`Result for ${shareCode}:`, result.demoUrl ? 'Found' : result.error);
          
          // Small delay between requests to avoid rate limiting
          await new Promise(r => setTimeout(r, 500));
        }
        
        if (!resolved) {
          resolved = true;
          
          const matches = results.map((r, index) => ({
            index,
            shareCode: r.shareCode,
            demoUrl: r.demoUrl,
            matchId: r.matchId,
            matchTime: r.matchTime,
            error: r.error,
          }));
          
          const successCount = matches.filter(m => m.demoUrl).length;
          
          resolve(NextResponse.json({
            success: true,
            total: matches.length,
            successCount,
            matches,
          }));
        }
        
        cleanup();
      } catch (error) {
        if (!resolved) {
          resolved = true;
          resolve(NextResponse.json({ 
            error: 'Error fetching demo URLs: ' + (error instanceof Error ? error.message : String(error)),
          }, { status: 500 }));
        }
        cleanup();
      }
    });

    csgo.on('error', (err: any) => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json({ 
          error: 'CS2 GC error: ' + (err?.message || String(err)),
        }, { status: 500 }));
        cleanup();
      }
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json({ 
          error: 'Timeout waiting for demo URLs. The Steam GC might be slow.',
        }, { status: 504 }));
        cleanup();
      }
    }, 120000);
  });
}
