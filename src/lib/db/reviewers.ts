import { getPgPool } from "@/lib/db/pool";

let ensurePromise: Promise<void> | null = null;

export async function ensureReviewersTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const pool = getPgPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reviewers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cognito_sub TEXT NOT NULL UNIQUE,
          fullname TEXT,
          email TEXT,
          phone TEXT,
          max_patient_capacity INTEGER DEFAULT 0,
          total_patient_capacity INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS reviewers_cognito_sub_idx ON reviewers (cognito_sub);`
      );

      // FUTURE: membership_expires_at - Reviewer membership not currently enforced.
      // Doctor access is limited only by assigned patient quota (max_patient_capacity).
      // Column kept for potential future use (e.g. reviewer subscription tiers).
      await pool.query(
        `ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;`
      );

      // Admin is not a reviewer: exclude from reviewers list/count. Synced from Cognito groups in reviewers/me.
      await pool.query(
        `ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;`
      );

      await pool.query(
        `ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;`
      );
    })();
  }
  await ensurePromise;
}
