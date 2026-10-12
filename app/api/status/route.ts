import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRecentSolutions, getStreakStats, getTodaySolution, getUserSettings } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getUserSettings(userId);
  const [today, history, stats] = await Promise.all([
    getTodaySolution(userId, settings.language),
    getRecentSolutions(userId, 14),
    getStreakStats(userId, settings.timezone),
  ]);
  return NextResponse.json({ today, history, stats, settings });
}
