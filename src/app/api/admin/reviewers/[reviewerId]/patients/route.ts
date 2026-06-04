import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { getPgPool } from "@/lib/db/pool";

type PatientRow = {
  id: string;
  cognito_sub: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: string | null;
  membership_expires_at: string | null;
  total_uploads: string;
  pending_reviews: string;
  completed_reviews: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewerId: string }> }
) {
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

  const { reviewerId } = await params;
  if (!reviewerId) {
    return NextResponse.json({ error: "Missing reviewerId" }, { status: 400 });
  }

  try {
    await ensurePatientsTable();
    await ensureVideoUploadsTable();
    const pool = getPgPool();
    const result = await pool.query<PatientRow>(
      `SELECT p.id, p.cognito_sub, p.email, p.full_name, p.phone, p.status, p.membership_expires_at,
              (SELECT COUNT(*)::text FROM video_uploads v WHERE v.user_sub = p.cognito_sub) AS total_uploads,
              (SELECT COUNT(*)::text FROM video_uploads v WHERE v.user_sub = p.cognito_sub AND v.rating IS NULL) AS pending_reviews,
              (SELECT COUNT(*)::text FROM video_uploads v WHERE v.user_sub = p.cognito_sub AND v.rating IS NOT NULL) AS completed_reviews
       FROM patients p
       WHERE p.assigned_doctor = $1
       ORDER BY p.full_name ASC NULLS LAST, p.email ASC NULLS LAST`,
      [reviewerId]
    );

    const now = Date.now();
    const patients = result.rows.map((row) => {
      const expiresAt = row.membership_expires_at
        ? new Date(row.membership_expires_at)
        : null;
      const membershipDaysRemaining =
        expiresAt == null
          ? null
          : Math.ceil((expiresAt.getTime() - now) / 86400000);
      return {
        id: row.id,
        cognitoSub: row.cognito_sub,
        email: row.email ?? "",
        fullName: row.full_name ?? "",
        phone: row.phone ?? "",
        status: row.status ?? "active",
        membershipExpiresAt: row.membership_expires_at,
        membershipDaysRemaining,
        totalUploads: parseInt(row.total_uploads || "0", 10),
        pendingReviews: parseInt(row.pending_reviews || "0", 10),
        completedReviews: parseInt(row.completed_reviews || "0", 10),
      };
    });

    return NextResponse.json({ patients });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
