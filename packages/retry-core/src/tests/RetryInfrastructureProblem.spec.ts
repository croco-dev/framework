import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  CircuitBreakerLockProblem,
  CircuitBreakerStateProblem,
} from "../libs/errors/RetryInfrastructureProblem";

const serializedDetailCases = [
  {
    name: "CircuitBreakerStateProblem",
    problem: new CircuitBreakerStateProblem("Custom state detail"),
    code: "RETRY_CIRCUIT_BREAKER_INVALID_STATE",
    category: ProblemCategory.InternalServerError,
    detail: "Custom state detail",
  },
  {
    name: "CircuitBreakerLockProblem",
    problem: new CircuitBreakerLockProblem("Custom lock detail"),
    code: "RETRY_CIRCUIT_BREAKER_LOCK_FAILED",
    category: ProblemCategory.InternalServerError,
    detail: "Custom lock detail",
  },
] as const;

describe("RetryInfrastructureProblem", () => {
  it.each(serializedDetailCases)(
    "serializes the detail for $name",
    ({ problem, code, category, detail }) => {
      expect(problem.category).toBe(category);
      expect(problem.toJSON()).toMatchObject({ code, detail });
    },
  );
});
