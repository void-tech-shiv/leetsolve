"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const languages = [
  { value: "java", label: "Java" },
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
];

const timezones = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

type ScheduleState = {
  enabled: boolean;
  time: string;
  timezone: string;
  language: string;
  leetcodeUsername: string;
  schedulerRunId?: string | null;
};

export default function SolveControls({ defaultLanguage }: { defaultLanguage: string }) {
  const router = useRouter();
  const [language, setLanguage] = useState(defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"ok" | "error">("ok");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleKind, setScheduleKind] = useState<"ok" | "error">("ok");
  const [schedule, setSchedule] = useState<ScheduleState>({
    enabled: true,
    time: "20:30",
    timezone: "Asia/Kolkata",
    language: defaultLanguage,
    leetcodeUsername: "",
    schedulerRunId: null,
  });

  useEffect(() => {
    fetch("/api/settings/schedule")
      .then((response) => response.json())
      .then((payload) => {
        if (!payload?.error) {
          setSchedule({
            enabled: payload.enabled,
            time: payload.time,
            timezone: payload.timezone,
            language: payload.language,
            leetcodeUsername: payload.leetcodeUsername || "",
            schedulerRunId: payload.schedulerRunId,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  async function runSolve() {
    setLoading(true);
    setMessage("Generating and checking today’s solution…");
    setKind("ok");

    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Solve request failed.");
      setMessage(`Done: ${payload.problem.title} · ${payload.verification.status}`);
      router.refresh();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    setScheduleKind("ok");
    setScheduleMessage("Saving your profile and schedule…");

    try {
      const response = await fetch("/api/settings/schedule", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: schedule.enabled,
          time: schedule.time,
          timezone: schedule.timezone,
          language: schedule.language,
          leetcodeUsername: schedule.leetcodeUsername,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not save settings.");

      let started = Boolean(payload.schedulerRunId);
      if (schedule.enabled && !started) {
        const schedulerResponse = await fetch("/api/scheduler/start", { method: "POST" });
        const schedulerPayload = await schedulerResponse.json();
        if (!schedulerResponse.ok) throw new Error(schedulerPayload?.error || "Settings saved, but background scheduler could not start.");
        started = true;
        setSchedule((current) => ({ ...current, schedulerRunId: schedulerPayload.runId }));
      }

      setLanguage(schedule.language);
      setScheduleMessage(
        schedule.enabled
          ? `Saved. Your daily solver will run at ${schedule.time} (${schedule.timezone}).${started ? " Scheduler is active." : ""}`
          : "Saved. Automatic solving is paused."
      );
      router.refresh();
    } catch (error) {
      setScheduleKind("error");
      setScheduleMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <>
      <div className="controls-card">
        <div>
          <div className="eyebrow">Account setup</div>
          <h3>Your LeetSolve profile</h3>
          <p className="muted small">Your schedule and history are private to your signed-in account.</p>
        </div>
        <div className="controls-row">
          <label className="field grow">
            <span>LeetCode username</span>
            <input
              value={schedule.leetcodeUsername}
              onChange={(event) => setSchedule((current) => ({ ...current, leetcodeUsername: event.target.value }))}
              placeholder="your_leetcode_username"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Automatic solving</span>
            <select
              value={schedule.enabled ? "on" : "off"}
              onChange={(event) => setSchedule((current) => ({ ...current, enabled: event.target.value === "on" }))}
            >
              <option value="on">Enabled</option>
              <option value="off">Paused</option>
            </select>
          </label>
          <label className="field">
            <span>Daily time</span>
            <input
              type="time"
              value={schedule.time}
              onChange={(event) => setSchedule((current) => ({ ...current, time: event.target.value }))}
            />
          </label>
          <label className="field grow">
            <span>Timezone</span>
            <select
              value={schedule.timezone}
              onChange={(event) => setSchedule((current) => ({ ...current, timezone: event.target.value }))}
            >
              {timezones.map((timezone) => <option value={timezone} key={timezone}>{timezone}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Language</span>
            <select
              value={schedule.language}
              onChange={(event) => setSchedule((current) => ({ ...current, language: event.target.value }))}
            >
              {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button className="primary-button" onClick={saveSchedule} disabled={savingSchedule}>
            {savingSchedule ? "Saving…" : "Save settings"}
          </button>
        </div>
        {scheduleMessage && <div className={`notice ${scheduleKind}`}>{scheduleMessage}</div>}
      </div>

      <div className="controls-card">
        <div>
          <div className="eyebrow">Manual test</div>
          <h3>Run today’s solver now</h3>
          <p className="muted small">Use this to test your account immediately instead of waiting for the scheduled time.</p>
        </div>
        <div className="controls-row">
          <label className="field">
            <span>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button className="primary-button" onClick={runSolve} disabled={loading}>
            {loading ? "Solving…" : "Solve now"}
          </button>
        </div>
        {message && <div className={`notice ${kind}`}>{message}</div>}
      </div>
    </>
  );
}
