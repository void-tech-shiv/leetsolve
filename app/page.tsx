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
    <main className="lc-app-shell">
      <header className="topbar lc-main-topbar">
        <a className="brand" href="/">
          <span className="brand-mark">L</span>
          <span>LeetSolve</span>
        </a>

        <nav className="lc-nav" aria-label="Workspace navigation">
          <a href="#description">Problems</a>
          <a href="#solution">Solve</a>
          <a href="#submissions">Submissions</a>
          <a href="#automation">Automation</a>
        </nav>

        <div className="account-strip">
          <div className="top-status">
            <span className="live-dot" />
            {automationActive
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

      <section className="lc-workspace">
        <section className="lc-pane lc-problem-pane" id="description">
          <div className="lc-pane-tabs">
            <span className="active">Description</span>
            <a href="#solution-notes">Solution</a>
            <a href="#submissions">Submissions</a>
          </div>

          <div className="lc-pane-scroll">
            <div className="lc-problem-heading">
              <div>
                <div className="lc-breadcrumb">Daily Challenge</div>
                <h1>{today?.title || "Today’s LeetCode challenge"}</h1>
              </div>
              {today?.difficulty && <span className={difficultyClass(today.difficulty)}>{today.difficulty}</span>}
            </div>

            <div className="lc-problem-actions">
              {today?.problem_url && (
                <a className="lc-secondary-action" href={today.problem_url} target="_blank" rel="noreferrer">
                  Open on LeetCode ↗
                </a>
              )}
              <span className={`lc-verdict-pill ${today?.status === "accepted" ? "accepted" : "pending"}`}>
                {today?.status === "accepted" ? "✓ Accepted" : today ? "Submitted" : "Not submitted"}
              </span>
            </div>

            <div className="lc-problem-summary">
              <div>
                <span>Language</span>
                <strong>{today?.language || language}</strong>
              </div>
              <div>
                <span>Verdict</span>
                <strong>{today?.submission_status || "—"}</strong>
              </div>
              <div>
                <span>Last run</span>
                <strong>{today ? formatDate(today.challenge_date) : "—"}</strong>
              </div>
            </div>

            <section className="lc-description-section" id="solution-notes">
              <h3>Solution overview</h3>
              {today?.explanation ? (
                <p>{today.explanation}</p>
              ) : (
                <p>
                  No saved solution for today yet. Connect your LeetCode account, add your Groq API key and use the submit panel on the right.
                </p>
              )}

              <div className="lc-complexity-row">
                <div><span>Time</span><strong>{today?.time_complexity || "—"}</strong></div>
                <div><span>Space</span><strong>{today?.space_complexity || "—"}</strong></div>
                {today?.runtime && <div><span>Runtime</span><strong>{today.runtime}</strong></div>}
                {today?.memory && <div><span>Memory</span><strong>{today.memory}</strong></div>}
              </div>
            </section>

            <section className="lc-account-section">
              <div className="lc-section-header">
                <h3>Account progress</h3>
                <span>{schedule.leetcodeUsername ? `@${schedule.leetcodeUsername}` : "LeetCode not connected"}</span>
              </div>
              <div className="lc-account-stats">
                <LeetCodeStatsCards connected={Boolean(schedule.leetcodeConnected && schedule.leetcodeUsername)} />
                <article className="stat-card">
                  <div className="stat-icon">⚙</div>
                  <div>
                    <span>Daily automation</span>
                    <strong className="language-stat">{automationActive ? "ON" : "LOCKED"}</strong>
                    <small>{automationActive ? `${schedule.time} · ${schedule.timezone}` : "manual solve stays free"}</small>
                  </div>
                </article>
              </div>
            </section>

            <section className="lc-submissions-section" id="submissions">
              <div className="lc-section-header">
                <h3>Recent submissions</h3>
                <span>{recent.length} saved</span>
              </div>
              <div className="history-list lc-history-list">
                {recent.length === 0 ? <p className="muted">No previous submissions yet.</p> : recent.map((item) => (
                  <a
                    className="history-row"
                    href={item.problem_url || `https://leetcode.com/problems/${item.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                    key={String(item.id)}
                  >
                    <div className="history-check">{item.status === "accepted" ? "✓" : "•"}</div>
                    <div className="history-copy">
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.challenge_date)} · {item.language} · {item.submission_status || item.status}</span>
                    </div>
                    <span className={difficultyClass(item.difficulty)}>{item.difficulty}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="lc-pane lc-editor-pane" id="solution">
          <div className="lc-editor-topbar">
            <div className="lc-pane-tabs lc-editor-tabs">
              <span className="active">Code</span>
            </div>
            <div className="lc-editor-meta">
              <span>{today?.language || language}</span>
              <span>{today?.status === "accepted" ? "Accepted" : "AI solution"}</span>
            </div>
          </div>

          <div className="lc-editor-body">
            {today?.code ? (
              <CodeViewer code={today.code} />
            ) : (
              <div className="lc-empty-editor">
                <div>&lt;/&gt;</div>
                <strong>No solution generated yet</strong>
                <span>Use the submit panel below to solve today’s challenge.</span>
              </div>
            )}
          </div>

          <div className="lc-console" id="manual-solve">
            <div className="lc-console-tabs">
              <span className="active">Testcase</span>
              <span>Result</span>
            </div>
            <ManualSolveCard
              defaultLanguage={language}
              connected={Boolean(schedule.leetcodeConnected)}
              groqConnected={groqStatus.connected}
            />
          </div>
        </section>
      </section>

      <section className="lc-settings-area" id="automation">
        <div className="lc-settings-main">
          <GroqKeyCard
            initialConnected={groqStatus.connected}
            initialVerifiedAt={groqStatus.verifiedAt}
          />
          <div className="lc-settings-controls">
            <SolveControls defaultLanguage={language} automationActive={automationActive} />
          </div>
        </div>

        <aside className="lc-settings-side">
          <article className="panel automation-panel">
            <div className="section-heading compact">
              <div><span className="eyebrow">AUTOMATION</span><h2>Daily pipeline</h2></div>
              <span className={automationActive ? "healthy" : "muted"}>{automationActive ? "Live" : "Locked"}</span>
            </div>
            {!automationActive && (
              <div className="notice error" style={{ marginBottom: 16 }}>
                Scheduled runs need a valid key. Manual solving remains free. <a href="/activate">Activate →</a>
              </div>
            )}
            {automationActive && !groqStatus.connected && (
              <div className="notice error" style={{ marginBottom: 16 }}>
                Add your Groq API key before enabling scheduled AI solving.
              </div>
            )}
            <div className="pipeline" style={!automationActive ? { opacity: 0.55 } : undefined}>
              <div className="pipe-item"><span>1</span><div><strong>Wait for schedule</strong><small>Cloud scheduler checks each Pro user</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>2</span><div><strong>Fetch challenge</strong><small>Daily problem + required signature</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>3</span><div><strong>Generate & verify</strong><small>Your Groq API key + retry loop</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>4</span><div><strong>Submit</strong><small>Connected LeetCode account</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>5</span><div><strong>Repair if rejected</strong><small>Verdict feedback → AI → retry</small></div></div>
            </div>
          </article>
        </aside>
      </section>

      <footer className="lc-footer">
        <span>LeetSolve</span>
        <span>Manual solving is free. Automation requires an activation key.</span>
      </footer>
    </main>
  );
}
