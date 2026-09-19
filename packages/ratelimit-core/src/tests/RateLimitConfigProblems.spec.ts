import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  RateLimitKeyBuilderProblem,
  RateLimitWindowProblem,
} from "../libs/problems/RateLimitConfigProblems";

const serializedDetailCases = [
  {
    name: "RateLimitKeyBuilderProblem",
    problem: new RateLimitKeyBuilderProblem("Custom key builder detail"),
    code: "RATE_LIMIT_KEY_BUILDER_ERROR",
    category: ProblemCategory.InternalServerError,
    detail: "Custom key builder detail",
  },
  {
    name: "RateLimitWindowProblem",
    problem: new RateLimitWindowProblem("Custom window detail"),
    code: "RATE_LIMIT_WINDOW_ERROR",
    category: ProblemCategory.BadRequest,
    detail: "Custom window detail",
  },
] as const;

describe("RateLimitConfigProblems", () => {
  it.each(serializedDetailCases)(
    "serializes the detail for $name",
    ({ problem, code, category, detail }) => {
      expect(problem.category).toBe(category);
      expect(problem.toJSON()).toMatchObject({ code, detail });
    },
  );
});
