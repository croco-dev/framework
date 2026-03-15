import { Token } from '@croco/framework-context';
import type { HealthSignal, SignalCategory, TenantHealthScore } from './types';

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
}

export abstract class HealthSignalRegistry {
  static readonly token = new Token<HealthSignalRegistry>('HealthSignalRegistry');
  abstract getProviders(): SignalProvider[];
}
