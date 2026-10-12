import { generateSolution, repairSolution } from "./ai";
import { saveSolution } from "./db";
import { verifySolution } from "./judge";
import { getDailyProblem } from "./leetcode";

export async function solveDaily(userId: string, language = process.env.DEFAULT_LANGUAGE || "java") {
  const problem = await getDailyProblem();
  let solution = await generateSolution(problem, language);
  let verification = await verifySolution(solution);

  const maxRepairs = Math.max(0, Number(process.env.MAX_REPAIR_ATTEMPTS || "2"));
  for (let attempt = 0; verification.configured && !verification.passed && attempt < maxRepairs; attempt += 1) {
    const failure = [verification.status, verification.stderr, verification.stdout].filter(Boolean).join("\n");
    solution = await repairSolution(problem, language, solution, failure || "Verification failed without details.");
    verification = await verifySolution(solution);
  }

  await saveSolution(userId, problem, solution, verification).catch((error) => {
    console.warn("Solution generated but database save failed:", error);
  });

  return { problem, solution, verification };
}
