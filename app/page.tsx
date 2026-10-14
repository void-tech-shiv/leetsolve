import { redirect } from "next/navigation";
import CodeViewer from "@/components/CodeViewer";
import GroqKeyCard from "@/components/GroqKeyCard";
import LeetCodeStatsCards from "@/components/LeetCodeStatsCards";
import ManualSolveCard from "@/components/ManualSolveCard";
import SolveControls from "@/components/SolveControls";
import { auth } from "@/lib/auth/server";
import { getRecentSolutions, getTodaySolution, getUserSettings } from "@/lib/db";
import { getSubscriptionStatus } from "@/lib/subscription";
import { getGroqKeyStatus } from "@/lib/user-groq";

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
  const [subscription, schedule, groqStatus] = await Promise.all([
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
    getGroqKeyStatus(userId).catch(() => ({ connected: false, verifiedAt: null })),
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

        <nav className="lc-nav" aria-label="Primary navigation">
          <a href="#today">Problems</a>
          <a href="#manual-solve">Solve</a>
          <a href="#history">Submissions</a>
          <a href={automationActive ? "#automation" : "/activate"}>Automation</a>
        </nav>

        <div className="account-strip">
          <div className="top-status">
            <span className="live-dot" /> {automationActive
              ? `Pro · ${subscription?.daysRemaining || 0} day${subscription?.daysRemaining === 1 ? "" : "s"} left`
              : "Free · Manual solve enabled"}
          </div>
          {!automationActive && <a className="account-link" href="/activate">Upgrade</a>}
          <div className="user-meta">
            <span>{schedule.leetcodeUsername ? `@${schedule.leetcodeUsername}` : session.user.name || session.user.email || "Account"}</span>
            <a className="account-link" href="/auth/sign-out">Sign out</a>
          </div>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">DAILY CHALLENGE</span>
          <h1>Practice. Submit.<br /><span>Keep your streak alive.</span></h1>
          <p>Connect your LeetCode account and Groq API key, then solve today’s challenge from one dashboard. Manual solving is free; unattended daily automation unlocks with an activation key.</p>
          <div className="hero-actions">
            {today?.problem_url && <a className="primary-link" href={today.problem_url} target="_blank" rel="noreferrer">Open today’s problem ↗</a>}
            <a className="account-link" href="#manual-solve">Solve & submit</a>
            {automationActive && <span className="subtle-label">Next schedule: {schedule.time} · {schedule.timezone}</span>}
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">🔥</div>
          <span className="orbit-chip chip-ai">AI</span>
          <span className="orbit-chip chip-test">RUN</span>
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
          <article className="panel today-panel" id="today">
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
              <div className="meta-block"><span>Verdict</span><strong>{today?.submission_status || "Not submitted yet"}</strong></div>
            </div>

            {today?.code ? (
              <>
                <CodeViewer code={today.code} />
                <div className="explanation-grid">
                  <div><span className="eyebrow">SOLUTION NOTES</span><p>{today.explanation}</p></div>
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
                <h3>No submission for today yet</h3>
                <p>Connect LeetCode, add your Groq API key and use “Solve & submit now”. Scheduled automation is the only feature that needs an activation key.</p>
              </div>
            )}
          </article>

          <div id="manual-solve" className={!automationActive ? "free-solve-controls" : undefined}>
            <GroqKeyCard
              initialConnected={groqStatus.connected}
              initialVerifiedAt={groqStatus.verifiedAt}
            />
            <SolveControls defaultLanguage={language} automationActive={automationActive} />
            {!automationActive && (
              <ManualSolveCard
                defaultLanguage={language}
                connected={Boolean(schedule.leetcodeConnected)}
                groqConnected={groqStatus.connected}
              />
            )}
          </div>
        </div>

        <aside className="side-column">
          <article className="panel automation-panel" id="automation">
            <div className="section-heading compact">
              <div><span className="eyebrow">AUTOMATION</span><h2>Daily auto-submit</h2></div>
              <span className={automationActive ? "healthy" : "muted"}>{automationActive ? "Active" : "Locked"}</span>
            </div>
            {!automationActive && (
              <div className="notice error" style={{ marginBottom: 16 }}>
                Scheduled runs need an activation key. Manual solve remains free. <a href="/activate">Upgrade →</a>
              </div>
            )}
            {automationActive && !groqStatus.connected && (
              <div className="notice error" style={{ marginBottom: 16 }}>
                Add your Groq API key before enabling scheduled AI solving.
              </div>
            )}
            <div className="pipeline" style={!automationActive ? { opacity: 0.55 } : undefined}>
              <div className="pipe-item"><span>1</span><div><strong>Wait for schedule</strong><small>Checks your saved time and timezone</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>2</span><div><strong>Fetch challenge</strong><small>Problem statement + code signature</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>3</span><div><strong>Generate & verify</strong><small>Your Groq API key + retry loop</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>4</span><div><strong>Submit</strong><small>Uses your connected LeetCode account</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>5</span><div><strong>Repair if rejected</strong><small>Verdict feedback → AI → re-submit</small></div></div>
            </div>
          </article>

          <article className="panel history-panel" id="history">
            <div className="section-heading compact"><div><span className="eyebrow">SUBMISSIONS</span><h2>Recent activity</h2></div></div>
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
        <span>Every AI solve uses the signed-in user’s own encrypted Groq API key.</span>
      </footer>
    </main>
  );
}
