import { NextRequest, NextResponse } from 'next/server';
import SteamUser from 'steam-user';
import Steam from 'node-steam';
import CSGO, { SharecodeDecoder } from 'csgo';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('steamUser');
  const password = searchParams.get('steamPass');
  const sharedSecret = searchParams.get('steamSecret');
  const shareCode = searchParams.get('shareCode');

  if (!username || !password || !shareCode) {
    return NextResponse.json({ error: 'Missing required query parameters: steamUser, steamPass, shareCode' }, { status: 400 });
  }

  return new Promise((resolve) => {
    const decoder = new SharecodeDecoder(shareCode);
    const client = new SteamUser();
    const steamClient = new Steam.SteamClient();
    const csgo = new CSGO.CSGOClient(steamClient, false);

    client.logOn({
      accountName: username,
      password: password,
      twoFactorCode: sharedSecret ? require('steam-totp').generateAuthCode(sharedSecret) : undefined,
    });

    client.on('loggedOn', () => {
      steamClient.connect();
    });

    steamClient.on('connected', () => {
      client.setPersona(SteamUser.EPersonaState.Online);
      client.gamesPlayed([730]);
    });

    steamClient.on('logOnResponse', () => {
      csgo.launch();
    });

    csgo.on('ready', () => {
      csgo.requestGame(decoder.matchId, decoder.outcomeId, decoder.token);
    });

    csgo.on('matchList', (matches: any) => {
      if (matches && matches.matches && matches.matches.length > 0) {
        const match = matches.matches[0];
        resolve(NextResponse.json({ demoUrl: match.downloadUrl }));
      } else {
        resolve(NextResponse.json({ error: 'No matches found.' }, { status: 404 }));
      }
      client.logOff();
    });

    setTimeout(() => {
      resolve(NextResponse.json({ error: 'Timeout waiting for demo URL.' }, { status: 504 }));
      client.logOff();
    }, 20000);
  });
} 