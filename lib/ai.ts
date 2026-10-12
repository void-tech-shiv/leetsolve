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

export async function generateSolution(problem: DailyProblem, language: string): Promise<GeneratedSolution> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const preferredSnippet = problem.codeSnippets?.find(
    (snippet) => snippet.langSlug.toLowerCase() === language.toLowerCase() || snippet.lang.toLowerCase() === language.toLowerCase(),
  );

  const prompt = `You are a competitive-programming assistant.

Problem:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
URL: ${problem.link}

Statement:
${problem.content || "Problem statement unavailable. Use the exact known problem identified by title/slug."}

Required starter/signature when available:
${preferredSnippet?.code || "Use the standard LeetCode signature for this problem."}

Generate a high-quality ${language} solution for this exact problem. Respect the required signature, constraints, and edge cases. Return JSON only with these keys: language, code, explanation, timeComplexity, spaceComplexity. Do not wrap JSON in markdown. Do not claim it was accepted. Keep explanation concise.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned an empty solution.");

  const parsed = solutionSchema.parse(JSON.parse(stripFences(text)));
  return { ...parsed, language };
}

export async function repairSolution(
  problem: DailyProblem,
  language: string,
  previous: GeneratedSolution,
  failure: string,
): Promise<GeneratedSolution> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `Fix this ${language} solution for the problem ${problem.title}.

Problem statement:
${problem.content || problem.titleSlug}

Previous code:
${previous.code}

Verification/compile failure:
${failure}

Return JSON only with keys: language, code, explanation, timeComplexity, spaceComplexity. Preserve the exact LeetCode function/class signature.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini repair request failed: HTTP ${response.status}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned an empty repaired solution.");
  const parsed = solutionSchema.parse(JSON.parse(stripFences(text)));
  return { ...parsed, language };
}
