import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { ensureSchedulerRunning } from "@/lib/start-scheduler";
import { requireActiveSubscription } from "@/lib/subscription";

export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireActiveSubscription(session.user.id);
    const result = await ensureSchedulerRunning();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.toLowerCase().includes("subscription") || message.toLowerCase().includes("activation") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
