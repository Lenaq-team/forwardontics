import { NextRequest, NextResponse } from 'next/server';
import {
    CognitoIdentityProviderClient,
    ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

const ClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

export async function POST(req: NextRequest) {
    if (!ClientId) {
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        );
    }

    let body: { email?: string; code?: string; newPassword?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const newPassword =
        typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!email) {
        return NextResponse.json(
            { error: 'Email is required' },
            { status: 400 }
        );
    }
    if (!code) {
        return NextResponse.json(
            { error: 'Verification code is required' },
            { status: 400 }
        );
    }
    if (!newPassword) {
        return NextResponse.json(
            { error: 'New password is required' },
            { status: 400 }
        );
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
        return NextResponse.json(
            {
                error:
                    'Password must be at least 8 characters with uppercase, lowercase, number, and special character.',
            },
            { status: 400 }
        );
    }

    try {
        await client.send(
            new ConfirmForgotPasswordCommand({
                ClientId,
                Username: email,
                ConfirmationCode: code,
                Password: newPassword,
            })
        );
        return NextResponse.json({
            success: true,
            message: 'Password has been reset. You can now sign in with your new password.',
        });
    } catch (err: unknown) {
        const message =
            err && typeof err === 'object' && 'name' in err
                ? String((err as { name: string }).name)
                : '';
        if (
            message === 'CodeMismatchException' ||
            message === 'ExpiredCodeException'
        ) {
            return NextResponse.json(
                {
                    error:
                        message === 'ExpiredCodeException'
                            ? 'Verification code has expired. Please request a new code.'
                            : 'Invalid verification code. Please check and try again.',
                },
                { status: 400 }
            );
        }
        console.error('ConfirmForgotPassword failed:', err);
        return NextResponse.json(
            { error: 'Failed to reset password. Please try again.' },
            { status: 500 }
        );
    }
}
