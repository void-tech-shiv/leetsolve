import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getRecentSolutions, getStreakStats, getTodaySolution, getUserSettings } from "@/lib/db";

export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const settings = await getUserSettings(userId);
  const [today, history, stats] = await Promise.all([
    getTodaySolution(userId, settings.language),
    getRecentSolutions(userId, 14),
    getStreakStats(userId, settings.timezone),
  ]);
  return NextResponse.json({ today, history, stats, settings });
}
