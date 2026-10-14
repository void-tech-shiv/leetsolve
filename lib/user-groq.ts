import { neon } from "@neondatabase/serverless";
import { decryptSecret, encryptSecret } from "./crypto";

export type GroqKeyStatus = {
  connected: boolean;
  verifiedAt: string | null;
};

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

async function ensureSchema() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS user_ai_credentials (
    user_id TEXT PRIMARY KEY,
    groq_api_key_enc TEXT,
    groq_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export async function verifyGroqApiKey(apiKey: string) {
  const response = await fetch("https://api.groq.com/openai/v1/models", {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Groq API key is invalid or does not have access.");
    }
    const body = await response.text().catch(() => "");
    throw new Error(`Groq verification failed (${response.status})${body ? `: ${body.slice(0, 160)}` : ""}`);
  }

  return true;
}

export async function saveGroqApiKey(userId: string, apiKey: string): Promise<GroqKeyStatus> {
  await ensureSchema();
  const sql = db();
  const encrypted = encryptSecret(apiKey);
  const rows = await sql`INSERT INTO user_ai_credentials (user_id, groq_api_key_enc, groq_verified_at, updated_at)
    VALUES (${userId}, ${encrypted}, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      groq_api_key_enc = EXCLUDED.groq_api_key_enc,
      groq_verified_at = NOW(),
      updated_at = NOW()
    RETURNING groq_verified_at` as Array<{ groq_verified_at: string | Date | null }>;

  return {
    connected: true,
    verifiedAt: rows[0]?.groq_verified_at ? new Date(rows[0].groq_verified_at).toISOString() : new Date().toISOString(),
  };
}

export async function getGroqApiKey(userId: string): Promise<string | null> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT groq_api_key_enc FROM user_ai_credentials WHERE user_id = ${userId} LIMIT 1` as Array<{ groq_api_key_enc: string | null }>;
  const encrypted = rows[0]?.groq_api_key_enc;
  if (!encrypted) return null;
  return decryptSecret(encrypted);
}

export async function getGroqKeyStatus(userId: string): Promise<GroqKeyStatus> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT groq_api_key_enc, groq_verified_at FROM user_ai_credentials WHERE user_id = ${userId} LIMIT 1` as Array<{
    groq_api_key_enc: string | null;
    groq_verified_at: string | Date | null;
  }>;
  const row = rows[0];
  return {
    connected: Boolean(row?.groq_api_key_enc),
    verifiedAt: row?.groq_verified_at ? new Date(row.groq_verified_at).toISOString() : null,
  };
}

export async function hasGroqApiKey(userId: string) {
  return (await getGroqKeyStatus(userId)).connected;
}

export async function requireGroqApiKey(userId: string) {
  const apiKey = await getGroqApiKey(userId);
  if (!apiKey) {
    throw new Error("Add your Groq API key in LeetSolve before solving or enabling automation.");
  }
  return apiKey;
}

export async function clearGroqApiKey(userId: string): Promise<GroqKeyStatus> {
  await ensureSchema();
  const sql = db();
  await sql`DELETE FROM user_ai_credentials WHERE user_id = ${userId}`;
  return { connected: false, verifiedAt: null };
}
