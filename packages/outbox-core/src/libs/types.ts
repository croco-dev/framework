import type { Problem } from "@croco/problems-core";

export type OutboxRecordStatus = "pending" | "claimed" | "retrying" | "dispatched" | "failed";

export type OutboxTenantBoundary = {
  readonly tenantId: string;
  readonly isolationKey?: string;
};

export type OutboxTraceContext = {
  readonly traceId?: string;
  readonly spanId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly baggage?: Record<string, string>;
  readonly attributes?: Record<string, string | number | boolean>;
};

export type OutboxSourceReference = {
  readonly eventId?: string;
  readonly eventType?: string;
  readonly commandId?: string;
  readonly commandType?: string;
  readonly aggregateId?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
};

export type TransactionalOutboxStoreContext<TClient = unknown> = {
  readonly client: TClient;
};

export type OutboxRetryOptions = {
  readonly maxAttempts?: number;
};

export type OutboxRetryMetadata = {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly retryable: boolean;
  readonly terminal: boolean;
  readonly lastFailedAt?: Date;
  readonly nextVisibleAt?: Date;
};

export type OutboxFailureMetadata = {
  readonly retryable: boolean;
  readonly terminal: boolean;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly failedAt: Date;
  readonly nextVisibleAt?: Date;
};

export type OutboxFailureRecord = {
  readonly problem: ReturnType<Problem["toJSON"]>;
  readonly retry: OutboxFailureMetadata;
};

export type OutboxIntent = {
  readonly type: string;
  readonly tenant: OutboxTenantBoundary;
  readonly idempotencyKey: string;
  readonly source: OutboxSourceReference;
  readonly payload: Record<string, unknown>;
  readonly traceContext?: OutboxTraceContext;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt?: Date;
};

export type OutboxRecordOptions<TClient = unknown> = {
  readonly id?: string;
  readonly context?: TransactionalOutboxStoreContext<TClient>;
  readonly now?: Date;
  readonly availableAt?: Date;
  readonly retry?: OutboxRetryOptions;
};

export type OutboxClaim = {
  readonly id: string;
  readonly attempt: number;
  readonly claimedAt: Date;
  readonly expiresAt: Date;
  readonly dispatcherId?: string;
};

export type OutboxDispatchResultMetadata = {
  readonly providerMessageId?: string;
  readonly metadata?: Record<string, unknown>;
};

export type DispatchResult = OutboxDispatchResultMetadata & {
  readonly expectedAttempt: number;
  readonly dispatchedAt: Date;
};

export type OutboxRecord = {
  readonly id: string;
  readonly type: string;
  readonly status: OutboxRecordStatus;
  readonly tenant: OutboxTenantBoundary;
  readonly idempotencyKey: string;
  readonly source: OutboxSourceReference;
  readonly payload: Record<string, unknown>;
  readonly traceContext?: OutboxTraceContext;
  readonly metadata: Record<string, unknown>;
  readonly retry: OutboxRetryMetadata;
  readonly availableAt: Date;
  readonly occurredAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly claim?: OutboxClaim;
  readonly dispatchResult?: DispatchResult;
  readonly failure?: OutboxFailureRecord;
};

export type ClaimedOutboxRecord = OutboxRecord & {
  readonly status: "claimed";
  readonly claim: OutboxClaim;
};

export type ClaimBatchOptions<TClient = unknown> = {
  readonly limit: number;
  readonly now: Date;
  readonly visibilityTimeoutMs: number;
  readonly dispatcherId?: string;
  readonly tenant?: OutboxTenantBoundary;
  readonly context?: TransactionalOutboxStoreContext<TClient>;
};

export interface TransactionalOutboxStore<TClient = unknown> {
  record(intent: OutboxIntent, options: OutboxRecordOptions<TClient>): Promise<OutboxRecord>;
  claimBatch(options: ClaimBatchOptions<TClient>): Promise<ClaimedOutboxRecord[]>;
  markDispatched(id: string, result: DispatchResult): Promise<void>;
  markFailed(id: string, problem: Problem): Promise<void>;
}
