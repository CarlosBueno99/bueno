import { NextRequest, NextResponse } from 'next/server';

// @ts-ignore
const SteamUser = require('steam-user');
// @ts-ignore
const GlobalOffensive = require('globaloffensive');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shareCode = searchParams.get('shareCode');

  // Read Steam credentials from environment variables (server-side only)
  const username = process.env.STEAM_USERNAME;
  const password = process.env.STEAM_PASSWORD;

  if (!username || !password) {
    return NextResponse.json({ error: 'Steam credentials not configured on server' }, { status: 500 });
  }

  if (!shareCode) {
    return NextResponse.json({ error: 'Missing required parameter: shareCode' }, { status: 400 });
  }

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
      client.setPersona(SteamUser.EPersonaState.Online);
      client.gamesPlayed([730]);
    });

    client.on('error', (err: any) => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json({ error: 'Steam login error', details: err?.message || String(err) }, { status: 401 }));
      }
    });

    csgo.on('connectedToGC', () => {
      csgo.requestGame(shareCode);
    });

    csgo.on('matchList', (matches: any) => {
      if (!resolved) {
        resolved = true;
        
        if (!matches || matches.length === 0) {
          resolve(NextResponse.json({ 
            error: 'No match found for this share code. The match may have expired or the share code is invalid.',
          }, { status: 404 }));
          cleanup();
          return;
        }
        
        const match = matches[0];
        const demoUrl = match?.['roundstatsall']?.at?.(-1)?.['map'];
        const matchId = match?.['matchid'];

        if (demoUrl) {
          resolve(NextResponse.json({ demoUrl, matchId: matchId?.toString() }));
        } else {
          resolve(NextResponse.json({ 
            error: 'Demo URL not found in match data',
            matchId: matchId?.toString(),
          }, { status: 404 }));
        }
        
        cleanup();
      }
    });

    csgo.on('error', (err: any) => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json({ error: 'CS2 GC error', details: err?.message || String(err) }, { status: 500 }));
        cleanup();
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json({ error: 'Timeout waiting for demo URL. Make sure the share code is valid.' }, { status: 504 }));
        cleanup();
      }
    }, 30000);
  });
} 