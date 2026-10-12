import { NextResponse } from "next/server";

export async function GET() {
  const authReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  const groqReady = Boolean(process.env.GROQ_API_KEY);
  const databaseReady = Boolean(process.env.DATABASE_URL);

  return NextResponse.json({
    authentication: authReady,
    groq: groqReady,
    database: databaseReady,
    ready: authReady && groqReady && databaseReady,
  });
}
