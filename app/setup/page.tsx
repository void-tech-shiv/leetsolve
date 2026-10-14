export const dynamic = "force-dynamic";

function Status({ ok }: { ok: boolean }) {
  return <span className={ok ? "healthy" : "difficulty hard"}>{ok ? "Configured ✓" : "Missing"}</span>;
}

export default function SetupPage() {
  const authReady = Boolean(process.env.NEON_AUTH_BASE_URL && process.env.DATABASE_URL);
  const databaseReady = Boolean(process.env.DATABASE_URL);
  const encryptionReady = Boolean(process.env.APP_ENCRYPTION_KEY);
  const ready = authReady && databaseReady && encryptionReady;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark">L</span><span>LeetSolve</span></a>
        <a className="primary-link" href="/">← Dashboard</a>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">MULTI-USER SETUP</span>
          <h1>Deploy once,<br /><span>let every user bring their own AI key.</span></h1>
          <p>Neon Managed Auth handles registration and sessions, Neon Postgres stores user data, and every user connects their own Groq API key for AI generation.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
          <div className="orbit-core">{ready ? "✓" : "⚙"}</div>
        </div>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 1</span><h2>Registration & login</h2></div><Status ok={authReady} /></div>
            <p>Neon Managed Better Auth is connected through <code>NEON_AUTH_BASE_URL</code>. Users can create accounts and sign in normally.</p>
          </article>

          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 2</span><h2>User-owned Groq AI</h2></div><Status ok={encryptionReady} /></div>
            <p>There is no shared <code>GROQ_API_KEY</code>. Each user verifies and saves their own Groq API key. It is encrypted with <code>APP_ENCRYPTION_KEY</code> and never returned to the browser after saving.</p>
          </article>

          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 3</span><h2>Neon database</h2></div><Status ok={databaseReady} /></div>
            <p><code>DATABASE_URL</code> stores user-scoped settings, encrypted AI credentials and solution history. Authentication data lives in Neon’s managed <code>neon_auth</code> schema.</p>
          </article>
        </div>

        <aside className="side-column">
          <article className="panel automation-panel">
            <div className="section-heading compact"><div><span className="eyebrow">STATUS</span><h2>{ready ? "Platform ready" : "Setup incomplete"}</h2></div><Status ok={ready} /></div>
            <div className="pipeline">
              <div className="pipe-item"><span>{authReady ? "✓" : "1"}</span><div><strong>Registration & login</strong><small>{authReady ? "Neon Auth connected" : "Auth configuration missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{encryptionReady ? "✓" : "2"}</span><div><strong>AI key encryption</strong><small>{encryptionReady ? "Per-user Groq keys enabled" : "APP_ENCRYPTION_KEY missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{databaseReady ? "✓" : "3"}</span><div><strong>Database</strong><small>{databaseReady ? "Neon configured" : "DATABASE_URL missing"}</small></div></div>
            </div>
          </article>

          <article className="panel history-panel">
            <div className="section-heading compact"><div><span className="eyebrow">USER FLOW</span><h2>After registration</h2></div></div>
            <p className="muted">Each user signs in, connects LeetCode, adds their own Groq API key, then uses free manual solving or activates a key for unattended automation.</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
