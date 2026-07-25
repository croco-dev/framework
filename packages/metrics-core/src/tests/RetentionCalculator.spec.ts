import { beforeEach, describe, expect, it } from "vitest";
import { InvalidRetentionMovementProblem } from "../libs/problems/MetricsProblems";
import { RetentionCalculator } from "../libs/RetentionCalculator";
import type { MRRMovement } from "../types";

describe("RetentionCalculator", () => {
  let calculator!: RetentionCalculator;

  beforeEach(() => {
    calculator = new RetentionCalculator();
  });

  const createMovement = (overrides?: Partial<MRRMovement>): MRRMovement => ({
    new: { amount: 10000, currency: "USD" },
    expansion: { amount: 5000, currency: "USD" },
    contraction: { amount: 2000, currency: "USD" },
    churned: { amount: 3000, currency: "USD" },
    reactivation: { amount: 1000, currency: "USD" },
    net: { amount: 11000, currency: "USD" },
    ...overrides,
  });

  describe("Fixture A: 안정적인 SaaS - GRR 95%, NRR 115%", () => {
    it("should calculate GRR as 95% for stable SaaS", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(95);
    });

    it("should calculate NRR as 115% for stable SaaS", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(103);
    });

    it("should calculate revenue churn as 3%", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        churned: { amount: 3000, currency: "USD" },
      });

      const result = await calculator.calculateChurn(startingMRR, movement, "revenue");

      expect(result).toBe(3);
    });
  });

  describe("Fixture B: 고성장 SaaS - GRR 92%, NRR 130%", () => {
    it("should calculate GRR as 92% for high-growth SaaS", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 25000, currency: "USD" },
        expansion: { amount: 15000, currency: "USD" },
        contraction: { amount: 3000, currency: "USD" },
        churned: { amount: 5000, currency: "USD" },
        reactivation: { amount: 2000, currency: "USD" },
        net: { amount: 34000, currency: "USD" },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(92);
    });

    it("should calculate NRR as 107% for high-growth SaaS", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 25000, currency: "USD" },
        expansion: { amount: 15000, currency: "USD" },
        contraction: { amount: 3000, currency: "USD" },
        churned: { amount: 5000, currency: "USD" },
        reactivation: { amount: 2000, currency: "USD" },
        net: { amount: 34000, currency: "USD" },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(107);
    });
  });

  describe("Fixture C: 위험한 SaaS - GRR 80%, NRR 85%", () => {
    it("should calculate GRR as 80% for at-risk SaaS", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: "USD" },
        expansion: { amount: 3000, currency: "USD" },
        contraction: { amount: 5000, currency: "USD" },
        churned: { amount: 15000, currency: "USD" },
        reactivation: { amount: 500, currency: "USD" },
        net: { amount: -11500, currency: "USD" },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(80);
    });

    it("should calculate NRR as 83% for at-risk SaaS", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: "USD" },
        expansion: { amount: 3000, currency: "USD" },
        contraction: { amount: 5000, currency: "USD" },
        churned: { amount: 15000, currency: "USD" },
        reactivation: { amount: 500, currency: "USD" },
        net: { amount: -11500, currency: "USD" },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(83);
    });
  });

  describe("Fixture D: 완벽한 보존 - GRR 100%, NRR 100%", () => {
    it("should calculate GRR as 100% when no churn or contraction", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 10000, currency: "USD" },
        expansion: { amount: 5000, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 0, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: 15000, currency: "USD" },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(100);
    });

    it("should calculate NRR as 105% with expansion only", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 10000, currency: "USD" },
        expansion: { amount: 5000, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 0, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: 15000, currency: "USD" },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(105);
    });
  });

  describe("Fixture E: 대규모 해지 - GRR 70%, NRR 75%", () => {
    it("should calculate GRR as 70% for massive churn", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: "USD" },
        expansion: { amount: 2000, currency: "USD" },
        contraction: { amount: 8000, currency: "USD" },
        churned: { amount: 22000, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: -23000, currency: "USD" },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(70);
    });

    it("should calculate NRR as 72% for massive churn", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 5000, currency: "USD" },
        expansion: { amount: 2000, currency: "USD" },
        contraction: { amount: 8000, currency: "USD" },
        churned: { amount: 22000, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: -23000, currency: "USD" },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(72);
    });
  });

  describe("calculateRetention: 모든 메트릭 한 번에 계산", () => {
    it("should return partial retention metrics when logo churn data is unavailable", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      });

      await expect(calculator.calculateRetention(startingMRR, movement)).resolves.toEqual({
        grr: 95,
        nrr: 103,
        logoChurn: null,
        revenueChurn: 3,
      });
    });

    it("should calculate logo churn when customer counts are provided", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      });

      const result = await calculator.calculateRetention(startingMRR, movement, 100, 95);

      expect(result.grr).toBe(95);
      expect(result.nrr).toBe(103);
      expect(result.logoChurn).toBe(5);
      expect(result.revenueChurn).toBe(3);
    });

    it("should return 0 logo churn when no customers churned", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      });

      const result = await calculator.calculateRetention(startingMRR, movement, 100, 100);

      expect(result.logoChurn).toBe(0);
    });

    it("should return null logo churn when starting customers is 0", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      });

      const result = await calculator.calculateRetention(startingMRR, movement, 0, 0);

      expect(result.logoChurn).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should return null for zero starting MRR", async () => {
      const startingMRR = 0;
      const movement = createMovement();

      const grr = await calculator.calculateGRR(startingMRR, movement);
      const nrr = await calculator.calculateNRR(startingMRR, movement);
      const churn = await calculator.calculateChurn(startingMRR, movement, "revenue");

      expect(grr).toBeNull();
      expect(nrr).toBeNull();
      expect(churn).toBeNull();
    });

    it("should cap GRR at 100% maximum", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 50000, currency: "USD" },
        expansion: { amount: 20000, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 0, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: 70000, currency: "USD" },
      });

      const result = await calculator.calculateGRR(startingMRR, movement);

      expect(result).toBe(100);
    });

    it("should calculate 0% GRR when losses equal starting MRR", async () => {
      const movement = createMovement({
        contraction: { amount: 20000, currency: "USD" },
        churned: { amount: 80000, currency: "USD" },
      });

      await expect(calculator.calculateGRR(100000, movement)).resolves.toBe(0);
    });

    it("should allow NRR to exceed 100%", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 50000, currency: "USD" },
        expansion: { amount: 20000, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 0, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: 70000, currency: "USD" },
      });

      const result = await calculator.calculateNRR(startingMRR, movement);

      expect(result).toBe(120);
    });

    it("should clamp GRR to 0 when losses exceed starting MRR", async () => {
      const startingMRR = 100000;
      const movement = createMovement({
        new: { amount: 1000, currency: "USD" },
        expansion: { amount: 0, currency: "USD" },
        contraction: { amount: 10000, currency: "USD" },
        churned: { amount: 95000, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: -104000, currency: "USD" },
      });

      const grr = await calculator.calculateGRR(startingMRR, movement);
      const nrr = await calculator.calculateNRR(startingMRR, movement);
      expect(grr).toBe(0);

      expect(nrr).toBe(-5);
    });

    it.each([
      ["churned", -1],
      ["churned", Number.NaN],
      ["churned", Number.POSITIVE_INFINITY],
      ["churned", Number.NEGATIVE_INFINITY],
      ["contraction", -1],
      ["contraction", Number.NaN],
      ["contraction", Number.POSITIVE_INFINITY],
      ["contraction", Number.NEGATIVE_INFINITY],
    ] as const)("should reject invalid %s loss amount %s", async (field, amount) => {
      const movement = createMovement({
        [field]: { amount, currency: "USD" },
      });

      await expect(calculator.calculateGRR(100000, movement)).rejects.toThrow(
        InvalidRetentionMovementProblem,
      );
    });

    it("should validate movement losses even when starting MRR is zero", async () => {
      const movement = createMovement({
        churned: { amount: Number.NaN, currency: "USD" },
      });

      await expect(calculator.calculateGRR(0, movement)).rejects.toThrow(
        InvalidRetentionMovementProblem,
      );
    });

    it("should propagate invalid GRR movement through calculateRetention", async () => {
      const movement = createMovement({
        contraction: { amount: -1, currency: "USD" },
      });

      await expect(calculator.calculateRetention(100000, movement)).rejects.toThrow(
        InvalidRetentionMovementProblem,
      );
    });

    it("should clamp over-loss GRR through calculateRetention", async () => {
      const movement = createMovement({
        contraction: { amount: 30000, currency: "USD" },
        churned: { amount: 80000, currency: "USD" },
      });

      await expect(calculator.calculateRetention(100000, movement)).resolves.toMatchObject({
        grr: 0,
      });
    });
  });

  describe("Golden Fixture: 종합 시나리오", () => {
    it("should return partial retention results for complex scenario", async () => {
      const startingMRR = 50000;
      const movement = createMovement({
        new: { amount: 10000, currency: "USD" },
        expansion: { amount: 7500, currency: "USD" },
        contraction: { amount: 2500, currency: "USD" },
        churned: { amount: 5000, currency: "USD" },
        reactivation: { amount: 1500, currency: "USD" },
        net: { amount: 11500, currency: "USD" },
      });

      await expect(calculator.calculateRetention(startingMRR, movement)).resolves.toEqual({
        grr: 85,
        nrr: 100,
        logoChurn: null,
        revenueChurn: 10,
      });
    });

    it("should return full retention results with logo churn when customer counts provided", async () => {
      const startingMRR = 50000;
      const movement = createMovement({
        new: { amount: 10000, currency: "USD" },
        expansion: { amount: 7500, currency: "USD" },
        contraction: { amount: 2500, currency: "USD" },
        churned: { amount: 5000, currency: "USD" },
        reactivation: { amount: 1500, currency: "USD" },
        net: { amount: 11500, currency: "USD" },
      });

      const result = await calculator.calculateRetention(startingMRR, movement, 50, 45);

      expect(result.grr).toBe(85);
      expect(result.nrr).toBe(100);
      expect(result.logoChurn).toBe(10);
      expect(result.revenueChurn).toBe(10);
    });
  });
});
