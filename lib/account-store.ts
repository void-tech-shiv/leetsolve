import { neon } from "@neondatabase/serverless";
import { decryptSecret, encryptSecret } from "./crypto";
import { ensureSchema } from "./db";

export type AccountStatus = {
  setupComplete: boolean;
  platformUsername: string | null;
  aiConfigured: boolean;
  platformConfigured: boolean;
};

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

async function ensureAccountColumns() {
  await ensureSchema();
  const db = sql();
  await db`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_key_ciphertext TEXT`;
  await db`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS platform_session_ciphertext TEXT`;
  await db`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS platform_csrf_ciphertext TEXT`;
  await db`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS platform_username TEXT`;
  await db`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT FALSE`;
  await db`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS setup_updated_at TIMESTAMPTZ`;
}

export async function getAccountStatus(): Promise<AccountStatus> {
  if (!process.env.DATABASE_URL) {
    return { setupComplete: false, platformUsername: null, aiConfigured: false, platformConfigured: false };
  }
  await ensureAccountColumns();
  const db = sql();
  const rows = await db`SELECT setup_complete, platform_username,
    (ai_key_ciphertext IS NOT NULL) AS ai_configured,
    (platform_session_ciphertext IS NOT NULL AND platform_csrf_ciphertext IS NOT NULL) AS platform_configured
    FROM app_settings WHERE id = 1 LIMIT 1`;
  const row = rows[0];
  return {
    setupComplete: Boolean(row?.setup_complete),
    platformUsername: row?.platform_username ? String(row.platform_username) : null,
    aiConfigured: Boolean(row?.ai_configured),
    platformConfigured: Boolean(row?.platform_configured),
  };
}

export async function saveAccountSetup(input: {
  aiKey: string;
  sessionValue: string;
  csrfValue: string;
  username: string | null;
}) {
  await ensureAccountColumns();
  const db = sql();
  await db`UPDATE app_settings SET
    ai_key_ciphertext = ${encryptSecret(input.aiKey)},
    platform_session_ciphertext = ${encryptSecret(input.sessionValue)},
    platform_csrf_ciphertext = ${encryptSecret(input.csrfValue)},
    platform_username = ${input.username},
    setup_complete = TRUE,
    setup_updated_at = NOW(),
    updated_at = NOW()
    WHERE id = 1`;
  return getAccountStatus();
}

export async function getAccountSecrets() {
  await ensureAccountColumns();
  const db = sql();
  const rows = await db`SELECT ai_key_ciphertext, platform_session_ciphertext,
    platform_csrf_ciphertext, platform_username FROM app_settings WHERE id = 1 LIMIT 1`;
  const row = rows[0];
  const aiKey = decryptSecret(row?.ai_key_ciphertext ? String(row.ai_key_ciphertext) : null);
  const sessionValue = decryptSecret(row?.platform_session_ciphertext ? String(row.platform_session_ciphertext) : null);
  const csrfValue = decryptSecret(row?.platform_csrf_ciphertext ? String(row.platform_csrf_ciphertext) : null);
  if (!aiKey || !sessionValue || !csrfValue) throw new Error("Account setup is incomplete. Open /setup first.");
  return {
    aiKey,
    sessionValue,
    csrfValue,
    username: row?.platform_username ? String(row.platform_username) : null,
  };
}
