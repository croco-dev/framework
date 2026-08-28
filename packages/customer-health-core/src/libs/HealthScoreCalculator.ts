import type {
  HealthScoreProfile,
  HealthSignal,
  HealthStatus,
  HealthTrend,
  SignalCategory,
  TenantHealthScore,
} from "./types";
import { InvalidHealthScoreInputProblem } from "./problems/HealthProblems";

const SCORE_EXPECTATION = "a finite number between 0 and 100";
const WEIGHT_EXPECTATION = "a finite number between 0 and 1";

function assertScore(input: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new InvalidHealthScoreInputProblem(input, value, SCORE_EXPECTATION);
  }
}

function assertWeight(input: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new InvalidHealthScoreInputProblem(input, value, WEIGHT_EXPECTATION);
  }
}

export class HealthScoreCalculator {
  calculate(
    signals: {
      category: string;
      name: string;
      value: number;
      weight: number;
      rawValue: unknown;
      collectedAt: Date;
    }[],
    profile: HealthScoreProfile,
  ): TenantHealthScore {
    const now = new Date();

    for (const category of ["usage", "business", "engagement"] as const) {
      assertWeight(`profile.weights.${category}`, profile.weights[category]);
    }
    assertScore("profile.thresholds.healthy", profile.thresholds.healthy);
    assertScore("profile.thresholds.atRisk", profile.thresholds.atRisk);

    for (const [index, signal] of signals.entries()) {
      assertScore(`signals[${index}].value`, signal.value);
      assertWeight(`signals[${index}].weight`, signal.weight);
    }

    if (signals.length === 0) {
      return {
        tenantId: "",
        overallScore: 0,
        status: "critical",
        categoryScores: {
          usage: 0,
          business: 0,
          engagement: 0,
        },
        signals: [],
        trend: "stable",
        calculatedAt: now,
      };
    }

    const categoryScores: Record<SignalCategory, number> = {
      usage: 0,
      business: 0,
      engagement: 0,
    };

    const categoryWeights: Record<SignalCategory, number> = {
      usage: 0,
      business: 0,
      engagement: 0,
    };

    for (const signal of signals) {
      const category = signal.category as SignalCategory;
      categoryScores[category] += signal.value * signal.weight;
      categoryWeights[category] += signal.weight;
    }

    for (const category of Object.keys(categoryScores) as SignalCategory[]) {
      if (categoryWeights[category] > 0) {
        categoryScores[category] = categoryScores[category] / categoryWeights[category];
      }
    }

    const overallScore =
      categoryScores.usage * profile.weights.usage +
      categoryScores.business * profile.weights.business +
      categoryScores.engagement * profile.weights.engagement;

    let status: HealthStatus;
    if (overallScore >= profile.thresholds.healthy) {
      status = "healthy";
    } else if (overallScore >= profile.thresholds.atRisk) {
      status = "at_risk";
    } else {
      status = "critical";
    }

    return {
      tenantId: "",
      overallScore,
      status,
      categoryScores,
      signals: signals as HealthSignal[],
      trend: "stable",
      calculatedAt: now,
    };
  }

  determineTrend(currentScore: number, previousScore?: number): HealthTrend {
    assertScore("currentScore", currentScore);

    if (previousScore === undefined) {
      return "stable";
    }

    assertScore("previousScore", previousScore);

    const diff = currentScore - previousScore;

    if (diff >= 5) {
      return "improving";
    }

    if (diff <= -5) {
      return "declining";
    }

    return "stable";
  }
}
