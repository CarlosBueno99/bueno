import { Hono } from 'hono'
import { getAuth } from '@clerk/hono'
import path from 'path'
import fs from 'fs/promises'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'node:stream'

// @ts-ignore
const SteamUser = require('steam-user')
// @ts-ignore
const GlobalOffensive = require('globaloffensive')

function parseS3Path(s3Path: string) {
  const match = s3Path.match(/^s3:\/\/([^/]+)(?:\/(.*))?$/)
  if (!match) throw new Error('Invalid CS2_DEMOS_S3_PATH format')
  return { bucket: match[1], prefix: match[2] || '' }
}

function generateDemoFilename(match: any, steamId: string) {
  const date = match.matchTime
    ? new Date(match.matchTime).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]
  let winLoss = 'U'
  if (match.matchResult != null && match.targetPlayerTeam != null) {
    winLoss = match.matchResult === match.targetPlayerTeam ? 'W' : 'L'
  }
  let score = '0-0'
  if (match.teamScores?.length === 2 && match.targetPlayerTeam != null) {
    score = match.targetPlayerTeam === 1
      ? `${match.teamScores[0]}-${match.teamScores[1]}`
      : `${match.teamScores[1]}-${match.teamScores[0]}`
  }
  const code = match.shareCode.replace('CSGO-', '').split('-')[0] || match.shareCode.slice(0, 5)
  return `${steamId}-${date}-${winLoss}-${score}-${code}.dem.bz2`
}

async function archiveDemoToS3(demoUrl: string, filename: string) {
  const s3Path = process.env.CS2_DEMOS_S3_PATH
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || 'us-east-1'
  if (!s3Path) throw new Error('CS2_DEMOS_S3_PATH is not configured')
  if (!accessKeyId || !secretAccessKey) throw new Error('AWS credentials are not configured')

  const { bucket, prefix } = parseS3Path(s3Path)
  const response = await fetch(demoUrl)
  if (!response.ok) throw new Error(`Demo download failed with HTTP ${response.status}`)
  if (!response.body) throw new Error('Demo download returned no response body')

  const key = prefix ? `${prefix}/${filename}` : filename
  const upload = new Upload({
    client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey } }),
    params: {
      Bucket: bucket,
      Key: key,
      Body: Readable.fromWeb(response.body as any),
      ContentType: 'application/x-bzip2',
    },
    partSize: 5 * 1024 * 1024,
    queueSize: 4,
  })
  await upload.done()
  return `s3://${bucket}/${key}`
}

