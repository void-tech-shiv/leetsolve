import { redirect } from "next/navigation";
import CodeViewer from "@/components/CodeViewer";
import SolveControls from "@/components/SolveControls";
import { auth } from "@/lib/auth/server";
import { getLeetCodeCredentials, getRecentSolutions, getTodaySolution, getUserSettings } from "@/lib/db";
import { getDailyProblem, getLeetCodeAccountStats } from "@/lib/leetcode";
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
  const subscription = await getSubscriptionStatus(userId).catch(() => null);
  const automationActive = Boolean(subscription?.active);

  const schedule = await getUserSettings(userId).catch(() => ({
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
  }));
  const language = schedule.language || process.env.DEFAULT_LANGUAGE || "java";
  const credentials = schedule.leetcodeConnected
    ? await getLeetCodeCredentials(userId).catch(() => null)
    : null;

  const [problem, today, recent, leetcodeStats] = await Promise.all([
    getDailyProblem().catch(() => null),
    getTodaySolution(userId, language).catch(() => null),
    getRecentSolutions(userId, 14).catch(() => []),
    credentials && schedule.leetcodeUsername
      ? getLeetCodeAccountStats(credentials, schedule.leetcodeUsername).catch(() => null)
      : Promise.resolve(null),
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
              : "Free dashboard · Automation locked"}
          </div>
          {!automationActive && <a className="account-link" href="/activate">Activate key</a>}
          <div className="user-meta">
            <span>{schedule.leetcodeUsername ? `@${schedule.leetcodeUsername}` : session.user.name || session.user.email || "Account"}</span>
            <a className="account-link" href="/auth/sign-out">Sign out</a>
          </div>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">{automationActive ? "AI DAILY AUTO-SUBMIT" : "FREE DASHBOARD · PRO AUTOMATION"}</span>
          <h1>Your daily coding dashboard,<br /><span>{automationActive ? "solved and submitted automatically." : "automation unlocks with an access key."}</span></h1>
          <p>{automationActive
            ? "LeetSolve fetches the daily challenge, generates code, checks it, submits it to your LeetCode account and repairs failed attempts when needed."
            : "Sign in, connect your LeetCode account and view your real stats for free. Activate a 7-day trial or 30-day key when you want AI solving, submission and daily scheduling."}</p>
          <div className="hero-actions">
            {problem && <a className="primary-link" href={problem.link} target="_blank" rel="noreferrer">Open today’s problem ↗</a>}
            {automationActive ? (
              <span className="subtle-label">{schedule.enabled ? `Daily run: ${schedule.time} · ${schedule.timezone}` : "Automatic schedule is paused"}</span>
            ) : (
              <a className="primary-link" href="/activate">Unlock automation →</a>
            )}
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">🔥</div>
          <span className="orbit-chip chip-ai">AI</span>
          <span className="orbit-chip chip-test">TEST</span>
          <span className="orbit-chip chip-save">{automationActive ? "SUBMIT" : "LOCKED"}</span>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card accent">
          <div className="stat-icon">🔥</div>
          <div>
            <span>LeetCode streak</span>
            <strong>{leetcodeStats?.currentStreak ?? "—"}</strong>
            <small>{leetcodeStats ? "official daily streak" : schedule.leetcodeConnected ? "unable to load account streak" : "connect LeetCode"}</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">🏆</div>
          <div>
            <span>Max streak</span>
            <strong>{leetcodeStats?.longestStreak ?? "—"}</strong>
            <small>{leetcodeStats ? "LeetCode profile calendar" : "real account stat"}</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">✓</div>
          <div>
            <span>Problems solved</span>
            <strong>{leetcodeStats?.totalSolved ?? "—"}</strong>
            <small>{leetcodeStats ? `${leetcodeStats.totalActiveDays} active days` : "LeetCode account"}</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">⚙</div>
          <div>
            <span>{automationActive ? "Scheduled language" : "Automation"}</span>
            <strong className="language-stat">{automationActive ? language : "Locked"}</strong>
            <small>{automationActive ? `${schedule.time} · ${schedule.timezone}` : "activate a key to unlock"}</small>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <article className="panel today-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TODAY</span>
                <h2>{problem?.title || today?.title || "Daily challenge"}</h2>
              </div>
              {(problem?.difficulty || today?.difficulty) && <span className={difficultyClass(problem?.difficulty || today?.difficulty)}>{problem?.difficulty || today?.difficulty}</span>}
            </div>

            <div className="run-summary">
              <div className={`run-state ${today?.status === "accepted" ? "complete" : "pending"}`}>
                <span>{today?.status === "accepted" ? "✓" : automationActive ? "○" : "🔒"}</span>
                <div>
                  <strong>{today?.status === "accepted" ? "Accepted on LeetCode" : today ? "Submission finished" : automationActive ? "Waiting for today’s run" : "Automation is locked"}</strong>
                  <small>{today ? `Saved ${formatDate(today.challenge_date)}` : automationActive ? "Your saved schedule will trigger it automatically" : "Activate an access key to enable solving and submission"}</small>
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
                <div className="empty-icon">{automationActive ? "⌁" : "🔒"}</div>
                <h3>{automationActive ? "No LeetCode submission saved for today yet" : "Automation is a Pro feature"}</h3>
                <p>{automationActive ? "Connect your account and wait for your scheduled time, or use “Solve & submit now”." : "Your dashboard and real LeetCode stats remain available. Activate a key to unlock AI solve, submit, repair and scheduling."}</p>
              </div>
            )}
          </article>

          <SolveControls defaultLanguage={language} automationActive={automationActive} />
        </div>

        <aside className="side-column">
          <article className="panel automation-panel">
            <div className="section-heading compact">
              <div><span className="eyebrow">PIPELINE</span><h2>Automation</h2></div>
              <span className={automationActive ? "healthy" : "muted"}>{automationActive ? "Live" : "Locked"}</span>
            </div>
            {!automationActive && (
              <div className="notice error" style={{ marginBottom: 16 }}>
                Activate a valid key to run this pipeline. <a href="/activate">Activate now →</a>
              </div>
            )}
            <div className="pipeline" style={!automationActive ? { opacity: 0.55 } : undefined}>
              <div className="pipe-item"><span>1</span><div><strong>Wait for your schedule</strong><small>Cloud workflow checks each active Pro user independently</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>2</span><div><strong>Fetch daily challenge</strong><small>Problem statement + required code signature</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>3</span><div><strong>Generate & verify</strong><small>Groq AI + local retry loop</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>4</span><div><strong>Submit to LeetCode</strong><small>Encrypted session + CSRF credentials</small></div></div>
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
        <span>Dashboard access is free. AI solving, submission and scheduling require an active key.</span>
      </footer>
    </main>
  );
}
