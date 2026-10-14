import { sleep } from "workflow";

async function schedulerTick() {
  "use step";

  const { getActiveUserSchedules, claimScheduledRun, releaseScheduledRun } = await import("../lib/db");
  const { touchSchedulerHeartbeat } = await import("../lib/scheduler-state");
  const { getLocalDateKey, isScheduleDue } = await import("../lib/schedule");
  const { hasActiveSubscription } = await import("../lib/subscription");
  const { hasGroqApiKey } = await import("../lib/user-groq");
  const { solveDaily } = await import("../lib/solver");

  await touchSchedulerHeartbeat();

  const settingsList = await getActiveUserSchedules();
  let solved = 0;
  const failures: string[] = [];

  for (const settings of settingsList) {
    if (!isScheduleDue(settings)) continue;
    if (!(await hasActiveSubscription(settings.userId))) continue;
    if (!(await hasGroqApiKey(settings.userId))) continue;

    const localDate = getLocalDateKey(settings.timezone);
    const claimed = await claimScheduledRun(settings.userId, localDate);
    if (!claimed) continue;

    try {
      await solveDaily(settings.userId, settings.language);
      solved += 1;
    } catch (error) {
      await releaseScheduledRun(settings.userId, localDate);
      failures.push(`${settings.userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  await touchSchedulerHeartbeat();
  return { status: "checked", users: settingsList.length, solved, failures };
}

export default async function schedulerLoop() {
  "use workflow";

  while (true) {
    await schedulerTick();
    await sleep("5m");
  }
}
