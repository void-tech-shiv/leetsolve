import { NextResponse } from "next/server";

export async function GET() {
  const authReady = Boolean(process.env.NEON_AUTH_BASE_URL && process.env.DATABASE_URL);
  const groqReady = Boolean(process.env.GROQ_API_KEY);
  const databaseReady = Boolean(process.env.DATABASE_URL);

  return NextResponse.json({
    authentication: authReady,
    groq: groqReady,
    database: databaseReady,
    ready: authReady && groqReady && databaseReady,
  });
}
