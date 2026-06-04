import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __forwardonticsPgPool: Pool | undefined;
}

function readBool(value: string | undefined): boolean {
  return (value || "").toLowerCase() === "true";
}

export function getPgPool(): Pool {
  if (global.__forwardonticsPgPool) return global.__forwardonticsPgPool;

  const sslEnabled = readBool(process.env.DB_SSL);

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  global.__forwardonticsPgPool = pool;
  return pool;
}

