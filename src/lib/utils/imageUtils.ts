/**
 * Transforms an S3 URL to use our proxy endpoint for secure access
 * @param s3Url - The original S3 URL
 * @returns The proxy URL that will securely serve the image
 */
export function getSecureImageUrl(
    s3Url: string | null | undefined
): string | null {
    if (!s3Url) return null;

    // If it's already a proxy URL, return as is
    if (s3Url.includes('/api/images/proxy')) {
        return s3Url;
    }

    // Transform S3 URL to proxy URL
    const encodedUrl = encodeURIComponent(s3Url);
    return `/api/images/proxy?url=${encodedUrl}`;
}

/**
 * Checks if a URL is an S3 URL that needs to be proxied
 * @param url - The URL to check
 * @returns True if it's an S3 URL that needs proxying
 */
export function isS3Url(url: string | null | undefined): boolean {
    if (!url) return false;
    return (
        url.includes('s3.amazonaws.com') ||
        url.includes('s3.us-east-1.amazonaws.com')
    );
}
