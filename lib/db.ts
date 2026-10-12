import { neon } from "@neondatabase/serverless";
import type { DailyProblem, GeneratedSolution, VerificationResult } from "./types";
import type { ScheduleSettings } from "./schedule";
import { decryptSecret, encryptSecret } from "./crypto";

export type SolutionRow = {
  id: number | string;
  user_id?: string | null;
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

export type UserSettings = ScheduleSettings & {
  userId: string;
  leetcodeSessionConfigured: boolean;
  leetcodeCsrfConfigured: boolean;
};

type SettingsRow = {
  user_id: string;
  leetcode_session_enc: string | null;
  leetcode_csrf_enc: string | null;
  schedule_enabled: boolean;
  schedule_time: string;
  timezone: string;
  language: string;
  last_run_local_date: string | Date | null;
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
    user_id TEXT,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS user_id TEXT`;
  await db`ALTER TABLE solutions DROP CONSTRAINT IF EXISTS solutions_challenge_date_language_key`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS solutions_user_day_language_unique
    ON solutions(user_id, challenge_date, language)`;
  await db`CREATE INDEX IF NOT EXISTS solutions_user_date_idx
    ON solutions(user_id, challenge_date DESC)`;

  await db`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    leetcode_session_enc TEXT,
    leetcode_csrf_enc TEXT,
    schedule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_time TEXT NOT NULL DEFAULT '20:30',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    language TEXT NOT NULL DEFAULT 'java',
    last_run_local_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS system_settings (
    id SMALLINT PRIMARY KEY,
    scheduler_run_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (id = 1)
  )`;
  await db`INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
}

async function ensureUserSettings(userId: string) {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO user_settings (user_id, language)
    VALUES (${userId}, ${process.env.DEFAULT_LANGUAGE || "java"})
    ON CONFLICT (user_id) DO NOTHING`;
}

function mapSettings(row: SettingsRow, schedulerRunId: string | null = null): UserSettings {
  return {
    userId: row.user_id,
    enabled: row.schedule_enabled,
    time: row.schedule_time,
    timezone: row.timezone,
    language: row.language,
    lastRunLocalDate: normalizeDate(row.last_run_local_date),
    schedulerRunId,
    leetcodeSessionConfigured: Boolean(row.leetcode_session_enc),
    leetcodeCsrfConfigured: Boolean(row.leetcode_csrf_enc),
  };
}

export async function saveSolution(userId: string, problem: DailyProblem, solution: GeneratedSolution, verification: VerificationResult) {
  await ensureSchema();
  const db = sql();
  const status = verification.configured ? (verification.passed ? "verified" : "generated") : "generated";

  await db`INSERT INTO solutions (
      user_id, challenge_date, title, slug, difficulty, problem_url, language, code,
      explanation, time_complexity, space_complexity, status, judge_status
    ) VALUES (
      ${userId}, ${problem.date}, ${problem.title}, ${problem.titleSlug}, ${problem.difficulty}, ${problem.link},
      ${solution.language}, ${solution.code}, ${solution.explanation}, ${solution.timeComplexity},
      ${solution.spaceComplexity}, ${status}, ${verification.status}
    )
    ON CONFLICT (user_id, challenge_date, language) DO UPDATE SET
      code = EXCLUDED.code,
      explanation = EXCLUDED.explanation,
      time_complexity = EXCLUDED.time_complexity,
      space_complexity = EXCLUDED.space_complexity,
      status = EXCLUDED.status,
      judge_status = EXCLUDED.judge_status,
      created_at = NOW()`;
}

export async function getRecentSolutions(userId: string, limit = 10): Promise<SolutionRow[]> {
  if (!process.env.DATABASE_URL) return [];
  await ensureSchema();
  const db = sql();
  return (await db`SELECT id, user_id, challenge_date, title, slug, difficulty, language, status, judge_status, created_at, problem_url
    FROM solutions WHERE user_id = ${userId}
    ORDER BY challenge_date DESC, created_at DESC LIMIT ${limit}`) as SolutionRow[];
}

export async function getTodaySolution(userId: string, language: string): Promise<SolutionRow | null> {
  if (!process.env.DATABASE_URL) return null;
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT * FROM solutions
    WHERE user_id = ${userId} AND challenge_date = CURRENT_DATE AND language = ${language}
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

function todayKey(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getStreakStats(userId: string, timezone = "Asia/Kolkata"): Promise<StreakStats> {
  if (!process.env.DATABASE_URL) return { currentStreak: 0, longestStreak: 0, totalSolved: 0 };
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT DISTINCT challenge_date FROM solutions
    WHERE user_id = ${userId}
    ORDER BY challenge_date DESC LIMIT 1000`) as Array<{ challenge_date: string | Date }>;
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

  const today = dayNumber(todayKey(timezone));
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

export async function getSystemSchedulerRunId() {
  if (!process.env.DATABASE_URL) return null;
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT scheduler_run_id FROM system_settings WHERE id = 1 LIMIT 1`) as Array<{ scheduler_run_id: string | null }>;
  return rows[0]?.scheduler_run_id || null;
}

export async function setSystemSchedulerRunId(runId: string) {
  await ensureSchema();
  const db = sql();
  await db`UPDATE system_settings SET scheduler_run_id = ${runId}, updated_at = NOW() WHERE id = 1`;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  await ensureUserSettings(userId);
  const db = sql();
  const rows = (await db`SELECT user_id, leetcode_session_enc, leetcode_csrf_enc,
    schedule_enabled, schedule_time, timezone, language, last_run_local_date
    FROM user_settings WHERE user_id = ${userId} LIMIT 1`) as SettingsRow[];
  const schedulerRunId = await getSystemSchedulerRunId();
  return mapSettings(rows[0], schedulerRunId);
}

export async function updateUserSettings(userId: string, input: {
  enabled: boolean;
  time: string;
  timezone: string;
  language: string;
  leetcodeSession?: string;
  leetcodeCsrf?: string;
}) {
  await ensureUserSettings(userId);
  const db = sql();

  await db`UPDATE user_settings SET
    schedule_enabled = ${input.enabled},
    schedule_time = ${input.time},
    timezone = ${input.timezone},
    language = ${input.language},
    updated_at = NOW()
    WHERE user_id = ${userId}`;

  if (input.leetcodeSession?.trim()) {
    const encrypted = encryptSecret(input.leetcodeSession.trim());
    await db`UPDATE user_settings SET leetcode_session_enc = ${encrypted}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (input.leetcodeCsrf?.trim()) {
    const encrypted = encryptSecret(input.leetcodeCsrf.trim());
    await db`UPDATE user_settings SET leetcode_csrf_enc = ${encrypted}, updated_at = NOW() WHERE user_id = ${userId}`;
  }

  return getUserSettings(userId);
}

export async function clearLeetCodeCredentials(userId: string) {
  await ensureUserSettings(userId);
  const db = sql();
  await db`UPDATE user_settings SET leetcode_session_enc = NULL, leetcode_csrf_enc = NULL, updated_at = NOW()
    WHERE user_id = ${userId}`;
}

export async function getUserLeetCodeCredentials(userId: string) {
  await ensureUserSettings(userId);
  const db = sql();
  const rows = (await db`SELECT leetcode_session_enc, leetcode_csrf_enc
    FROM user_settings WHERE user_id = ${userId} LIMIT 1`) as Array<{
      leetcode_session_enc: string | null;
      leetcode_csrf_enc: string | null;
    }>;
  const row = rows[0];
  return {
    session: decryptSecret(row?.leetcode_session_enc) || null,
    csrf: decryptSecret(row?.leetcode_csrf_enc) || null,
  };
}

export async function getActiveUserSchedules(): Promise<UserSettings[]> {
  if (!process.env.DATABASE_URL) return [];
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT user_id, leetcode_session_enc, leetcode_csrf_enc,
    schedule_enabled, schedule_time, timezone, language, last_run_local_date
    FROM user_settings WHERE schedule_enabled = TRUE`) as SettingsRow[];
  return rows.map((row) => mapSettings(row, null));
}

export async function claimScheduledRun(userId: string, localDate: string) {
  await ensureUserSettings(userId);
  const db = sql();
  const rows = await db`UPDATE user_settings
    SET last_run_local_date = ${localDate}::date, updated_at = NOW()
    WHERE user_id = ${userId}
      AND (last_run_local_date IS NULL OR last_run_local_date <> ${localDate}::date)
    RETURNING user_id`;
  return rows.length > 0;
}

export async function releaseScheduledRun(userId: string, localDate: string) {
  await ensureUserSettings(userId);
  const db = sql();
  await db`UPDATE user_settings
    SET last_run_local_date = NULL, updated_at = NOW()
    WHERE user_id = ${userId} AND last_run_local_date = ${localDate}::date`;
}
