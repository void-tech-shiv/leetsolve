import type { GeneratedSolution, VerificationResult } from "./types";

const languageIds: Record<string, number> = {
  java: 62,
  python: 71,
  python3: 71,
  cpp: 54,
  "c++": 54,
  javascript: 63,
  typescript: 74,
};

export async function verifySolution(solution: GeneratedSolution): Promise<VerificationResult> {
  const baseUrl = process.env.JUDGE0_URL;
  if (!baseUrl) {
    return { configured: false, passed: false, status: "verification-skipped" };
  }

  const languageId = languageIds[solution.language.toLowerCase()] ?? languageIds[(process.env.DEFAULT_LANGUAGE || "java").toLowerCase()];
  if (!languageId) return { configured: true, passed: false, status: "unsupported-language" };

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.JUDGE0_API_KEY) headers["X-RapidAPI-Key"] = process.env.JUDGE0_API_KEY;
  if (process.env.JUDGE0_API_HOST) headers["X-RapidAPI-Host"] = process.env.JUDGE0_API_HOST;

  const normalizedLanguage = solution.language.toLowerCase();
  let sourceCode = solution.code;
  if (normalizedLanguage === "java" && !/static\s+void\s+main\s*\(/.test(sourceCode)) {
    sourceCode += "\n\nclass Main { public static void main(String[] args) {} }\n";
  } else if ((normalizedLanguage === "cpp" || normalizedLanguage === "c++") && !/\bmain\s*\(/.test(sourceCode)) {
    sourceCode += "\n\nint main() { return 0; }\n";
  }

  const create = await fetch(`${baseUrl.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({ language_id: languageId, source_code: sourceCode }),
  });

  if (!create.ok) {
    return { configured: true, passed: false, status: `judge-http-${create.status}`, stderr: await create.text() };
  }

  const result = await create.json();
  const status = result?.status?.description || "unknown";
  return {
    configured: true,
    passed: status === "Accepted",
    status,
    stdout: result?.stdout || undefined,
    stderr: result?.stderr || result?.compile_output || undefined,
  };
}
