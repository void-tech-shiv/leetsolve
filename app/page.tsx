import { redirect } from "next/navigation";
import CodeViewer from "@/components/CodeViewer";
import LeetCodeStatsCards from "@/components/LeetCodeStatsCards";
import SolveControls from "@/components/SolveControls";
import { auth } from "@/lib/auth/server";
import { getRecentSolutions, getTodaySolution, getUserSettings } from "@/lib/db";
import { getSubscriptionStatus } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function difficultyClass(value = "") {
  return `difficulty ${value.toLowerCase()}`;
}

export default async function Home() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const userId = session.user.id;
  const [subscription, schedule] = await Promise.all([
    getSubscriptionStatus(userId).catch(() => null),
    getUserSettings(userId).catch(() => ({
      userId,
      leetcodeUsername: null,
      leetcodeConnected: false,
      leetcodeVerifiedAt: null,
      enabled: true,
      time: "20:30",
      timezone: "Asia/Kolkata",
      language: process.env.DEFAULT_LANGUAGE || "java",
      lastRunLocalDate: null,
      schedulerRunId: null,
    })),
  ]);

  const automationActive = Boolean(subscription?.active);
  const language = schedule.language || process.env.DEFAULT_LANGUAGE || "java";
  const [today, recent] = await Promise.all([
    getTodaySolution(userId, language).catch(() => null),
    getRecentSolutions(userId, 14).catch(() => []),
  ]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">L</span>
          <span>LeetSolve</span>
        </a>
        <div className="account-strip">
          <div className="top-status">
            <span className="live-dot" /> {automationActive
              ? `Pro active · ${subscription?.daysRemaining || 0} day${subscription?.daysRemaining === 1 ? "" : "s"} left`
              : "Free dashboard · Manual solve enabled · Automation locked"}
          </div>
          {!automationActive && <a className="account-link" href="/activate">Activate automation</a>}
          <div className="user-meta">
            <span>{schedule.leetcodeUsername ? `@${schedule.leetcodeUsername}` : session.user.name || session.user.email || "Account"}</span>
            <a className="account-link" href="/auth/sign-out">Sign out</a>
          </div>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">{automationActive ? "AI DAILY AUTO-SUBMIT" : "FREE MANUAL SOLVE · PRO AUTOMATION"}</span>
          <h1>Your daily coding dashboard,<br /><span>{automationActive ? "solved and submitted automatically." : "solve anytime, automate when you upgrade."}</span></h1>
          <p>{automationActive
            ? "LeetSolve can solve on demand or run automatically at your saved time every day."
            : "Sign in, connect LeetCode, view your real stats and use Solve & submit now for free. An activation key is required only for unattended daily automation."}</p>
          <div className="hero-actions">
            {today?.problem_url && <a className="primary-link" href={today.problem_url} target="_blank" rel="noreferrer">Open today’s problem ↗</a>}
            {automationActive ? (
              <span className="subtle-label">{schedule.enabled ? `Daily run: ${schedule.time} · ${schedule.timezone}` : "Automatic schedule is paused"}</span>
            ) : (
              <a className="primary-link" href="#manual-solve">Solve manually for free ↓</a>
            )}
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">🔥</div>
          <span className="orbit-chip chip-ai">AI</span>
          <span className="orbit-chip chip-test">TEST</span>
          <span className="orbit-chip chip-save">SUBMIT</span>
        </div>
      </section>

      <section className="stats-grid">
        <LeetCodeStatsCards connected={Boolean(schedule.leetcodeConnected && schedule.leetcodeUsername)} />
        <article className="stat-card">
          <div className="stat-icon">⚙</div>
          <div>
            <span>{automationActive ? "Scheduled language" : "Daily automation"}</span>
            <strong className="language-stat">{automationActive ? language : "Locked"}</strong>
            <small>{automationActive ? `${schedule.time} · ${schedule.timezone}` : "manual solve is still free"}</small>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <article className="panel today-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TODAY</span>
                <h2>{today?.title || "Daily challenge"}</h2>
              </div>
              {today?.difficulty && <span className={difficultyClass(today.difficulty)}>{today.difficulty}</span>}
            </div>

            <div className="run-summary">
              <div className={`run-state ${today?.status === "accepted" ? "complete" : "pending"}`}>
                <span>{today?.status === "accepted" ? "✓" : "○"}</span>
                <div>
                  <strong>{today?.status === "accepted" ? "Accepted on LeetCode" : today ? "Submission finished" : "Ready when you are"}</strong>
                  <small>{today ? `Saved ${formatDate(today.challenge_date)}` : automationActive ? "Use manual solve now or wait for your schedule" : "Use Solve & submit now below — no activation key needed"}</small>
                </div>
              </div>
              <div className="meta-block"><span>Language</span><strong>{today?.language || language}</strong></div>
              <div className="meta-block"><span>LeetCode verdict</span><strong>{today?.submission_status || "Not submitted yet"}</strong></div>
            </div>

            {today?.code ? (
              <>
                <CodeViewer code={today.code} />
                <div className="explanation-grid">
                  <div><span className="eyebrow">EXPLANATION</span><p>{today.explanation}</p></div>
                  <div className="complexity-box">
                    <div><span>Time</span><strong>{today.time_complexity || "—"}</strong></div>
                    <div><span>Space</span><strong>{today.space_complexity || "—"}</strong></div>
                    {today.runtime && <div><span>Runtime</span><strong>{today.runtime}</strong></div>}
                    {today.memory && <div><span>Memory</span><strong>{today.memory}</strong></div>}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">⌁</div>
                <h3>No LeetCode submission saved for today yet</h3>
                <p>Connect your account and use “Solve & submit now”. Daily unattended scheduling is the only feature that needs an activation key.</p>
              </div>
            )}
          </article>

          <div id="manual-solve">
            <SolveControls defaultLanguage={language} automationActive={automationActive} />
          </div>
        </div>

        <aside className="side-column">
          <article className="panel automation-panel">
            <div className="section-heading compact">
              <div><span className="eyebrow">PIPELINE</span><h2>Daily automation</h2></div>
              <span className={automationActive ? "healthy" : "muted"}>{automationActive ? "Live" : "Locked"}</span>
            </div>
            {!automationActive && (
              <div className="notice error" style={{ marginBottom: 16 }}>
                Automatic scheduled runs need a valid key. Manual solving remains available. <a href="/activate">Activate automation →</a>
              </div>
            )}
            <div className="pipeline" style={!automationActive ? { opacity: 0.55 } : undefined}>
              <div className="pipe-item"><span>1</span><div><strong>Wait for your schedule</strong><small>Cloud workflow checks each active Pro user independently</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>2</span><div><strong>Fetch daily challenge</strong><small>Problem statement + required code signature</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>3</span><div><strong>Generate & verify</strong><small>AI + local retry loop</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>4</span><div><strong>Submit to LeetCode</strong><small>Connected account session</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>5</span><div><strong>Repair if rejected</strong><small>Verdict feedback → AI → re-submit</small></div></div>
            </div>
          </article>

          <article className="panel history-panel">
            <div className="section-heading compact"><div><span className="eyebrow">RECENT</span><h2>Your history</h2></div></div>
            <div className="history-list">
              {recent.length === 0 ? <p className="muted">No previous submissions yet.</p> : recent.map((item) => (
                <a className="history-row" href={item.problem_url || `https://leetcode.com/problems/${item.slug}/`} target="_blank" rel="noreferrer" key={String(item.id)}>
                  <div className="history-check">{item.status === "accepted" ? "✓" : "•"}</div>
                  <div className="history-copy"><strong>{item.title}</strong><span>{formatDate(item.challenge_date)} · {item.language} · {item.submission_status || item.status}</span></div>
                  <span className={difficultyClass(item.difficulty)}>{item.difficulty}</span>
                </a>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <footer>
        <span>LeetSolve</span>
        <span>Dashboard + manual solve are free. Only unattended daily automation requires an active key.</span>
      </footer>
    </main>
  );
}
