import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { start } from "workflow/api";
import schedulerLoop from "@/workflows/scheduler";
import { getSystemSchedulerRunId, setSystemSchedulerRunId } from "@/lib/db";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existingRunId = await getSystemSchedulerRunId();
    if (existingRunId) {
      return NextResponse.json({ ok: true, runId: existingRunId, alreadyRunning: true });
    }

    const run = await start(schedulerLoop, []);
    await setSystemSchedulerRunId(run.runId);
    return NextResponse.json({ ok: true, runId: run.runId, alreadyRunning: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
