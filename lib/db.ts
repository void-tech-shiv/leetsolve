import { neon } from "@neondatabase/serverless";
import { decryptSecret, encryptSecret } from "./crypto";
import type { DailyProblem, GeneratedSolution, LeetCodeCredentials, LeetCodeSubmissionResult, VerificationResult } from "./types";
import type { ScheduleSettings } from "./schedule";

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
  submission_id?: string | null;
  submission_status?: string | null;
  runtime?: string | null;
  memory?: string | null;
  submitted_at?: string | Date | null;
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
  leetcodeUsername: string | null;
  leetcodeConnected: boolean;
  leetcodeVerifiedAt: string | Date | null;
};

type SettingsRow = {
  user_id: string;
  leetcode_username: string | null;
  schedule_enabled: boolean;
  schedule_time: string;
  timezone: string;
  language: string;
  last_run_local_date: string | Date | null;
  leetcode_connected?: boolean;
  leetcode_verified_at?: string | Date | null;
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
    submission_id TEXT,
    submission_status TEXT,
    runtime TEXT,
    memory TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS user_id TEXT`;
  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS submission_id TEXT`;
  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS submission_status TEXT`;
  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS runtime TEXT`;
  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS memory TEXT`;
  await db`ALTER TABLE solutions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`;
  await db`ALTER TABLE solutions DROP CONSTRAINT IF EXISTS solutions_challenge_date_language_key`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS solutions_user_day_language_unique
    ON solutions(user_id, challenge_date, language)`;
  await db`CREATE INDEX IF NOT EXISTS solutions_user_date_idx
    ON solutions(user_id, challenge_date DESC)`;

  await db`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    leetcode_username TEXT,
    leetcode_session_enc TEXT,
    leetcode_csrf_enc TEXT,
    leetcode_verified_at TIMESTAMPTZ,
    schedule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_time TEXT NOT NULL DEFAULT '20:30',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    language TEXT NOT NULL DEFAULT 'java',
    last_run_local_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS leetcode_username TEXT`;
  await db`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS leetcode_session_enc TEXT`;
  await db`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS leetcode_csrf_enc TEXT`;
  await db`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS leetcode_verified_at TIMESTAMPTZ`;

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
    leetcodeUsername: row.leetcode_username,
    leetcodeConnected: Boolean(row.leetcode_connected),
    leetcodeVerifiedAt: row.leetcode_verified_at || null,
    enabled: row.schedule_enabled,
    time: row.schedule_time,
    timezone: row.timezone,
    language: row.language,
    lastRunLocalDate: normalizeDate(row.last_run_local_date),
    schedulerRunId,
  };
}

export async function saveSolution(
  userId: string,
  problem: DailyProblem,
  solution: GeneratedSolution,
  verification: VerificationResult,
  submission?: LeetCodeSubmissionResult | null,
) {
  await ensureSchema();
  const db = sql();
  const status = submission
    ? (submission.accepted ? "accepted" : "submitted")
    : verification.configured
      ? (verification.passed ? "verified" : "generated")
      : "generated";

  await db`INSERT INTO solutions (
      user_id, challenge_date, title, slug, difficulty, problem_url, language, code,
      explanation, time_complexity, space_complexity, status, judge_status,
      submission_id, submission_status, runtime, memory, submitted_at
    ) VALUES (
      ${userId}, ${problem.date}, ${problem.title}, ${problem.titleSlug}, ${problem.difficulty}, ${problem.link},
      ${solution.language}, ${solution.code}, ${solution.explanation}, ${solution.timeComplexity},
      ${solution.spaceComplexity}, ${status}, ${verification.status},
      ${submission?.submissionId || null}, ${submission?.statusMessage || null},
      ${submission?.runtime || null}, ${submission?.memory || null}, ${submission ? new Date().toISOString() : null}
    )
    ON CONFLICT (user_id, challenge_date, language) DO UPDATE SET
      code = EXCLUDED.code,
      explanation = EXCLUDED.explanation,
      time_complexity = EXCLUDED.time_complexity,
      space_complexity = EXCLUDED.space_complexity,
      status = EXCLUDED.status,
      judge_status = EXCLUDED.judge_status,
      submission_id = EXCLUDED.submission_id,
      submission_status = EXCLUDED.submission_status,
      runtime = EXCLUDED.runtime,
      memory = EXCLUDED.memory,
      submitted_at = EXCLUDED.submitted_at,
      created_at = NOW()`;
}

