import type {
  HealthScoreProfile,
  HealthSignal,
  HealthStatus,
  HealthTrend,
  SignalCategory,
  TenantHealthScore,
} from './types';

export class HealthScoreCalculator {
  calculate(signals: HealthSignal[], profile: HealthScoreProfile): TenantHealthScore {
    const now = new Date();

    if (signals.length === 0) {
      return {
        tenantId: '',
        overallScore: 0,
        status: 'critical',
        categoryScores: {
          usage: 0,
          business: 0,
          engagement: 0,
        },
        signals: [],
        trend: 'stable',
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
      categoryScores[signal.category] += signal.value * signal.weight;
      categoryWeights[signal.category] += signal.weight;
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
      status = 'healthy';
    } else if (overallScore >= profile.thresholds.atRisk) {
      status = 'at_risk';
    } else {
      status = 'critical';
    }

    return {
      tenantId: '',
      overallScore,
      status,
      categoryScores,
      signals,
      trend: 'stable',
      calculatedAt: now,
    };
  }

  determineTrend(currentScore: number, previousScore?: number): HealthTrend {
    if (previousScore === undefined) {
      return 'stable';
    }

    const diff = currentScore - previousScore;

    if (diff >= 5) {
      return 'improving';
    }

    if (diff <= -5) {
      return 'declining';
    }

    return 'stable';
  }
}
