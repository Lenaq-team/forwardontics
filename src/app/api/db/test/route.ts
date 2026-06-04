import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db/pool";

export async function GET() {
  try {
    const pool = getPgPool();
    const result = await pool.query("SELECT 1 as ok, now() as now");
    return NextResponse.json({ ok: true, db: result.rows?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

