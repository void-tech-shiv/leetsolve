import { NextRequest, NextResponse } from "next/server";
import { solveDaily } from "@/lib/solver";

export async function POST(request: NextRequest) {
  const configuredKey = process.env.APP_ACCESS_KEY;
  if (configuredKey && request.headers.get("x-leetsolve-key") !== configuredKey) {
    return NextResponse.json({ error: "Invalid app access key." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await solveDaily(body.language || process.env.DEFAULT_LANGUAGE || "java");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
