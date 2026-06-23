"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

// Type for pending match from internal query
type PendingMatch = {
  _id: Id<"cs2Matches">;
  shareCode: string;
  demoUrl: string;
  matchTime?: string;
  steamId: string;
  teamScores?: number[];
  matchResult?: number;
  targetPlayerTeam?: number;
};

// Type for archive result
type ArchiveResult = {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
};

// Parse S3 path like "s3://bucket-name/prefix/path"
function parseS3Path(s3Path: string): { bucket: string; prefix: string } | null {
  const match = s3Path.match(/^s3:\/\/([^\/]+)(?:\/(.*))?$/);
  if (!match) return null;
  return {
    bucket: match[1],
    prefix: match[2] || '',
  };
}

/**
 * Generate a filename for the archived demo.
 * Format: {steamId}-{date}-{W|L}-{score}-{shareCodePrefix}.dem.bz2
 */
function generateDemoFilename(
  steamId: string,
  matchTime: string | undefined,
  teamScores: number[] | undefined,
  matchResult: number | undefined,
  targetPlayerTeam: number | undefined,
  shareCode: string
): string {
  // Get date part
  const date = matchTime 
    ? new Date(matchTime).toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];
  
  // Determine win/loss
  let winLoss = 'U'; // Unknown
  if (matchResult !== undefined && targetPlayerTeam !== undefined) {
    winLoss = matchResult === targetPlayerTeam ? 'W' : 'L';
  }
  
  // Get score string
  let scoreStr = '0-0';
  if (teamScores && teamScores.length === 2 && targetPlayerTeam !== undefined) {
    // Put the target player's team score first
    if (targetPlayerTeam === 1) {
      scoreStr = `${teamScores[0]}-${teamScores[1]}`;
    } else {
      scoreStr = `${teamScores[1]}-${teamScores[0]}`;
    }
  }
  
  // Get share code prefix (first segment)
  const shareCodePrefix = shareCode.replace('CSGO-', '').split('-')[0] || shareCode.substring(0, 5);
  
  return `${steamId}-${date}-${winLoss}-${scoreStr}-${shareCodePrefix}.dem.bz2`;
}

/**
 * Convert a web ReadableStream to a Node.js Readable stream
 */
function webStreamToNodeStream(webStream: ReadableStream<Uint8Array>): Readable {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    },
  });
}

/**
 * Internal action to download pending demos and archive them to S3.
 * Uses streaming to minimize memory usage - pipes directly from Valve CDN to S3.
 * Called by cron job and manual trigger.
 */
export const downloadPendingDemos = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    successful: v.number(),
    failed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx): Promise<ArchiveResult> => {
    // Get pending matches
    const pendingMatches: PendingMatch[] = await ctx.runQuery(
      internal.cs2Actions.getMatchesPendingDownload, 
      {}
    );
    
    if (pendingMatches.length === 0) {
      console.log('No pending demos to archive.');
      return { processed: 0, successful: 0, failed: 0, errors: [] };
    }
    
    console.log(`Found ${pendingMatches.length} pending demos to archive.`);
    
    // Get S3 configuration from environment
    const s3Path = process.env.CS2_DEMOS_S3_PATH;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    
    if (!s3Path) {
      console.error('S3 path not configured. Set CS2_DEMOS_S3_PATH environment variable.');
      return { 
        processed: 0, 
        successful: 0, 
        failed: pendingMatches.length, 
        errors: ['S3 path not configured'] 
      };
    }
    
    if (!awsAccessKeyId || !awsSecretAccessKey) {
      console.error('AWS credentials not configured.');
      return { 
        processed: 0, 
        successful: 0, 
        failed: pendingMatches.length, 
        errors: ['AWS credentials not configured'] 
      };
    }
    
    const parsedPath = parseS3Path(s3Path);
    if (!parsedPath) {
      console.error('Invalid CS2_DEMOS_S3_PATH format.');
      return { 
        processed: 0, 
        successful: 0, 
        failed: pendingMatches.length, 
        errors: ['Invalid S3 path format'] 
      };
    }
    
    const { bucket, prefix } = parsedPath;
    
    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
    
    const concurrency = Math.min(
      Number(process.env.CONCURRENT_ARCHIVES) || 3,
      pendingMatches.length
    );

    const results: { match: PendingMatch; error?: string }[] = []
    const queue = [...pendingMatches]

    async function worker() {
      while (queue.length > 0) {
        const match = queue.shift()!
        try {
          const filename = generateDemoFilename(
            match.steamId,
            match.matchTime,
            match.teamScores,
            match.matchResult,
            match.targetPlayerTeam,
            match.shareCode
          )

          const s3Key = prefix ? `${prefix}/${filename}` : filename
          const s3Uri = `s3://${bucket}/${s3Key}`

          console.log(`Archiving ${match.shareCode} as ${filename}...`)

          const downloadResponse = await fetch(match.demoUrl)

          if (!downloadResponse.ok) {
            if (downloadResponse.status === 502 || downloadResponse.status === 404 || downloadResponse.status === 410) {
              throw new Error(`Demo expired or unavailable (HTTP ${downloadResponse.status})`)
            }
            throw new Error(`Failed to download demo: HTTP ${downloadResponse.status}`)
          }

          if (!downloadResponse.body) {
            throw new Error('No response body from Valve CDN')
          }

          const nodeStream = webStreamToNodeStream(downloadResponse.body)

          const upload = new Upload({
            client: s3Client,
            params: {
              Bucket: bucket,
              Key: s3Key,
              Body: nodeStream,
              ContentType: 'application/x-bzip2',
            },
            partSize: 5 * 1024 * 1024,
            queueSize: 4,
          })

          await upload.done()

          await ctx.runMutation(internal.cs2Actions.updateMatchS3Key, {
            matchId: match._id,
            s3ObjectKey: s3Uri,
          })

          console.log(`Successfully archived ${match.shareCode} to ${s3Uri}`)
          results.push({ match })
        } catch (error) {
          const errorMsg = `Error archiving ${match.shareCode}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg)
          results.push({ match, error: errorMsg })
        }
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)

    const successful = results.filter((r) => !r.error).length
    const failed = results.filter((r) => r.error).length
    const errors = results.filter((r): r is { match: PendingMatch; error: string } => !!r.error).map((r) => r.error)

    return { processed: pendingMatches.length, successful, failed, errors }
  },
});
