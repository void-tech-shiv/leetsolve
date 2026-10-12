import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    groq: Boolean(process.env.GROQ_API_KEY),
    leetcodeSession: Boolean(process.env.LEETCODE_SESSION),
    csrf: Boolean(process.env.LEETCODE_CSRF),
    database: Boolean(process.env.DATABASE_URL),
    ready: Boolean(
      process.env.GROQ_API_KEY &&
      process.env.LEETCODE_SESSION &&
      process.env.LEETCODE_CSRF &&
      process.env.DATABASE_URL
    ),
  });
}
