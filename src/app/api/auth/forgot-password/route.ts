import { NextRequest, NextResponse } from 'next/server';
import {
    CognitoIdentityProviderClient,
    ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

const ClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

export async function POST(req: NextRequest) {
    if (!ClientId) {
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        );
    }

    let body: { email?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email) {
        return NextResponse.json(
            { error: 'Email is required' },
            { status: 400 }
        );
    }

    try {
        await client.send(
            new ForgotPasswordCommand({
                ClientId,
                Username: email,
            })
        );
    } catch (err: unknown) {
        // Always return success to avoid email enumeration.
        // Cognito may throw UserNotFoundException or LimitExceededException, etc.
        console.warn('ForgotPassword request failed:', err);
    }

    return NextResponse.json({
        success: true,
        message:
            'If an account exists with this email, you will receive a verification code shortly. Please check your inbox and spam folder.',
    });
}
