import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  LlmCostLimitExceededProblem,
  LlmMeteringRecordFailedProblem,
  LlmQuotaExceededProblem,
  PricingNotFoundProblem,
} from "../libs/problems/LlmMeteringProblems";

describe("LlmMeteringProblems", () => {
  describe("LlmQuotaExceededProblem", () => {
    it("should create problem with quota exceeded details", () => {
      const problem = new LlmQuotaExceededProblem("llm.prompt_tokens", 15000, 10000);

      expect(problem.code).toBe("llm-metering/quota-exceeded");
      expect(problem.category).toBe(ProblemCategory.Forbidden);
      expect(problem.status).toBe(403);
      expect(problem.detail).toContain("llm.prompt_tokens");
      expect(problem.detail).toContain("15000");
      expect(problem.detail).toContain("10000");
      expect(problem.extensions?.meterId).toBe("llm.prompt_tokens");
      expect(problem.extensions?.currentUsage).toBe(15000);
      expect(problem.extensions?.quota).toBe(10000);
    });
  });

  describe("LlmCostLimitExceededProblem", () => {
    it("should create problem for daily limit exceeded", () => {
      const problem = new LlmCostLimitExceededProblem("tenant-123", 15.5, 10.0, "daily");

      expect(problem.code).toBe("llm-metering/cost-limit-exceeded");
      expect(problem.category).toBe(ProblemCategory.Forbidden);
      expect(problem.status).toBe(403);
      expect(problem.detail).toContain("tenant-123");
      expect(problem.detail).toContain("$15.50");
      expect(problem.detail).toContain("$10.00");
      expect(problem.detail).toContain("daily");
      expect(problem.extensions?.tenantId).toBe("tenant-123");
      expect(problem.extensions?.currentCost).toBe(15.5);
      expect(problem.extensions?.limit).toBe(10.0);
      expect(problem.extensions?.period).toBe("daily");
    });

    it("should create problem for monthly limit exceeded", () => {
      const problem = new LlmCostLimitExceededProblem("tenant-123", 150.0, 100.0, "monthly");

      expect(problem.code).toBe("llm-metering/cost-limit-exceeded");
      expect(problem.detail).toContain("$150.00");
      expect(problem.detail).toContain("$100.00");
      expect(problem.detail).toContain("monthly");
      expect(problem.extensions?.period).toBe("monthly");
    });
  });

  describe("PricingNotFoundProblem", () => {
    it("should create problem with not found category", () => {
      const problem = new PricingNotFoundProblem("openai", "gpt-4");

      expect(problem.code).toBe("llm-metering/pricing-not-found");
      expect(problem.category).toBe(ProblemCategory.NotFound);
      expect(problem.status).toBe(404);
      expect(problem.detail).toContain("provider 'openai'");
      expect(problem.detail).toContain("model 'gpt-4'");
    });
  });

  describe("LlmMeteringRecordFailedProblem", () => {
    it("should expose failed operation and meter ids", () => {
      const problem = new LlmMeteringRecordFailedProblem(
        "generate",
        ["llm.prompt_tokens", "llm.cost_usd_nanos"],
        new Error("boom"),
      );

      expect(problem.code).toBe("llm-metering/record-failed");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.status).toBe(500);
      expect(problem.detail).toContain("operation 'generate'");
      expect(problem.extensions?.operation).toBe("generate");
      expect(problem.extensions?.meterIds).toEqual(["llm.prompt_tokens", "llm.cost_usd_nanos"]);
      expect(problem.cause).toBeInstanceOf(Error);
      expect((problem.cause as Error).message).toBe("boom");
    });
  });
});
