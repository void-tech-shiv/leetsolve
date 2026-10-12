import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { solveDaily } from "@/lib/solver";

export async function POST(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await solveDaily(session.user.id, body.language || process.env.DEFAULT_LANGUAGE || "java");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
