import { redirect } from "next/navigation";
import ActivationForm from "@/components/ActivationForm";
import { auth } from "@/lib/auth/server";
import { getSubscriptionStatus } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function ActivatePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const subscription = await getSubscriptionStatus(session.user.id).catch(() => null);
  if (subscription?.active) redirect("/");

  return (
    <main className="auth-shell">
      <a className="brand auth-brand" href="/">
        <span className="brand-mark">L</span>
        <span>LeetSolve</span>
      </a>
      <div className="auth-panel">
        {subscription?.status === "EXPIRED" && (
          <div className="notice error" style={{ marginBottom: 16 }}>
            Your previous LeetSolve subscription has expired. Activate a new key to continue.
          </div>
        )}
        <ActivationForm storeUrl={process.env.NEXT_PUBLIC_STORE_URL || null} />
        <p className="auth-switch" style={{ marginTop: 18 }}>
          Signed in as {session.user.email || session.user.name || "your account"} · <a href="/auth/sign-out">Sign out</a>
        </p>
      </div>
    </main>
  );
}
