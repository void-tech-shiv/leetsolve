"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GroqKeyCard({
  initialConnected,
  initialVerifiedAt,
}: {
  initialConnected: boolean;
  initialVerifiedAt?: string | null;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [verifiedAt, setVerifiedAt] = useState(initialVerifiedAt || null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"ok" | "error">("ok");

  async function save() {
    setLoading(true);
    setKind("ok");
    setMessage("Verifying your Groq API key…");
    try {
      const response = await fetch("/api/settings/groq", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not save Groq API key.");

      setConnected(true);
      setVerifiedAt(payload.verifiedAt || new Date().toISOString());
      setApiKey("");
      setMessage("Groq API key verified and encrypted. Your solves will now use your own Groq account.");
      router.refresh();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Could not save Groq API key.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    setKind("ok");
    try {
      const response = await fetch("/api/settings/groq", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not remove Groq API key.");
      setConnected(false);
      setVerifiedAt(null);
      setMessage("Groq API key removed. Solving and automation are paused until you add another key.");
      router.refresh();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Could not remove Groq API key.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="controls-card">
      <div>
        <div className="eyebrow">YOUR AI PROVIDER · GROQ</div>
        <h3>{connected ? "Your Groq API key is connected" : "Add your Groq API key"}</h3>
        <p className="muted small">
          Every generated or repaired solution uses your own Groq key, not LeetSolve&apos;s API quota. The key is encrypted server-side and is never shown back after saving.
        </p>
      </div>

      {connected ? (
        <div className="controls-row">
          <div className="field grow">
            <span>Status</span>
            <div className="notice ok">
              Connected ✓ {verifiedAt ? `· verified ${new Date(verifiedAt).toLocaleString()}` : ""}
            </div>
          </div>
          <button className="secondary-button" type="button" onClick={remove} disabled={loading}>
            {loading ? "Working…" : "Remove key"}
          </button>
        </div>
      ) : (
        <div className="controls-row">
          <label className="field grow">
            <span>Groq API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="gsk_..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button className="primary-button" type="button" onClick={save} disabled={loading || apiKey.trim().length < 20}>
            {loading ? "Verifying…" : "Verify & save"}
          </button>
        </div>
      )}

      {!connected && (
        <p className="muted small">
          Don&apos;t have one? Create a Groq API key in the Groq Console, then paste it here. Do not send your key in chat.
        </p>
      )}
      {message && <div className={`notice ${kind}`}>{message}</div>}
    </div>
  );
}
