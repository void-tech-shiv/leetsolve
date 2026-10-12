export const dynamic = "force-dynamic";

function Status({ ok }: { ok: boolean }) {
  return <span className={ok ? "healthy" : "difficulty hard"}>{ok ? "Configured ✓" : "Missing"}</span>;
}

export default function SetupPage() {
  const authReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  const groqReady = Boolean(process.env.GROQ_API_KEY);
  const databaseReady = Boolean(process.env.DATABASE_URL);
  const ready = authReady && groqReady && databaseReady;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark">L</span><span>LeetSolve</span></a>
        <a className="primary-link" href="/">← Dashboard</a>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">MULTI-USER SETUP</span>
          <h1>Deploy once,<br /><span>let everyone create an account.</span></h1>
          <p>Clerk handles registration and login, Neon stores user-scoped schedules and history, and Groq powers solution generation.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
          <div className="orbit-core">{ready ? "✓" : "⚙"}</div>
        </div>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 1</span><h2>Clerk authentication</h2></div><Status ok={authReady} /></div>
            <p>Create a Clerk application and add <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to Vercel.</p>
          </article>

          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 2</span><h2>Groq AI</h2></div><Status ok={groqReady} /></div>
            <p>Add your server-side <code>GROQ_API_KEY</code>. Users do not need to provide their own AI key in this MVP.</p>
            <a className="primary-link" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Open Groq console ↗</a>
          </article>

          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 3</span><h2>Neon database</h2></div><Status ok={databaseReady} /></div>
            <p>Add <code>DATABASE_URL</code>. LeetSolve automatically creates user-scoped settings and solution-history tables.</p>
          </article>
        </div>

        <aside className="side-column">
          <article className="panel automation-panel">
            <div className="section-heading compact"><div><span className="eyebrow">STATUS</span><h2>{ready ? "Platform ready" : "Setup incomplete"}</h2></div><Status ok={ready} /></div>
            <div className="pipeline">
              <div className="pipe-item"><span>{authReady ? "✓" : "1"}</span><div><strong>Registration & login</strong><small>{authReady ? "Clerk configured" : "Clerk keys missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{groqReady ? "✓" : "2"}</span><div><strong>AI provider</strong><small>{groqReady ? "Groq configured" : "GROQ_API_KEY missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{databaseReady ? "✓" : "3"}</span><div><strong>Database</strong><small>{databaseReady ? "Neon configured" : "DATABASE_URL missing"}</small></div></div>
            </div>
          </article>

          <article className="panel history-panel">
            <div className="section-heading compact"><div><span className="eyebrow">USER FLOW</span><h2>After deployment</h2></div></div>
            <p className="muted">Users register, sign in, enter their LeetCode username, choose language, timezone and daily time, then save their personal schedule.</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
