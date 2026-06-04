import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Check if AWS credentials are configured
const hasAwsCredentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

if (!hasAwsCredentials) {
    console.warn('AWS credentials not configured - videos will not be proxied');
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

const DEFAULT_BUCKET = 'gopex-videos-dev';

/** Mobile browsers have issues with proxied video (206/range, buffering). Use presigned S3 redirect. */
function isMobileVideoClient(userAgent: string | null): boolean {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return (
        (ua.includes('android') && ua.includes('chrome')) ||
        ua.includes('iphone') ||
        ua.includes('ipad')
    );
}

/** Infer video MIME type from key when S3 returns generic type. */
function getVideoContentType(s3ContentType: string | undefined, key: string): string {
    if (s3ContentType && s3ContentType.startsWith('video/')) return s3ContentType;
    const ext = key.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        ogg: 'video/ogg',
    };
    return mime[ext ?? ''] ?? 'video/mp4';
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const videoKey = searchParams.get('key');
        const bucket = searchParams.get('bucket') || DEFAULT_BUCKET;
        const rangeHeader = request.headers.get('range');
        const userAgent = request.headers.get('user-agent');

        if (!videoKey) {
            return NextResponse.json(
                { error: 'Video key is required' },
                { status: 400 }
            );
        }

        if (!s3Client) {
            return NextResponse.json(
                { error: 'AWS credentials not configured' },
                { status: 500 }
            );
        }

        // Mobile: redirect to presigned S3 URL so browser loads directly from S3.
        // S3 handles Range/206 natively and avoids proxy buffering/streaming issues.
        if (isMobileVideoClient(userAgent)) {
            const command = new GetObjectCommand({ Bucket: bucket, Key: videoKey });
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return NextResponse.redirect(presignedUrl, 302);
        }

        const useRange = rangeHeader?.startsWith('bytes=');
        const commandInput: { Bucket: string; Key: string; Range?: string } = {
            Bucket: bucket,
            Key: videoKey,
        };
        if (useRange) commandInput.Range = rangeHeader!;

        const response = await s3Client.send(new GetObjectCommand(commandInput));

        if (!response.Body) {
            return NextResponse.json(
                { error: 'Video not found' },
                { status: 404 }
            );
        }

        const contentType = getVideoContentType(response.ContentType, videoKey);
        const contentLength = response.ContentLength?.toString() || '';
        const contentRange = response.ContentRange;
        const isPartial = useRange && !!response.ContentRange;

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=604800',
            'Accept-Ranges': 'bytes',
        };
        if (contentLength) headers['Content-Length'] = contentLength;
        if (contentRange) headers['Content-Range'] = contentRange;

        const stream = response.Body.transformToWebStream();
        return new NextResponse(stream, {
            status: isPartial ? 206 : 200,
            headers,
        });
    } catch (error) {
        console.error('Error in video proxy:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch video',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
