"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const registering = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = registering
        ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });

      if (result.error) throw new Error(result.error.message || "Authentication failed.");
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-heading">
        <span className="eyebrow">{registering ? "CREATE ACCOUNT" : "WELCOME BACK"}</span>
        <h1>{registering ? "Join LeetSolve" : "Sign in"}</h1>
        <p>{registering ? "Create your account, then choose your own coding schedule." : "Continue to your personal LeetSolve dashboard."}</p>
      </div>

      {registering && (
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required placeholder="Your name" />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" />
      </label>

      <label className="field">
        <span>Password</span>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} autoComplete={registering ? "new-password" : "current-password"} required placeholder="Minimum 8 characters" />
      </label>

      {error && <div className="notice error">{error}</div>}

      <button className="primary-button auth-submit" type="submit" disabled={loading}>
        {loading ? "Please wait…" : registering ? "Create account" : "Sign in"}
      </button>

      <p className="auth-switch">
        {registering ? "Already have an account?" : "New to LeetSolve?"}{" "}
        <a href={registering ? "/auth/sign-in" : "/auth/sign-up"}>{registering ? "Sign in" : "Create account"}</a>
      </p>
    </form>
  );
}
