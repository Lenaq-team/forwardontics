import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { canAccessReviewer } from "@/lib/auth/reviewerAccess";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { getPgPool } from "@/lib/db/pool";

type VideoRow = {
  id: string;
  created_at: Date | string;
  exercise_id: number | null;
  user_sub: string;
  user_email: string | null;
  bucket: string;
  key: string;
};

type PatientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
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

    const reviewerResult = await pool.query<{ id: string }>(
      `SELECT id FROM reviewers WHERE cognito_sub = $1`,
      [user.sub]
    );
    const reviewerId = reviewerResult.rows[0]?.id;
    if (!reviewerId) {
      return NextResponse.json({ reviews: [] });
    }

    const result = await pool.query<
      VideoRow & PatientRow
    >(
      `SELECT v.id, v.created_at, v.exercise_id, v.user_sub, v.user_email, v.bucket, v.key,
              p.id AS patient_id, p.full_name, p.email
       FROM video_uploads v
       INNER JOIN patients p ON v.user_sub = p.cognito_sub AND p.assigned_doctor = $1
       WHERE v.rating IS NULL
       ORDER BY v.created_at DESC
       LIMIT 500`,
      [reviewerId]
    );

    const reviews = result.rows.map((row) => ({
      id: String(row.id),
      patientId: String((row as { patient_id?: string }).patient_id ?? ""),
      patientName: row.full_name ?? "Unknown",
      patientEmail: row.email ?? row.user_email ?? "",
      videoS3Key: row.key,
      bucket: row.bucket,
      submittedDate: new Date(row.created_at).toISOString(),
      rating: null as number | null,
      comments: "",
      status: "pending" as const,
      exerciseType: row.exercise_id != null ? Number(row.exercise_id) : undefined,
    }));

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
