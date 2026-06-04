import { getPgPool } from "@/lib/db/pool";

let ensurePromise: Promise<void> | null = null;

export async function ensurePatientsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const pool = getPgPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS patients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cognito_sub TEXT NOT NULL UNIQUE,
          email TEXT,
          timezone TEXT NOT NULL DEFAULT 'UTC',
          full_name TEXT,
          assigned_doctor TEXT,
          phone TEXT,
          date_of_birth DATE,
          sex TEXT,
          status TEXT DEFAULT 'active',
          current_streak_days INTEGER DEFAULT 0,
          longest_streak_days INTEGER DEFAULT 0,
          last_completed_day_key TEXT,
          last_activity_day_key TEXT,
          streak_started_day_key TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS full_name TEXT;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_doctor TEXT;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone TEXT;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex TEXT;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_streak_days INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS longest_streak_days INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_completed_day_key TEXT;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_activity_day_key TEXT;`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS streak_started_day_key TEXT;`);

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS patients_cognito_sub_idx ON patients (cognito_sub);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS patients_email_idx ON patients (email) WHERE email IS NOT NULL;`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS patients_assigned_doctor_idx ON patients (assigned_doctor) WHERE assigned_doctor IS NOT NULL;`
      );

      // Patient 90-day membership once enrolled. When expired, patient cannot upload videos.
      await pool.query(
        `ALTER TABLE patients ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;`
      );

      await pool.query(
        `ALTER TABLE patients ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;`
      );
    })();
  }
  await ensurePromise;
}
