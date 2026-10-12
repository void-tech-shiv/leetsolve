export const dynamic = "force-dynamic";

function Status({ ok }: { ok: boolean }) {
  return <span className={ok ? "healthy" : "difficulty hard"}>{ok ? "Configured ✓" : "Missing"}</span>;
}

export default function SetupPage() {
  const groq = Boolean(process.env.GROQ_API_KEY);
  const session = Boolean(process.env.LEETCODE_SESSION);
  const csrf = Boolean(process.env.LEETCODE_CSRF);
  const database = Boolean(process.env.DATABASE_URL);
  const ready = groq && session && csrf && database;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark">L</span><span>LeetSolve</span></a>
        <a className="primary-link" href="/">← Dashboard</a>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">ACCOUNT SETUP</span>
          <h1>Connect your solver<br /><span>without exposing credentials.</span></h1>
          <p>Keep API keys and authentication cookies on the server as deployment secrets. LeetSolve only shows whether each required value is configured.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
          <div className="orbit-core">{ready ? "✓" : "⚙"}</div>
        </div>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 1</span><h2>Groq AI</h2></div><Status ok={groq} /></div>
            <p>Create a Groq API key, then add it to your deployment as <code>GROQ_API_KEY</code>.</p>
            <a className="primary-link" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get Groq API key ↗</a>
          </article>

          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 2</span><h2>LeetCode account session</h2></div><Status ok={session && csrf} /></div>
            <p>Log in to LeetCode in your own browser. Open DevTools → Application → Cookies → <code>https://leetcode.com</code>, then locate the session cookie and CSRF cookie.</p>
            <div className="explanation-grid">
              <div><span className="eyebrow">SERVER VARIABLE</span><p><code>LEETCODE_SESSION</code></p></div>
              <div><span className="eyebrow">SERVER VARIABLE</span><p><code>LEETCODE_CSRF</code></p></div>
            </div>
            <p className="muted small">Never paste these values into chat, source code, GitHub commits, or screenshots. Treat them like a password.</p>
          </article>

          <article className="panel today-panel">
            <div className="section-heading"><div><span className="eyebrow">STEP 3</span><h2>Database</h2></div><Status ok={database} /></div>
            <p>Add your Neon connection string as <code>DATABASE_URL</code>. It stores schedule settings and solution history, not your LeetCode cookies.</p>
          </article>
        </div>

        <aside className="side-column">
          <article className="panel automation-panel">
            <div className="section-heading compact"><div><span className="eyebrow">STATUS</span><h2>{ready ? "Setup ready" : "Setup incomplete"}</h2></div><Status ok={ready} /></div>
            <div className="pipeline">
              <div className="pipe-item"><span>{groq ? "✓" : "1"}</span><div><strong>Groq AI key</strong><small>{groq ? "Server secret configured" : "GROQ_API_KEY missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{session ? "✓" : "2"}</span><div><strong>LeetCode session</strong><small>{session ? "Server secret configured" : "LEETCODE_SESSION missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{csrf ? "✓" : "3"}</span><div><strong>CSRF token</strong><small>{csrf ? "Server secret configured" : "LEETCODE_CSRF missing"}</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>{database ? "✓" : "4"}</span><div><strong>Neon database</strong><small>{database ? "Connected" : "DATABASE_URL missing"}</small></div></div>
            </div>
          </article>

          <article className="panel history-panel">
            <div className="section-heading compact"><div><span className="eyebrow">DEPLOYMENT</span><h2>Vercel secrets</h2></div></div>
            <p className="muted">In Vercel open Project → Settings → Environment Variables and add the required values. Redeploy once after adding or changing them.</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
