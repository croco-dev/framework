import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  normalizeOpenAiError,
  OpenAiAbortProblem,
  OpenAiAuthenticationProblem,
  OpenAiRateLimitProblem,
  OpenAiRetryableUpstreamProblem,
  OpenAiTerminalUpstreamProblem,
  OpenAiValidationProblem,
} from "../libs/problems/OpenAiProblems";

describe("OpenAI Problem normalization", () => {
  it.each([
    [
      "auth",
      { status: 401, request_id: "req-auth" },
      OpenAiAuthenticationProblem,
      ProblemCategory.Unauthorized,
    ],
    [
      "rate limit",
      {
        status: 429,
        headers: new Headers({ "retry-after": "30" }),
      },
      OpenAiRateLimitProblem,
      ProblemCategory.TooManyRequests,
    ],
    ["validation", { status: 422 }, OpenAiValidationProblem, ProblemCategory.BadRequest],
    [
      "retryable",
      { status: 503 },
      OpenAiRetryableUpstreamProblem,
      ProblemCategory.InternalServerError,
    ],
    [
      "terminal",
      { status: 404 },
      OpenAiTerminalUpstreamProblem,
      ProblemCategory.InternalServerError,
    ],
    ["abort", { name: "AbortError" }, OpenAiAbortProblem, ProblemCategory.BadRequest],
  ])(
    "maps %s errors to a deterministic Croco Problem",
    (_label, error, expectedClass, category) => {
      const problem = normalizeOpenAiError(error, "generate");

      expect(problem).toBeInstanceOf(expectedClass);
      expect(problem.category).toBe(category);
      expect(problem.extensions).toMatchObject({
        provider: "openai",
        operation: "generate",
      });
    },
  );
});
