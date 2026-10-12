import { start } from "workflow/api";
import schedulerLoop from "@/workflows/scheduler";
import { getSchedulerState } from "./scheduler-state";
import { setSystemSchedulerRunId } from "./db";

export async function ensureSchedulerRunning() {
  const state = await getSchedulerState();
  if (state.healthy && state.runId) {
    return { runId: state.runId, alreadyRunning: true, restarted: false };
  }

  const run = await start(schedulerLoop, []);
  await setSystemSchedulerRunId(run.runId);
  return { runId: run.runId, alreadyRunning: false, restarted: Boolean(state.runId) };
}
