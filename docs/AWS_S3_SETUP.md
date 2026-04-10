# AWS S3 Setup for CS2 Demo Archiving

This guide walks you through creating AWS credentials and an S3 bucket for storing CS2 demo files.

## Prerequisites

- An AWS account (create one at https://aws.amazon.com if needed)
- Access to the AWS Management Console

---

## Step 1: Create an S3 Bucket

1. Go to the [S3 Console](https://s3.console.aws.amazon.com/s3/buckets)
2. Click **Create bucket**
3. Configure the bucket:
   - **Bucket name**: Choose a unique name (e.g., `my-cs2-demos`)
   - **AWS Region**: Select a region close to you (e.g., `us-east-1`)
   - **Object Ownership**: Keep "ACLs disabled (recommended)"
   - **Block Public Access**: Keep all boxes checked (recommended for private storage)
   - **Bucket Versioning**: Disable (not needed for demos)
   - **Default encryption**: Enable with SSE-S3 (default)
4. Click **Create bucket**

### Optional: Create a folder prefix

If you want to organize demos by environment:
1. Open your new bucket
2. Click **Create folder**
3. Name it `dev` or `prod`
4. Your S3 path will be: `s3://my-cs2-demos/dev`

---

## Step 2: Create an IAM User for Programmatic Access

1. Go to the [IAM Console](https://console.aws.amazon.com/iam/)
2. In the left sidebar, click **Users**
3. Click **Create user**
4. Configure the user:
   - **User name**: `cs2-demo-uploader` (or any descriptive name)
   - Click **Next**

---

## Step 3: Attach Permissions

1. Select **Attach policies directly**
2. Click **Create policy** (opens in new tab)
3. Switch to the **JSON** tab and paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "CS2DemoUpload",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME",
                "arn:aws:s3:::YOUR-BUCKET-NAME/*"
            ]
        }
    ]
}
```

4. Replace `YOUR-BUCKET-NAME` with your actual bucket name (e.g., `my-cs2-demos`)
5. Click **Next**
6. **Policy name**: `CS2DemoUploadPolicy`
7. Click **Create policy**

8. Go back to the user creation tab
9. Click the refresh button (🔄) next to the search box
10. Search for `CS2DemoUploadPolicy` and check the box
11. Click **Next**
12. Click **Create user**

---

## Step 4: Create Access Keys

1. Click on the user you just created (`cs2-demo-uploader`)
2. Go to the **Security credentials** tab
3. Scroll down to **Access keys**
4. Click **Create access key**
5. Select **Application running outside AWS**
6. Click **Next**
7. (Optional) Add a description: "Convex CS2 demo uploader"
8. Click **Create access key**

**IMPORTANT**: Copy both values now - you won't be able to see the secret again!

- **Access key ID**: `AKIA...` (20 characters)
- **Secret access key**: `wJalr...` (40 characters)

9. Click **Done**

---

## Step 5: Configure Environment Variables

Add these to your Convex environment:

```bash
# Set via Convex CLI
npx convex env set AWS_ACCESS_KEY_ID AKIA...your-access-key...
npx convex env set AWS_SECRET_ACCESS_KEY wJalr...your-secret-key...
npx convex env set AWS_REGION us-east-1
npx convex env set CS2_DEMOS_S3_PATH s3://my-cs2-demos/dev
```

Or set them in the [Convex Dashboard](https://dashboard.convex.dev):
1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add each variable

---

## Verification

After setting up, you can verify the configuration:

1. Go to the Admin page in your app
2. Fetch some CS2 matches (if you have any with demo URLs)
3. Click "Archive Demos to S3"
4. Check your S3 bucket for the uploaded files

---

## Security Best Practices

1. **Minimal permissions**: The policy above only grants `PutObject`, `GetObject`, and `ListBucket` - nothing more
2. **Never commit credentials**: AWS credentials should only be in environment variables, never in code
3. **Rotate keys periodically**: Create new access keys and delete old ones every 90 days
4. **Enable MFA on your AWS account**: Protect your root account with multi-factor authentication

---

## Troubleshooting

### "Access Denied" error
- Verify the bucket name in your policy matches exactly
- Check that the IAM user has the policy attached
- Ensure `CS2_DEMOS_S3_PATH` uses the correct bucket name

### "Invalid bucket name" error
- S3 bucket names must be globally unique
- Names can only contain lowercase letters, numbers, and hyphens
- Names must be 3-63 characters long

### "Credentials not configured" error
- Verify all 4 environment variables are set in Convex
- Check for typos in the access key ID and secret

---

## Cost Estimation

CS2 demo files are typically 50-150 MB (compressed). With S3 Standard pricing:

| Demos/month | Storage | Cost (approx) |
|-------------|---------|---------------|
| 50          | ~5 GB   | ~$0.12/month  |
| 200         | ~20 GB  | ~$0.46/month  |
| 500         | ~50 GB  | ~$1.15/month  |

Plus minimal costs for PUT requests (~$0.005 per 1,000 requests).

---

## Cleanup (if needed)

To remove everything:

1. **Empty the bucket**: S3 Console → Select bucket → Empty
2. **Delete the bucket**: S3 Console → Select bucket → Delete
3. **Delete the IAM user**: IAM Console → Users → Select user → Delete
4. **Delete the policy**: IAM Console → Policies → Select policy → Delete
5. **Remove env vars**: `npx convex env unset AWS_ACCESS_KEY_ID` (repeat for each)
