import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import {
  canAccessReviewer,
  shouldEnforceMembership,
  getLimitsForGroups,
  getReviewerLimits,
} from "@/lib/auth/reviewerAccess";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-1",
});

function effectiveMaxCapacity(
  maxFromDb: number | null,
  groups: string[]
): number {
  const m = maxFromDb ?? 0;
  if (m > 0) return m;
  const limits = getLimitsForGroups(groups);
  return limits ? limits.maxPatients : getReviewerLimits().maxPatients;
}

type PatientRow = {
  id: string;
  cognito_sub: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: string | null;
  current_streak_days: number | null;
  longest_streak_days: number | null;
  membership_expires_at: string | null;
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

    const pool = getPgPool();
    const reviewerResult = await pool.query<{
      id: string;
      max_patient_capacity: number | null;
      membership_expires_at: string | null;
    }>(
      `SELECT id, max_patient_capacity, membership_expires_at FROM reviewers WHERE cognito_sub = $1`,
      [user.sub]
    );
    const reviewer = reviewerResult.rows[0];
    const reviewerId = reviewer?.id;
    if (!reviewerId) {
      const limits = getLimitsForGroups(groups);
      const maxCap = limits ? limits.maxPatients : getReviewerLimits().maxPatients;
      return NextResponse.json({
        patients: [],
        maxPatientCapacity: maxCap,
        isMembershipActive: false,
      });
    }

    const expiresAtGet = reviewer.membership_expires_at ? new Date(reviewer.membership_expires_at) : null;
    const isMembershipActive = expiresAtGet != null && expiresAtGet > new Date();

    const result = await pool.query<PatientRow>(
      `SELECT id, cognito_sub, email, full_name, phone, status,
              current_streak_days, longest_streak_days, membership_expires_at
       FROM patients
       WHERE assigned_doctor = $1
       ORDER BY full_name ASC NULLS LAST, email ASC NULLS LAST`,
      [reviewerId]
    );

    const maxPatientCapacity = effectiveMaxCapacity(
      reviewer.max_patient_capacity,
      groups
    );
    const now = Date.now();

    const patients = result.rows.map((row) => {
      const expiresAt = row.membership_expires_at ? new Date(row.membership_expires_at) : null;
      const membershipDaysRemaining =
        expiresAt == null ? null : Math.ceil((expiresAt.getTime() - now) / 86400000);
      return {
        id: row.id,
        cognitoSub: row.cognito_sub,
        email: row.email ?? "",
        fullName: row.full_name ?? "",
        phone: row.phone ?? "",
        status: row.status ?? "active",
        currentStreakDays: row.current_streak_days ?? 0,
        longestStreakDays: row.longest_streak_days ?? 0,
        membershipExpiresAt: row.membership_expires_at,
        membershipDaysRemaining,
      };
    });

    return NextResponse.json({
      patients,
      maxPatientCapacity,
      isMembershipActive,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
      return NextResponse.json(
        { error: "Missing Cognito User Pool configuration" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, fullName } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    const fullNameTrimmed = fullName.trim();
    const fullNameRegex = /^[a-zA-Z\s]+$/;
    if (!fullNameRegex.test(fullNameTrimmed)) {
      return NextResponse.json(
        { error: "Full name can only contain letters and spaces" },
        { status: 400 }
      );
    }

    await ensureReviewersTable();
    await ensurePatientsTable();

    const pool = getPgPool();
    const reviewerResult = await pool.query<{
      id: string;
      max_patient_capacity: number | null;
      membership_expires_at: string | null;
    }>(
      `SELECT id, max_patient_capacity, membership_expires_at FROM reviewers WHERE cognito_sub = $1`,
      [user.sub]
    );
    const reviewer = reviewerResult.rows[0];
    const reviewerId = reviewer?.id;
    if (!reviewerId) {
      return NextResponse.json(
        { error: "Reviewer profile not found" },
        { status: 403 }
      );
    }

    // Enforce membership for Reviewer-test (trial reviewers)
    if (shouldEnforceMembership(groups)) {
      const expiresAt = reviewer.membership_expires_at
        ? new Date(reviewer.membership_expires_at)
        : null;
      if (expiresAt == null || expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "Your reviewer access has expired. Contact support to renew." },
          { status: 403 }
        );
      }
    }

    const maxCapacity = effectiveMaxCapacity(
      reviewer.max_patient_capacity,
      groups
    );
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM patients WHERE assigned_doctor = $1`,
      [reviewerId]
    );
    const currentCount = parseInt(countResult.rows[0]?.count ?? "0", 10);
    if (currentCount >= maxCapacity) {
      return NextResponse.json(
        { error: `Patient limit reached (${maxCapacity} maximum). Remove a patient or contact support to increase capacity.` },
        { status: 400 }
      );
    }

    const userAttributes: { Name: string; Value: string }[] = [
      { Name: "email", Value: email.trim() },
      { Name: "name", Value: fullNameTrimmed },
    ];
    const createUserResponse = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email.trim().toLowerCase(),
        UserAttributes: userAttributes,
        DesiredDeliveryMediums: ["EMAIL"],
      })
    );

    const cognitoSub =
      createUserResponse.User?.Attributes?.find((a) => a.Name === "sub")
        ?.Value ?? null;

    if (!cognitoSub) {
      return NextResponse.json(
        { error: "Failed to get Cognito user ID" },
        { status: 500 }
      );
    }

    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email.trim().toLowerCase(),
        GroupName: "User",
      })
    );

    const userAccessDays =
      parseInt(process.env.USER_ACCESS_PERIOD_DAYS ?? "90", 10) || 90;
    const patientExpiresAt = new Date(
      Date.now() + userAccessDays * 24 * 60 * 60 * 1000
    ).toISOString();
    await pool.query(
      `INSERT INTO patients (cognito_sub, email, full_name, phone, assigned_doctor, status, membership_expires_at)
       VALUES ($1, $2, $3, NULL, $4, 'active', $5)`,
      [
        cognitoSub,
        email.trim(),
        fullNameTrimmed,
        reviewerId,
        patientExpiresAt,
      ]
    );

    const insertResult = await pool.query<{ id: string }>(
      `SELECT id FROM patients WHERE cognito_sub = $1`,
      [cognitoSub]
    );
    const patientId = insertResult.rows[0]?.id;

    return NextResponse.json({
      patientId,
      cognitoSub,
      email: email.trim(),
      fullName: fullNameTrimmed,
    });
  } catch (error) {
    console.error("Create patient error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
