import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    AdminResetUserPasswordCommand,
    AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureAuditLogsTable } from "@/lib/db/auditLogs";
import { getPgPool } from "@/lib/db/pool";
import { generateSecurePassword } from "@/lib/auth/generatePassword";

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
});

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ patientId: string }> }
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

    const { patientId } = await params;
    if (!patientId) {
        return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
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
        await ensurePatientsTable();
        await ensureAuditLogsTable();
        const pool = getPgPool();

        const result = await pool.query<{
            email: string | null;
            full_name: string | null;
        }>(
            `SELECT email, full_name FROM patients WHERE id = $1`,
            [patientId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const patient = result.rows[0];
        if (!patient.email) {
            return NextResponse.json({ error: "Patient has no email address" }, { status: 400 });
        }

        if (method === "email") {
            await client.send(
                new AdminResetUserPasswordCommand({
                    UserPoolId: userPoolId,
                    Username: patient.email,
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
                    patientId,
                    patient.email,
                    patient.full_name ?? null,
                    "patient",
                    `Reset email sent to ${patient.email}`,
                ]
            );

            return NextResponse.json({ success: true });
        } else {
            const temporaryPassword = generateSecurePassword();

            await client.send(
                new AdminSetUserPasswordCommand({
                    UserPoolId: userPoolId,
                    Username: patient.email,
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
                    patientId,
                    patient.email,
                    patient.full_name ?? null,
                    "patient",
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
