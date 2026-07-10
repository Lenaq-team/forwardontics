import { getPgPool } from "@/lib/db/pool";

let ensurePromise: Promise<void> | null = null;

export async function ensureAuditLogsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const pool = getPgPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          performed_by_email TEXT        NOT NULL,
          performed_by_sub   TEXT        NOT NULL,
          action             TEXT        NOT NULL,
          target_id          TEXT        NOT NULL,
          target_email       TEXT,
          target_name        TEXT,
          target_role        TEXT        NOT NULL,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(
        `CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS audit_logs_performed_by_idx ON audit_logs (performed_by_sub);`
      );
      await pool.query(
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT;`
      );
    })();
  }
  await ensurePromise;
}
