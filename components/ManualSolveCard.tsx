"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const languages = [
  { value: "java", label: "Java" },
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
];

export default function ManualSolveCard({ defaultLanguage, connected }: { defaultLanguage: string; connected: boolean }) {
  const router = useRouter();
  const [language, setLanguage] = useState(defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"ok" | "error">("ok");

  async function runSolve() {
    setLoading(true);
    setKind("ok");
    setMessage("Generating, checking and submitting today’s solution…");

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

  return (
    <div className="controls-card free-manual-card">
      <div>
        <div className="eyebrow">MANUAL SOLVE · FREE</div>
        <h3>Solve and submit today’s problem now</h3>
        <p className="muted small">No activation key is required. Connect your LeetCode account, choose a language and run it whenever you want.</p>
      </div>
      <div className="controls-row">
        <label className="field">
          <span>Language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button className="primary-button" onClick={runSolve} disabled={loading || !connected}>
          {loading ? "Solving & submitting…" : "Solve & submit now"}
        </button>
      </div>
      {!connected && <div className="notice error">Connect your LeetCode account first.</div>}
      {message && <div className={`notice ${kind}`}>{message}</div>}
    </div>
  );
}
