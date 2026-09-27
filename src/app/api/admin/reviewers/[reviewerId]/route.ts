import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensureAuditLogsTable } from "@/lib/db/auditLogs";
import { getPgPool } from "@/lib/db/pool";

type MembershipAction = "disable" | "enable" | "extend";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function PATCH(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { maxPatientCapacity, fullname, action, days: rawDays } = body as {
    maxPatientCapacity?: unknown;
    fullname?: unknown;
    action?: unknown;
    days?: unknown;
  };

  // Membership action (disable/enable/extend) is handled separately from field edits
  if (action !== undefined) {
    const membershipAction = action as MembershipAction;
    if (!["disable", "enable", "extend"].includes(membershipAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let days: number | undefined;
    if (membershipAction === "enable" || membershipAction === "extend") {
      days = typeof rawDays === "number" ? rawDays : parseInt(String(rawDays), 10);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        return NextResponse.json(
          { error: "days must be an integer between 1 and 3650" },
          { status: 400 }
        );
      }
    }

    try {
      await ensureReviewersTable();
      await ensureAuditLogsTable();
      const pool = getPgPool();

      const reviewerResult = await pool.query<{
        id: string;
        email: string | null;
        fullname: string | null;
        membership_expires_at: string | null;
      }>(
        `SELECT id, email, fullname, membership_expires_at FROM reviewers
         WHERE id = $1 AND COALESCE(is_admin, false) = false`,
        [reviewerId]
      );

      if (reviewerResult.rows.length === 0) {
        return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
      }

      const reviewer = reviewerResult.rows[0];
      let newExpiry: string;
      let auditAction: string;
      let auditDetails: string;

      if (membershipAction === "disable") {
        const updated = await pool.query<{ membership_expires_at: string }>(
          `UPDATE reviewers SET membership_expires_at = NOW(), updated_at = NOW()
           WHERE id = $1 RETURNING membership_expires_at`,
          [reviewerId]
        );
        newExpiry = updated.rows[0].membership_expires_at;
        auditAction = "DISABLE_REVIEWER";
        auditDetails = "Membership revoked immediately";
      } else if (membershipAction === "enable") {
        const updated = await pool.query<{ membership_expires_at: string }>(
          `UPDATE reviewers
           SET membership_expires_at = NOW() + ($1 || ' days')::interval, updated_at = NOW()
           WHERE id = $2 RETURNING membership_expires_at`,
          [days, reviewerId]
        );
        newExpiry = updated.rows[0].membership_expires_at;
        auditAction = "ENABLE_REVIEWER";
        auditDetails = `Enabled for ${days} days. New expiry: ${new Date(newExpiry).toISOString().slice(0, 10)}`;
      } else {
        // extend
        const updated = await pool.query<{ membership_expires_at: string }>(
          `UPDATE reviewers
           SET membership_expires_at = GREATEST(NOW(), COALESCE(membership_expires_at, NOW())) + ($1 || ' days')::interval,
               updated_at = NOW()
           WHERE id = $2 RETURNING membership_expires_at`,
          [days, reviewerId]
        );
        newExpiry = updated.rows[0].membership_expires_at;
        auditAction = "EXTEND_REVIEWER_MEMBERSHIP";
        auditDetails = `Extended by ${days} days. New expiry: ${new Date(newExpiry).toISOString().slice(0, 10)}`;
      }

      await pool.query(
        `INSERT INTO audit_logs
           (performed_by_email, performed_by_sub, action, target_id, target_email, target_name, target_role, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          adminEmail,
          adminSub,
          auditAction,
          reviewerId,
          reviewer.email ?? null,
          reviewer.fullname ?? null,
          "reviewer",
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

  // Validate: at least one field must be provided
  if (maxPatientCapacity === undefined && fullname === undefined) {
    return NextResponse.json(
      { error: "At least one of maxPatientCapacity or fullname must be provided" },
      { status: 400 }
    );
  }

  // Validate maxPatientCapacity if provided
  if (maxPatientCapacity !== undefined) {
    if (
      typeof maxPatientCapacity !== "number" ||
      !Number.isInteger(maxPatientCapacity) ||
      maxPatientCapacity < 0
    ) {
      return NextResponse.json(
        { error: "maxPatientCapacity must be a non-negative integer" },
        { status: 400 }
      );
    }
  }

  // Validate fullname if provided
  if (fullname !== undefined) {
    if (typeof fullname !== "string" || !fullname.trim()) {
      return NextResponse.json(
        { error: "fullname must be a non-empty string" },
        { status: 400 }
      );
    }
  }

  try {
    await ensureReviewersTable();
    const pool = getPgPool();

    // Fetch the reviewer's cognito_sub so we can update Cognito
    const reviewerRow = await pool.query<{ id: string; cognito_sub: string }>(
      `SELECT id, cognito_sub FROM reviewers WHERE id = $1 AND COALESCE(is_admin, false) = false`,
      [reviewerId]
    );

    if (reviewerRow.rowCount === 0) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
    }

    const cognitoSub = reviewerRow.rows[0].cognito_sub;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    // Build DB update
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (maxPatientCapacity !== undefined) {
      updates.push(`max_patient_capacity = $${paramIndex++}`);
      values.push(maxPatientCapacity);
    }

    if (fullname !== undefined) {
      updates.push(`fullname = $${paramIndex++}`);
      values.push((fullname as string).trim());
    }

    updates.push(`updated_at = NOW()`);
    values.push(reviewerId);

    await pool.query(
      `UPDATE reviewers SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );

    // Update Cognito if fullname changed
    if (fullname !== undefined && userPoolId) {
      await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: cognitoSub,
          UserAttributes: [
            { Name: "name", Value: (fullname as string).trim() },
          ],
        })
      );
    }

    return NextResponse.json({ id: reviewerId });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
