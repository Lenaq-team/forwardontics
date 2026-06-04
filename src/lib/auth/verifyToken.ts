import jwt from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';

interface JWK {
    kid: string;
    [key: string]: unknown;
}

interface DecodedToken {
    header: { kid: string };
    payload: { email: string; 'custom:role'?: string };
}

interface VerifiedToken {
    email: string;
    sub?: string;
    'custom:role'?: string;
    'cognito:groups'?: string[];
}

let jwksCache: Record<string, string> | null = null;
let jwksCacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function verifyIdToken(
    token: string
): Promise<{ email: string; sub?: string; role: string; groups: string[] } | null> {
    const region = 'us-east-1'; // update if different
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
    const iss = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    // Check if cache is expired or empty
    const now = Date.now();
    if (!jwksCache || now - jwksCacheTime > CACHE_DURATION) {
        try {
            // Add timeout to the fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const res = await fetch(`${iss}/.well-known/jwks.json`, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`Failed to fetch JWKS: ${res.status}`);
            }

            const { keys } = await res.json();
            jwksCache = keys.reduce((acc: Record<string, string>, key: JWK) => {
                acc[key.kid] = jwkToPem(key as unknown as jwkToPem.JWK);
                return acc;
            }, {});
            jwksCacheTime = now;
        } catch (error) {
            // If JWKS fetch fails, try to use cached data if available
            if (jwksCache) {
                console.warn('JWKS fetch failed, using cached data:', error);
            } else {
                console.error(
                    'JWKS fetch failed and no cache available:',
                    error
                );
                return null;
            }
        }
    }

    const decoded = jwt.decode(token, {
        complete: true,
    }) as DecodedToken | null;
    if (!decoded) {
        return null;
    }

    const kid = decoded.header.kid;
    const pem = jwksCache?.[kid];

    if (!pem) {
        return null;
    }

    try {
        const verified = jwt.verify(token, pem, {
            issuer: iss,
        }) as VerifiedToken;

        return {
            email: verified.email,
            sub: verified.sub,
            role: verified['custom:role'] || 'User',
            groups: verified['cognito:groups'] || [],
        };
    } catch (error) {
        return null;
    }
}
