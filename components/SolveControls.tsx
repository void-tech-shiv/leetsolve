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
  schedulerRunId?: string | null;
};

type LeetCodeConnection = {
  connected: boolean;
  username?: string | null;
  verifiedAt?: string | null;
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
    schedulerRunId: null,
  });

  const [connection, setConnection] = useState<LeetCodeConnection>({ connected: false });
  const [leetcodeSession, setLeetcodeSession] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionKind, setConnectionKind] = useState<"ok" | "error">("ok");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/schedule").then((response) => response.json()),
      fetch("/api/settings/leetcode").then((response) => response.json()),
    ])
      .then(([schedulePayload, connectionPayload]) => {
        if (!schedulePayload?.error) {
          setSchedule({
            enabled: schedulePayload.enabled,
            time: schedulePayload.time,
            timezone: schedulePayload.timezone,
            language: schedulePayload.language,
            schedulerRunId: schedulePayload.schedulerRunId,
          });
          setLanguage(schedulePayload.language);
        }
        if (!connectionPayload?.error) {
          setConnection({
            connected: Boolean(connectionPayload.connected),
            username: connectionPayload.username,
            verifiedAt: connectionPayload.verifiedAt,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  async function connectLeetCode() {
    setConnecting(true);
    setConnectionKind("ok");
    setConnectionMessage("Verifying your LeetCode session…");

    try {
      const response = await fetch("/api/settings/leetcode", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: leetcodeSession, csrfToken }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not connect LeetCode.");

      setConnection({ connected: true, username: payload.username, verifiedAt: payload.verifiedAt });
      setLeetcodeSession("");
      setCsrfToken("");
      setConnectionMessage(`Connected to LeetCode as ${payload.username}. Credentials are encrypted server-side.`);
      router.refresh();
    } catch (error) {
      setConnectionKind("error");
      setConnectionMessage(error instanceof Error ? error.message : "Could not connect LeetCode.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectLeetCode() {
    setConnecting(true);
    setConnectionKind("ok");
    try {
      const response = await fetch("/api/settings/leetcode", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not disconnect LeetCode.");
      setConnection({ connected: false, username: null, verifiedAt: null });
      setConnectionMessage("LeetCode credentials removed from LeetSolve.");
      router.refresh();
    } catch (error) {
      setConnectionKind("error");
      setConnectionMessage(error instanceof Error ? error.message : "Could not disconnect LeetCode.");
    } finally {
      setConnecting(false);
    }
  }

  async function runSolve() {
    setLoading(true);
    setMessage("Generating, checking and submitting today’s solution…");
    setKind("ok");

    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Solve request failed.");

      const verdict = payload?.submission?.statusMessage || payload?.verification?.status || "Completed";
      if (!payload?.submission?.accepted) setKind("error");
      setMessage(`${payload.problem.title} · LeetCode verdict: ${verdict}`);
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
    setScheduleMessage("Saving your schedule…");

    try {
      const response = await fetch("/api/settings/schedule", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: schedule.enabled,
          time: schedule.time,
          timezone: schedule.timezone,
          language: schedule.language,
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
          ? `Saved. LeetSolve will solve and submit at ${schedule.time} (${schedule.timezone}).${started ? " Scheduler is active." : ""}`
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
          <div className="eyebrow">LeetCode account</div>
          <h3>{connection.connected ? `Connected as ${connection.username || "LeetCode user"}` : "Connect your LeetCode session"}</h3>
          <p className="muted small">
            LeetSolve uses your LEETCODE_SESSION and csrftoken only on the server to submit solutions to your account. Saved values are encrypted and are never shown back in the browser.
          </p>
        </div>

        {connection.connected ? (
          <div className="controls-row">
            <div className="field grow">
              <span>Status</span>
              <div className="notice ok">Connected ✓ {connection.verifiedAt ? `· verified ${new Date(connection.verifiedAt).toLocaleString()}` : ""}</div>
            </div>
            <button className="secondary-button" onClick={disconnectLeetCode} disabled={connecting}>
              {connecting ? "Working…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="controls-row">
            <label className="field grow">
              <span>LEETCODE_SESSION</span>
              <input
                type="password"
                value={leetcodeSession}
                onChange={(event) => setLeetcodeSession(event.target.value)}
                placeholder="Paste LEETCODE_SESSION cookie"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="field grow">
              <span>csrftoken</span>
              <input
                type="password"
                value={csrfToken}
                onChange={(event) => setCsrfToken(event.target.value)}
                placeholder="Paste csrftoken cookie"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className="primary-button"
              onClick={connectLeetCode}
              disabled={connecting || !leetcodeSession.trim() || !csrfToken.trim()}
            >
              {connecting ? "Verifying…" : "Verify & connect"}
            </button>
          </div>
        )}
        {connectionMessage && <div className={`notice ${connectionKind}`}>{connectionMessage}</div>}
      </div>

      <div className="controls-card">
        <div>
          <div className="eyebrow">Daily automation</div>
          <h3>Choose when LeetSolve submits every day</h3>
          <p className="muted small">The cloud scheduler runs even when your laptop is off. A connected LeetCode account is required.</p>
        </div>
        <div className="controls-row">
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
            {savingSchedule ? "Saving…" : "Save schedule"}
          </button>
        </div>
        {scheduleMessage && <div className={`notice ${scheduleKind}`}>{scheduleMessage}</div>}
      </div>

      <div className="controls-card">
        <div>
          <div className="eyebrow">Manual test</div>
          <h3>Solve and submit today’s problem now</h3>
          <p className="muted small">LeetSolve generates the solution, verifies it when possible, submits it to LeetCode and repairs/retries failed submissions automatically.</p>
        </div>
        <div className="controls-row">
          <label className="field">
            <span>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button className="primary-button" onClick={runSolve} disabled={loading || !connection.connected}>
            {loading ? "Solving & submitting…" : "Solve & submit now"}
          </button>
        </div>
        {!connection.connected && <div className="notice error">Connect your LeetCode account first.</div>}
        {message && <div className={`notice ${kind}`}>{message}</div>}
      </div>
    </>
  );
}
