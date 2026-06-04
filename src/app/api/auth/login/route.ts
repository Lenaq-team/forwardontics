import { NextRequest, NextResponse } from 'next/server';
import { CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
import { userPool } from '@/lib/cognito/userPool';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();

    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
    });

    return new Promise<NextResponse>((resolve) => {
        user.authenticateUser(authDetails, {
            onSuccess: (result) => {
                const idToken = result.getIdToken().getJwtToken();

                const cookie = serialize('idToken', idToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60,
                    domain:
                        process.env.NODE_ENV === 'production'
                            ? undefined
                            : 'localhost',
                });

                // Used for browser-side AWS auth (direct S3 upload).
                // Keep it short-lived to reduce exposure risk.
                const clientCookie = serialize('idTokenClient', idToken, {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 10 * 60, // 10 minutes
                    domain:
                        process.env.NODE_ENV === 'production'
                            ? undefined
                            : 'localhost',
                });

                const response = new NextResponse(JSON.stringify({ success: true }), {
                    status: 200,
                });
                response.headers.append('Set-Cookie', cookie);
                response.headers.append('Set-Cookie', clientCookie);
                resolve(response);
            },

            onFailure: (err) => {
                resolve(
                    NextResponse.json({ error: err.message }, { status: 401 })
                );
            },

            newPasswordRequired: () => {
                resolve(
                    NextResponse.json(
                        { error: 'NEW_PASSWORD_REQUIRED' },
                        { status: 409 }
                    )
                );
            },
        });
    });
}
