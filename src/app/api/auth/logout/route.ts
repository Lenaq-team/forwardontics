import { NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST() {
    try {
        // Clear all authentication cookies
        const cookies = [
            serialize('idToken', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                expires: new Date(0),
            }),
            serialize('idTokenClient', '', {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                expires: new Date(0),
            }),
            serialize('accessToken', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                expires: new Date(0),
            }),
            serialize('refreshToken', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                expires: new Date(0),
            }),
            serialize('user', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                expires: new Date(0),
            }),
        ];

        const response = new NextResponse(
            JSON.stringify({
                success: true,
                message: 'Logged out successfully',
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );

        // Set multiple cookies
        cookies.forEach((cookie) => {
            response.headers.append('Set-Cookie', cookie);
        });

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return new NextResponse(
            JSON.stringify({ success: false, message: 'Logout failed' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

// Keep GET method for backward compatibility
export function GET() {
    return POST();
}
