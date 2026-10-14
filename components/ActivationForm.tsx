"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivationForm({ storeUrl }: { storeUrl?: string | null }) {
  const router = useRouter();
  const [activationCode, setActivationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/subscription/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activationCode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Activation failed.");

      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-heading">
        <span className="eyebrow">LEETSOLVE PRO</span>
        <h1>Activate your subscription</h1>
        <p>Enter the activation code you received after purchasing LeetSolve. A new key unlocks 30 days by default.</p>
      </div>

      <label className="field">
        <span>Activation code</span>
        <input
          value={activationCode}
          onChange={(event) => setActivationCode(event.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck={false}
          required
          minLength={10}
          placeholder="LEET-XXXX-XXXX-XXXX"
        />
      </label>

      {error && <div className="notice error">{error}</div>}

      <button className="primary-button auth-submit" type="submit" disabled={loading || activationCode.trim().length < 10}>
        {loading ? "Activating…" : "Activate LeetSolve"}
      </button>

      {storeUrl ? (
        <p className="auth-switch">Don’t have a key? <a href={storeUrl} target="_blank" rel="noreferrer">Buy 30-day access ↗</a></p>
      ) : (
        <p className="auth-switch">Purchase a LeetSolve subscription from Shiv Tools Store to receive an activation key.</p>
      )}
    </form>
  );
}
