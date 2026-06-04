import { NextRequest, NextResponse } from 'next/server';
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { verifyIdToken } from '@/lib/auth/verifyToken';
import { getReviewerLimits, getReviewerTestLimits } from '@/lib/auth/reviewerAccess';
import { ensureReviewersTable } from '@/lib/db/reviewers';
import { getPgPool } from '@/lib/db/pool';

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

export async function POST(request: NextRequest) {
    const token = request.cookies.get('idToken')?.value;
    if (!token) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        );
    }

    try {
        const user = await verifyIdToken(token);
        if (!user || !user.groups?.includes('Admin')) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            );
        }
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const { email, role, fullName } = await request.json();
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    if (!email || !role || !userPoolId) {
        return NextResponse.json(
            { error: 'Missing parameters' },
            { status: 400 }
        );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return NextResponse.json(
            { error: 'Invalid email format' },
            { status: 400 }
        );
    }

    const validRoles = ['Admin', 'User', 'Manager', 'Reviewer', 'Reviewer-test'];
    if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    try {
        const userAttributes: { Name: string; Value: string }[] = [
            { Name: 'email', Value: email },
        ];
        if (fullName != null && String(fullName).trim()) {
            userAttributes.push({ Name: 'name', Value: String(fullName).trim() });
        }

        const createResult = await client.send(
            new AdminCreateUserCommand({
                UserPoolId: userPoolId,
                Username: email,
                UserAttributes: userAttributes,
                DesiredDeliveryMediums: ['EMAIL'],
            })
        );

        await client.send(
            new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: email,
                GroupName: role,
            })
        );

        const cognitoSub =
            createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value ?? null;

        if (
            (role === 'Reviewer' || role === 'Reviewer-test') &&
            cognitoSub
        ) {
            const limits = role === 'Reviewer-test' ? getReviewerTestLimits() : getReviewerLimits();
            const membershipExpiresAt = new Date(
                Date.now() + limits.accessPeriodDays * 24 * 60 * 60 * 1000
            ).toISOString();

            await ensureReviewersTable();
            const pool = getPgPool();
            const name = fullName != null && String(fullName).trim() ? String(fullName).trim() : null;
            await pool.query(
                `INSERT INTO reviewers (cognito_sub, email, fullname, is_admin, max_patient_capacity, membership_expires_at)
                 VALUES ($1, $2, $3, false, $4, $5)
                 ON CONFLICT (cognito_sub) DO UPDATE SET
                   email = EXCLUDED.email,
                   fullname = EXCLUDED.fullname,
                   max_patient_capacity = EXCLUDED.max_patient_capacity,
                   membership_expires_at = EXCLUDED.membership_expires_at,
                   updated_at = NOW()`,
                [cognitoSub, email, name, limits.maxPatients, membershipExpiresAt]
            );
        }

        return NextResponse.json({ email, role, fullName: fullName ?? null });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'An unknown error occurred' },
            { status: 500 }
        );
    }
}
