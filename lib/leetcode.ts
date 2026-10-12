import type { DailyProblem, GeneratedSolution, LeetCodeCredentials, LeetCodeSubmissionResult } from "./types";

const endpoint = "https://leetcode.com/graphql";
const baseUrl = "https://leetcode.com";

const dailyQuery = `
query questionOfToday {
  activeDailyCodingChallengeQuestion {
    date
    link
    question {
      questionId
      title
      titleSlug
      difficulty
    }
  }
}`;

const questionQuery = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    content
    codeSnippets {
      lang
      langSlug
      code
    }
  }
}`;

const userStatusQuery = `
query globalData {
  userStatus {
    isSignedIn
    username
  }
}`;

const accountStatsQuery = `
query LeetSolveAccountStats($username: String!) {
  streakCounter {
    streakCount
  }
  matchedUser(username: $username) {
    submitStats: submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    userCalendar {
      streak
      totalActiveDays
    }
  }
}`;

export type LeetCodeAccountStats = {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  totalSolved: number;
};

function publicHeaders() {
  return {
    "content-type": "application/json",
    "user-agent": "LeetSolve/1.0 (+daily coding assistant)",
  };
}

function authenticatedHeaders(credentials: LeetCodeCredentials, referer = `${baseUrl}/`) {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: baseUrl,
    referer,
    "x-csrftoken": credentials.csrfToken,
    cookie: `LEETCODE_SESSION=${credentials.session}; csrftoken=${credentials.csrfToken}`,
    "user-agent": "Mozilla/5.0 (compatible; LeetSolve/1.0; +https://leetcode.com)",
  };
}

async function graphql(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: publicHeaders(),
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`LeetCode request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.errors?.length) throw new Error(payload.errors[0]?.message || "LeetCode GraphQL error");
  return payload.data;
}

