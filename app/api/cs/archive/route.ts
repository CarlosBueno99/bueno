import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
 * POST /api/cs/archive
 * 
 * Downloads a demo file from Valve CDN and uploads it to S3.
 * 
 * Authentication: Either Clerk session OR internal secret token (for cron jobs)
 * 
 * Body:
 * - demoUrl: URL to download the demo from Valve
 * - filename: Filename to use for the S3 object (e.g., "bueno-2026-01-27-W-13-11-mjSaW.dem.bz2")
 * - internalSecret: (optional) Secret token for internal/cron calls
 * 
 * Returns:
 * - s3Uri: Full S3 URI of the uploaded file
 */
export async function POST(request: NextRequest) {
  // Check for internal secret (for cron/internal calls)
  const internalSecret = process.env.CS2_ARCHIVE_INTERNAL_SECRET;
  
  // Parse request body first to check for internal secret
  let body: { demoUrl?: string; filename?: string; internalSecret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ 
      error: 'Invalid JSON body' 
    }, { status: 400 });
  }
  
  // Authenticate: either Clerk session OR internal secret
  const isInternalCall = internalSecret && body.internalSecret === internalSecret;
  
  if (!isInternalCall) {
    // Verify user is authenticated via Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized. You must be logged in to access this endpoint.' 
      }, { status: 401 });
    }
  }

  const { demoUrl, filename } = body;

  if (!demoUrl) {
    return NextResponse.json({ 
      error: 'Missing required field: demoUrl' 
    }, { status: 400 });
  }

  if (!filename) {
    return NextResponse.json({ 
      error: 'Missing required field: filename' 
    }, { status: 400 });
  }

  // Get S3 configuration from environment
  const s3Path = process.env.CS2_DEMOS_S3_PATH;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'us-east-1';

  if (!s3Path) {
    return NextResponse.json({ 
      error: 'S3 path not configured. Set CS2_DEMOS_S3_PATH environment variable (e.g., s3://bucket-name/prefix).' 
    }, { status: 500 });
  }

  if (!awsAccessKeyId || !awsSecretAccessKey) {
    return NextResponse.json({ 
      error: 'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.' 
    }, { status: 500 });
  }

  const parsedPath = parseS3Path(s3Path);
  if (!parsedPath) {
    return NextResponse.json({ 
      error: 'Invalid CS2_DEMOS_S3_PATH format. Expected s3://bucket-name/prefix' 
    }, { status: 500 });
  }

  const { bucket, prefix } = parsedPath;
  const s3Key = prefix ? `${prefix}/${filename}` : filename;
  const s3Uri = `s3://${bucket}/${s3Key}`;

  console.log(`Downloading demo from ${demoUrl}...`);

  try {
    // Download the demo file from Valve CDN
    const downloadResponse = await fetch(demoUrl);
    
    if (!downloadResponse.ok) {
      return NextResponse.json({ 
        error: `Failed to download demo: HTTP ${downloadResponse.status}` 
      }, { status: 502 });
    }

    const demoBuffer = await downloadResponse.arrayBuffer();
    const demoSize = demoBuffer.byteLength;
    
    console.log(`Downloaded ${(demoSize / 1024 / 1024).toFixed(2)} MB, uploading to S3...`);

    // Upload to S3
    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: Buffer.from(demoBuffer),
      ContentType: 'application/x-bzip2',
    }));

    console.log(`Successfully uploaded to ${s3Uri}`);

    return NextResponse.json({
      success: true,
      s3Uri,
      size: demoSize,
    });
  } catch (error) {
    console.error('Error archiving demo:', error);
    return NextResponse.json({ 
      error: 'Error archiving demo: ' + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 });
  }
}
