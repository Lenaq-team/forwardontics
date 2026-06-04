import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth/verifyToken';

export async function POST(req: NextRequest) {
    const { token } = await req.json();

    if (!token) {
        return NextResponse.json(
            { error: 'No token provided' },
            { status: 400 }
        );
    }

    try {
        const user = await verifyIdToken(token);

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                email: user.email,
                role: user.role,
                groups: user.groups,
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Token verification failed',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
