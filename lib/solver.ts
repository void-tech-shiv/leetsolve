import { generateSolution, repairSolution } from "./ai";
import { getLeetCodeCredentials, saveSolution } from "./db";
import { verifySolution } from "./judge";
import { getDailyProblem, submitAndWait } from "./leetcode";
import { requireActiveSubscription } from "./subscription";
import { requireGroqApiKey } from "./user-groq";
import type { LeetCodeSubmissionResult } from "./types";

function submissionFailure(result: LeetCodeSubmissionResult) {
  return [
    `LeetCode verdict: ${result.statusMessage}`,
    result.totalCorrect !== undefined && result.totalTestcases !== undefined
      ? `Passed test cases: ${result.totalCorrect}/${result.totalTestcases}`
      : "",
    result.lastTestcase ? `Last testcase: ${result.lastTestcase}` : "",
    result.expectedOutput ? `Expected output: ${result.expectedOutput}` : "",
    result.codeOutput ? `Your output: ${result.codeOutput}` : "",
  ].filter(Boolean).join("\n");
}

export async function solveDaily(
  userId: string,
  language = process.env.DEFAULT_LANGUAGE || "java",
  options: { requireSubscription?: boolean } = {},
) {
  // Scheduled/background automation is a paid feature. Manual solves explicitly
  // opt out of this check in the /api/solve route.
  if (options.requireSubscription !== false) {
    await requireActiveSubscription(userId);
  }

  // Every solve uses the signed-in user's own Groq key. There is intentionally
  // no server GROQ_API_KEY fallback, so one user's usage never consumes another key.
  const groqApiKey = await requireGroqApiKey(userId);

  const credentials = await getLeetCodeCredentials(userId);
  if (!credentials) {
    throw new Error("Connect your LeetCode account before running the solver.");
  }

  const problem = await getDailyProblem();
  let solution = await generateSolution(problem, language, groqApiKey);
  let verification = await verifySolution(solution);

  const maxRepairs = Math.max(0, Number(process.env.MAX_REPAIR_ATTEMPTS || "2"));
  for (let attempt = 0; verification.configured && !verification.passed && attempt < maxRepairs; attempt += 1) {
    const failure = [verification.status, verification.stderr, verification.stdout].filter(Boolean).join("\n");
    solution = await repairSolution(
      problem,
      language,
      solution,
      failure || "Verification failed without details.",
      groqApiKey,
    );
    verification = await verifySolution(solution);
  }

  const maxSubmissionAttempts = Math.max(1, Number(process.env.MAX_SUBMISSION_ATTEMPTS || "3"));
  let submission: LeetCodeSubmissionResult | null = null;

  for (let attempt = 0; attempt < maxSubmissionAttempts; attempt += 1) {
    submission = await submitAndWait(problem, solution, credentials);
    if (submission.accepted) break;

    if (attempt < maxSubmissionAttempts - 1) {
      solution = await repairSolution(problem, language, solution, submissionFailure(submission), groqApiKey);
      verification = await verifySolution(solution);

      if (verification.configured && !verification.passed) {
        const localFailure = [verification.status, verification.stderr, verification.stdout].filter(Boolean).join("\n");
        solution = await repairSolution(
          problem,
          language,
          solution,
          localFailure || "Local verification failed after repair.",
          groqApiKey,
        );
        verification = await verifySolution(solution);
      }
    }
  }

  await saveSolution(userId, problem, solution, verification, submission).catch((error) => {
    console.warn("Solution submitted but database save failed:", error instanceof Error ? error.message : "Unknown error");
  });

  return { problem, solution, verification, submission };
}
