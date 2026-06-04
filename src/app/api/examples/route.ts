import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { verifyIdToken } from "@/lib/auth/verifyToken";

const BUCKET = "gopex-examples";
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv"];

const hasAwsCredentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

const s3Client = hasAwsCredentials
  ? new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

function isVideoKey(key: string): boolean {
  const lower = key.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function keyToDisplayName(key: string): string {
  const filename = key.split("/").pop() || key;
  let nameOnly = filename.replace(/\.[^.]+$/, "");
  // snake_case -> insert spaces
  nameOnly = nameOnly.replace(/_/g, " ");
  // camelCase/PascalCase -> insert space before capitals: "HowTo" -> "How To"
  nameOnly = nameOnly.replace(/([a-z])([A-Z])/g, "$1 $2");
  nameOnly = nameOnly.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  // Insert space before/after numbers: "Exercise3" -> "Exercise 3", "How2To" -> "How 2 To"
  nameOnly = nameOnly.replace(/([a-zA-Z])(\d)/g, "$1 $2");
  nameOnly = nameOnly.replace(/(\d)([a-zA-Z])/g, "$1 $2");
  nameOnly = nameOnly.replace(/\s+/g, " ").trim();
  // First word keeps casing, rest lowercase: "How To" -> "How to"
  const words = nameOnly.split(" ");
  if (words.length <= 1) return nameOnly;
  return (
    words[0] +
    " " +
    words
      .slice(1)
      .map((w) => w.toLowerCase())
      .join(" ")
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("idToken")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await verifyIdToken(token);
    if (!user?.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (!s3Client) {
      return NextResponse.json(
        { error: "AWS credentials not configured" },
        { status: 500 }
      );
    }

    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        MaxKeys: 500,
      })
    );

    const contents = response.Contents ?? [];
    const videos = contents
      .filter((obj) => obj.Key && isVideoKey(obj.Key))
      .map((obj) => ({
        key: obj.Key!,
        name: keyToDisplayName(obj.Key!),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Examples list error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
