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
  exercise_id: number | null;
  trim_start_seconds: string | number | null;
  trim_end_seconds: string | number | null;
  stage: string;
  bucket: string;
  key: string;
  rating: number | null;
  review_comments: string | null;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
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

    const { patientId } = await params;
    if (!patientId) {
      return NextResponse.json({ error: "Patient ID required" }, { status: 400 });
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
      return NextResponse.json({ videos: [], patient: null });
    }

    const patientResult = await pool.query<{ cognito_sub: string; full_name: string | null }>(
      `SELECT cognito_sub, full_name FROM patients
       WHERE id = $1 AND assigned_doctor = $2`,
      [patientId, reviewerId]
    );

    const patient = patientResult.rows[0];
    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found or not assigned to you" },
        { status: 404 }
      );
    }

    const videoResult = await pool.query<VideoRow>(
      `SELECT id, created_at, exercise_id, trim_start_seconds, trim_end_seconds,
              stage, bucket, key, rating, review_comments
       FROM video_uploads
       WHERE user_sub = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [patient.cognito_sub]
    );

    const videos = videoResult.rows.map((row) => {
      const start = row.trim_start_seconds != null ? Number(row.trim_start_seconds) : null;
      const end = row.trim_end_seconds != null ? Number(row.trim_end_seconds) : null;
      const durationSeconds = start != null && end != null && end > start ? end - start : null;
      const hasRating = row.rating != null && row.rating > 0;

      return {
        id: String(row.id),
        date: new Date(row.created_at).toISOString(),
        rating: row.rating != null ? Number(row.rating) : null,
        comments: row.review_comments ?? "",
        duration: durationSeconds != null ? `${durationSeconds.toFixed(1)}s` : "",
        status: (hasRating ? "reviewed" : "pending") as "pending" | "reviewed" | "approved",
        exerciseType: row.exercise_id != null ? Number(row.exercise_id) : undefined,
        stage: String(row.stage),
        bucket: String(row.bucket),
        key: String(row.key),
      };
    });

    return NextResponse.json({
      videos,
      patient: {
        id: patientId,
        cognitoSub: patient.cognito_sub,
        fullName: patient.full_name ?? "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
