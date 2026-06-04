import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

function getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const parts = document.cookie.split('; ').map((c) => c.trim());
    const match = parts.find((p) => p.startsWith(`${name}=`));
    if (!match) return null;
    return decodeURIComponent(match.slice(name.length + 1));
}

function base64UrlDecode(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
    );
    return atob(padded);
}

export function getCognitoSubFromIdToken(idToken: string): string | null {
    try {
        const payload = idToken.split('.')[1];
        if (!payload) return null;
        const json = base64UrlDecode(payload);
        const parsed = JSON.parse(json) as { sub?: string };
        return parsed.sub ?? null;
    } catch {
        return null;
    }
}

export function getIdTokenForBrowserAwsAuth(): string | null {
    // This cookie is set by our auth routes specifically for browser-side AWS auth.
    // NOTE: This is intentionally *not* httpOnly, so treat it as sensitive.
    return getCookieValue('idTokenClient');
}

export function createAuthedS3Client() {
    const region =
        process.env.NEXT_PUBLIC_REGION ||
        process.env.NEXT_PUBLIC_AWS_REGION ||
        'us-east-1';
    const identityPoolId = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID;
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

    if (!identityPoolId) {
        throw new Error('Missing NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID');
    }
    if (!userPoolId) {
        throw new Error('Missing NEXT_PUBLIC_COGNITO_USER_POOL_ID');
    }

    // Identity Pool IDs look like: us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    // (This is NOT the Cognito App Client ID)
    const identityPoolIdPattern = /^[\w-]+:[0-9a-f-]+$/i;
    if (!identityPoolIdPattern.test(identityPoolId)) {
        throw new Error(
            `Invalid NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID: expected format "region:uuid" (got "${identityPoolId}")`,
        );
    }

    const idToken = getIdTokenForBrowserAwsAuth();
    if (!idToken) {
        throw new Error('Missing Cognito id token (idTokenClient cookie)');
    }

    const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    const cognitoIdentityClient = new CognitoIdentityClient({ region });

    return new S3Client({
        region,
        credentials: fromCognitoIdentityPool({
            client: cognitoIdentityClient,
            identityPoolId,
            logins: {
                [providerName]: idToken,
            },
        }),
    });
}