export async function getRecentSolutions(userId: string, limit = 10): Promise<SolutionRow[]> {
  if (!process.env.DATABASE_URL) return [];
  await ensureSchema();
  const db = sql();
  return (await db`SELECT id, user_id, challenge_date, title, slug, difficulty, language, status, judge_status,
      submission_id, submission_status, runtime, memory, submitted_at, created_at, problem_url
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
    WHERE user_id = ${userId} AND status = 'accepted'
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
  const rows = (await db`SELECT user_id, leetcode_username, schedule_enabled, schedule_time, timezone, language,
      last_run_local_date, leetcode_verified_at,
      (leetcode_session_enc IS NOT NULL AND leetcode_csrf_enc IS NOT NULL) AS leetcode_connected
    FROM user_settings WHERE user_id = ${userId} LIMIT 1`) as SettingsRow[];
  const schedulerRunId = await getSystemSchedulerRunId();
  return mapSettings(rows[0], schedulerRunId);
}

export async function updateUserSettings(userId: string, input: {
  enabled: boolean;
  time: string;
  timezone: string;
  language: string;
  leetcodeUsername?: string;
}) {
  await ensureUserSettings(userId);
  const db = sql();
  const username = input.leetcodeUsername?.trim() || null;

  await db`UPDATE user_settings SET
    leetcode_username = COALESCE(${username}, leetcode_username),
    schedule_enabled = ${input.enabled},
    schedule_time = ${input.time},
    timezone = ${input.timezone},
    language = ${input.language},
    updated_at = NOW()
    WHERE user_id = ${userId}`;

  return getUserSettings(userId);
}

export async function saveLeetCodeCredentials(userId: string, credentials: LeetCodeCredentials, username: string | null) {
  await ensureUserSettings(userId);
  const db = sql();
  const sessionEncrypted = encryptSecret(credentials.session);
  const csrfEncrypted = encryptSecret(credentials.csrfToken);

  await db`UPDATE user_settings SET
    leetcode_session_enc = ${sessionEncrypted},
    leetcode_csrf_enc = ${csrfEncrypted},
    leetcode_username = COALESCE(${username}, leetcode_username),
    leetcode_verified_at = NOW(),
    updated_at = NOW()
    WHERE user_id = ${userId}`;

  return getUserSettings(userId);
}

export async function getLeetCodeCredentials(userId: string): Promise<LeetCodeCredentials | null> {
  await ensureUserSettings(userId);
  const db = sql();
  const rows = await db`SELECT leetcode_session_enc, leetcode_csrf_enc
    FROM user_settings WHERE user_id = ${userId} LIMIT 1` as Array<{
      leetcode_session_enc: string | null;
      leetcode_csrf_enc: string | null;
    }>;
  const row = rows[0];
  if (!row?.leetcode_session_enc || !row?.leetcode_csrf_enc) return null;

  const session = decryptSecret(row.leetcode_session_enc);
  const csrfToken = decryptSecret(row.leetcode_csrf_enc);
  if (!session || !csrfToken) return null;
  return { session, csrfToken };
}

export async function clearLeetCodeCredentials(userId: string) {
  await ensureUserSettings(userId);
  const db = sql();
  await db`UPDATE user_settings SET
    leetcode_session_enc = NULL,
    leetcode_csrf_enc = NULL,
    leetcode_verified_at = NULL,
    updated_at = NOW()
    WHERE user_id = ${userId}`;
  return getUserSettings(userId);
}

export async function getActiveUserSchedules(): Promise<UserSettings[]> {
  if (!process.env.DATABASE_URL) return [];
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT user_id, leetcode_username, schedule_enabled, schedule_time, timezone, language,
      last_run_local_date, leetcode_verified_at,
      (leetcode_session_enc IS NOT NULL AND leetcode_csrf_enc IS NOT NULL) AS leetcode_connected
    FROM user_settings
    WHERE schedule_enabled = TRUE
      AND leetcode_session_enc IS NOT NULL
      AND leetcode_csrf_enc IS NOT NULL`) as SettingsRow[];
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
