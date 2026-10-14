import { NextResponse } from "next/server";

export async function GET() {
  const authReady = Boolean(process.env.NEON_AUTH_BASE_URL && process.env.DATABASE_URL);
  const databaseReady = Boolean(process.env.DATABASE_URL);
  const encryptionReady = Boolean(process.env.APP_ENCRYPTION_KEY);

  return NextResponse.json({
    authentication: authReady,
    database: databaseReady,
    userGroqKeys: encryptionReady,
    ready: authReady && databaseReady && encryptionReady,
  });
}
