export type SignalCategory = "usage" | "business" | "engagement";

export type HealthStatus = "healthy" | "at_risk" | "critical";

export type HealthTrend = "improving" | "stable" | "declining";

export type TrendPeriod = "day" | "week" | "month";

export type HealthSignal = {
  category: SignalCategory;
  name: string;
  value: number;
  weight: number;
  rawValue: unknown;
  collectedAt: Date;
};

export type BuiltinSignalType =
  | "login_frequency"
  | "feature_usage_rate"
  | "support_ticket_frequency";

export type LoginFrequencySignal = {
  type: "login_frequency";
  loginsPerDay: number;
  activeDays: number;
  totalDays: number;
};

export type FeatureUsageRateSignal = {
  type: "feature_usage_rate";
  featureKey: string;
  usageCount: number;
  uniqueUsers: number;
};

export type SupportTicketFrequencySignal = {
  type: "support_ticket_frequency";
  openTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  ticketsPerUser: number;
};

export type BuiltinSignal =
  | LoginFrequencySignal
  | FeatureUsageRateSignal
  | SupportTicketFrequencySignal;

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

export type TrendDataPoint = {
  date: Date;
  score: number;
  status: HealthStatus;
};

export type HealthTrendAnalysis = {
  tenantId: string;
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  dataPoints: TrendDataPoint[];
  averageScore: number;
  trendDirection: HealthTrend;
  changePercentage: number;
};
