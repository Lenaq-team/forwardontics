import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { getPgPool } from "@/lib/db/pool";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function PATCH(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { maxPatientCapacity, fullname } = body as {
    maxPatientCapacity?: unknown;
    fullname?: unknown;
  };

  // Validate: at least one field must be provided
  if (maxPatientCapacity === undefined && fullname === undefined) {
    return NextResponse.json(
      { error: "At least one of maxPatientCapacity or fullname must be provided" },
      { status: 400 }
    );
  }

  // Validate maxPatientCapacity if provided
  if (maxPatientCapacity !== undefined) {
    if (
      typeof maxPatientCapacity !== "number" ||
      !Number.isInteger(maxPatientCapacity) ||
      maxPatientCapacity < 0
    ) {
      return NextResponse.json(
        { error: "maxPatientCapacity must be a non-negative integer" },
        { status: 400 }
      );
    }
  }

  // Validate fullname if provided
  if (fullname !== undefined) {
    if (typeof fullname !== "string" || !fullname.trim()) {
      return NextResponse.json(
        { error: "fullname must be a non-empty string" },
        { status: 400 }
      );
    }
  }

  try {
    await ensureReviewersTable();
    const pool = getPgPool();

    // Fetch the reviewer's cognito_sub so we can update Cognito
    const reviewerRow = await pool.query<{ id: string; cognito_sub: string }>(
      `SELECT id, cognito_sub FROM reviewers WHERE id = $1 AND COALESCE(is_admin, false) = false`,
      [reviewerId]
    );

    if (reviewerRow.rowCount === 0) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
    }

    const cognitoSub = reviewerRow.rows[0].cognito_sub;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    // Build DB update
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (maxPatientCapacity !== undefined) {
      updates.push(`max_patient_capacity = $${paramIndex++}`);
      values.push(maxPatientCapacity);
    }

    if (fullname !== undefined) {
      updates.push(`fullname = $${paramIndex++}`);
      values.push((fullname as string).trim());
    }

    updates.push(`updated_at = NOW()`);
    values.push(reviewerId);

    await pool.query(
      `UPDATE reviewers SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );

    // Update Cognito if fullname changed
    if (fullname !== undefined && userPoolId) {
      await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: cognitoSub,
          UserAttributes: [
            { Name: "name", Value: (fullname as string).trim() },
          ],
        })
      );
    }

    return NextResponse.json({ id: reviewerId });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
