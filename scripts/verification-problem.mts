export type VerificationProblemCategory = "configuration" | "contract" | "input";

export class VerificationProblem extends Error {
  readonly category: VerificationProblemCategory;
  readonly code: string;
  readonly status = 400;
  readonly type = "https://croco.dev/problems/verification";

  constructor(code: string, category: VerificationProblemCategory, message: string) {
    super(message);
    this.name = "VerificationProblem";
    this.code = code;
    this.category = category;
  }
}

export function formatVerificationProblem(error: unknown): string {
  if (error instanceof VerificationProblem) {
    return `[${error.code}/${error.category}] ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
