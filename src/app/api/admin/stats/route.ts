import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensurePatientsTable } from "@/lib/db/patients";
import { ensureReviewersTable } from "@/lib/db/reviewers";
import { getPgPool } from "@/lib/db/pool";

export async function GET(req: NextRequest) {
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

    try {
        await ensureReviewersTable();
        await ensurePatientsTable();
        const pool = getPgPool();

        // Admin is not a reviewer: count only non-Admin rows (is_admin synced from Cognito in reviewers/me)
        const [reviewersResult, patientsResult] = await Promise.all([
            pool.query<{ count: string }>(
                "SELECT COUNT(*) AS count FROM reviewers WHERE COALESCE(is_admin, false) = false"
            ),
            pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM patients WHERE assigned_doctor IS NOT NULL"),
        ]);

        const totalReviewers = parseInt(reviewersResult.rows[0]?.count ?? "0", 10);
        const totalPatients = parseInt(patientsResult.rows[0]?.count ?? "0", 10);

        return NextResponse.json({ totalReviewers, totalPatients });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
