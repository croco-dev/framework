import { Token } from "@croco/framework-context";
import type { DomainEvent } from "@croco/events-core";
import type { HealthTransitionEventIntent } from "./eventIntent";
import type {
  HealthSignal,
  HealthTrendAnalysis,
  SignalCategory,
  TenantHealthScore,
  TrendPeriod,
} from "./types";

export type HealthTransitionCommitResult =
  | {
      readonly committed: true;
      /** The transition joined a caller-owned transaction and its events must remain pending. */
      readonly eventPublicationDeferred?: true;
    }
  | { readonly committed: false; readonly latest: TenantHealthScore | null };

export abstract class SignalProvider {
  static readonly token = new Token<SignalProvider>("SignalProvider");
  abstract readonly category: SignalCategory;
  abstract collect(tenantId: string): Promise<HealthSignal[]>;
}

export abstract class HealthScoreStore {
  static readonly token = new Token<HealthScoreStore>("HealthScoreStore");
  abstract saveTransition(
    score: TenantHealthScore,
    previous: TenantHealthScore | null,
    eventIntents: readonly HealthTransitionEventIntent[],
  ): Promise<HealthTransitionCommitResult>;
  abstract listPendingEventIntents(
    tenantId: string,
    limit?: number,
  ): Promise<readonly HealthTransitionEventIntent[]>;
  abstract markEventIntentPublished(eventId: string): Promise<void>;
  abstract findLatest(tenantId: string): Promise<TenantHealthScore | null>;
  abstract findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]>;
  abstract findHistoryByPeriod(
    tenantId: string,
    period: TrendPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<TenantHealthScore[]>;
}

export abstract class CustomerHealthEventPublisher {
  static readonly token = new Token<CustomerHealthEventPublisher>("CustomerHealthEventPublisher");
  /** Must deduplicate retries and concurrent deliveries by `event.eventId`. */
  abstract publishIdempotently(event: DomainEvent): Promise<void>;
}

export abstract class HealthSignalRegistry {
  static readonly token = new Token<HealthSignalRegistry>("HealthSignalRegistry");
  abstract getProviders(): SignalProvider[];
}

export abstract class TrendAnalyzer {
  static readonly token = new Token<TrendAnalyzer>("TrendAnalyzer");
  abstract analyzeTrend(
    tenantId: string,
    period: TrendPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<HealthTrendAnalysis>;
}
