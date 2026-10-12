import { DailyProblem } from "./types";

const endpoint = "https://leetcode.com/graphql";

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

async function graphql(query: string, variables?: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "LeetSolve/0.1 (+personal coding assistant)",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`LeetCode request failed: HTTP ${response.status}`);
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
    link: daily.link.startsWith("http") ? daily.link : `https://leetcode.com${daily.link}`,
    title: daily.question.title,
    titleSlug: daily.question.titleSlug,
    difficulty: daily.question.difficulty,
    questionId: daily.question.questionId,
    content: htmlToText(detail?.content || ""),
    codeSnippets: detail?.codeSnippets || [],
  };
}
