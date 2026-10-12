import { z } from "zod";
import type { DailyProblem, GeneratedSolution } from "./types";

const solutionSchema = z.object({
  language: z.string(),
  code: z.string().min(1),
  explanation: z.string().min(1),
  timeComplexity: z.string().min(1),
  spaceComplexity: z.string().min(1),
});

function stripFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function groqJson(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a competitive-programming assistant. Return valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${body.slice(0, 240)}`);
  }
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

export async function generateSolution(problem: DailyProblem, language: string): Promise<GeneratedSolution> {
  const preferredSnippet = problem.codeSnippets?.find(
    (snippet) => snippet.langSlug.toLowerCase() === language.toLowerCase() || snippet.lang.toLowerCase() === language.toLowerCase(),
  );

  const prompt = `Problem:\nTitle: ${problem.title}\nDifficulty: ${problem.difficulty}\nURL: ${problem.link}\n\nStatement:\n${problem.content || "Problem statement unavailable. Use the exact known problem identified by title/slug."}\n\nRequired starter/signature when available:\n${preferredSnippet?.code || "Use the standard LeetCode signature for this problem."}\n\nGenerate a high-quality ${language} solution for this exact problem. Respect the required signature, constraints, and edge cases. Return JSON only with keys: language, code, explanation, timeComplexity, spaceComplexity. Do not claim it was accepted.`;

  const parsed = solutionSchema.parse(JSON.parse(stripFences(await groqJson(prompt))));
  return { ...parsed, language };
}

export async function repairSolution(
  problem: DailyProblem,
  language: string,
  previous: GeneratedSolution,
  failure: string,
): Promise<GeneratedSolution> {
  const prompt = `Fix this ${language} solution for the problem ${problem.title}.\n\nProblem statement:\n${problem.content || problem.titleSlug}\n\nPrevious code:\n${previous.code}\n\nVerification/compile failure:\n${failure}\n\nReturn JSON only with keys: language, code, explanation, timeComplexity, spaceComplexity. Preserve the exact LeetCode function/class signature.`;
  const parsed = solutionSchema.parse(JSON.parse(stripFences(await groqJson(prompt))));
  return { ...parsed, language };
}
