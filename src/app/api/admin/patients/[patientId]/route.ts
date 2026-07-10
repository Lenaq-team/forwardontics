import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureAuditLogsTable } from "@/lib/db/auditLogs";
import { getPgPool } from "@/lib/db/pool";

type PatchAction = "disable" | "enable" | "extend";

async function verifyAdmin(req: NextRequest) {
    const token = req.cookies.get("idToken")?.value;
    if (!token) return null;
    try {
        const user = await verifyIdToken(token);
        if (!user || !user.groups?.includes("Admin")) return null;
        return { email: user.email, sub: user.sub ?? "" };
    } catch {
        return null;
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ patientId: string }> }
) {
    const admin = await verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { patientId } = await params;
    if (!patientId) {
        return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    let body: { action?: unknown; days?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action as PatchAction | undefined;
    if (!action || !["disable", "enable", "extend"].includes(action)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let days: number | undefined;
    if (action === "enable" || action === "extend") {
        days = typeof body.days === "number" ? body.days : parseInt(String(body.days), 10);
        if (!Number.isInteger(days) || days < 1 || days > 3650) {
            return NextResponse.json(
                { error: "days must be an integer between 1 and 3650" },
                { status: 400 }
            );
        }
    }

    try {
        await ensurePatientsTable();
        await ensureAuditLogsTable();
        const pool = getPgPool();

        const patientResult = await pool.query<{
            id: string;
            email: string | null;
            full_name: string | null;
            membership_expires_at: string | null;
        }>(
            `SELECT id, email, full_name, membership_expires_at FROM patients WHERE id = $1`,
            [patientId]
        );

        if (patientResult.rows.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const patient = patientResult.rows[0];
        let newExpiry: string;
        let auditAction: string;
        let auditDetails: string;

        if (action === "disable") {
            const updated = await pool.query<{ membership_expires_at: string }>(
                `UPDATE patients SET membership_expires_at = NOW(), updated_at = NOW()
                 WHERE id = $1 RETURNING membership_expires_at`,
                [patientId]
            );
            newExpiry = updated.rows[0].membership_expires_at;
            auditAction = "DISABLE_PATIENT";
            auditDetails = "Membership revoked immediately";
        } else if (action === "enable") {
            const updated = await pool.query<{ membership_expires_at: string }>(
                `UPDATE patients
                 SET membership_expires_at = NOW() + ($1 || ' days')::interval, updated_at = NOW()
                 WHERE id = $2 RETURNING membership_expires_at`,
                [days, patientId]
            );
            newExpiry = updated.rows[0].membership_expires_at;
            auditAction = "ENABLE_PATIENT";
            auditDetails = `Enabled for ${days} days. New expiry: ${new Date(newExpiry).toISOString().slice(0, 10)}`;
        } else {
            // extend
            const updated = await pool.query<{ membership_expires_at: string }>(
                `UPDATE patients
                 SET membership_expires_at = GREATEST(NOW(), COALESCE(membership_expires_at, NOW())) + ($1 || ' days')::interval,
                     updated_at = NOW()
                 WHERE id = $2 RETURNING membership_expires_at`,
                [days, patientId]
            );
            newExpiry = updated.rows[0].membership_expires_at;
            auditAction = "EXTEND_MEMBERSHIP";
            auditDetails = `Extended by ${days} days. New expiry: ${new Date(newExpiry).toISOString().slice(0, 10)}`;
        }

        await pool.query(
            `INSERT INTO audit_logs
               (performed_by_email, performed_by_sub, action, target_id, target_email, target_name, target_role, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                admin.email,
                admin.sub,
                auditAction,
                patientId,
                patient.email ?? null,
                patient.full_name ?? null,
                "patient",
                auditDetails,
            ]
        );

        return NextResponse.json({ success: true, membershipExpiresAt: newExpiry });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
});

export async function DELETE(
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

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    try {
        await ensurePatientsTable();
        await ensureAuditLogsTable();

        const pool = getPgPool();

        // Fetch patient record
        const patientResult = await pool.query<{
            id: string;
            cognito_sub: string;
            email: string | null;
            full_name: string | null;
        }>(
            `SELECT id, cognito_sub, email, full_name FROM patients WHERE id = $1`,
            [patientId]
        );

        if (patientResult.rows.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const patient = patientResult.rows[0];

        // Delete from Cognito (tolerate UserNotFoundException — user may already be removed)
        if (patient.email) {
            try {
                await client.send(
                    new AdminDeleteUserCommand({
                        UserPoolId: userPoolId,
                        Username: patient.email,
                    })
                );
            } catch (err: unknown) {
                const code = (err as { name?: string }).name;
                if (code !== "UserNotFoundException") {
                    throw err;
                }
            }
        }

        // Delete video uploads
        await pool.query(
            `DELETE FROM video_uploads WHERE user_sub = $1`,
            [patient.cognito_sub]
        );

        // Delete patient record
        await pool.query(`DELETE FROM patients WHERE id = $1`, [patientId]);

        // Write audit log
        await pool.query(
            `INSERT INTO audit_logs
               (performed_by_email, performed_by_sub, action, target_id, target_email, target_name, target_role)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                adminEmail,
                adminSub,
                "DELETE_USER",
                patientId,
                patient.email ?? null,
                patient.full_name ?? null,
                "patient",
            ]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
