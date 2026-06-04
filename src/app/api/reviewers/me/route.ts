import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import {
  canAccessReviewer,
  getLimitsForGroups,
} from "@/lib/auth/reviewerAccess";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { getPgPool } from "@/lib/db/pool";

type ReviewerRow = {
  id: string;
  cognito_sub: string;
  fullname: string | null;
  email: string | null;
  phone: string | null;
  max_patient_capacity: number | null;
  total_patient_capacity: number | null;
  membership_expires_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await verifyIdToken(token);
    if (!user || !user.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const groups = user.groups ?? [];
    if (!canAccessReviewer(groups)) {
      return NextResponse.json(
        { error: "Reviewer or Admin access required" },
        { status: 403 }
      );
    }

    await ensureReviewersTable();
    await ensurePatientsTable();
    await ensureVideoUploadsTable();

    const pool = getPgPool();
    const selectCols =
      `id, cognito_sub, fullname, email, phone, max_patient_capacity, total_patient_capacity, membership_expires_at, terms_accepted_at, created_at, updated_at`;

    let result = await pool.query<ReviewerRow>(
      `SELECT ${selectCols} FROM reviewers WHERE cognito_sub = $1`,
      [user.sub]
    );

    const isAdmin = groups.includes("Admin");

    if (result.rows.length === 0) {
      // Never add Admin to the reviewers table (Admin is not a reviewer)
      if (isAdmin) {
        const limits = getLimitsForGroups(groups);
        const maxCap = limits ? limits.maxPatients : 0;
        // Admin may have a shadow row for terms acceptance only
        const adminRow = await pool.query<{ terms_accepted_at: string | null }>(
          `SELECT terms_accepted_at FROM reviewers WHERE cognito_sub = $1`,
          [user.sub]
        );
        const termsAcceptedAt = adminRow.rows[0]?.terms_accepted_at ?? null;
        return NextResponse.json({
          id: null,
          cognitoSub: user.sub,
          fullname: null,
          email: user.email ?? null,
          phone: null,
          maxPatientCapacity: maxCap,
          totalPatientCapacity: 0,
          pendingReviews: 0,
          totalReviewsMade: 0,
          membershipExpiresAt: null,
          isMembershipActive: false,
          termsAcceptedAt,
        });
      }
      const limits = getLimitsForGroups(groups);
      const expiresAt = limits
        ? new Date(
            Date.now() + limits.accessPeriodDays * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;
      const maxCapacity = limits ? limits.maxPatients : null;

      await pool.query(
        `INSERT INTO reviewers (cognito_sub, email, max_patient_capacity, membership_expires_at, is_admin)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (cognito_sub) DO NOTHING`,
        [
          user.sub,
          user.email ?? null,
          maxCapacity,
          expiresAt,
        ]
      );
      result = await pool.query<ReviewerRow>(
        `SELECT ${selectCols} FROM reviewers WHERE cognito_sub = $1`,
        [user.sub]
      );
    }

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Failed to create reviewer" },
        { status: 500 }
      );
    }
    // Keep is_admin in sync for existing rows (Admin is not a reviewer; filter in admin APIs)
    await pool.query(
      `UPDATE reviewers SET is_admin = $1, updated_at = NOW() WHERE id = $2`,
      [isAdmin, row.id]
    );

    // Total patients = count of patients where assigned_doctor = reviewer's UUID
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM patients WHERE assigned_doctor = $1`,
      [row.id]
    );
    const totalPatientCapacity = parseInt(countResult.rows[0]?.count ?? "0", 10);

    // Pending reviews and total reviews made (may fail if rating column not yet migrated)
    let pendingReviews = 0;
    let totalReviewsMade = 0;
    try {
      const pendingRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM video_uploads v
         INNER JOIN patients p ON v.user_sub = p.cognito_sub AND p.assigned_doctor = $1
         WHERE v.rating IS NULL`,
        [row.id]
      );
      pendingReviews = parseInt(pendingRes.rows[0]?.count ?? "0", 10);

      const completedRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM video_uploads v
         INNER JOIN patients p ON v.user_sub = p.cognito_sub AND p.assigned_doctor = $1
         WHERE v.rating IS NOT NULL`,
        [row.id]
      );
      totalReviewsMade = parseInt(completedRes.rows[0]?.count ?? "0", 10);
    } catch (e) {
      console.warn("Reviewers stats (pending/totalReviews):", e);
    }

    // FUTURE: Reviewer membership not enforced (doctor limited by patient quota only).
    // Patient 90-day membership once enrolled may be implemented. Fields kept for future use.
    const now = new Date();
    const expiresAt = row.membership_expires_at ? new Date(row.membership_expires_at) : null;
    const isMembershipActive = expiresAt != null && expiresAt > now;

    return NextResponse.json({
      id: row.id,
      cognitoSub: row.cognito_sub,
      fullname: row.fullname,
      email: row.email,
      phone: row.phone,
      maxPatientCapacity: row.max_patient_capacity ?? 0,
      totalPatientCapacity,
      pendingReviews,
      totalReviewsMade,
      membershipExpiresAt: row.membership_expires_at,
      isMembershipActive,
      termsAcceptedAt: row.terms_accepted_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await verifyIdToken(token);
    if (!user || !user.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const groups = user.groups ?? [];
    if (!canAccessReviewer(groups)) {
      return NextResponse.json(
        { error: "Reviewer or Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      fullname,
      email,
      phone,
      maxPatientCapacity,
    } = body;

    await ensureReviewersTable();
    await ensurePatientsTable();

    const pool = getPgPool();

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (fullname !== undefined) {
      updates.push(`fullname = $${paramIndex++}`);
      values.push(fullname === null ? null : String(fullname));
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email === null ? null : String(email));
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone === null ? null : String(phone));
    }
    if (maxPatientCapacity !== undefined) {
      updates.push(`max_patient_capacity = $${paramIndex++}`);
      values.push(
        typeof maxPatientCapacity === "number"
          ? maxPatientCapacity
          : parseInt(String(maxPatientCapacity), 10) || 0
      );
    }

    const isAdmin = groups.includes("Admin");
    if (updates.length > 0) {
      // Never add Admin to the reviewers table
      if (!isAdmin) {
        await pool.query(
          `INSERT INTO reviewers (cognito_sub, email)
           VALUES ($1, $2)
           ON CONFLICT (cognito_sub) DO NOTHING`,
          [user.sub, user.email ?? null]
        );
      }
      updates.push(`updated_at = NOW()`);
      values.push(user.sub);
      await pool.query(
        `UPDATE reviewers SET ${updates.join(", ")} WHERE cognito_sub = $${paramIndex}`,
        values
      );
    }

    const selectCols =
      `id, cognito_sub, fullname, email, phone, max_patient_capacity, total_patient_capacity, membership_expires_at, created_at, updated_at`;

    const result = await pool.query<ReviewerRow>(
      `SELECT ${selectCols} FROM reviewers WHERE cognito_sub = $1`,
      [user.sub]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
    }

    // Total patients = count of patients where assigned_doctor = reviewer's UUID
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM patients WHERE assigned_doctor = $1`,
      [row.id]
    );
    const totalPatientCapacity = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const expiresAtPatch = row.membership_expires_at ? new Date(row.membership_expires_at) : null;
    const isMembershipActivePatch = expiresAtPatch != null && expiresAtPatch > new Date();

    return NextResponse.json({
      id: row.id,
      cognitoSub: row.cognito_sub,
      fullname: row.fullname,
      email: row.email,
      phone: row.phone,
      maxPatientCapacity: row.max_patient_capacity ?? 0,
      totalPatientCapacity,
      membershipExpiresAt: row.membership_expires_at,
      isMembershipActive: isMembershipActivePatch,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
