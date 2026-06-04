import { NextRequest, NextResponse } from 'next/server';
import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    ListGroupsCommand,
    AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { verifyIdToken } from '@/lib/auth/verifyToken';

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

export async function GET(req: NextRequest) {
    // Check authentication
    const token = req.cookies.get('idToken')?.value;
    if (!token) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        );
    }

    // Verify user is admin
    try {
        const user = await verifyIdToken(token);
        if (!user || !user.groups?.includes('Admin')) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            );
        }
    } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
        return NextResponse.json(
            { error: 'Missing UserPoolId' },
            { status: 400 }
        );
    }

    try {
        // Get all users in one call
        const usersResult = await client.send(
            new ListUsersCommand({ UserPoolId: userPoolId })
        );

        // Get all groups in one call
        const groupsResult = await client.send(
            new ListGroupsCommand({ UserPoolId: userPoolId })
        );

        // Create a map of group names for quick lookup
        const groupMap = new Map();
        if (groupsResult.Groups) {
            for (const group of groupsResult.Groups) {
                if (group.GroupName) {
                    groupMap.set(group.GroupName, group.GroupName);
                }
            }
        }

        // Process users with complete attributes
        const users = await Promise.all(
            (usersResult.Users || []).map(async (user) => {
                const username = user.Username || '';
                let role = 'User'; // Default role

                // Get user attributes
                const attributes: Record<string, string> = {};
                if (user.Attributes) {
                    for (const attr of user.Attributes) {
                        if (attr.Name && attr.Value !== undefined) {
                            attributes[attr.Name] = attr.Value;
                        }
                    }
                }

                // Get user groups
                if (username) {
                    try {
                        const groupRes = await client.send(
                            new AdminListGroupsForUserCommand({
                                Username: username,
                                UserPoolId: userPoolId,
                            })
                        );
                        if (groupRes.Groups?.length) {
                            role = groupRes.Groups[0].GroupName || 'User';
                        }
                    } catch (err) {
                        // User might not have groups, which is fine
                        role = 'User';
                    }
                }

                return {
                    username,
                    email: attributes.email || '',
                    role,
                    attributes,
                    userStatus: user.UserStatus,
                    enabled: user.Enabled,
                    userCreateDate: user.UserCreateDate,
                    lastModifiedDate: user.UserLastModifiedDate,
                    sub: attributes.sub || '',
                    birthdate: attributes.birthdate || '',
                    picture: attributes.picture || '',
                    emailVerified: attributes.email_verified === 'true',
                    name: attributes.name || '',
                    family_name: attributes.family_name || '',
                };
            })
        );

        return NextResponse.json(users);
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