async function authenticatedGraphql(
  query: string,
  credentials: LeetCodeCredentials,
  variables?: Record<string, unknown>,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: authenticatedHeaders(credentials, `${baseUrl}/problemset/`),
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`LeetCode account request failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.errors?.length) throw new Error(payload.errors[0]?.message || "LeetCode GraphQL error");
  return payload.data;
}

function htmlToText(html = "") {
  return html
    .replace(/<pre>/gi, "\n```\n")
    .replace(/<\/pre>/gi, "\n```\n")
    .replace(/<li>/gi, "\n- ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getDailyProblem(): Promise<DailyProblem> {
  const dailyData = await graphql(dailyQuery);
  const daily = dailyData?.activeDailyCodingChallengeQuestion;
  if (!daily?.question) throw new Error("Daily challenge metadata is unavailable.");

  const detailData = await graphql(questionQuery, { titleSlug: daily.question.titleSlug });
  const detail = detailData?.question;

  return {
    date: daily.date,
    link: daily.link.startsWith("http") ? daily.link : `${baseUrl}${daily.link}`,
    title: daily.question.title,
    titleSlug: daily.question.titleSlug,
    difficulty: daily.question.difficulty,
    questionId: daily.question.questionId,
    content: htmlToText(detail?.content || ""),
    codeSnippets: detail?.codeSnippets || [],
  };
}

export async function verifyLeetCodeCredentials(credentials: LeetCodeCredentials) {
  const data = await authenticatedGraphql(userStatusQuery, credentials);
  const status = data?.userStatus;
  if (!status?.isSignedIn || !status?.username) {
    throw new Error("LeetCode session is not authenticated. Copy fresh LEETCODE_SESSION and csrftoken cookies.");
  }
  return { username: String(status.username) };
}

export async function getLeetCodeAccountStats(
  credentials: LeetCodeCredentials,
  username: string,
): Promise<LeetCodeAccountStats> {
  const data = await authenticatedGraphql(accountStatsQuery, credentials, { username });
  const matchedUser = data?.matchedUser;
  if (!matchedUser) throw new Error("LeetCode profile stats are unavailable for this account.");

  const counts = Array.isArray(matchedUser?.submitStats?.acSubmissionNum)
    ? matchedUser.submitStats.acSubmissionNum
    : [];
  const allCount = counts.find((item: { difficulty?: string }) => item?.difficulty === "All")?.count;
  const fallbackTotal = counts
    .filter((item: { difficulty?: string }) => item?.difficulty && item.difficulty !== "All")
    .reduce((sum: number, item: { count?: number }) => sum + Number(item?.count || 0), 0);

  return {
    currentStreak: Number(data?.streakCounter?.streakCount || 0),
    longestStreak: Number(matchedUser?.userCalendar?.streak || 0),
    totalActiveDays: Number(matchedUser?.userCalendar?.totalActiveDays || 0),
    totalSolved: Number(allCount ?? fallbackTotal ?? 0),
  };
}

export async function submitSolution(
  problem: DailyProblem,
  solution: GeneratedSolution,
  credentials: LeetCodeCredentials,
): Promise<string> {
  if (!problem.questionId) throw new Error("LeetCode question ID is missing.");

  const referer = `${baseUrl}/problems/${problem.titleSlug}/`;
  const response = await fetch(`${referer}submit/`, {
    method: "POST",
    headers: authenticatedHeaders(credentials, referer),
    body: JSON.stringify({
      lang: solution.language,
      question_id: problem.questionId,
      typed_code: solution.code,
    }),
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("LeetCode rejected the saved session. Reconnect your LeetCode account.");
  }
  if (response.status === 429) {
    throw new Error("LeetCode rate-limited the submission. Try again later.");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LeetCode submit failed: HTTP ${response.status}${text ? ` · ${text.slice(0, 160)}` : ""}`);
  }

  const payload = await response.json();
  const submissionId = payload?.submission_id ?? payload?.submissionId;
  if (!submissionId) throw new Error("LeetCode did not return a submission ID.");
  return String(submissionId);
}

function toSubmissionResult(submissionId: string, payload: Record<string, unknown>): LeetCodeSubmissionResult {
  const statusMessage = String(payload.status_msg || payload.statusMessage || payload.state || "Unknown");
  const statusCode = typeof payload.status_code === "number" ? payload.status_code : undefined;
  return {
    submissionId,
    accepted: statusMessage.toLowerCase() === "accepted" || statusCode === 10,
    state: String(payload.state || "UNKNOWN"),
    statusCode,
    statusMessage,
    runtime: payload.status_runtime ? String(payload.status_runtime) : payload.runtime ? String(payload.runtime) : undefined,
    memory: payload.memory ? String(payload.memory) : undefined,
    lastTestcase: payload.last_testcase ? String(payload.last_testcase) : undefined,
    expectedOutput: payload.expected_output ? String(payload.expected_output) : undefined,
    codeOutput: payload.code_output ? String(payload.code_output) : undefined,
    totalCorrect: typeof payload.total_correct === "number" ? payload.total_correct : undefined,
    totalTestcases: typeof payload.total_testcases === "number" ? payload.total_testcases : undefined,
  };
}

export async function waitForSubmissionResult(
  submissionId: string,
  credentials: LeetCodeCredentials,
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<LeetCodeSubmissionResult> {
  const maxAttempts = options.maxAttempts ?? 30;
  const delayMs = options.delayMs ?? 1200;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${baseUrl}/submissions/detail/${submissionId}/check/`, {
      method: "GET",
      headers: authenticatedHeaders(credentials, `${baseUrl}/submissions/detail/${submissionId}/`),
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("LeetCode session expired while checking the submission.");
    }
    if (!response.ok) throw new Error(`Could not check LeetCode submission: HTTP ${response.status}`);

    const payload = await response.json() as Record<string, unknown>;
    const state = String(payload.state || "").toUpperCase();
    if (state === "SUCCESS" || payload.status_msg || payload.status_code) {
      return toSubmissionResult(submissionId, payload);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("LeetCode judging timed out before a final verdict was returned.");
}

export async function submitAndWait(
  problem: DailyProblem,
  solution: GeneratedSolution,
  credentials: LeetCodeCredentials,
) {
  const submissionId = await submitSolution(problem, solution, credentials);
  return waitForSubmissionResult(submissionId, credentials);
}
