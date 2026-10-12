import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <div className="auth-brand"><span className="brand-mark">L</span><span>LeetSolve</span></div>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/" />
    </main>
  );
}
