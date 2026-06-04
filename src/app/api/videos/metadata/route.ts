import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";

type OldVideoRow = { id: string; bucket: string; key: string };

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await verifyIdToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }
    if (!user.sub) {
      return NextResponse.json(
        { error: "Token missing user sub" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      id,
      bucket,
      key,
      stage,
      exerciseId,
      createdAt,
      trimStartSeconds,
      trimEndSeconds,
      contentType,
      sizeBytes,
    } = body ?? {};

    if (!id || !bucket || !key || !stage || !createdAt) {
      return NextResponse.json(
        { error: "Missing required fields: id, bucket, key, stage, createdAt" },
        { status: 400 }
      );
    }

    await ensureVideoUploadsTable();
    await ensurePatientsTable();

    const pool = getPgPool();

    // Get patient timezone for "same day" matching; check membership for upload permission
    let timezone = "UTC";
    const patientRow = await pool.query<{ timezone: string; membership_expires_at: string | null }>(
      `SELECT timezone, membership_expires_at FROM patients WHERE cognito_sub = $1`,
      [user.sub]
    );
    const p = patientRow.rows[0];
    if (p?.timezone) timezone = p.timezone;

    const expiresAt = p?.membership_expires_at ? new Date(p.membership_expires_at) : null;
    if (expiresAt != null && expiresAt <= new Date()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your 90-day membership has expired. You cannot upload new videos. Contact your clinician to renew.",
        },
        { status: 403 }
      );
    }

    const exerciseIdNum = typeof exerciseId === "number" ? exerciseId : null;
    const hasExercise = Number.isFinite(exerciseIdNum) && exerciseIdNum! >= 1 && exerciseIdNum! <= 3;

    // Block only if user has a reviewed video for this exercise on the same calendar day (patient timezone)
    if (hasExercise) {
      const reviewedCheck = await pool.query<{ id: string }>(
        `SELECT id FROM video_uploads
         WHERE user_sub = $1 AND exercise_id = $2 AND reviewed_at IS NOT NULL
           AND date(created_at AT TIME ZONE $3) = date($4::timestamptz AT TIME ZONE $3)
         LIMIT 1`,
        [user.sub, exerciseIdNum, timezone, createdAt]
      );
      if (reviewedCheck.rows.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "You already have a reviewed video for this exercise type. A new upload is not allowed.",
          },
          { status: 400 }
        );
      }
    }

    // Find existing videos: same user, same exercise, same calendar day → replace by re-upload (only pending)
    const existing = hasExercise
      ? await pool.query<OldVideoRow>(
      `SELECT id, bucket, key FROM video_uploads
       WHERE user_sub = $1
         AND (exercise_id IS NOT DISTINCT FROM $2)
         AND date(created_at AT TIME ZONE $3) = date($4::timestamptz AT TIME ZONE $3)
         AND id != $5`,
      [user.sub, exerciseIdNum, timezone, createdAt, id]
        )
      : { rows: [] as OldVideoRow[] };

    // Delete old from S3 and DB
    if (existing.rows.length > 0) {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        for (const row of existing.rows) {
          try {
            await s3.send(new DeleteObjectCommand({ Bucket: row.bucket, Key: row.key }));
          } catch (e) {
            console.warn("metadata: Failed to delete old S3 object", row.key, e);
          }
        }
      }
      await pool.query(
        `DELETE FROM video_uploads WHERE id = ANY($1)`,
        [existing.rows.map((r) => r.id)]
      );
    }

    await pool.query(
      `
        INSERT INTO video_uploads (
          id, user_sub, user_email, bucket, key, stage, exercise_id,
          created_at, trim_start_seconds, trim_end_seconds, content_type, size_bytes
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12
        )
      `,
      [
        id,
        user.sub,
        user.email,
        bucket,
        key,
        stage,
        typeof exerciseId === "number" ? exerciseId : null,
        new Date(createdAt),
        typeof trimStartSeconds === "number" ? trimStartSeconds : null,
        typeof trimEndSeconds === "number" ? trimEndSeconds : null,
        typeof contentType === "string" ? contentType : null,
        typeof sizeBytes === "number" ? Math.trunc(sizeBytes) : null,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

