import { sleep } from "workflow";

async function schedulerTick() {
  "use step";

  const { getActiveUserSchedules, claimScheduledRun, releaseScheduledRun } = await import("../lib/db");
  const { getLocalDateKey, isScheduleDue } = await import("../lib/schedule");
  const { solveDaily } = await import("../lib/solver");

  const settingsList = await getActiveUserSchedules();
  let solved = 0;
  const failures: string[] = [];

  for (const settings of settingsList) {
    if (!isScheduleDue(settings)) continue;

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

  return { status: "checked", users: settingsList.length, solved, failures };
}

export default async function schedulerLoop() {
  "use workflow";

  while (true) {
    await schedulerTick();
    await sleep("5m");
  }
}
