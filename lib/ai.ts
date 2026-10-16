import type { DailyProblem, GeneratedSolution } from "./types";

function cleanGeneratedCode(value: string) {
  const text = value.trim();
  if (!text) throw new Error("Groq returned an empty solution.");

  // Prefer the contents of a Markdown code fence if the model added one
  // despite the instruction to return source code only.
  const fenced = text.match(/```(?:[a-zA-Z0-9_+#.-]+)?\s*\n([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  return text;
}

async function groqCode(prompt: string, apiKey: string) {
  if (!apiKey) throw new Error("Your Groq API key is required.");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are a competitive-programming expert. Return ONLY the complete source code that should be submitted to LeetCode. Do not return JSON. Do not explain the answer. Do not use Markdown fences or any text before or after the code.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.ok) {
      const payload = await response.json();
      const text = payload?.choices?.[0]?.message?.content || "";
      if (text.trim()) return cleanGeneratedCode(text);

      lastError = "Groq returned an empty response.";
      if (attempt < 3) continue;
      throw new Error(lastError);
    }

    const body = await response.text();
    lastError = body;

    if (response.status === 401 || response.status === 403) {
      throw new Error("Your Groq API key was rejected. Update it in LeetSolve and try again.");
    }
    if (response.status === 429) {
      throw new Error("Your Groq account hit its rate limit. Wait or use another Groq API key.");
    }

    // Transient provider failures are safe to retry. We intentionally do not
    // use Groq JSON/structured-output mode here because code containing quotes,
    // backslashes and newlines can cause Groq's server-side JSON validator to
    // reject an otherwise usable generated solution with json_validate_failed.
    const retryable = response.status === 408 || response.status >= 500;
    if (retryable && attempt < 3) continue;

    throw new Error(`Groq request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  throw new Error(
    `Groq could not generate a solution after 3 attempts${lastError ? `: ${lastError.slice(0, 180)}` : "."}`,
  );
}

function buildSolution(language: string, code: string, problem: DailyProblem): GeneratedSolution {
  return {
    language,
    code,
    explanation: `AI-generated solution for ${problem.title}.`,
    timeComplexity: "See implementation",
    spaceComplexity: "See implementation",
  };
}

export async function generateSolution(
  problem: DailyProblem,
  language: string,
  apiKey: string,
): Promise<GeneratedSolution> {
  const preferredSnippet = problem.codeSnippets?.find(
    (snippet) =>
      snippet.langSlug.toLowerCase() === language.toLowerCase() ||
      snippet.lang.toLowerCase() === language.toLowerCase(),
  );

  const prompt = `Problem:\nTitle: ${problem.title}\nDifficulty: ${problem.difficulty}\nURL: ${problem.link}\n\nStatement:\n${problem.content || "Problem statement unavailable. Use the exact known problem identified by title/slug."}\n\nRequired starter/signature when available:\n${preferredSnippet?.code || "Use the standard LeetCode signature for this problem."}\n\nGenerate the complete ${language} solution for this exact LeetCode problem. Respect the exact required class/function signature, constraints, imports, and edge cases. Return source code only.`;

  const code = await groqCode(prompt, apiKey);
  return buildSolution(language, code, problem);
}

export async function repairSolution(
  problem: DailyProblem,
  language: string,
  previous: GeneratedSolution,
  failure: string,
  apiKey: string,
): Promise<GeneratedSolution> {
  const preferredSnippet = problem.codeSnippets?.find(
    (snippet) =>
      snippet.langSlug.toLowerCase() === language.toLowerCase() ||
      snippet.lang.toLowerCase() === language.toLowerCase(),
  );

  const prompt = `Fix the following ${language} LeetCode solution for ${problem.title}.\n\nProblem statement:\n${problem.content || problem.titleSlug}\n\nRequired starter/signature when available:\n${preferredSnippet?.code || "Preserve the exact LeetCode signature."}\n\nPrevious code:\n${previous.code}\n\nVerification/submission failure:\n${failure}\n\nReturn the complete corrected source code only. Preserve the exact LeetCode class/function signature.`;

  const code = await groqCode(prompt, apiKey);
  return buildSolution(language, code, problem);
}
