import { beforeEach, describe, expect, it } from "vitest";
import { HealthScoreCalculator } from "../libs/HealthScoreCalculator";
import type { HealthScoreProfile, HealthSignal } from "../libs/types";

describe("HealthScoreCalculator", () => {
  let calculator: HealthScoreCalculator;

  beforeEach(() => {
    calculator = new HealthScoreCalculator();
  });

  describe("calculate", () => {
    it("should calculate weighted average correctly", () => {
      const signals: HealthSignal[] = [
        {
          category: "usage",
          name: "daily_active_users",
          value: 80,
          weight: 0.3,
          rawValue: 80,
          collectedAt: new Date(),
        },
        {
          category: "usage",
          name: "feature_adoption",
          value: 60,
          weight: 0.7,
          rawValue: 60,
          collectedAt: new Date(),
        },
      ];

      const profile: HealthScoreProfile = {
        id: "default",
        name: "Default Profile",
        weights: { usage: 1, business: 0, engagement: 0 },
        thresholds: { healthy: 80, atRisk: 50 },
      };

      const result = calculator.calculate(signals, profile);

      expect(result.overallScore).toBe(66);
      expect(result.categoryScores.usage).toBe(66);
    });

    it("should return score 0 and critical status for empty signals", () => {
      const signals: HealthSignal[] = [];

      const profile: HealthScoreProfile = {
        id: "default",
        name: "Default Profile",
        weights: { usage: 1, business: 0, engagement: 0 },
        thresholds: { healthy: 80, atRisk: 50 },
      };

      const result = calculator.calculate(signals, profile);

      expect(result.overallScore).toBe(0);
      expect(result.status).toBe("critical");
      expect(result.categoryScores.usage).toBe(0);
      expect(result.categoryScores.business).toBe(0);
      expect(result.categoryScores.engagement).toBe(0);
    });

    it("should determine status based on thresholds - at_risk boundary", () => {
      const signals: HealthSignal[] = [
        {
          category: "usage",
          name: "daily_active_users",
          value: 79,
          weight: 1,
          rawValue: 79,
          collectedAt: new Date(),
        },
      ];

      const profile: HealthScoreProfile = {
        id: "default",
        name: "Default Profile",
        weights: { usage: 1, business: 0, engagement: 0 },
        thresholds: { healthy: 80, atRisk: 50 },
      };

      const result = calculator.calculate(signals, profile);

      expect(result.overallScore).toBe(79);
      expect(result.status).toBe("at_risk");
    });

    it("should determine status based on thresholds - healthy boundary", () => {
      const signals: HealthSignal[] = [
        {
          category: "usage",
          name: "daily_active_users",
          value: 80,
          weight: 1,
          rawValue: 80,
          collectedAt: new Date(),
        },
      ];

      const profile: HealthScoreProfile = {
        id: "default",
        name: "Default Profile",
        weights: { usage: 1, business: 0, engagement: 0 },
        thresholds: { healthy: 80, atRisk: 50 },
      };

      const result = calculator.calculate(signals, profile);

      expect(result.overallScore).toBe(80);
      expect(result.status).toBe("healthy");
    });

    it("should determine critical status for scores below atRisk threshold", () => {
      const signals: HealthSignal[] = [
        {
          category: "usage",
          name: "daily_active_users",
          value: 49,
          weight: 1,
          rawValue: 49,
          collectedAt: new Date(),
        },
      ];

      const profile: HealthScoreProfile = {
        id: "default",
        name: "Default Profile",
        weights: { usage: 1, business: 0, engagement: 0 },
        thresholds: { healthy: 80, atRisk: 50 },
      };

      const result = calculator.calculate(signals, profile);

      expect(result.overallScore).toBe(49);
      expect(result.status).toBe("critical");
    });

    it("should calculate overall score using category weights", () => {
      const signals: HealthSignal[] = [
        {
          category: "usage",
          name: "daily_active_users",
          value: 80,
          weight: 1,
          rawValue: 80,
          collectedAt: new Date(),
        },
        {
          category: "business",
          name: "mrr",
          value: 60,
          weight: 1,
          rawValue: 60,
          collectedAt: new Date(),
        },
        {
          category: "engagement",
          name: "session_duration",
          value: 40,
          weight: 1,
          rawValue: 40,
          collectedAt: new Date(),
        },
      ];

      const profile: HealthScoreProfile = {
        id: "default",
        name: "Default Profile",
        weights: { usage: 0.5, business: 0.3, engagement: 0.2 },
        thresholds: { healthy: 80, atRisk: 50 },
      };

      const result = calculator.calculate(signals, profile);

      expect(result.overallScore).toBe(66);
      expect(result.categoryScores.usage).toBe(80);
      expect(result.categoryScores.business).toBe(60);
      expect(result.categoryScores.engagement).toBe(40);
    });
  });

  describe("determineTrend", () => {
    it("should return stable when no previous score", () => {
      const trend = calculator.determineTrend(75);

      expect(trend).toBe("stable");
    });

    it("should return improving when diff >= 5", () => {
      const trend = calculator.determineTrend(75, 70);

      expect(trend).toBe("improving");
    });

    it("should return improving when diff > 5", () => {
      const trend = calculator.determineTrend(80, 70);

      expect(trend).toBe("improving");
    });

    it("should return declining when diff <= -5", () => {
      const trend = calculator.determineTrend(65, 70);

      expect(trend).toBe("declining");
    });

    it("should return declining when diff < -5", () => {
      const trend = calculator.determineTrend(60, 70);

      expect(trend).toBe("declining");
    });

    it("should return stable when diff is within ±5", () => {
      expect(calculator.determineTrend(75, 72)).toBe("stable");
      expect(calculator.determineTrend(75, 70)).toBe("improving");
      expect(calculator.determineTrend(75, 80)).toBe("declining");
    });

    it("should return stable when diff is exactly 5", () => {
      const trend = calculator.determineTrend(75, 70);

      expect(trend).toBe("improving");
    });

    it("should return stable when diff is exactly -5", () => {
      const trend = calculator.determineTrend(65, 70);

      expect(trend).toBe("declining");
    });

    it("should return stable when diff is 4", () => {
      const trend = calculator.determineTrend(74, 70);

      expect(trend).toBe("stable");
    });

    it("should return stable when diff is -4", () => {
      const trend = calculator.determineTrend(66, 70);

      expect(trend).toBe("stable");
    });
  });
});
