"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const languages = [
  { value: "java", label: "Java" },
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
];

export default function SolveControls({ defaultLanguage }: { defaultLanguage: string }) {
  const router = useRouter();
  const [language, setLanguage] = useState(defaultLanguage);
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"ok" | "error">("ok");

  useEffect(() => {
    setAccessKey(window.localStorage.getItem("leetsolve_access_key") || "");
  }, []);

  async function runSolve() {
    setLoading(true);
    setMessage("Generating and checking today’s solution…");
    setKind("ok");
    if (accessKey) window.localStorage.setItem("leetsolve_access_key", accessKey);

    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessKey ? { "x-leetsolve-key": accessKey } : {}),
        },
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

  return (
    <div className="controls-card">
      <div>
        <div className="eyebrow">Manual test</div>
        <h3>Run today’s solver now</h3>
        <p className="muted small">The daily cron runs automatically. Use this only when you want to test the app.</p>
      </div>
      <div className="controls-row">
        <label className="field">
          <span>Language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="field grow">
          <span>App access key <em>(only if configured)</em></span>
          <input
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            placeholder="APP_ACCESS_KEY"
            type="password"
          />
        </label>
        <button className="primary-button" onClick={runSolve} disabled={loading}>
          {loading ? "Solving…" : "Solve now"}
        </button>
      </div>
      {message && <div className={`notice ${kind}`}>{message}</div>}
    </div>
  );
}
