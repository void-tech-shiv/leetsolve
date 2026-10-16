import type { DailyProblem, GeneratedSolution } from "./types";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "llama-3.3-70b-versatile";

function cleanGeneratedCode(value: string) {
  const text = value.trim();
  if (!text) throw new Error("Groq returned an empty solution.");

  // Prefer the contents of a Markdown code fence if the model added one
  // despite the instruction to return source code only.
  const fenced = text.match(/```(?:[a-zA-Z0-9_+#.-]+)?\s*\n([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  return text;
}

function systemInstruction() {
  return "You are a competitive-programming expert. Return ONLY the complete source code that should be submitted to LeetCode. Do not return JSON. Do not explain the answer. Do not use Markdown fences or any text before or after the code.";
}

function extractResponsesText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return "";
}

function extractChatText(payload: any) {
  const text = payload?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}

function providerError(status: number, body: string) {
  if (status === 401 || status === 403) {
    return new Error("Your Groq API key was rejected. Update it in LeetSolve and try again.");
  }
  if (status === 429) {
    return new Error("Your Groq account hit its rate limit. Wait a moment and try again.");
  }
  return new Error(`Groq request failed (${status}): ${body.slice(0, 240)}`);
}

async function groqResponses(prompt: string, apiKey: string, model: string) {
  const response = await fetch("https://api.groq.com/openai/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: systemInstruction(),
      input: prompt,
      reasoning: { effort: "low" },
    }),
  });

  const body = await response.text();
  if (!response.ok) throw providerError(response.status, body);

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Groq returned an unreadable response.");
  }

  return extractResponsesText(payload);
}

async function groqChat(prompt: string, apiKey: string, model: string) {
  const isGptOss = model.startsWith("openai/gpt-oss-");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      ...(isGptOss
        ? {
            reasoning_effort: "low",
            reasoning_format: "hidden",
          }
        : {}),
      messages: [
        { role: "system", content: systemInstruction() },
        { role: "user", content: prompt },
      ],
    }),
  });

  const body = await response.text();
  if (!response.ok) throw providerError(response.status, body);

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Groq returned an unreadable response.");
  }

  return extractChatText(payload);
}

async function groqCode(prompt: string, apiKey: string) {
  if (!apiKey) throw new Error("Your Groq API key is required.");

  const configuredModel = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.GROQ_FALLBACK_MODEL || FALLBACK_MODEL;
  const attempts: Array<{ model: string; mode: "responses" | "chat" }> = [];

  if (configuredModel.startsWith("openai/gpt-oss-")) {
    // Groq's Responses API is the most reliable path for GPT-OSS final output.
    attempts.push({ model: configuredModel, mode: "responses" });
    // Keep Chat Completions as a secondary GPT-OSS path with reasoning hidden.
    attempts.push({ model: configuredModel, mode: "chat" });
  } else {
    attempts.push({ model: configuredModel, mode: "chat" });
  }

  if (!attempts.some((attempt) => attempt.model === fallbackModel)) {
    attempts.push({ model: fallbackModel, mode: "chat" });
  }

  let lastError = "";

  for (const attempt of attempts) {
    try {
      const text =
        attempt.mode === "responses"
          ? await groqResponses(prompt, apiKey, attempt.model)
          : await groqChat(prompt, apiKey, attempt.model);

      if (text.trim()) return cleanGeneratedCode(text);
      lastError = `${attempt.model} returned an empty response.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Bad/expired keys cannot be fixed by changing model or endpoint.
      if (message.includes("API key was rejected")) throw error;

      lastError = message;
    }
  }

  throw new Error(
    `Groq could not generate visible source code${lastError ? `: ${lastError.slice(0, 220)}` : "."}`,
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
