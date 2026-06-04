import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";
import { getDatePartsInTimezone } from "@/lib/utils/dateInTimezone";
import { randomUUID } from "crypto";

function safeRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function getStage(): "dev" | "prod" {
  const stage = (process.env.NEXT_PUBLIC_STAGE || "dev").toLowerCase();
  return stage === "prod" ? "prod" : "dev";
}

function getBucketForStage(stage: "dev" | "prod"): string {
  return stage === "prod" ? "gopex-videos-prod" : "gopex-videos-dev";
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || safeRequestId();
  const startedAt = Date.now();

  const common = {
    requestId,
    path: request.nextUrl?.pathname,
    contentLength: request.headers.get("content-length"),
    userAgent: request.headers.get("user-agent"),
    forwardedFor: request.headers.get("x-forwarded-for"),
  };

  console.log("upload-video:start", common);

  try {
    const token = request.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", requestId },
        { status: 401, headers: { "x-request-id": requestId } }
      );
    }

    const user = await verifyIdToken(token);
    if (!user || !user.sub) {
      return NextResponse.json(
        { success: false, error: "Invalid token", requestId },
        { status: 403, headers: { "x-request-id": requestId } }
      );
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { success: false, error: "AWS credentials not configured", requestId },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const exerciseIdRaw = formData.get("exerciseId") as string | null;
    const trimStartRaw = formData.get("trimStartSeconds") as string | null;
    const trimEndRaw = formData.get("trimEndSeconds") as string | null;
    const createdAtRaw = formData.get("createdAt") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing required field: file", requestId },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const contentType = file.type || "video/webm";

    // Basic validation (trimmed clips are small; keep limits conservative)
    const allowedTypes = ["video/webm", "video/mp4"];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported content type: ${contentType}`,
          requestId,
        },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const maxSizeBytes = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Max ${maxSizeBytes} bytes`,
          requestId,
        },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const now = createdAtRaw ? new Date(createdAtRaw) : new Date();

    // Use patient's timezone for S3 folder so it matches their calendar day
    let timezone = "UTC";
    try {
      await ensurePatientsTable();
      const pool = getPgPool();
      const row = await pool.query<{ timezone: string }>(
        `SELECT timezone FROM patients WHERE cognito_sub = $1`,
        [user.sub]
      );
      if (row.rows[0]?.timezone) {
        timezone = row.rows[0].timezone;
      }
    } catch {
      // fallback to UTC
    }

    const { yyyy, mm, dd } = getDatePartsInTimezone(now, timezone);

    const stage = getStage();
    const bucket = getBucketForStage(stage);
    const id = safeRequestId(); // UUID-ish
    const key = `users/${user.sub}/${yyyy}/${mm}/${dd}/${id}.webm`;

    const exerciseId = exerciseIdRaw ? Number(exerciseIdRaw) : null;
    const exerciseIdNum = Number.isFinite(exerciseId as number) ? exerciseId : null;
    const hasExercise = Number.isFinite(exerciseIdNum as number) && (exerciseIdNum as number) >= 1 && (exerciseIdNum as number) <= 3;

    await ensureVideoUploadsTable();
    const pool = getPgPool();

    // Block only if user has a reviewed video for this exercise on the same calendar day (patient timezone)
    if (hasExercise) {
      const reviewedCheck = await pool.query<{ id: string }>(
        `SELECT id FROM video_uploads
         WHERE user_sub = $1 AND exercise_id = $2 AND reviewed_at IS NOT NULL
           AND date(created_at AT TIME ZONE $3) = date($4::timestamptz AT TIME ZONE $3)
         LIMIT 1`,
        [user.sub, exerciseIdNum, timezone, now.toISOString()]
      );
      if (reviewedCheck.rows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "You already have a reviewed video for this exercise type. A new upload is not allowed.",
            requestId,
          },
          { status: 400, headers: { "x-request-id": requestId } }
        );
      }
    }

    // Find and remove existing: same user, same exercise, same calendar day (replace by re-upload, only if pending)
    type OldRow = { id: string; bucket: string; key: string };
    const existing = hasExercise
      ? await pool.query<OldRow>(
      `SELECT id, bucket, key FROM video_uploads
       WHERE user_sub = $1
         AND (exercise_id IS NOT DISTINCT FROM $2)
         AND date(created_at AT TIME ZONE $3) = date($4::timestamptz AT TIME ZONE $3)
         AND id != $5`,
      [user.sub, exerciseIdNum, timezone, now.toISOString(), id]
        )
      : { rows: [] as OldRow[] };

    if (existing.rows.length > 0) {
      const s3ClientForDelete = new S3Client({
        region: process.env.AWS_REGION || process.env.NEXT_PUBLIC_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      for (const row of existing.rows) {
        try {
          await s3ClientForDelete.send(new DeleteObjectCommand({ Bucket: row.bucket, Key: row.key }));
        } catch (e) {
          console.warn("upload: Failed to delete old S3 object", row.key, e);
        }
      }
      await pool.query(
        `DELETE FROM video_uploads WHERE id = ANY($1)`,
        [existing.rows.map((r) => r.id)]
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || process.env.NEXT_PUBLIC_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log("upload-video:s3_uploading", {
      ...common,
      bucket,
      key,
      fileName: file.name,
      fileSize: file.size,
      contentType,
      durationMs: Date.now() - startedAt,
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          "original-name": file.name,
          "exercise-id": exerciseIdRaw || "",
          "created-at": now.toISOString(),
        },
      })
    );

    console.log("upload-video:s3_upload_success", {
      ...common,
      bucket,
      key,
      durationMs: Date.now() - startedAt,
    });

    // Store metadata in DB
    const trimStartSeconds = trimStartRaw ? Number(trimStartRaw) : null;
    const trimEndSeconds = trimEndRaw ? Number(trimEndRaw) : null;

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
        exerciseIdNum,
        now,
        Number.isFinite(trimStartSeconds as number) ? trimStartSeconds : null,
        Number.isFinite(trimEndSeconds as number) ? trimEndSeconds : null,
        contentType,
        Math.trunc(file.size),
      ]
    );

    console.log("upload-video:db_insert_success", {
      ...common,
      id,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { success: true, id, bucket, key, stage, createdAt: now.toISOString(), requestId },
      { headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    console.error("upload-video:error", {
      ...common,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        requestId,
      },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}

