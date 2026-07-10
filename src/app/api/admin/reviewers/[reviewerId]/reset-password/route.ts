import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    AdminResetUserPasswordCommand,
    AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensureAuditLogsTable } from "@/lib/db/auditLogs";
import { getPgPool } from "@/lib/db/pool";
import { generateSecurePassword } from "@/lib/auth/generatePassword";

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
});

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ reviewerId: string }> }
) {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let adminEmail: string;
    let adminSub: string;
    try {
        const user = await verifyIdToken(token);
        if (!user || !user.groups?.includes("Admin")) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }
        adminEmail = user.email;
        adminSub = user.sub ?? "";
    } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const { reviewerId } = await params;
    if (!reviewerId) {
        return NextResponse.json({ error: "Missing reviewerId" }, { status: 400 });
    }

    let body: { method?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const method = body.method;
    if (method !== "email" && method !== "temporary") {
        return NextResponse.json(
            { error: "method must be 'email' or 'temporary'" },
            { status: 400 }
        );
    }

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    try {
        await ensureReviewersTable();
        await ensureAuditLogsTable();
        const pool = getPgPool();

        const result = await pool.query<{
            email: string | null;
            fullname: string | null;
        }>(
            `SELECT email, fullname FROM reviewers WHERE id = $1 AND COALESCE(is_admin, false) = false`,
            [reviewerId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
        }

        const reviewer = result.rows[0];
        if (!reviewer.email) {
            return NextResponse.json({ error: "Reviewer has no email address" }, { status: 400 });
        }

        if (method === "email") {
            await client.send(
                new AdminResetUserPasswordCommand({
                    UserPoolId: userPoolId,
                    Username: reviewer.email,
                })
            );

            await pool.query(
                `INSERT INTO audit_logs
                   (performed_by_email, performed_by_sub, action, target_id, target_email, target_name, target_role, details)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    adminEmail,
                    adminSub,
                    "RESET_PASSWORD_EMAIL",
                    reviewerId,
                    reviewer.email,
                    reviewer.fullname ?? null,
                    "reviewer",
                    `Reset email sent to ${reviewer.email}`,
                ]
            );

            return NextResponse.json({ success: true });
        } else {
            const temporaryPassword = generateSecurePassword();

            await client.send(
                new AdminSetUserPasswordCommand({
                    UserPoolId: userPoolId,
                    Username: reviewer.email,
                    Password: temporaryPassword,
                    Permanent: false,
                })
            );

            await pool.query(
                `INSERT INTO audit_logs
                   (performed_by_email, performed_by_sub, action, target_id, target_email, target_name, target_role, details)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    adminEmail,
                    adminSub,
                    "RESET_PASSWORD_TEMPORARY",
                    reviewerId,
                    reviewer.email,
                    reviewer.fullname ?? null,
                    "reviewer",
                    "Temporary password set (password not logged for security)",
                ]
            );

            return NextResponse.json({ success: true, temporaryPassword });
        }
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
