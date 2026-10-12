export type ScheduleSettings = {
  enabled: boolean;
  time: string;
  timezone: string;
  language: string;
  lastRunLocalDate: string | null;
  schedulerRunId: string | null;
};

function clockParts(timezone: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

export function getLocalDateKey(timezone: string, at = new Date()) {
  return clockParts(timezone, at).date;
}

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isScheduleDue(settings: ScheduleSettings, at = new Date()) {
  if (!settings.enabled) return false;

  const local = clockParts(settings.timezone, at);
  if (settings.lastRunLocalDate === local.date) return false;

  const [targetHour, targetMinute] = settings.time.split(":").map(Number);
  const nowMinutes = local.hour * 60 + local.minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  return nowMinutes >= targetMinutes;
}
