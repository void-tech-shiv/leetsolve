import { NextResponse } from "next/server";
import { getRecentSolutions, getStreakStats, getTodaySolution } from "@/lib/db";

export async function GET() {
  const language = process.env.DEFAULT_LANGUAGE || "java";
  const [today, history, stats] = await Promise.all([
    getTodaySolution(language),
    getRecentSolutions(14),
    getStreakStats(),
  ]);
  return NextResponse.json({ today, history, stats, language });
}
