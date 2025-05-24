"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
var Steam = require('steam');
// @ts-ignore
var csgo = require('csgo');
// @ts-ignore
var SteamUser = require('steam-user');
var steamClient = new Steam.SteamClient();
var user = new SteamUser(steamClient);
var steamGC = new Steam.SteamGameCoordinator(steamClient, 730);
var CS2 = new csgo.CSGOClient(user, steamGC, false);
var shareCode = 'CSGO-QYtkU-AWaxi-63ybQ-bvret-yCfyC';
var decoder = new csgo.SharecodeDecoder(shareCode);
var decoded_match = decoder.decode();
console.log("Decoded match info:", decoded_match);
steamClient.connect();
console.log("Called steamClient.connect()");
steamClient.on('connected', function () {
    console.log("Steam client connected, logging in...");
    user.logOn({
        accountName: 'x',
        password: 'y'
    });
});
console.log("Logging in...");
user.on('loggedOn', function (response) {
    if (response) {
        console.log('Failed to log on:', response);
        return;
    }
    console.log("Logged on to Steam, launching CS2 client...");
    CS2.launch();
});
user.on('erorr', function (err) {
    console.log('Steam user error:', err);
});
user.on('steamGuard', function (domain, callback) {
    console.log('Steam Guard code required. Please enter it:');
    var readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    readline.question('Steam Guard Code: ', function (code) {
        callback(code);
        readline.close();
    });
});
CS2.on('ready', function () {
    console.log("CS2 client ready, requesting game info...");
    CS2.requestGame(decoded_match.matchId, decoded_match.outcomeId, decoded_match.tokenId);
});
CS2.on('matchList', function (data) {
    console.log("Received matchList event:", JSON.stringify(data, null, 2));
    if (data && data.matches && data.matches.length > 0) {
        var match = data.matches[0];
        var demoUrl = match.matchinfo && match.matchinfo.map;
        console.log('Demo download URL:', demoUrl);
    }
    else {
        console.log('No match data received.');
    }
});
CS2.on('unready', function () {
    console.log('CS2 client unready');
});
CS2.on('error', function (err) {
    console.log('CS2 error:', err);
});
steamClient.on('error', function (err) {
    console.log('Steam client error:', err);
});
// async function main() {
//   await analyzeDemo({
//     demoPath: 'cstypescript/astralis-vs-spirit-m1-dust2.dem',
//     outputFolderPath: '.',
//     format: ExportFormat.JSON,
//     source: DemoSource.Valve,
//     analyzePositions: false,
//     minify: false,
//     onStderr: console.error,
//     onStdout: console.log,
//     onStart: () => {
//       console.log('Starting!');
//     },
//     onEnd: () => {
//       console.log('Done!');
//     },
//   });
// }
// main();
