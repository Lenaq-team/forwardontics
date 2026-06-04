import jwt from 'jsonwebtoken';

export function decodeIdToken(
    token: string
): { email: string; role: string } | null {
    try {
        interface DecodedToken {
            email: string;
            'custom:role'?: string;
        }
        const decoded = jwt.decode(token) as DecodedToken;
        return {
            email: decoded.email,
            role: decoded['custom:role'] || 'User',
        };
    } catch (err) {
        console.error('Error decoding token:', err);
        return null;
    }
}
