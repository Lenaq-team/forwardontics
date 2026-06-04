import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { getPgPool } from "@/lib/db/pool";

import { canAccessReviewer } from "@/lib/auth/reviewerAccess";

type VideoRow = {
  id: string;
  created_at: Date | string;
  uploaded_at: Date | string | null;
  reviewed_at: Date | string | null;
  exercise_id: number | null;
  user_sub: string;
  user_email: string | null;
  bucket: string;
  key: string;
  rating: number | null;
  review_comments: string | null;
  reviewer_id: string | null;
};

type PatientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ReviewerRow = {
  reviewer_fullname: string | null;
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
      VideoRow & PatientRow & ReviewerRow
    >(
      `SELECT v.id, v.created_at, v.uploaded_at, v.reviewed_at, v.exercise_id, v.user_sub, v.user_email,
              v.bucket, v.key, v.rating, v.review_comments, v.reviewer_id,
              p.id AS patient_id, p.full_name, p.email,
              r.fullname AS reviewer_fullname
       FROM video_uploads v
       INNER JOIN patients p ON v.user_sub = p.cognito_sub AND p.assigned_doctor = $1
       LEFT JOIN reviewers r ON v.reviewer_id = r.id
       WHERE v.rating IS NOT NULL
       ORDER BY COALESCE(v.reviewed_at, v.uploaded_at, v.created_at) DESC NULLS LAST
       LIMIT 500`,
      [reviewerId]
    );

    const reviews = result.rows.map((row) => {
      const reviewDate =
        row.reviewed_at ?? row.uploaded_at ?? row.created_at;
      return {
        id: String(row.id),
        patientId: String((row as { patient_id?: string }).patient_id ?? ""),
        patientName: row.full_name ?? "Unknown",
        patientEmail: row.email ?? row.user_email ?? "",
        videoS3Key: row.key,
        bucket: row.bucket,
        submittedDate: new Date(row.created_at).toISOString(),
        reviewDate: new Date(reviewDate).toISOString(),
        rating: row.rating != null ? Number(row.rating) : null,
        comments: row.review_comments ?? "",
        status: "completed" as const,
        reviewerName: row.reviewer_fullname ?? undefined,
        exerciseType: row.exercise_id != null ? Number(row.exercise_id) : undefined,
      };
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
