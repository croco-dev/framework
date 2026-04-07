import { Token } from '@croco/framework-context';
import type { HealthSignal, HealthTrendAnalysis, SignalCategory, TenantHealthScore, TrendPeriod } from './types';

export abstract class SignalProvider {
  static readonly token = new Token<SignalProvider>('SignalProvider');
  abstract readonly category: SignalCategory;
  abstract collect(tenantId: string): Promise<HealthSignal[]>;
}

export abstract class HealthScoreStore {
  static readonly token = new Token<HealthScoreStore>('HealthScoreStore');
  abstract save(score: TenantHealthScore): Promise<void>;
  abstract findLatest(tenantId: string): Promise<TenantHealthScore | null>;
  abstract findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]>;
  abstract findHistoryByPeriod(
    tenantId: string,
    period: TrendPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<TenantHealthScore[]>;
}

export abstract class HealthSignalRegistry {
  static readonly token = new Token<HealthSignalRegistry>('HealthSignalRegistry');
  abstract getProviders(): SignalProvider[];
}

export abstract class TrendAnalyzer {
  static readonly token = new Token<TrendAnalyzer>('TrendAnalyzer');
  abstract analyzeTrend(
    tenantId: string,
    period: TrendPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<HealthTrendAnalysis>;
}
