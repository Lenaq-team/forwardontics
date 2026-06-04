import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureReviewersTable } from "@/lib/db/reviewers";
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
  patient_count: string;
  pending_reviews: string;
  completed_reviews: string;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("idToken")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await verifyIdToken(token);
    if (!user || !user.groups?.includes("Admin")) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  try {
    await ensureReviewersTable();
    await ensureVideoUploadsTable();
    const pool = getPgPool();
    // Admin is not a reviewer: exclude rows marked as Admin (synced from Cognito in reviewers/me)
    const result = await pool.query<ReviewerRow>(
      `SELECT r.id, r.cognito_sub, r.fullname, r.email, r.phone,
              r.max_patient_capacity, r.total_patient_capacity, r.membership_expires_at,
              (SELECT COUNT(*)::text FROM patients p WHERE p.assigned_doctor = r.id::text) AS patient_count,
              (SELECT COUNT(*)::text FROM video_uploads v INNER JOIN patients p ON v.user_sub = p.cognito_sub WHERE p.assigned_doctor = r.id::text AND v.rating IS NULL) AS pending_reviews,
              (SELECT COUNT(*)::text FROM video_uploads v INNER JOIN patients p ON v.user_sub = p.cognito_sub WHERE p.assigned_doctor = r.id::text AND v.rating IS NOT NULL) AS completed_reviews
       FROM reviewers r
       WHERE COALESCE(r.is_admin, false) = false
       ORDER BY r.fullname ASC NULLS LAST, r.email ASC NULLS LAST`
    );

    const reviewers = result.rows.map((row) => ({
      id: row.id,
      cognitoSub: row.cognito_sub,
      fullname: row.fullname ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      maxPatientCapacity: row.max_patient_capacity ?? 0,
      totalPatientCapacity: row.total_patient_capacity ?? 0,
      membershipExpiresAt: row.membership_expires_at ?? null,
      patientCount: parseInt(row.patient_count || "0", 10),
      pendingReviews: parseInt(row.pending_reviews || "0", 10),
      completedReviews: parseInt(row.completed_reviews || "0", 10),
    }));

    return NextResponse.json({ reviewers });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
