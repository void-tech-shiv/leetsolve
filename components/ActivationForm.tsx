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
        <h1>Activate your access</h1>
        <p>Subscribe through Nexora for ₹59/month with AutoPay, or request a 7-day free trial. Then enter the activation key you receive.</p>
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
          placeholder="LEET-XXXX-XXXX-XXXX-XXXX"
        />
      </label>

      {error && <div className="notice error">{error}</div>}

      <button className="primary-button auth-submit" type="submit" disabled={loading || activationCode.trim().length < 10}>
        {loading ? "Activating…" : "Activate LeetSolve"}
      </button>

      {storeUrl ? (
        <p className="auth-switch">Need a key? <a href={storeUrl} target="_blank" rel="noreferrer">Subscribe for ₹59/month or request a 7-day trial ↗</a></p>
      ) : (
        <p className="auth-switch">Get your subscription or free-trial key from Nexora.</p>
      )}
    </form>
  );
}
