import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getUserSettings, updateUserSettings } from "@/lib/db";
import { isValidTimezone } from "@/lib/schedule";
import { ensureSchedulerRunning } from "@/lib/start-scheduler";
import { hasActiveSubscription } from "@/lib/subscription";

const schema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80),
  language: z.enum(["java", "python3", "cpp", "javascript"]),
  leetcodeUsername: z.string().trim().max(80).optional(),
});

async function sessionUserId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id || null;
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await getUserSettings(userId);
    const automationActive = await hasActiveSubscription(userId).catch(() => false);
    if (settings.enabled && automationActive) {
      const scheduler = await ensureSchedulerRunning();
      settings.schedulerRunId = scheduler.runId;
    } else if (!automationActive) {
      settings.schedulerRunId = null;
    }
    return NextResponse.json({ ...settings, automationActive });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid profile or schedule settings." }, { status: 400 });
    if (!isValidTimezone(parsed.data.timezone)) {
      return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
    }

    const settings = await updateUserSettings(userId, parsed.data);
    const automationActive = await hasActiveSubscription(userId).catch(() => false);
    if (settings.enabled && automationActive) {
      const scheduler = await ensureSchedulerRunning();
      settings.schedulerRunId = scheduler.runId;
    } else if (!automationActive) {
      settings.schedulerRunId = null;
    }
    return NextResponse.json({ ...settings, automationActive });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
