"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const languages = [
  { value: "java", label: "Java" },
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
];

export default function ManualSolveCard({
  defaultLanguage,
  connected,
  groqConnected,
}: {
  defaultLanguage: string;
  connected: boolean;
  groqConnected: boolean;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"ok" | "error">("ok");

  async function runSolve() {
    setLoading(true);
    setKind("ok");
    setMessage("Generating with your Groq API key, checking and submitting today’s solution…");

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

  const ready = connected && groqConnected;

  return (
    <div className="controls-card free-manual-card">
      <div>
        <div className="eyebrow">MANUAL SOLVE · FREE</div>
        <h3>Solve and submit today’s problem now</h3>
        <p className="muted small">No activation key is required. LeetSolve uses your own Groq API key to generate and repair the solution, then submits it through your connected LeetCode account.</p>
      </div>
      <div className="controls-row">
        <label className="field">
          <span>Language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button className="primary-button" onClick={runSolve} disabled={loading || !ready}>
          {loading ? "Solving & submitting…" : "Solve & submit now"}
        </button>
      </div>
      {!connected && <div className="notice error">Connect your LeetCode account first.</div>}
      {!groqConnected && <div className="notice error">Add and verify your Groq API key above before solving.</div>}
      {message && <div className={`notice ${kind}`}>{message}</div>}
    </div>
  );
}
