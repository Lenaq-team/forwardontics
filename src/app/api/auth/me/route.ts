import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth/verifyToken';

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('idToken')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const user = await verifyIdToken(token);

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 403 }
            );
        }

        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
