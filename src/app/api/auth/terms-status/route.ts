import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { canAccessReviewer } from "@/lib/auth/reviewerAccess";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";

function canAccessPatient(groups: string[]): boolean {
  return groups.includes("User") || groups.includes("Admin");
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json(
        { termsAccepted: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await verifyIdToken(token);
    if (!user || !user.sub) {
      return NextResponse.json(
        { termsAccepted: false, error: "Invalid token" },
        { status: 403 }
      );
    }

    const groups = user.groups ?? [];

    if (canAccessReviewer(groups)) {
      await ensureReviewersTable();
      const pool = getPgPool();
      const row = await pool.query<{ terms_accepted_at: string | null }>(
        `SELECT terms_accepted_at FROM reviewers WHERE cognito_sub = $1`,
        [user.sub]
      );
      const termsAccepted = !!row.rows[0]?.terms_accepted_at;
      return NextResponse.json({ termsAccepted });
    }

    if (canAccessPatient(groups)) {
      await ensurePatientsTable();
      const pool = getPgPool();
      const row = await pool.query<{ terms_accepted_at: string | null }>(
        `SELECT terms_accepted_at FROM patients WHERE cognito_sub = $1`,
        [user.sub]
      );
      const termsAccepted = !!row.rows[0]?.terms_accepted_at;
      return NextResponse.json({ termsAccepted });
    }

    // Unknown role: allow access (no terms gate)
    return NextResponse.json({ termsAccepted: true });
  } catch (error) {
    return NextResponse.json(
      {
        termsAccepted: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
