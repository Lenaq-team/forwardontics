import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { getDatePartsInTimezone } from "@/lib/utils/dateInTimezone";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";
import { randomUUID } from "crypto";

function getStage(): "dev" | "prod" {
  const stage = (process.env.NEXT_PUBLIC_STAGE || "dev").toLowerCase();
  return stage === "prod" ? "prod" : "dev";
}

function getBucketForStage(stage: "dev" | "prod"): string {
  return stage === "prod" ? "gopex-videos-prod" : "gopex-videos-dev";
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await verifyIdToken(token);
    if (!user || !user.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { error: "AWS credentials not configured" },
        { status: 500 }
      );
    }

    const { contentType } = (await req.json().catch(() => ({}))) as {
      contentType?: string;
    };

    const now = new Date();

    // Use patient's timezone for S3 folder; check membership for upload permission
    let timezone = "UTC";
    try {
      await ensurePatientsTable();
      const pool = getPgPool();
      const row = await pool.query<{ timezone: string; membership_expires_at: string | null }>(
        `SELECT timezone, membership_expires_at FROM patients WHERE cognito_sub = $1`,
        [user.sub]
      );
      const patientRow = row.rows[0];
      if (patientRow?.timezone) timezone = patientRow.timezone;

      const expiresAt = patientRow?.membership_expires_at ? new Date(patientRow.membership_expires_at) : null;
      if (expiresAt != null && expiresAt <= now) {
        return NextResponse.json(
          {
            error:
              "Your 90-day membership has expired. You cannot upload new videos. Contact your clinician to renew.",
          },
          { status: 403 }
        );
      }
    } catch {
      // fallback to UTC; if patient row missing, allow (e.g. first-time flow)
    }

    const { yyyy, mm, dd } = getDatePartsInTimezone(now, timezone);

    const stage = getStage();
    const bucket = getBucketForStage(stage);
    const id = randomUUID();
    const key = `users/${user.sub}/${yyyy}/${mm}/${dd}/${id}.webm`;

    const s3 = new S3Client({
      region: process.env.AWS_REGION || process.env.NEXT_PUBLIC_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "video/webm",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return NextResponse.json({ uploadUrl, bucket, key, stage, id, createdAt: now.toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