export function registerCsRoutes(app: Hono) {
  // GET /api/cs — Read parsed demo from local file
  app.get('/api/cs', async (c) => {
    try {
      const jsonPath = path.join(process.cwd(), 'app', 'demo.json')
      const demoData = await fs.readFile(jsonPath, 'utf-8')
      const raw = JSON.parse(demoData)

      const map = raw.mapName || 'Unknown Map'
      const duration = raw.duration || null
      const date = raw.date || new Date().toISOString()
      const gameModeStr = raw.gameModeStr || ''
      const teamA = raw.teamA || { name: 'Team 1', score: 0 }
      const teamB = raw.teamB || { name: 'Team 2', score: 0 }

      const players = raw.players && typeof raw.players === 'object' ? Object.values(raw.players) : []
      const mapPlayer = (p: any) => ({
        name: p.name, steamId: p.steamId, team: p.team?.name || '',
        kills: p.killCount ?? 0, deaths: p.deathCount ?? 0, assists: p.assistCount ?? 0,
        adr: p.averageDamagePerRound ?? 0, kast: p.kast ?? 0, hsp: p.headshotPercent ?? 0,
        rating: p.hltvRating2 ?? p.hltvRating ?? 0,
      })

      const processedStats = {
        map, date, duration, gameModeStr,
        teams: {
          team1: { name: teamA.name, score: teamA.score, players: players.filter((p: any) => p.team?.name === teamA.name).map(mapPlayer) },
          team2: { name: teamB.name, score: teamB.score, players: players.filter((p: any) => p.team?.name === teamB.name).map(mapPlayer) },
        },
        rounds: Array.isArray(raw.rounds) ? raw.rounds.map((r: any, idx: number) => ({
          number: idx + 1, winner: r.winnerName || null, winType: r.winType || null, duration: r.duration || null,
          score: { team1: r.teamAScore ?? null, team2: r.teamBScore ?? null },
        })) : [],
        economy: Array.isArray(raw.playerEconomies) ? raw.playerEconomies : [],
        chatMessages: Array.isArray(raw.chatMessages) ? raw.chatMessages : [],
      }

      return c.json(processedStats)
    } catch (error) {
      console.error('Failed to read demo data:', error)
      return c.json({ error: error instanceof Error ? error.message : 'Failed to read demo data' }, 500)
    }
  })

  // GET /api/cs/download — Download a single demo by share code
  app.get('/api/cs/download', async (c) => {
    const shareCode = c.req.query('shareCode')
    const username = process.env.STEAM_USERNAME
    const password = process.env.STEAM_PASSWORD

    if (!username || !password) return c.json({ error: 'Steam credentials not configured on server' }, 500)
    if (!shareCode) return c.json({ error: 'Missing required parameter: shareCode' }, 400)

    return new Promise<Response>((resolve) => {
      const client = new SteamUser()
      const csgo = new GlobalOffensive(client)
      let resolved = false

      const cleanup = () => { try { client.logOff() } catch {} }

      client.logOn({ accountName: username, password })
      client.on('loggedOn', () => { client.setPersona(SteamUser.EPersonaState.Online); client.gamesPlayed([730]) })
      client.on('error', (err: any) => {
        if (!resolved) { resolved = true; resolve(c.json({ error: 'Steam login error', details: err?.message || String(err) }, 401)) }
      })
      csgo.on('connectedToGC', () => csgo.requestGame(shareCode))
      csgo.on('matchList', (matches: any) => {
        if (!resolved) {
          resolved = true
          if (!matches || matches.length === 0) {
            resolve(c.json({ error: 'No match found for this share code.' }, 404)); cleanup(); return
          }
          const match = matches[0]
          const demoUrl = match?.['roundstatsall']?.at?.(-1)?.['map']
          const matchId = match?.['matchid']
          if (demoUrl) resolve(c.json({ demoUrl, matchId: matchId?.toString() }))
          else resolve(c.json({ error: 'Demo URL not found in match data', matchId: matchId?.toString() }, 404))
          cleanup()
        }
      })
      csgo.on('error', (err: any) => {
        if (!resolved) { resolved = true; resolve(c.json({ error: 'CS2 GC error', details: err?.message || String(err) }, 500)); cleanup() }
      })
      setTimeout(() => {
        if (!resolved) { resolved = true; resolve(c.json({ error: 'Timeout waiting for demo URL.' }, 504)); cleanup() }
      }, 30000)
    })
  })

  // GET /api/cs/matches — Batch fetch demo URLs for multiple share codes
  app.get('/api/cs/matches', async (c) => {
    const internalSecret = process.env.CS2_ARCHIVE_INTERNAL_SECRET
    const isInternalCall = Boolean(
      internalSecret && c.req.header('x-cs2-internal-secret') === internalSecret
    )
    if (!isInternalCall) {
      const auth = getAuth(c)
      if (!auth?.userId) return c.json({ error: 'Unauthorized.' }, 401)
    }

    const shareCodesParam = c.req.query('shareCodes')
    const targetSteamId = c.req.query('targetSteamId') ?? null
    const username = process.env.STEAM_USERNAME
    const password = process.env.STEAM_PASSWORD

    if (!username || !password) return c.json({ error: 'Steam credentials not configured.' }, 500)
    if (!shareCodesParam) return c.json({ error: 'Missing required query parameter: shareCodes' }, 400)

    const shareCodes = shareCodesParam.split(',').map(c => c.trim()).filter(Boolean)
    if (shareCodes.length === 0) return c.json({ error: 'No valid share codes provided' }, 400)

    function steamId64ToSteamId32(steamId64: string): number {
      return Number(BigInt(steamId64) - BigInt('76561197960265728'))
    }

    async function getDemoUrlForShareCode(csgo: any, shareCode: string, timeoutMs = 15000): Promise<any> {
      return new Promise((resolve) => {
        let done = false
        const handler = (matches: any) => {
          if (done) return
          done = true
          csgo.removeListener('matchList', handler)
          if (!matches?.length) { resolve({ shareCode, demoUrl: null, error: 'No match found' }); return }
          const match = matches[0]
          const lastRound = match?.['roundstatsall']?.at?.(-1)
          const demoUrl = lastRound?.['map'] || null
          const matchId = match?.['matchid']?.toString() || null
          const matchTime = match?.['matchtime'] ? new Date(match['matchtime'] * 1000).toISOString() : null
          const teamScores: number[] | null = lastRound?.['team_scores'] || null
          const matchResult: number | null = lastRound?.['match_result'] ?? null
          let targetPlayerTeam: number | null = null
          let playerStats = null
          if (targetSteamId && lastRound) {
            const id32 = steamId64ToSteamId32(targetSteamId)
            const accountIds: number[] = lastRound?.['reservation']?.['account_ids'] || []
            const idx = accountIds.indexOf(id32)
            if (idx !== -1) {
              targetPlayerTeam = idx < 5 ? 1 : 2
              playerStats = { kills: lastRound['kills']?.[idx] ?? 0, deaths: lastRound['deaths']?.[idx] ?? 0, assists: lastRound['assists']?.[idx] ?? 0, headshots: lastRound['enemy_headshots']?.[idx] ?? 0, mvps: lastRound['mvps']?.[idx] ?? 0, score: lastRound['scores']?.[idx] ?? 0 }
            }
          }
          resolve({ shareCode, demoUrl, matchId, matchTime, teamScores, matchResult, targetPlayerTeam, playerStats })
        }
        csgo.on('matchList', handler)
        csgo.requestGame(shareCode)
        setTimeout(() => { if (!done) { done = true; csgo.removeListener('matchList', handler); resolve({ shareCode, demoUrl: null, error: 'Timeout' }) } }, timeoutMs)
      })
    }

    console.log(`[cs/matches] Starting request for ${shareCodes.length} share codes`)

    return new Promise<Response>((resolve) => {
      const client = new SteamUser()
      const csgo = new GlobalOffensive(client)
      let resolved = false
      const cleanup = () => { try { client.logOff() } catch {} }

      console.log('[cs/matches] Logging into Steam...')
      client.logOn({ accountName: username, password })

      client.on('loggedOn', () => {
        console.log('[cs/matches] Logged into Steam as', client.steamID?.getSteam3RenderedID?.())
        client.setPersona(SteamUser.EPersonaState.Online)
        client.gamesPlayed([730])
      })

      client.on('error', (err: any) => {
        console.error('[cs/matches] Steam login error:', err)
        if (!resolved) { resolved = true; resolve(c.json({ error: 'Steam login error: ' + (err?.message || String(err)) }, 500)) }
      })

      csgo.on('connectedToGC', async () => {
        console.log('[cs/matches] Connected to CS2 GC, processing', shareCodes.length, 'share codes')
        try {
          const results = []
          for (const code of shareCodes) {
            console.log(`[cs/matches] Requesting game for: ${code}`)
            const result = await getDemoUrlForShareCode(csgo, code, 10000)
            console.log(`[cs/matches] Result for ${code}:`, result.demoUrl ? 'got URL' : (result.error ?? 'no URL'))
            if (isInternalCall && result.demoUrl && targetSteamId) {
              try {
                const filename = generateDemoFilename(result, targetSteamId)
                result.s3ObjectKey = await archiveDemoToS3(result.demoUrl, filename)
              } catch (error) {
                result.archiveError = error instanceof Error ? error.message : String(error)
              }
            }
            results.push(result)
            await new Promise(r => setTimeout(r, 500))
          }
          if (!resolved) {
            resolved = true
            const matches = results.map((r, index) => ({ index, ...r }))
            const successCount = matches.filter((m: any) => m.demoUrl).length
            console.log(`[cs/matches] Done — ${successCount}/${matches.length} succeeded`)
            resolve(c.json({ success: true, total: matches.length, successCount, matches }))
          }
          cleanup()
        } catch (error) {
          console.error('[cs/matches] Error in connectedToGC handler:', error)
          if (!resolved) { resolved = true; resolve(c.json({ error: 'Error fetching demo URLs: ' + (error instanceof Error ? error.message : String(error)) }, 500)) }
          cleanup()
        }
      })

      csgo.on('disconnectedFromGC', (reason: any) => {
        console.warn('[cs/matches] Disconnected from GC, reason:', reason)
      })

      csgo.on('error', (err: any) => {
        console.error('[cs/matches] CS2 GC error:', err)
        if (!resolved) { resolved = true; resolve(c.json({ error: 'CS2 GC error: ' + (err?.message || String(err)) }, 500)); cleanup() }
      })

      setTimeout(() => {
        if (!resolved) {
          console.warn('[cs/matches] 120s timeout hit — never connected to GC or finished processing')
          resolved = true
          resolve(c.json({ error: 'Timeout waiting for demo URLs.' }, 504))
          cleanup()
        }
      }, isInternalCall ? 10 * 60 * 1000 : 120000)
    })
  })

  // POST /api/cs/archive — Download a demo and upload it to S3
  app.post('/api/cs/archive', async (c) => {
    let body: { demoUrl?: string; filename?: string; internalSecret?: string }
    try { body = await c.req.json() }
    catch { return c.json({ error: 'Invalid JSON body' }, 400) }

    const internalSecret = process.env.CS2_ARCHIVE_INTERNAL_SECRET
    const isInternalCall = internalSecret && body.internalSecret === internalSecret

    if (!isInternalCall) {
      const auth = getAuth(c)
      if (!auth?.userId) return c.json({ error: 'Unauthorized.' }, 401)
    }

    const { demoUrl, filename } = body
    if (!demoUrl) return c.json({ error: 'Missing required field: demoUrl' }, 400)
    if (!filename) return c.json({ error: 'Missing required field: filename' }, 400)

    try {
      const s3Uri = await archiveDemoToS3(demoUrl, filename)
      return c.json({ success: true, s3Uri })
    } catch (error) {
      console.error('Error archiving demo:', error)
      return c.json({ error: 'Error archiving demo: ' + (error instanceof Error ? error.message : String(error)) }, 500)
    }
  })
}
