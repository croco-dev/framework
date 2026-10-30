import { beforeEach, describe, expect, it } from "vitest";
import type { PlanProvider } from "../libs/interfaces/PlanProvider";
import { MrrCalculator } from "../libs/MrrCalculator";
import {
  MixedCurrencyMRRProblem,
  SubscriptionPricingUnavailableProblem,
} from "../libs/problems/MetricsProblems";
import type { PlanSnapshot, SubscriptionSnapshot } from "../types";

describe("MrrCalculator", () => {
  let calculator!: MrrCalculator;
  let mockPlanProvider!: PlanProvider;

  beforeEach(() => {
    calculator = new MrrCalculator();

    mockPlanProvider = {
      getPlanVersion: async (planId: string) => {
        const plans: Record<string, PlanSnapshot> = {
          plan_monthly_10: {
            id: "plan_monthly_10",
            amount: 1000,
            currency: "USD",
            interval: "month",
            intervalCount: 1,
          },
          plan_monthly_20: {
            id: "plan_monthly_20",
            amount: 2000,
            currency: "USD",
            interval: "month",
            intervalCount: 1,
          },
          plan_yearly_120: {
            id: "plan_yearly_120",
            amount: 12000,
            currency: "USD",
            interval: "year",
            intervalCount: 1,
          },
          plan_monthly_5: {
            id: "plan_monthly_5",
            amount: 500,
            currency: "USD",
            interval: "month",
            intervalCount: 1,
          },
          plan_monthly_krw: {
            id: "plan_monthly_krw",
            amount: 15000,
            currency: "KRW",
            interval: "month",
            intervalCount: 1,
          },
        };
        return plans[planId] ?? null;
      },
    };
  });

  describe("Fixture A: 신규 구독 3개 → New MRR 계산", () => {
    it("should calculate total MRR from 3 new monthly subscriptions", async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: "sub_1",
          planId: "plan_monthly_10",
          pricingRef: "plan_monthly_10",
        },
        {
          id: "sub_2",
          planId: "plan_monthly_20",
          pricingRef: "plan_monthly_20",
        },
        {
          id: "sub_3",
          planId: "plan_monthly_10",
          pricingRef: "plan_monthly_10",
        },
      ];

      const result = await calculator.calculateMRR(subscriptions, mockPlanProvider);

      expect(result).toEqual({
        amount: 4000,
        currency: "USD",
      });
    });
  });

  describe("Fixture B: 업그레이드 1개 → Expansion MRR", () => {
    it("should classify upgrade from $10 to $20 as expansion", () => {
      const result = calculator.classifyMRRMovement(true, false, 1000, 2000);

      expect(result).toBe("expansion");
    });
  });

  describe("Fixture C: 다운그레이드 1개 → Contraction MRR", () => {
    it("should classify downgrade from $20 to $5 as contraction", () => {
      const result = calculator.classifyMRRMovement(true, false, 2000, 500);

      expect(result).toBe("contraction");
    });
  });

  describe("Fixture D: 해지 1개 → Churned MRR", () => {
    it("should classify first subscription as new business", () => {
      const result = calculator.classifyMRRMovement(false, false, null, 1000);

      expect(result).toBe("new");
    });

    it("should classify reactivation after churn correctly", () => {
      const result = calculator.classifyMRRMovement(true, true, 1000, 1000);

      expect(result).toBe("reactivation");
    });
  });

  describe("Fixture E: 재구독 1개 → Reactivation MRR", () => {
    it("should classify returning customer as reactivation", () => {
      const wasChurned = true;
      const hasPreviousSubscription = true;

      const result = calculator.classifyMRRMovement(
        hasPreviousSubscription,
        wasChurned,
        1000,
        2000,
      );

      expect(result).toBe("reactivation");
    });
  });

  describe("normalizeMRR", () => {
    it("should keep monthly plans as-is", () => {
      const result = calculator.normalizeMRR(1000, "month", 1);
      expect(result).toBe(1000);
    });

    it("should normalize yearly plans to monthly", () => {
      const result = calculator.normalizeMRR(12000, "year", 1);
      expect(result).toBe(1000);
    });

    it("should handle intervalCount correctly for monthly", () => {
      const result = calculator.normalizeMRR(3000, "month", 3);
      expect(result).toBe(1000);
    });

    it("should handle intervalCount correctly for yearly", () => {
      const result = calculator.normalizeMRR(24000, "year", 2);
      expect(result).toBe(1000);
    });

    it("should round fractional monthly amounts to whole minor units", () => {
      expect(calculator.normalizeMRR(19900, "year", 1)).toBe(1658);
      expect(calculator.normalizeMRR(29000, "year", 1)).toBe(2417);
      expect(calculator.normalizeMRR(10000, "month", 3)).toBe(3333);
      expect(calculator.normalizeMRR(6, "year", 1)).toBe(1);
      expect(calculator.normalizeMRR(-6, "year", 1)).toBe(-1);
      expect(calculator.normalizeMRR(Number.MAX_SAFE_INTEGER, "month", 3)).toBe(3002399751580330);
    });

    it("should sum individually rounded subscription amounts", async () => {
      const annualPlanProvider: PlanProvider = {
        getPlanVersion: async () => ({
          id: "plan_yearly_199",
          amount: 19900,
          currency: "USD",
          interval: "year",
          intervalCount: 1,
        }),
      };

      await expect(
        calculator.calculateMRR(
          [
            { id: "sub-1", planId: "plan_yearly_199", pricingRef: "plan_yearly_199" },
            { id: "sub-2", planId: "plan_yearly_199", pricingRef: "plan_yearly_199" },
          ],
          annualPlanProvider,
        ),
      ).resolves.toEqual({ amount: 3316, currency: "USD" });
    });
  });

  describe("Golden Fixture: MRR 계산 시나리오 종합 테스트", () => {
    it("should calculate MRR correctly with mixed monthly and yearly plans", async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: "sub_1",
          planId: "plan_monthly_10",
          pricingRef: "plan_monthly_10",
        },
        {
          id: "sub_2",
          planId: "plan_yearly_120",
          pricingRef: "plan_yearly_120",
        },
        {
          id: "sub_3",
          planId: "plan_monthly_20",
          pricingRef: "plan_monthly_20",
        },
      ];

      const result = await calculator.calculateMRR(subscriptions, mockPlanProvider);

      expect(result).toEqual({
        amount: 4000,
        currency: "USD",
      });
    });
  });

  describe("exact total minor units", () => {
    const limit = Number.MAX_SAFE_INTEGER;

    async function calculate(amounts: readonly number[]) {
      const subscriptions = amounts.map((_amount, index) => ({
        id: `sub-${index}`,
        planId: String(index),
        pricingRef: String(index),
      }));
      const provider: PlanProvider = {
        getPlanVersion: async (ref) => ({
          id: ref,
          amount: amounts[Number(ref)],
          currency: "EUR",
          interval: "month",
          intervalCount: 1,
        }),
      };
      return calculator.calculateMRR(subscriptions, provider);
    }

    it.each([
      [[limit - 7, 5, 2], limit],
      [[-limit + 7, -5, -2], -limit],
      [[limit, 2, -limit], 2],
      [[limit, -limit, 2], 2],
      [[2, limit, -limit], 2],
      [[2, -limit, limit], 2],
      [[-limit, limit, 2], 2],
      [[-limit, 2, limit], 2],
    ] as const)("returns exact safe total for %j", async (amounts, expected) => {
      await expect(calculate(amounts)).resolves.toEqual({
        amount: expected,
        currency: "EUR",
      });
    });

    it.each([
      [[limit, 1], "9007199254740992"],
      [[1, limit], "9007199254740992"],
      [[limit, limit, limit], "27021597764222973"],
      [[-limit, -1], "-9007199254740992"],
      [[-1, -limit], "-9007199254740992"],
      [[-limit, -limit, -limit], "-27021597764222973"],
    ] as const)("rejects unrepresentable total for %j", async (amounts, expected) => {
      await expect(calculate(amounts)).rejects.toMatchObject({
        code: "metrics-core/mrr-total-overflow",
        detail: expect.stringContaining(expected),
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty subscriptions list", async () => {
      const result = await calculator.calculateMRR([], mockPlanProvider);
      expect(result).toEqual({
        amount: 0,
        currency: "USD",
      });
    });

    it.each([false, true])(
      "should reject unavailable pricing with a valid preceding plan: %s",
      async (includeValid) => {
        const subscriptions: SubscriptionSnapshot[] = [
          ...(includeValid
            ? [{ id: "sub_valid", planId: "plan_monthly_10", pricingRef: "plan_monthly_10" }]
            : []),
          { id: "sub_1", planId: "unknown_plan", pricingRef: "unknown_plan" },
        ];

        await expect(
          calculator.calculateMRR(subscriptions, mockPlanProvider),
        ).rejects.toBeInstanceOf(SubscriptionPricingUnavailableProblem);
      },
    );

    it("should retain the currency of an existing free plan", async () => {
      const provider: PlanProvider = {
        getPlanVersion: async () => ({
          id: "free",
          amount: 0,
          currency: "EUR",
          interval: "month",
          intervalCount: 1,
        }),
      };
      await expect(
        calculator.calculateMRR(
          [{ id: "sub_free", planId: "free", pricingRef: "free@v1" }],
          provider,
        ),
      ).resolves.toEqual({ amount: 0, currency: "EUR" });
    });

    it.each([undefined, "", "   "])(
      "should reject a missing pricing reference (%s)",
      async (pricingRef) => {
        const subscription = {
          id: "sub-1",
          planId: "plan_monthly_10",
          pricingRef,
        } as SubscriptionSnapshot;
        await expect(
          calculator.calculateMRR([subscription], mockPlanProvider),
        ).rejects.toBeInstanceOf(SubscriptionPricingUnavailableProblem);
      },
    );

    it("should reject pinned pricing from another plan family", async () => {
      await expect(
        calculator.calculateMRR(
          [{ id: "sub-1", planId: "plan_monthly_10", pricingRef: "plan_monthly_20" }],
          mockPlanProvider,
        ),
      ).rejects.toBeInstanceOf(SubscriptionPricingUnavailableProblem);
    });

    it("should classify equal amounts as unchanged", () => {
      const result = calculator.classifyMRRMovement(true, false, 1000, 1000);

      expect(result).toBe("unchanged");
    });

    it("should handle null previous amount as new", () => {
      const result = calculator.classifyMRRMovement(true, false, null, 1000);

      expect(result).toBe("new");
    });

    it("should fail fast when subscriptions contain mixed currencies", async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: "sub_usd",
          planId: "plan_monthly_10",
          pricingRef: "plan_monthly_10",
        },
        {
          id: "sub_krw",
          planId: "plan_monthly_krw",
          pricingRef: "plan_monthly_krw",
        },
      ];

      await expect(calculator.calculateMRR(subscriptions, mockPlanProvider)).rejects.toBeInstanceOf(
        MixedCurrencyMRRProblem,
      );
      await expect(calculator.calculateMRR(subscriptions, mockPlanProvider)).rejects.toThrow(
        "Cannot aggregate MRR across multiple currencies: expected 'USD' but received 'KRW'",
      );
    });
  });
});
