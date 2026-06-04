import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import {
  canAccessReviewer,
  shouldEnforceMembership,
} from "@/lib/auth/reviewerAccess";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { getPgPool } from "@/lib/db/pool";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: videoId } = await params;
    if (!videoId) {
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }

    const body = await req.json();
    const rating = body.rating;
    const comments = body.comments ?? "";

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    await ensureReviewersTable();
    await ensurePatientsTable();
    await ensureVideoUploadsTable();

    const pool = getPgPool();

    const reviewerResult = await pool.query<{ id: string; membership_expires_at: string | null }>(
      `SELECT id, membership_expires_at FROM reviewers WHERE cognito_sub = $1`,
      [user.sub]
    );
    const reviewer = reviewerResult.rows[0];
    const reviewerId = reviewer?.id;
    if (!reviewerId) {
      return NextResponse.json(
        { error: "Reviewer profile not found" },
        { status: 403 }
      );
    }

    // Enforce membership for Reviewer-test (trial reviewers)
    if (shouldEnforceMembership(groups)) {
      const expiresAt = reviewer.membership_expires_at
        ? new Date(reviewer.membership_expires_at)
        : null;
      if (expiresAt == null || expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "Your reviewer access has expired. Contact support to renew." },
          { status: 403 }
        );
      }
    }

    // Verify video exists and belongs to a patient assigned to this reviewer
    const checkResult = await pool.query<{ id: string }>(
      `SELECT v.id FROM video_uploads v
       INNER JOIN patients p ON v.user_sub = p.cognito_sub AND p.assigned_doctor = $1
       WHERE v.id = $2::uuid`,
      [reviewerId, videoId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Video not found or you are not assigned to review it" },
        { status: 404 }
      );
    }

    await pool.query(
      `UPDATE video_uploads
       SET rating = $1, review_comments = $2, reviewed_at = NOW(), reviewer_id = $3
       WHERE id = $4::uuid`,
      [rating, comments, reviewerId, videoId]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
