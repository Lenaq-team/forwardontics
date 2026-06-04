import { getPgPool } from "@/lib/db/pool";

let ensurePromise: Promise<void> | null = null;

export async function ensureVideoUploadsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const pool = getPgPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS video_uploads (
          id UUID PRIMARY KEY,
          user_sub TEXT NOT NULL,
          user_email TEXT,
          bucket TEXT NOT NULL,
          key TEXT NOT NULL,
          stage TEXT NOT NULL,
          exercise_id INTEGER, -- Exercise type (matches exercises.ts id)
          created_at TIMESTAMPTZ NOT NULL,
          trim_start_seconds NUMERIC,
          trim_end_seconds NUMERIC,
          content_type TEXT,
          size_bytes BIGINT,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // In case the table existed before new columns were added, ensure columns exist.
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS exercise_id INTEGER;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS trim_start_seconds NUMERIC;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS trim_end_seconds NUMERIC;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS content_type TEXT;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS size_bytes BIGINT;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS rating NUMERIC;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS reviewer_id UUID;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS review_comments TEXT;`);
      await pool.query(`ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;`);

      await pool.query(`CREATE INDEX IF NOT EXISTS video_uploads_user_sub_idx ON video_uploads (user_sub);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS video_uploads_created_at_idx ON video_uploads (created_at DESC);`);
    })();
  }
  await ensurePromise;
}

