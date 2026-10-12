"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    void authClient.signOut().finally(() => {
      router.replace("/auth/sign-in");
      router.refresh();
    });
  }, [router]);

  return (
    <main className="auth-shell">
      <div className="auth-panel auth-loading">
        <span className="eyebrow">LEETSOLVE</span>
        <h2>Signing you out…</h2>
      </div>
    </main>
  );
}
