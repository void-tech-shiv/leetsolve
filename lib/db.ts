import { neon } from "@neondatabase/serverless";
import type { DailyProblem, GeneratedSolution, VerificationResult } from "./types";

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

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
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
