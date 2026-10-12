import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import schedulerLoop from "@/workflows/scheduler";
import { getScheduleSettings, setSchedulerRunId } from "@/lib/db";

export async function POST(request: NextRequest) {
  const configuredKey = process.env.APP_ACCESS_KEY;
  if (configuredKey && request.headers.get("x-leetsolve-key") !== configuredKey) {
    return NextResponse.json({ error: "Invalid app access key." }, { status: 401 });
  }

  try {
    const settings = await getScheduleSettings();
    if (settings.schedulerRunId) {
      return NextResponse.json({ ok: true, runId: settings.schedulerRunId, alreadyRunning: true });
    }

    const run = await start(schedulerLoop, []);
    await setSchedulerRunId(run.runId);
    return NextResponse.json({ ok: true, runId: run.runId, alreadyRunning: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
