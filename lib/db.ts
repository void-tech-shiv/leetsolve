import { neon } from "@neondatabase/serverless";
import type { DailyProblem, GeneratedSolution, VerificationResult } from "./types";
import type { ScheduleSettings } from "./schedule";

export type SolutionRow = {
  id: number | string;
  challenge_date: string | Date;
  title: string;
  slug: string;
  difficulty: string;
  language: string;
  status: string;
  judge_status?: string | null;
  created_at: string | Date;
  problem_url?: string;
  code?: string;
  explanation?: string;
  time_complexity?: string;
  space_complexity?: string;
};

export type StreakStats = {
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
};

type SettingsRow = {
  schedule_enabled: boolean;
  schedule_time: string;
  timezone: string;
  language: string;
  last_run_local_date: string | Date | null;
  scheduler_run_id: string | null;
};

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

function normalizeDate(value: string | Date | null) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export async function ensureSchema() {
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS solutions (
    id BIGSERIAL PRIMARY KEY,
    challenge_date DATE NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    problem_url TEXT NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    explanation TEXT NOT NULL,
    time_complexity TEXT NOT NULL,
    space_complexity TEXT NOT NULL,
    status TEXT NOT NULL,
    judge_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(challenge_date, language)
  )`;

  await db`CREATE TABLE IF NOT EXISTS app_settings (
    id SMALLINT PRIMARY KEY,
    schedule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_time TEXT NOT NULL DEFAULT '20:30',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    language TEXT NOT NULL DEFAULT 'java',
    last_run_local_date DATE,
    scheduler_run_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (id = 1)
  )`;

  await db`INSERT INTO app_settings (id, language)
    VALUES (1, ${process.env.DEFAULT_LANGUAGE || "java"})
    ON CONFLICT (id) DO NOTHING`;
}

export async function saveSolution(problem: DailyProblem, solution: GeneratedSolution, verification: VerificationResult) {
  await ensureSchema();
  const db = sql();
  const status = verification.configured ? (verification.passed ? "verified" : "generated") : "generated";
  await db`INSERT INTO solutions (
      challenge_date, title, slug, difficulty, problem_url, language, code,
      explanation, time_complexity, space_complexity, status, judge_status
    ) VALUES (
      ${problem.date}, ${problem.title}, ${problem.titleSlug}, ${problem.difficulty}, ${problem.link},
      ${solution.language}, ${solution.code}, ${solution.explanation}, ${solution.timeComplexity},
      ${solution.spaceComplexity}, ${status}, ${verification.status}
    )
    ON CONFLICT (challenge_date, language) DO UPDATE SET
      code = EXCLUDED.code,
      explanation = EXCLUDED.explanation,
      time_complexity = EXCLUDED.time_complexity,
      space_complexity = EXCLUDED.space_complexity,
      status = EXCLUDED.status,
      judge_status = EXCLUDED.judge_status,
      created_at = NOW()`;
}

export async function getRecentSolutions(limit = 10): Promise<SolutionRow[]> {
  if (!process.env.DATABASE_URL) return [];
  await ensureSchema();
  const db = sql();
  return (await db`SELECT id, challenge_date, title, slug, difficulty, language, status, judge_status, created_at, problem_url
            FROM solutions ORDER BY challenge_date DESC, created_at DESC LIMIT ${limit}`) as SolutionRow[];
}

export async function getTodaySolution(language: string): Promise<SolutionRow | null> {
  if (!process.env.DATABASE_URL) return null;
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT * FROM solutions
            WHERE challenge_date = CURRENT_DATE AND language = ${language}
            ORDER BY created_at DESC LIMIT 1`) as SolutionRow[];
  return rows[0] || null;
}

function dateKey(value: string | Date) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function dayNumber(key: string) {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

export async function getStreakStats(): Promise<StreakStats> {
  if (!process.env.DATABASE_URL) return { currentStreak: 0, longestStreak: 0, totalSolved: 0 };
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT DISTINCT challenge_date FROM solutions ORDER BY challenge_date DESC LIMIT 1000`) as Array<{
    challenge_date: string | Date;
  }>;
  const dates = rows.map((row) => dateKey(row.challenge_date));
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0, totalSolved: 0 };

  const numbers = dates.map(dayNumber).sort((a, b) => b - a);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i - 1] - numbers[i] === 1) run += 1;
    else if (numbers[i - 1] !== numbers[i]) run = 1;
    longest = Math.max(longest, run);
  }

  const today = dayNumber(new Date().toISOString().slice(0, 10));
  let current = 0;
  if (numbers[0] === today || numbers[0] === today - 1) {
    current = 1;
    for (let i = 1; i < numbers.length; i += 1) {
      if (numbers[i - 1] - numbers[i] === 1) current += 1;
      else break;
    }
  }

  return { currentStreak: current, longestStreak: longest, totalSolved: dates.length };
}

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  if (!process.env.DATABASE_URL) {
    return {
      enabled: true,
      time: "20:30",
      timezone: "Asia/Kolkata",
      language: process.env.DEFAULT_LANGUAGE || "java",
      lastRunLocalDate: null,
      schedulerRunId: null,
    };
  }

  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT schedule_enabled, schedule_time, timezone, language, last_run_local_date, scheduler_run_id
    FROM app_settings WHERE id = 1 LIMIT 1`) as SettingsRow[];
  const row = rows[0];

  return {
    enabled: row.schedule_enabled,
    time: row.schedule_time,
    timezone: row.timezone,
    language: row.language,
    lastRunLocalDate: normalizeDate(row.last_run_local_date),
    schedulerRunId: row.scheduler_run_id,
  };
}

export async function updateScheduleSettings(input: Pick<ScheduleSettings, "enabled" | "time" | "timezone" | "language">) {
  await ensureSchema();
  const db = sql();
  await db`UPDATE app_settings SET
    schedule_enabled = ${input.enabled},
    schedule_time = ${input.time},
    timezone = ${input.timezone},
    language = ${input.language},
    updated_at = NOW()
    WHERE id = 1`;
  return getScheduleSettings();
}

export async function setSchedulerRunId(runId: string) {
  await ensureSchema();
  const db = sql();
  await db`UPDATE app_settings SET scheduler_run_id = ${runId}, updated_at = NOW() WHERE id = 1`;
}

export async function claimScheduledRun(localDate: string) {
  await ensureSchema();
  const db = sql();
  const rows = await db`UPDATE app_settings
    SET last_run_local_date = ${localDate}::date, updated_at = NOW()
    WHERE id = 1
      AND (last_run_local_date IS NULL OR last_run_local_date <> ${localDate}::date)
    RETURNING id`;
  return rows.length > 0;
}

export async function releaseScheduledRun(localDate: string) {
  await ensureSchema();
  const db = sql();
  await db`UPDATE app_settings
    SET last_run_local_date = NULL, updated_at = NOW()
    WHERE id = 1 AND last_run_local_date = ${localDate}::date`;
}
