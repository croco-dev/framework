export type SignalCategory = 'usage' | 'business' | 'engagement';

export type HealthStatus = 'healthy' | 'at_risk' | 'critical';

export type HealthTrend = 'improving' | 'stable' | 'declining';

export type HealthSignal = {
  category: SignalCategory;
  name: string;
  value: number;
  weight: number;
  rawValue: unknown;
  collectedAt: Date;
};

export type HealthScoreProfile = {
  id: string;
  name: string;
  weights: Record<SignalCategory, number>;
  thresholds: { healthy: number; atRisk: number };
};

export type TenantHealthScore = {
  tenantId: string;
  overallScore: number;
  status: HealthStatus;
  categoryScores: Record<SignalCategory, number>;
  signals: HealthSignal[];
  trend: HealthTrend;
  previousScore?: number;
  calculatedAt: Date;
};
