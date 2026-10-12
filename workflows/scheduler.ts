import { sleep } from "workflow";

async function schedulerTick() {
  "use step";

  const { getScheduleSettings, claimScheduledRun, releaseScheduledRun } = await import("../lib/db");
  const { getLocalDateKey, isScheduleDue } = await import("../lib/schedule");
  const { solveDaily } = await import("../lib/solver");

  const settings = await getScheduleSettings();
  if (!isScheduleDue(settings)) {
    return { status: settings.enabled ? "waiting" : "disabled" };
  }

  const localDate = getLocalDateKey(settings.timezone);
  const claimed = await claimScheduledRun(localDate);
  if (!claimed) return { status: "already-claimed" };

  try {
    const result = await solveDaily(settings.language);
    return {
      status: "solved",
      localDate,
      title: result.problem.title,
      language: result.solution.language,
      verification: result.verification.status,
    };
  } catch (error) {
    await releaseScheduledRun(localDate);
    throw error;
  }
}

export default async function schedulerLoop() {
  "use workflow";

  while (true) {
    await schedulerTick();
    await sleep("5m");
  }
}
