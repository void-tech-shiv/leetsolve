import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { ensureSchedulerRunning } from "@/lib/start-scheduler";
import { requireActiveSubscription } from "@/lib/subscription";
import { requireGroqApiKey } from "@/lib/user-groq";

export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireActiveSubscription(session.user.id);
    await requireGroqApiKey(session.user.id);
    const result = await ensureSchedulerRunning();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const lower = message.toLowerCase();
    const status = lower.includes("subscription") || lower.includes("activation") || lower.includes("groq") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
