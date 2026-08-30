import {
  DefaultEventSerializer,
  type DomainEvent,
  type EventBus,
  type EventSerializer,
  type EventTraceContext,
  type SerializedEvent,
} from "@croco/events-core";
import { getActiveTraceInfo, recordError, recordEvent, withSpan } from "@croco/telemetry-api";
import type { TxManager } from "@croco/tx-core";
import {
  InvalidTransactionalEventConfigurationProblem,
  OutboxPublishExhaustedProblem,
  OutboxTransactionRequiredProblem,
} from "./problems/EventsTxProblems";
import type { TransactionalEventConfigurationField } from "./problems/EventsTxProblems";
import type { InboxMessageStatus, OutboxMessageStatus } from "./TransactionalEventTypes";

export type TransactionalEventDiagnostic = {
  code: string;
  message: string;
  at: Date;
  details?: Record<string, unknown>;
};

export type TransactionalEventError = {
  name: string;
  message: string;
  stack?: string;
  code?: string;
};

export type TransactionalOutboxMessage = {
  id: string;
  eventId: string;
  eventType: string;
  aggregateId?: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  traceContext?: EventTraceContext;
  attempts: number;
  maxAttempts: number;
  status: OutboxMessageStatus;
  visibleAt: Date;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lockedUntil?: Date;
  publishedAt?: Date;
  lastError?: TransactionalEventError;
  deadLetteredAt?: Date;
  deadLetterReason?: string;
  diagnostics: TransactionalEventDiagnostic[];
};

export type TransactionalInboxRecord = {
  consumerId: string;
  messageId: string;
  inboxKey: string;
  eventType: string;
  status: InboxMessageStatus;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  lockedUntil?: Date;
  processedAt?: Date;
  failedAt?: Date;
  lastError?: TransactionalEventError;
  failureReason?: string;
  metadata: Record<string, unknown>;
  diagnostics: TransactionalEventDiagnostic[];
};

export type AppendOutboxMessageInput = {
  id: string;
  eventId: string;
  eventType: string;
  aggregateId?: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  traceContext?: EventTraceContext;
  maxAttempts: number;
  visibleAt: Date;
  occurredAt: Date;
  diagnostics?: TransactionalEventDiagnostic[];
};

export type OutboxAppendOptions = {
  id?: string;
  aggregateId?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
  visibleAt?: Date;
  metadata?: Record<string, unknown>;
};

export type OutboxClaimOptions = {
  limit: number;
  now: Date;
  visibilityTimeoutMs: number;
};

export type OutboxCompletionInput = {
  id: string;
  expectedAttempts: number;
  now: Date;
};

export type OutboxFailureInput = OutboxCompletionInput & {
  error: TransactionalEventError;
  nextVisibleAt: Date;
  diagnostic: TransactionalEventDiagnostic;
};

export type OutboxReleaseInput = OutboxCompletionInput & {
  diagnostic: TransactionalEventDiagnostic;
};

export type OutboxDeadLetterInput = OutboxCompletionInput & {
  reason: string;
  diagnostic: TransactionalEventDiagnostic;
};

export type InboxStartInput = {
  consumerId: string;
  messageId: string;
  inboxKey: string;
  eventType: string;
  now: Date;
  visibilityTimeoutMs?: number;
  metadata?: Record<string, unknown>;
};

export type InboxStartResult =
  | {
      status: "started";
      record: TransactionalInboxRecord;
    }
  | {
      status: "duplicate";
      record: TransactionalInboxRecord;
    };

export type InboxCompletionInput = {
  consumerId: string;
  inboxKey: string;
  expectedAttempts: number;
  now: Date;
  diagnostic?: TransactionalEventDiagnostic;
};

export type InboxFailureInput = InboxCompletionInput & {
  error: TransactionalEventError;
  reason: string;
};

export type ListOutboxMessagesOptions = {
  status?: OutboxMessageStatus;
  limit?: number;
};

