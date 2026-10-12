import { NextRequest, NextResponse } from "next/server";
import { solveDaily } from "@/lib/solver";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await solveDaily();
    return NextResponse.json({
      ok: true,
      title: result.problem.title,
      language: result.solution.language,
      verification: result.verification.status,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
