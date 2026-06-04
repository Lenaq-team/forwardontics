import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { getPgPool } from "@/lib/db/pool";

type VideoUploadRow = {
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
  reviewed_at: Date | string | null;
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

    await ensureVideoUploadsTable();

    const pool = getPgPool();
    const result = await pool.query<VideoUploadRow>(
      `
        SELECT
          id,
          created_at,
          exercise_id,
          trim_start_seconds,
          trim_end_seconds,
          stage,
          bucket,
          key,
          rating,
          review_comments,
          reviewed_at
        FROM video_uploads
        WHERE user_sub = $1
        ORDER BY created_at DESC
        LIMIT 200
      `,
      [user.sub]
    );

    // Shape to match existing frontend table expectations.
    // Status: "reviewed" when reviewed_at is set, otherwise "pending"
    const videos = result.rows.map((row: VideoUploadRow) => {
      const start = row.trim_start_seconds != null ? Number(row.trim_start_seconds) : null;
      const end = row.trim_end_seconds != null ? Number(row.trim_end_seconds) : null;
      const durationSeconds = start != null && end != null && end > start ? end - start : null;
      const isReviewed = row.reviewed_at != null;

      return {
        id: String(row.id),
        date: new Date(row.created_at).toISOString(),
        rating: row.rating != null ? Number(row.rating) : null,
        comments: row.review_comments ?? "",
        duration: durationSeconds != null ? `${durationSeconds.toFixed(1)}s` : "",
        status: (isReviewed ? "reviewed" : "pending") as "pending" | "reviewed" | "approved",
        exerciseType: row.exercise_id != null ? Number(row.exercise_id) : undefined,
        stage: String(row.stage),
        bucket: String(row.bucket),
        key: String(row.key),
      };
    });

    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

