import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { getPgPool } from "@/lib/db/pool";

function canAccessPatient(groups: string[]): boolean {
  return groups.includes("User") || groups.includes("Admin");
}

type PatientRow = {
  id: string;
  cognito_sub: string;
  email: string | null;
  timezone: string;
  full_name: string | null;
  assigned_doctor: string | null;
  reviewer_fullname: string | null;
  phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  status: string | null;
  membership_expires_at: string | null;
  terms_accepted_at: string | null;
  current_streak_days: number | null;
  longest_streak_days: number | null;
  last_completed_day_key: string | null;
  last_activity_day_key: string | null;
  streak_started_day_key: string | null;
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

    const groups = [...(user.groups || []), user.role].filter(Boolean);
    if (!canAccessPatient(groups)) {
      return NextResponse.json(
        { error: "User or Admin access required" },
        { status: 403 }
      );
    }

    await ensurePatientsTable();
    await ensureReviewersTable();

    const pool = getPgPool();
    const selectCols =
      `p.id, p.cognito_sub, p.email, p.timezone, p.full_name, p.assigned_doctor, r.fullname as reviewer_fullname, p.phone, p.date_of_birth, p.sex, p.status, p.membership_expires_at, p.terms_accepted_at, p.current_streak_days, p.longest_streak_days, p.last_completed_day_key, p.last_activity_day_key, p.streak_started_day_key, p.created_at, p.updated_at`;

    let result = await pool.query<PatientRow>(
      `SELECT ${selectCols} FROM patients p
       LEFT JOIN reviewers r ON p.assigned_doctor = r.id::text
       WHERE p.cognito_sub = $1`,
      [user.sub]
    );

    if (result.rows.length === 0) {
      const userAccessDays =
        parseInt(process.env.USER_ACCESS_PERIOD_DAYS ?? "90", 10) || 90;
      const membershipExpiresAt = new Date(
        Date.now() + userAccessDays * 24 * 60 * 60 * 1000
      ).toISOString();
      await pool.query(
        `INSERT INTO patients (cognito_sub, email, timezone, membership_expires_at)
         VALUES ($1, $2, 'UTC', $3)
         ON CONFLICT (cognito_sub) DO NOTHING`,
        [user.sub, user.email ?? null, membershipExpiresAt]
      );
      result = await pool.query<PatientRow>(
        `SELECT ${selectCols} FROM patients p
         LEFT JOIN reviewers r ON p.assigned_doctor = r.id::text
         WHERE p.cognito_sub = $1`,
        [user.sub]
      );
    }

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
    }

    const expiresAt = row.membership_expires_at ? new Date(row.membership_expires_at) : null;
    const isMembershipActive = expiresAt == null || expiresAt > new Date();

    return NextResponse.json({
      id: row.id,
      cognitoSub: row.cognito_sub,
      email: row.email,
      timezone: row.timezone,
      fullName: row.full_name,
      assignedDoctor: row.reviewer_fullname ?? row.assigned_doctor,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      sex: row.sex,
      status: row.status ?? "active",
      membershipExpiresAt: row.membership_expires_at,
      isMembershipActive,
      termsAcceptedAt: row.terms_accepted_at ?? null,
      currentStreakDays: row.current_streak_days ?? 0,
      longestStreakDays: row.longest_streak_days ?? 0,
      lastCompletedDayKey: row.last_completed_day_key,
      lastActivityDayKey: row.last_activity_day_key,
      streakStartedDayKey: row.streak_started_day_key,
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

    const groups = [...(user.groups || []), user.role].filter(Boolean);
    if (!canAccessPatient(groups)) {
      return NextResponse.json(
        { error: "User or Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      timezone,
      email,
      fullName,
      assignedDoctor,
      phone,
      dateOfBirth,
      sex,
      status,
      currentStreakDays,
      longestStreakDays,
      lastCompletedDayKey,
      lastActivityDayKey,
      streakStartedDayKey,
    } = body;

    await ensurePatientsTable();
    await ensureReviewersTable();

    const pool = getPgPool();

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (timezone != null && typeof timezone === "string") {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
    }
    if (email != null && typeof email === "string") {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(fullName === null ? null : String(fullName));
    }
    if (assignedDoctor !== undefined) {
      updates.push(`assigned_doctor = $${paramIndex++}`);
      values.push(assignedDoctor === null ? null : String(assignedDoctor));
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone === null ? null : String(phone));
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramIndex++}`);
      values.push(dateOfBirth === null ? null : String(dateOfBirth));
    }
    if (sex !== undefined) {
      updates.push(`sex = $${paramIndex++}`);
      values.push(sex === null ? null : String(sex));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status === null ? null : String(status));
    }
    if (currentStreakDays !== undefined) {
      updates.push(`current_streak_days = $${paramIndex++}`);
      values.push(typeof currentStreakDays === "number" ? currentStreakDays : parseInt(String(currentStreakDays), 10) || 0);
    }
    if (longestStreakDays !== undefined) {
      updates.push(`longest_streak_days = $${paramIndex++}`);
      values.push(typeof longestStreakDays === "number" ? longestStreakDays : parseInt(String(longestStreakDays), 10) || 0);
    }
    if (lastCompletedDayKey !== undefined) {
      updates.push(`last_completed_day_key = $${paramIndex++}`);
      values.push(lastCompletedDayKey === null ? null : String(lastCompletedDayKey));
    }
    if (lastActivityDayKey !== undefined) {
      updates.push(`last_activity_day_key = $${paramIndex++}`);
      values.push(lastActivityDayKey === null ? null : String(lastActivityDayKey));
    }
    if (streakStartedDayKey !== undefined) {
      updates.push(`streak_started_day_key = $${paramIndex++}`);
      values.push(streakStartedDayKey === null ? null : String(streakStartedDayKey));
    }

    if (updates.length > 0) {
      await pool.query(
        `INSERT INTO patients (cognito_sub, email, timezone)
         VALUES ($1, $2, 'UTC')
         ON CONFLICT (cognito_sub) DO NOTHING`,
        [user.sub, user.email ?? null]
      );
      updates.push(`updated_at = NOW()`);
      values.push(user.sub);
      await pool.query(
        `UPDATE patients SET ${updates.join(", ")} WHERE cognito_sub = $${paramIndex}`,
        values
      );
    }

    const selectCols =
      `p.id, p.cognito_sub, p.email, p.timezone, p.full_name, p.assigned_doctor, r.fullname as reviewer_fullname, p.phone, p.date_of_birth, p.sex, p.status, p.membership_expires_at, p.current_streak_days, p.longest_streak_days, p.last_completed_day_key, p.last_activity_day_key, p.streak_started_day_key, p.created_at, p.updated_at`;

    const result = await pool.query<PatientRow>(
      `SELECT ${selectCols} FROM patients p
       LEFT JOIN reviewers r ON p.assigned_doctor = r.id::text
       WHERE p.cognito_sub = $1`,
      [user.sub]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const expiresAtPatch = row.membership_expires_at ? new Date(row.membership_expires_at) : null;
    const isMembershipActivePatch = expiresAtPatch == null || expiresAtPatch > new Date();

    return NextResponse.json({
      id: row.id,
      cognitoSub: row.cognito_sub,
      email: row.email,
      timezone: row.timezone,
      fullName: row.full_name,
      assignedDoctor: row.reviewer_fullname ?? row.assigned_doctor,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      sex: row.sex,
      status: row.status ?? "active",
      membershipExpiresAt: row.membership_expires_at,
      isMembershipActive: isMembershipActivePatch,
      currentStreakDays: row.current_streak_days ?? 0,
      longestStreakDays: row.longest_streak_days ?? 0,
      lastCompletedDayKey: row.last_completed_day_key,
      lastActivityDayKey: row.last_activity_day_key,
      streakStartedDayKey: row.streak_started_day_key,
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
