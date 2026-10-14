import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getLeetCodeCredentials, getUserSettings } from "@/lib/db";
import { getLeetCodeAccountStats } from "@/lib/leetcode";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await getUserSettings(session.user.id);
    if (!settings.leetcodeConnected || !settings.leetcodeUsername) {
      return NextResponse.json({ connected: false });
    }

    const credentials = await getLeetCodeCredentials(session.user.id);
    if (!credentials) return NextResponse.json({ connected: false });

    const stats = await getLeetCodeAccountStats(credentials, settings.leetcodeUsername);
    return NextResponse.json({ connected: true, stats }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      connected: true,
      error: error instanceof Error ? error.message : "Could not load LeetCode stats.",
    }, { status: 500 });
  }
}
