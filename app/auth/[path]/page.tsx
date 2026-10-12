import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="auth-shell">
      <a className="brand auth-brand" href="/">
        <span className="brand-mark">L</span>
        <span>LeetSolve</span>
      </a>
      <div className="auth-panel">
        <AuthView path={path} />
      </div>
    </main>
  );
}
