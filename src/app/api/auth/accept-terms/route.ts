import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { canAccessReviewer } from "@/lib/auth/reviewerAccess";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";

function canAccessPatient(groups: string[]): boolean {
  return groups.includes("User") || groups.includes("Admin");
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await verifyIdToken(token);
    if (!user || !user.sub) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 403 }
      );
    }

    const groups = user.groups ?? [];

    if (canAccessReviewer(groups)) {
      await ensureReviewersTable();
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO reviewers (cognito_sub, email, is_admin, terms_accepted_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (cognito_sub) DO UPDATE SET
           terms_accepted_at = NOW(),
           updated_at = NOW()`,
        [user.sub, user.email ?? null, groups.includes("Admin")]
      );
      return NextResponse.json({ success: true });
    }

    if (canAccessPatient(groups)) {
      await ensurePatientsTable();
      const pool = getPgPool();
      const userAccessDays =
        parseInt(process.env.USER_ACCESS_PERIOD_DAYS ?? "90", 10) || 90;
      const membershipExpiresAt = new Date(
        Date.now() + userAccessDays * 24 * 60 * 60 * 1000
      ).toISOString();
      await pool.query(
        `INSERT INTO patients (cognito_sub, email, timezone, membership_expires_at, terms_accepted_at, updated_at)
         VALUES ($1, $2, 'UTC', $3, NOW(), NOW())
         ON CONFLICT (cognito_sub) DO UPDATE SET
           terms_accepted_at = NOW(),
           updated_at = NOW()`,
        [user.sub, user.email ?? null, membershipExpiresAt]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Unable to determine user role" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
