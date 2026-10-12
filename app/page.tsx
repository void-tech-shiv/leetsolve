import CodeViewer from "@/components/CodeViewer";
import SolveControls from "@/components/SolveControls";
import { getRecentSolutions, getStreakStats, getTodaySolution } from "@/lib/db";
import { getDailyProblem } from "@/lib/leetcode";

export const dynamic = "force-dynamic";

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function difficultyClass(value = "") {
  return `difficulty ${value.toLowerCase()}`;
}

export default async function Home() {
  const language = process.env.DEFAULT_LANGUAGE || "java";
  const [problem, today, recent, stats] = await Promise.all([
    getDailyProblem().catch(() => null),
    getTodaySolution(language).catch(() => null),
    getRecentSolutions(14).catch(() => []),
    getStreakStats().catch(() => ({ currentStreak: 0, longestStreak: 0, totalSolved: 0 })),
  ]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">L</span>
          <span>LeetSolve</span>
        </a>
        <div className="top-status"><span className="live-dot" /> Daily automation enabled</div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="pill">AI DAILY SOLVER</span>
          <h1>Your daily coding problem,<br /><span>handled automatically.</span></h1>
          <p>LeetSolve finds the daily challenge, generates a solution, checks it, retries when needed, and saves the result to your dashboard.</p>
          <div className="hero-actions">
            {problem && <a className="primary-link" href={problem.link} target="_blank" rel="noreferrer">Open today’s problem ↗</a>}
            <span className="subtle-label">Next automatic run: 00:15 UTC</span>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">🔥</div>
          <span className="orbit-chip chip-ai">AI</span>
          <span className="orbit-chip chip-test">TEST</span>
          <span className="orbit-chip chip-save">SAVE</span>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card accent">
          <div className="stat-icon">🔥</div>
          <div><span>LeetSolve streak</span><strong>{stats.currentStreak}</strong><small>prepared days</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">🏆</div>
          <div><span>Longest run</span><strong>{stats.longestStreak}</strong><small>prepared days</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">✓</div>
          <div><span>Total solved</span><strong>{stats.totalSolved}</strong><small>daily runs</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">⚙</div>
          <div><span>Default language</span><strong className="language-stat">{language}</strong><small>configurable</small></div>
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
              <div className={`run-state ${today ? "complete" : "pending"}`}>
                <span>{today ? "✓" : "○"}</span>
                <div><strong>{today ? "Solution ready" : "Waiting for today’s run"}</strong><small>{today ? `Saved ${formatDate(today.challenge_date)}` : "Cron will generate it automatically"}</small></div>
              </div>
              <div className="meta-block"><span>Language</span><strong>{today?.language || language}</strong></div>
              <div className="meta-block"><span>Verification</span><strong>{today?.judge_status || "Not run yet"}</strong></div>
            </div>

            {today?.code ? (
              <>
                <CodeViewer code={today.code} />
                <div className="explanation-grid">
                  <div><span className="eyebrow">EXPLANATION</span><p>{today.explanation}</p></div>
                  <div className="complexity-box">
                    <div><span>Time</span><strong>{today.time_complexity || "—"}</strong></div>
                    <div><span>Space</span><strong>{today.space_complexity || "—"}</strong></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">⌁</div>
                <h3>No solution saved for today yet</h3>
                <p>Once the scheduled job runs, the generated solution will appear here automatically.</p>
              </div>
            )}
          </article>

          <SolveControls defaultLanguage={language} />
        </div>

        <aside className="side-column">
          <article className="panel automation-panel">
            <div className="section-heading compact"><div><span className="eyebrow">PIPELINE</span><h2>Automation</h2></div><span className="healthy">Healthy</span></div>
            <div className="pipeline">
              <div className="pipe-item"><span>1</span><div><strong>Fetch challenge</strong><small>Daily problem metadata</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>2</span><div><strong>Generate solution</strong><small>Gemini coding model</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>3</span><div><strong>Verify & repair</strong><small>Judge + retry loop</small></div></div>
              <div className="pipe-line" />
              <div className="pipe-item"><span>4</span><div><strong>Save result</strong><small>Neon PostgreSQL</small></div></div>
            </div>
          </article>

          <article className="panel history-panel">
            <div className="section-heading compact"><div><span className="eyebrow">RECENT</span><h2>History</h2></div></div>
            <div className="history-list">
              {recent.length === 0 ? <p className="muted">No previous runs yet.</p> : recent.map((item) => (
                <a className="history-row" href={item.problem_url || `https://leetcode.com/problems/${item.slug}/`} target="_blank" rel="noreferrer" key={String(item.id)}>
                  <div className="history-check">✓</div>
                  <div className="history-copy"><strong>{item.title}</strong><span>{formatDate(item.challenge_date)} · {item.language}</span></div>
                  <span className={difficultyClass(item.difficulty)}>{item.difficulty}</span>
                </a>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <footer>
        <span>LeetSolve</span>
        <span>Automatic preparation and verification only — no LeetCode account credentials are stored.</span>
      </footer>
    </main>
  );
}