export type ListInboxRecordsOptions = {
  consumerId?: string;
  status?: InboxMessageStatus;
  limit?: number;
};

export type TransactionalEventStoreContext<TClient = unknown> = {
  client?: TClient;
};

export interface TransactionalEventStore<TClient = unknown> {
  appendOutbox(
    input: AppendOutboxMessageInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage>;

  findOutboxById(
    id: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null>;

  findOutboxByIdempotencyKey(
    idempotencyKey: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null>;

  claimOutboxBatch(
    options: OutboxClaimOptions,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage[]>;

  markOutboxPublished(
    input: OutboxCompletionInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null>;

  markOutboxFailed(
    input: OutboxFailureInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null>;

  releaseOutboxClaim(
    input: OutboxReleaseInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null>;

  markOutboxDeadLettered(
    input: OutboxDeadLetterInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null>;

  listOutboxMessages(
    options?: ListOutboxMessagesOptions,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage[]>;

  startInboxProcessing(
    input: InboxStartInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<InboxStartResult>;

  markInboxProcessed(
    input: InboxCompletionInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord>;

  markInboxFailed(
    input: InboxFailureInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord>;

  findInboxRecord(
    consumerId: string,
    inboxKey: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord | null>;

  listInboxRecords(
    options?: ListInboxRecordsOptions,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord[]>;
}

export type TransactionalOutboxConfig<TClient> = {
  store: TransactionalEventStore<TClient>;
  txManager: Pick<TxManager<TClient>, "getClient" | "isInTransaction">;
  serializer?: EventSerializer;
  maxAttempts?: number;
  now?: () => Date;
  idFactory?: () => string;
};

export type OutboxRelayRetryPolicy = {
  baseDelayMs: number;
  multiplier: number;
  maxDelayMs: number;
};

export type OutboxRelayConfig<TClient> = {
  store: TransactionalEventStore<TClient>;
  publish: (message: TransactionalOutboxMessage, signal?: AbortSignal) => Promise<void>;
  deadLetter?: (message: TransactionalOutboxMessage) => Promise<void>;
  txManager?: Pick<TxManager<TClient>, "getClient">;
  batchSize?: number;
  visibilityTimeoutMs?: number;
  retry?: Partial<OutboxRelayRetryPolicy>;
  now?: () => Date;
};

export type OutboxRelayPublishOptions = Partial<OutboxClaimOptions> & {
  signal?: AbortSignal;
};

export type OutboxRelayMessageResult =
  | {
      status: "published";
      message: TransactionalOutboxMessage;
    }
  | {
      status: "scheduled_retry";
      message: TransactionalOutboxMessage;
      error: TransactionalEventError;
    }
  | {
      status: "poisoned" | "dead_lettered";
      message: TransactionalOutboxMessage;
      error: TransactionalEventError;
      problem: OutboxPublishExhaustedProblem;
    }
  | {
      status: "stale_claim";
      message: TransactionalOutboxMessage;
      diagnostic: TransactionalEventDiagnostic;
    }
  | {
      status: "released";
      message: TransactionalOutboxMessage;
    };

export type OutboxRelayBatchResult = {
  status: "completed" | "cancelled" | "stopped";
  claimed: number;
  published: number;
  scheduledRetry: number;
  poisoned: number;
  deadLettered: number;
  staleClaimed: number;
  released: number;
  results: OutboxRelayMessageResult[];
};

export type OutboxRelayDrainResult = {
  status: "drained" | "cancelled";
  activeBatches: number;
  pendingBatches: number;
};

export type TransactionalInboxConsumerConfig<TClient> = {
  store: TransactionalEventStore<TClient>;
  consumerId: string;
  txManager?: Pick<TxManager<TClient>, "getClient">;
  visibilityTimeoutMs?: number;
  now?: () => Date;
  throwOnError?: boolean;
};

export type InboxConsumerResult =
  | {
      status: "processed";
      record: TransactionalInboxRecord;
    }
  | {
      status: "duplicate";
      record: TransactionalInboxRecord;
    }
  | {
      status: "failed";
      record: TransactionalInboxRecord;
      error: TransactionalEventError;
    };

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_VISIBILITY_TIMEOUT_MS = 30_000;
const MAX_INT32 = 2_147_483_647;
const DEFAULT_RETRY_POLICY: OutboxRelayRetryPolicy = {
  baseDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 30_000,
};

function toConfigurationReceivedValue(value: number | string): number | string {
  if (typeof value === "string" || Number.isFinite(value)) {
    return value;
  }
  if (Number.isNaN(value)) {
    return "NaN";
  }
  return value === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity";
}

function validatePositiveInt32(value: number, field: TransactionalEventConfigurationField): void {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_INT32) {
    throw new InvalidTransactionalEventConfigurationProblem({
      field,
      constraint: "positive-int32",
      receivedValue: toConfigurationReceivedValue(value),
    });
  }
}

export function resolveInboxLockedUntil(input: InboxStartInput): Date {
  const visibilityTimeoutMs = input.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS;
  validatePositiveInt32(visibilityTimeoutMs, "visibilityTimeoutMs");
  return new Date(input.now.getTime() + visibilityTimeoutMs);
}

function validateNonNegativeInt32(
  value: number,
  field: TransactionalEventConfigurationField,
): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_INT32) {
    throw new InvalidTransactionalEventConfigurationProblem({
      field,
      constraint: "non-negative-int32",
      receivedValue: toConfigurationReceivedValue(value),
    });
  }
}

function validatePositiveFiniteNumber(
  value: number,
  field: TransactionalEventConfigurationField,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidTransactionalEventConfigurationProblem({
      field,
      constraint: "positive-finite-number",
      receivedValue: toConfigurationReceivedValue(value),
    });
  }
}

function validateConsumerId(consumerId: string): void {
  if (consumerId.trim().length === 0 || [...consumerId].length > 128) {
    throw new InvalidTransactionalEventConfigurationProblem({
      field: "consumerId",
      constraint: "non-blank-string-at-most-128",
      receivedValue: consumerId,
    });
  }
}

function defaultNow(): Date {
  return new Date();
}

function defaultIdFactory(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTransactionalEventError(error: unknown): TransactionalEventError {
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(code ? { code } : {}),
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}

export function createTransactionalEventDiagnostic(
  code: string,
  message: string,
  at: Date,
  details?: Record<string, unknown>,
): TransactionalEventDiagnostic {
  return {
    code,
    message,
    at,
    ...(details ? { details } : {}),
  };
}

function buildSerializedEvent(message: TransactionalOutboxMessage): SerializedEvent {
  return {
    eventType: message.eventType,
    eventId: message.eventId,
    occurredAt: message.occurredAt.toISOString(),
    aggregateId: message.aggregateId,
    payload: message.payload,
  };
}

function calculateRetryDelayMs(attempts: number, retry: OutboxRelayRetryPolicy): number {
  if (retry.baseDelayMs === 0 || retry.maxDelayMs === 0) {
    return 0;
  }
  const exponent = Math.max(attempts - 1, 0);
  const delay = retry.baseDelayMs * retry.multiplier ** exponent;
  return Number.isFinite(delay) ? Math.min(delay, retry.maxDelayMs) : retry.maxDelayMs;
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Appends serialized domain events to a transactional outbox using the active `tx-core` client.
 */
export class TransactionalOutbox<TClient = unknown> {
  private readonly serializer: EventSerializer;
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  constructor(private readonly config: TransactionalOutboxConfig<TClient>) {
    if (config.maxAttempts !== undefined) {
      validatePositiveInt32(config.maxAttempts, "maxAttempts");
    }
    this.serializer = config.serializer ?? new DefaultEventSerializer();
    this.maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.now = config.now ?? defaultNow;
    this.idFactory = config.idFactory ?? defaultIdFactory;
  }

  async append(
    event: DomainEvent,
    options: OutboxAppendOptions = {},
  ): Promise<TransactionalOutboxMessage> {
    if (options.maxAttempts !== undefined) {
      validatePositiveInt32(options.maxAttempts, "maxAttempts");
    }
    if (!this.config.txManager.isInTransaction()) {
      throw new OutboxTransactionRequiredProblem();
    }

    const client = this.config.txManager.getClient();
    if (!client) {
      throw new OutboxTransactionRequiredProblem();
    }

    const serialized = this.serializer.serialize(event);
    const now = this.now();
    const traceContext = event.metadata.traceContext ?? getActiveTraceInfo();

    return withSpan(
      async () => {
        const message = await this.config.store.appendOutbox(
          {
            id: options.id ?? this.idFactory(),
            eventId: serialized.eventId,
            eventType: serialized.eventType,
            aggregateId: options.aggregateId ?? serialized.aggregateId,
            idempotencyKey: options.idempotencyKey ?? serialized.eventId,
            payload: serialized.payload,
            metadata: {
              ...event.metadata,
              ...options.metadata,
            },
            traceContext,
            maxAttempts: options.maxAttempts ?? this.maxAttempts,
            visibleAt: options.visibleAt ?? now,
            occurredAt: new Date(serialized.occurredAt),
            diagnostics: [
              createTransactionalEventDiagnostic(
                "events-tx/outbox-appended",
                "Outbox message appended.",
                now,
                {
                  eventType: serialized.eventType,
                },
              ),
            ],
          },
          { client },
        );

        recordEvent("events-tx.outbox.appended", {
          "events-tx.message_id": message.id,
          "events-tx.event_type": message.eventType,
        });

        return message;
      },
      {
        name: "events-tx.outbox.append",
        attributes: {
          "events-tx.event_type": serialized.eventType,
        },
      },
    );
  }
}

/**
 * Claims visible outbox messages and publishes them in deterministic batches.
 */
export class TransactionalOutboxRelay<TClient = unknown> {
  private readonly batchSize: number;
  private readonly visibilityTimeoutMs: number;
  private readonly retry: OutboxRelayRetryPolicy;
  private readonly now: () => Date;
  private readonly activeBatches = new Map<Promise<OutboxRelayBatchResult>, AbortController>();
  private accepting = true;

  constructor(private readonly config: OutboxRelayConfig<TClient>) {
    if (config.batchSize !== undefined) {
      validatePositiveInt32(config.batchSize, "batchSize");
    }
    if (config.visibilityTimeoutMs !== undefined) {
      validatePositiveInt32(config.visibilityTimeoutMs, "visibilityTimeoutMs");
    }
    if (config.retry?.baseDelayMs !== undefined) {
      validateNonNegativeInt32(config.retry.baseDelayMs, "retry.baseDelayMs");
    }
    if (config.retry?.maxDelayMs !== undefined) {
      validateNonNegativeInt32(config.retry.maxDelayMs, "retry.maxDelayMs");
    }
    if (config.retry?.multiplier !== undefined) {
      validatePositiveFiniteNumber(config.retry.multiplier, "retry.multiplier");
    }
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.visibilityTimeoutMs = config.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS;
    this.retry = {
      ...DEFAULT_RETRY_POLICY,
      ...config.retry,
    };
    this.now = config.now ?? defaultNow;
  }

  publishBatch(options: OutboxRelayPublishOptions = {}): Promise<OutboxRelayBatchResult> {
    if (options.limit !== undefined) {
      validatePositiveInt32(options.limit, "limit");
    }
    if (options.visibilityTimeoutMs !== undefined) {
      validatePositiveInt32(options.visibilityTimeoutMs, "visibilityTimeoutMs");
    }

    if (!this.accepting) {
      return Promise.resolve(this.createEmptyBatchResult("stopped"));
    }
    if (options.signal?.aborted) {
      return Promise.resolve(this.createEmptyBatchResult("cancelled"));
    }

    const controller = new AbortController();
    const removeAbortListener = this.forwardAbort(options.signal, controller);
    const operation = this.executeBatch(options, controller.signal);
    this.activeBatches.set(operation, controller);
    const removeBatch = () => {
      removeAbortListener();
      this.activeBatches.delete(operation);
    };
    void operation.then(removeBatch, removeBatch);
    return operation;
  }

  stop(): void {
    this.accepting = false;
    for (const controller of this.activeBatches.values()) {
      controller.abort();
    }
  }

  async drain(signal?: AbortSignal): Promise<OutboxRelayDrainResult> {
    this.stop();
    const active = [...this.activeBatches.keys()];
    const activeBatches = active.length;
    if (activeBatches === 0) {
      return { status: "drained", activeBatches: 0, pendingBatches: 0 };
    }

    if (signal?.aborted) {
      return {
        status: "cancelled",
        activeBatches,
        pendingBatches: this.activeBatches.size,
      };
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: OutboxRelayDrainResult) => {
        if (settled) {
          return;
        }
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        resolve(result);
      };
      const onAbort = () => {
        finish({
          status: "cancelled",
          activeBatches,
          pendingBatches: this.activeBatches.size,
        });
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      void Promise.allSettled(active).then(() => {
        finish({ status: "drained", activeBatches, pendingBatches: 0 });
      });
    });
  }

  async onShutdown(signal?: AbortSignal): Promise<void> {
    await this.drain(signal);
  }

  private async executeBatch(
    options: OutboxRelayPublishOptions,
    signal: AbortSignal,
  ): Promise<OutboxRelayBatchResult> {
    const now = options.now ?? this.now();
    const claimed = await this.config.store.claimOutboxBatch(
      {
        limit: options.limit ?? this.batchSize,
        now,
        visibilityTimeoutMs: options.visibilityTimeoutMs ?? this.visibilityTimeoutMs,
      },
      this.context(),
    );
    const results: OutboxRelayMessageResult[] = [];

    for (const [index, message] of claimed.entries()) {
      if (signal.aborted) {
        for (const unstarted of claimed.slice(index)) {
          results.push(await this.releaseClaim(unstarted));
        }
        break;
      }
      results.push(await this.publishOne(message, signal));
    }

    return this.createBatchResult(signal.aborted ? "cancelled" : "completed", claimed, results);
  }

  private createBatchResult(
    status: OutboxRelayBatchResult["status"],
    claimed: TransactionalOutboxMessage[],
    results: OutboxRelayMessageResult[],
  ): OutboxRelayBatchResult {
    return {
      status,
      claimed: claimed.length,
      published: results.filter((result) => result.status === "published").length,
      scheduledRetry: results.filter((result) => result.status === "scheduled_retry").length,
      poisoned: results.filter((result) => result.status === "poisoned").length,
      deadLettered: results.filter((result) => result.status === "dead_lettered").length,
      staleClaimed: results.filter((result) => result.status === "stale_claim").length,
      released: results.filter((result) => result.status === "released").length,
      results,
    };
  }

  private createEmptyBatchResult(status: "cancelled" | "stopped"): OutboxRelayBatchResult {
    return this.createBatchResult(status, [], []);
  }

  private async publishOne(
    message: TransactionalOutboxMessage,
    signal: AbortSignal,
  ): Promise<OutboxRelayMessageResult> {
    return withSpan(
      async () => {
        try {
          await this.config.publish(message, signal);
          const published = await this.config.store.markOutboxPublished(
            {
              id: message.id,
              expectedAttempts: message.attempts,
              now: this.now(),
            },
            this.context(),
          );
          if (!published) {
            return this.createStaleClaimResult(message, "events-tx/outbox-publish-stale-claim");
          }
          recordEvent("events-tx.outbox.published", {
            "events-tx.message_id": message.id,
            "events-tx.event_type": message.eventType,
          });
          return { status: "published", message: published };
        } catch (error) {
          const normalized = normalizeTransactionalEventError(error);
          recordError(error);
          return this.handlePublishFailure(message, normalized);
        }
      },
      {
        name: "events-tx.outbox.publish",
        attributes: {
          "events-tx.message_id": message.id,
          "events-tx.event_type": message.eventType,
        },
      },
    );
  }

  private async releaseClaim(
    message: TransactionalOutboxMessage,
  ): Promise<OutboxRelayMessageResult> {
    const now = this.now();
    const released = await this.config.store.releaseOutboxClaim(
      {
        id: message.id,
        expectedAttempts: message.attempts,
        now,
        diagnostic: createTransactionalEventDiagnostic(
          "events-tx/outbox-claim-released",
          "Outbox claim released before publication started.",
          now,
          {
            eventType: message.eventType,
            attempts: message.attempts,
          },
        ),
      },
      this.context(),
    );
    if (!released) {
      return this.createStaleClaimResult(message, "events-tx/outbox-release-stale-claim");
    }
    recordEvent("events-tx.outbox.claim_released", {
      "events-tx.message_id": message.id,
      "events-tx.event_type": message.eventType,
    });
    return { status: "released", message: released };
  }

  private async handlePublishFailure(
    message: TransactionalOutboxMessage,
    error: TransactionalEventError,
  ): Promise<OutboxRelayMessageResult> {
    const now = this.now();
    const failed = await this.config.store.markOutboxFailed(
      {
        id: message.id,
        expectedAttempts: message.attempts,
        error,
        now,
        nextVisibleAt: addMs(now, calculateRetryDelayMs(message.attempts, this.retry)),
        diagnostic: createTransactionalEventDiagnostic(
          "events-tx/outbox-publish-failed",
          error.message,
          now,
          {
            eventType: message.eventType,
            attempts: message.attempts,
          },
        ),
      },
      this.context(),
    );

    if (!failed) {
      return this.createStaleClaimResult(message, "events-tx/outbox-fail-stale-claim");
    }

    if (failed.status !== "poisoned") {
      return {
        status: "scheduled_retry",
        message: failed,
        error,
      };
    }

    const problem = new OutboxPublishExhaustedProblem(
      failed.id,
      failed.attempts,
      new Error(error.message),
    );

    if (!this.config.deadLetter) {
      return {
        status: "poisoned",
        message: failed,
        error,
        problem,
      };
    }

    await this.config.deadLetter(failed);
    const deadLettered = await this.config.store.markOutboxDeadLettered(
      {
        id: failed.id,
        expectedAttempts: failed.attempts,
        now: this.now(),
        reason: problem.detail ?? problem.message,
        diagnostic: createTransactionalEventDiagnostic(
          "events-tx/outbox-dead-lettered",
          problem.detail ?? problem.message,
          this.now(),
          {
            eventType: failed.eventType,
            attempts: failed.attempts,
          },
        ),
      },
      this.context(),
    );

    if (!deadLettered) {
      return this.createStaleClaimResult(failed, "events-tx/outbox-dead-letter-stale-claim");
    }

    return {
      status: "dead_lettered",
      message: deadLettered,
      error,
      problem,
    };
  }

  private createStaleClaimResult(
    message: TransactionalOutboxMessage,
    code: string,
  ): OutboxRelayMessageResult {
    const diagnostic = createTransactionalEventDiagnostic(
      code,
      "Outbox message claim was already completed or superseded.",
      this.now(),
      {
        eventType: message.eventType,
        attempts: message.attempts,
      },
    );
    recordEvent("events-tx.outbox.stale_claim", {
      "events-tx.message_id": message.id,
      "events-tx.event_type": message.eventType,
      "events-tx.attempts": message.attempts,
    });
    return {
      status: "stale_claim",
      message,
      diagnostic,
    };
  }

  private context(): TransactionalEventStoreContext<TClient> | undefined {
    const client = this.config.txManager?.getClient();
    return client ? { client } : undefined;
  }

  private forwardAbort(signal: AbortSignal | undefined, controller: AbortController): () => void {
    if (!signal) {
      return () => undefined;
    }
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Provides inbox idempotency for at-least-once event consumers.
 */
export class TransactionalInboxConsumer<TClient = unknown> {
  private readonly consumerId: string;
  private readonly visibilityTimeoutMs: number;
  private readonly now: () => Date;
  private readonly throwOnError: boolean;

  constructor(private readonly config: TransactionalInboxConsumerConfig<TClient>) {
    validateConsumerId(config.consumerId);
    const visibilityTimeoutMs = config.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS;
    validatePositiveInt32(visibilityTimeoutMs, "visibilityTimeoutMs");
    this.consumerId = config.consumerId;
    this.visibilityTimeoutMs = visibilityTimeoutMs;
    this.now = config.now ?? defaultNow;
    this.throwOnError = config.throwOnError ?? true;
  }

  async handle(
    message: TransactionalOutboxMessage,
    handler: (message: TransactionalOutboxMessage) => Promise<void>,
  ): Promise<InboxConsumerResult> {
    const now = this.now();
    const inboxKey = message.idempotencyKey || message.eventId || message.id;
    const start = await this.config.store.startInboxProcessing(
      {
        consumerId: this.consumerId,
        messageId: message.id,
        inboxKey,
        eventType: message.eventType,
        now,
        visibilityTimeoutMs: this.visibilityTimeoutMs,
        metadata: {
          aggregateId: message.aggregateId,
        },
      },
      this.context(),
    );

    if (start.status === "duplicate") {
      return {
        status: "duplicate",
        record: start.record,
      };
    }

    try {
      await handler(message);
    } catch (error) {
      const normalized = normalizeTransactionalEventError(error);
      const failed = await this.config.store.markInboxFailed(
        {
          consumerId: this.consumerId,
          inboxKey,
          expectedAttempts: start.record.attempts,
          now: this.now(),
          error: normalized,
          reason: normalized.message,
          diagnostic: createTransactionalEventDiagnostic(
            "events-tx/inbox-failed",
            normalized.message,
            this.now(),
            {
              eventType: message.eventType,
            },
          ),
        },
        this.context(),
      );

      if (this.throwOnError) {
        throw error;
      }

      return {
        status: "failed",
        record: failed,
        error: normalized,
      };
    }

    const processed = await this.config.store.markInboxProcessed(
      {
        consumerId: this.consumerId,
        inboxKey,
        expectedAttempts: start.record.attempts,
        now: this.now(),
        diagnostic: createTransactionalEventDiagnostic(
          "events-tx/inbox-processed",
          "Inbox message processed.",
          this.now(),
          {
            eventType: message.eventType,
          },
        ),
      },
      this.context(),
    );

    return {
      status: "processed",
      record: processed,
    };
  }

  private context(): TransactionalEventStoreContext<TClient> | undefined {
    const client = this.config.txManager?.getClient();
    return client ? { client } : undefined;
  }
}

export function createEventBusOutboxPublisher(
  eventBus: EventBus,
  serializer: EventSerializer = new DefaultEventSerializer(),
): (message: TransactionalOutboxMessage) => Promise<void> {
  return async (message) => {
    const event = serializer.deserialize(buildSerializedEvent(message));
    event.metadata = {
      ...event.metadata,
      ...message.metadata,
      ...(message.traceContext ? { traceContext: message.traceContext } : {}),
    };
    await eventBus.publish(event);
  };
}
