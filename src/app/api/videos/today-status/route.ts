import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verifyToken";
import { ensureVideoUploadsTable } from "@/lib/db/videos";
import { ensurePatientsTable } from "@/lib/db/patients";
import { getPgPool } from "@/lib/db/pool";
import { MANDATORY_EXERCISE_IDS } from "@/lib/data/exercises";

type Row = { exercise_id: number | null };
type CompletedDayRow = { d: string };

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

    const timezone = req.nextUrl.searchParams.get("timezone") || "UTC";

    await ensureVideoUploadsTable();
    await ensurePatientsTable();
    const pool = getPgPool();

    // Get exercises uploaded today (in patient timezone)
    const result = await pool.query<Row>(
      `
      SELECT exercise_id
      FROM video_uploads
      WHERE user_sub = $1
        AND date(created_at AT TIME ZONE $2) = date((NOW() AT TIME ZONE $2))
      `,
      [user.sub, timezone]
    );

    const uploadedExerciseIds = new Set(
      result.rows.map((r) => r.exercise_id).filter((id): id is number => id != null)
    );

    const status = {
      1: uploadedExerciseIds.has(1),
      2: uploadedExerciseIds.has(2),
      3: uploadedExerciseIds.has(3),
    };

    // Get all completed days (dates where user uploaded all mandatory exercises: 1 and 2)
    const completedDaysResult = await pool.query<CompletedDayRow>(
      `
      SELECT date(created_at AT TIME ZONE $2)::text as d
      FROM video_uploads
      WHERE user_sub = $1 AND exercise_id = ANY($3::int[])
      GROUP BY date(created_at AT TIME ZONE $2)
      HAVING COUNT(DISTINCT exercise_id) = $4
      ORDER BY d DESC
      `,
      [user.sub, timezone, [...MANDATORY_EXERCISE_IDS], MANDATORY_EXERCISE_IDS.length]
    );

    const completedDaySet = new Set(completedDaysResult.rows.map((r) => r.d));

    // Today in patient timezone
    const todayRow = await pool.query<{ today: string }>(
      `SELECT date((NOW() AT TIME ZONE $1))::text as today`,
      [timezone]
    );
    const today = todayRow.rows[0]?.today ?? new Date().toISOString().slice(0, 10);

    // Current streak: consecutive completed days ending on the most recent completed day.
    // If user completed yesterday but not today yet, we show 1 (not 0).
    // Start from the most recent completed day (today or before), then count backwards.
    const completedDatesOnOrBeforeToday = [...completedDaySet].filter((d) => d <= today).sort();
    const mostRecentCompleted =
      completedDatesOnOrBeforeToday.length > 0
        ? completedDatesOnOrBeforeToday[completedDatesOnOrBeforeToday.length - 1]
        : null;

    let currentStreak = 0;
    if (mostRecentCompleted) {
      let checkDate = mostRecentCompleted;
      while (completedDaySet.has(checkDate)) {
        currentStreak++;
        const d = new Date(checkDate + "T12:00:00");
        d.setDate(d.getDate() - 1);
        checkDate = d.toISOString().slice(0, 10);
      }
    }

    // Longest streak: scan all completed days (sorted asc: oldest first)
    const sortedDates = [...completedDaySet].sort();
    let longestStreak = sortedDates.length > 0 ? 1 : 0;
    let run = sortedDates.length > 0 ? 1 : 0; // run=0 when no dates, else we're in a run of 1
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T12:00:00");
      const curr = new Date(sortedDates[i] + "T12:00:00");
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        run++;
      } else {
        longestStreak = Math.max(longestStreak, run);
        run = 1;
      }
    }
    longestStreak = Math.max(longestStreak, run, currentStreak);

    // Update patients table (assumes row exists from /api/patients/me; only update streaks)
    // Use computed values directly - we are the source of truth from video data
    await pool.query(
      `UPDATE patients SET
         current_streak_days = $1,
         longest_streak_days = $2,
         updated_at = NOW()
       WHERE cognito_sub = $3`,
      [currentStreak, longestStreak, user.sub]
    );

    const totalCompletedDays = completedDaySet.size;

    return NextResponse.json({
      ...status,
      currentStreak,
      longestStreak,
      totalCompletedDays,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
