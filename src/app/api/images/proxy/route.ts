import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Check if AWS credentials are configured
const hasAwsCredentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

if (!hasAwsCredentials) {
    console.warn('AWS credentials not configured - images will not be proxied');
}

const s3Client = hasAwsCredentials
    ? new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
      })
    : null;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const imageUrl = searchParams.get('url');

        console.log('Image proxy request:', { imageUrl });

        if (!imageUrl) {
            return NextResponse.json(
                { error: 'Image URL is required' },
                { status: 400 }
            );
        }

        // Validate that it's an S3 URL from our bucket
        if (!imageUrl.includes('forwardontics-profile-pictures-dev.s3')) {
            return NextResponse.json(
                { error: 'Invalid S3 URL' },
                { status: 400 }
            );
        }

        // For now, just return a placeholder since AWS credentials might not be configured
        console.log('Returning placeholder image for development');
        return NextResponse.redirect(
            'https://via.placeholder.com/100x100/cccccc/666666?text=CR',
            302
        );
    } catch (error) {
        console.error('Error in image proxy:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch image',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
