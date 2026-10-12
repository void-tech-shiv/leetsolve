import { neon } from "@neondatabase/serverless";
import { ensureSchema } from "./db";

const STALE_AFTER_MS = 12 * 60 * 1000;

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

export async function getSchedulerState() {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT scheduler_run_id, updated_at FROM system_settings WHERE id = 1 LIMIT 1` as Array<{
    scheduler_run_id: string | null;
    updated_at: string | Date | null;
  }>;
  const row = rows[0];
  const runId = row?.scheduler_run_id || null;
  const heartbeatAt = row?.updated_at ? new Date(row.updated_at) : null;
  const ageMs = heartbeatAt ? Date.now() - heartbeatAt.getTime() : Number.POSITIVE_INFINITY;

  return {
    runId,
    heartbeatAt,
    healthy: Boolean(runId && heartbeatAt && ageMs <= STALE_AFTER_MS),
    ageMs,
  };
}

export async function touchSchedulerHeartbeat() {
  await ensureSchema();
  const db = sql();
  await db`UPDATE system_settings SET updated_at = NOW() WHERE id = 1`;
}
