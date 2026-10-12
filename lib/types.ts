export type DailyProblem = {
  date: string;
  link: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  questionId?: string;
  content?: string;
  codeSnippets?: Array<{ lang: string; langSlug: string; code: string }>;
};

export type GeneratedSolution = {
  language: string;
  code: string;
  explanation: string;
  timeComplexity: string;
  spaceComplexity: string;
};

export type VerificationResult = {
  configured: boolean;
  passed: boolean;
  status: string;
  stdout?: string;
  stderr?: string;
};

export type LeetCodeCredentials = {
  session: string;
  csrfToken: string;
};

export type LeetCodeSubmissionResult = {
  submissionId: string;
  accepted: boolean;
  state: string;
  statusCode?: number;
  statusMessage: string;
  runtime?: string;
  memory?: string;
  lastTestcase?: string;
  expectedOutput?: string;
  codeOutput?: string;
  totalCorrect?: number;
  totalTestcases?: number;
};
