import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { solveDaily } from "@/lib/solver";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await solveDaily(userId, body.language || process.env.DEFAULT_LANGUAGE || "java");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
