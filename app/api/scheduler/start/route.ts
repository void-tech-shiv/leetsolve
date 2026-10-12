import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { ensureSchedulerRunning } from "@/lib/start-scheduler";

export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await ensureSchedulerRunning();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
