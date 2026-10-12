import AuthForm from "@/components/AuthForm";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <a className="brand auth-brand" href="/">
        <span className="brand-mark">L</span>
        <span>LeetSolve</span>
      </a>
      <div className="auth-panel"><AuthForm mode="sign-in" /></div>
    </main>
  );
}
