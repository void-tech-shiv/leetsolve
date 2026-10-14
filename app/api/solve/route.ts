import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { solveDaily } from "@/lib/solver";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await solveDaily(
      session.user.id,
      body.language || process.env.DEFAULT_LANGUAGE || "java",
      { requireSubscription: false },
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const lower = message.toLowerCase();
    const status = lower.includes("groq api key") || lower.includes("connect your leetcode") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
