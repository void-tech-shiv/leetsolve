import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type SubscriptionStatus = {
  active: boolean;
  status: "NONE" | "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
  activatedAt: string | null;
  daysRemaining: number;
  codeHint: string | null;
};

type ActivationRow = {
  id: number | string;
  code_hash: string;
  code_hint: string | null;
  duration_days: number;
  status: "AVAILABLE" | "ACTIVE" | "REVOKED";
  user_id: string | null;
  activated_at: string | Date | null;
  expires_at: string | Date | null;
};

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

export function normalizeActivationCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashActivationCode(value: string) {
  return createHash("sha256").update(normalizeActivationCode(value)).digest("hex");
}

export async function ensureSubscriptionSchema() {
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS activation_codes (
    id BIGSERIAL PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    code_hint TEXT,
    duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','ACTIVE','REVOKED')),
    user_id TEXT,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS activation_codes_user_expiry_idx
    ON activation_codes(user_id, expires_at DESC)`;
}

function toIso(value: string | Date | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function statusFromRow(row: ActivationRow | undefined): SubscriptionStatus {
  if (!row) {
    return { active: false, status: "NONE", expiresAt: null, activatedAt: null, daysRemaining: 0, codeHint: null };
  }

  const expiresAt = toIso(row.expires_at);
  const activatedAt = toIso(row.activated_at);
  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
  const active = row.status === "ACTIVE" && remainingMs > 0;

  return {
    active,
    status: row.status === "REVOKED" ? "REVOKED" : active ? "ACTIVE" : "EXPIRED",
    expiresAt,
    activatedAt,
    daysRemaining: active ? Math.max(1, Math.ceil(remainingMs / 86_400_000)) : 0,
    codeHint: row.code_hint,
  };
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  await ensureSubscriptionSchema();
  const db = sql();
  const rows = await db`SELECT id, code_hash, code_hint, duration_days, status, user_id, activated_at, expires_at
    FROM activation_codes
    WHERE user_id = ${userId}
    ORDER BY expires_at DESC NULLS LAST, activated_at DESC NULLS LAST
    LIMIT 1` as ActivationRow[];
  return statusFromRow(rows[0]);
}

export async function hasActiveSubscription(userId: string) {
  return (await getSubscriptionStatus(userId)).active;
}

export async function requireActiveSubscription(userId: string) {
  const subscription = await getSubscriptionStatus(userId);
  if (!subscription.active) {
    throw new Error(subscription.status === "EXPIRED"
      ? "Your LeetSolve subscription has expired. Activate a new key to continue."
      : "An active LeetSolve activation key is required.");
  }
  return subscription;
}

export async function activateSubscription(userId: string, rawCode: string): Promise<SubscriptionStatus> {
  const normalized = normalizeActivationCode(rawCode);
  if (normalized.length < 10 || normalized.length > 120) {
    throw new Error("Invalid activation code.");
  }

  await ensureSubscriptionSchema();
  const db = sql();
  const codeHash = hashActivationCode(normalized);
  const rows = await db`SELECT id, code_hash, code_hint, duration_days, status, user_id, activated_at, expires_at
    FROM activation_codes WHERE code_hash = ${codeHash} LIMIT 1` as ActivationRow[];
  const code = rows[0];

  if (!code || code.status === "REVOKED") throw new Error("Invalid or revoked activation code.");

  if (code.status === "ACTIVE") {
    if (code.user_id !== userId) throw new Error("This activation code is already linked to another account.");
    const current = statusFromRow(code);
    if (!current.active) throw new Error("This activation code has expired.");
    return current;
  }

  const current = await getSubscriptionStatus(userId);
  const now = Date.now();
  const baseTime = current.active && current.expiresAt
    ? Math.max(now, new Date(current.expiresAt).getTime())
    : now;
  const expiresAt = new Date(baseTime + code.duration_days * 86_400_000).toISOString();

  const activated = await db`UPDATE activation_codes SET
      status = 'ACTIVE',
      user_id = ${userId},
      activated_at = NOW(),
      expires_at = ${expiresAt}::timestamptz,
      updated_at = NOW()
    WHERE id = ${code.id} AND status = 'AVAILABLE' AND user_id IS NULL
    RETURNING id, code_hash, code_hint, duration_days, status, user_id, activated_at, expires_at` as ActivationRow[];

  if (!activated[0]) throw new Error("Activation code was already used. Please try another key.");
  return statusFromRow(activated[0]);
}
