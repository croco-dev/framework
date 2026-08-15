export type SagaExecutionStatus = "pending" | "running" | "completed" | "compensated" | "failed";

export type SagaStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "compensating"
  | "compensated"
  | "compensation_failed";

export type SagaFailure = {
  readonly message: string;
  readonly retryable: boolean;
  readonly code?: string;
  readonly stack?: string;
};

export type SagaRetryContext = {
  readonly saga: SagaDefinition;
  readonly executionId: string;
  readonly step: SagaStepDefinition;
  readonly attempt: number;
  readonly error: unknown;
};

export type SagaRetryPolicy = {
  readonly maxAttempts?: number;
  readonly shouldRetry?: (context: SagaRetryContext) => boolean | Promise<boolean>;
};

export type SagaStepResult = {
  readonly stepId: string;
  readonly result: unknown;
};

export type SagaStepInputContext = {
  readonly saga: SagaDefinition;
  readonly executionId: string;
  readonly payload: unknown;
  readonly step: SagaStepDefinition;
  readonly previousResults: readonly SagaStepResult[];
};

export type SagaStepIdempotencyContext = SagaStepInputContext & {
  readonly stepInput: unknown;
};

export type SagaStepContext = SagaStepIdempotencyContext & {
  readonly attempt: number;
  readonly idempotencyKey?: string;
  readonly enqueueOutbox: (message: SagaOutboxMessage) => void;
};

export type SagaCompensationContext = SagaStepContext & {
  readonly failure: SagaFailure;
  readonly stepResult: SagaStepExecutionRecord;
};

export type SagaIdempotencyContext = {
  readonly saga: SagaDefinition;
  readonly payload: unknown;
};

export type SagaIdempotencyResolver = (context: SagaIdempotencyContext) => string | undefined;

export type SagaStepInputResolver = (context: SagaStepInputContext) => unknown;

export type SagaStepIdempotencyResolver = (
  context: SagaStepIdempotencyContext,
) => string | undefined;

export type SagaStepHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: SagaStepContext,
) => TOutput | Promise<TOutput>;

export type SagaCompensationHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: SagaCompensationContext,
) => TOutput | Promise<TOutput>;

export type SagaOutboxMessage = {
  readonly id: string;
  readonly topic: string;
  readonly payload: unknown;
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
};

export type SagaOutboxStatus = "pending" | "published";

export type SagaOutboxRecord = SagaOutboxMessage & {
  /** Stable across retries and replays. Publishers must use this value to deduplicate delivery. */
  readonly deliveryId: string;
  readonly stepId: string;
  readonly phase: "step" | "compensation";
  readonly status: SagaOutboxStatus;
  readonly enqueuedAt: string;
  readonly publishedAt?: string;
};

export type SagaOutboxPublishContext = {
  readonly saga: SagaDefinition;
  readonly executionId: string;
  readonly step: SagaStepDefinition;
  readonly message: SagaOutboxRecord;
};

export type SagaOutboxPublisher = {
  /** Implementations must make repeated calls with the same message.deliveryId idempotent. */
  readonly publish: (
    message: SagaOutboxRecord,
    context: SagaOutboxPublishContext,
  ) => void | Promise<void>;
};

export type SagaStepDefinition<TInput = unknown, TOutput = unknown> = {
  readonly id: string;
  readonly input?: SagaStepInputResolver;
  readonly run: SagaStepHandler<TInput, TOutput>;
  readonly compensate?: SagaCompensationHandler<TInput>;
  readonly retry?: SagaRetryPolicy;
  readonly idempotencyKey?: string | SagaStepIdempotencyResolver;
};

export type SagaDefinition = {
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly SagaStepDefinition[];
  readonly idempotencyKey?: string | SagaIdempotencyResolver;
  readonly outbox?: SagaOutboxPublisher;
  readonly metadata?: Record<string, unknown>;
};

export type SagaStepExecutionRecord = {
  readonly id: string;
  readonly status: SagaStepStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly input: unknown;
  readonly result?: unknown;
  readonly error?: SagaFailure;
  readonly compensationResult?: unknown;
  readonly compensationError?: SagaFailure;
  readonly idempotencyKey?: string;
  readonly outboxMessages: readonly SagaOutboxRecord[];
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly compensationStartedAt?: Date;
  readonly compensationCompletedAt?: Date;
};

export type SagaExecution = {
  readonly id: string;
  readonly sagaName: string;
  readonly status: SagaExecutionStatus;
  readonly payload: unknown;
  readonly steps: readonly SagaStepExecutionRecord[];
  readonly result?: unknown;
  readonly error?: SagaFailure;
  readonly compensationFailures: readonly SagaFailure[];
  readonly idempotencyKey?: string;
  readonly replayOf?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
};

export type CreateSagaExecutionParams = {
  readonly sagaName: string;
  readonly payload: unknown;
  readonly idempotencyKey?: string;
  readonly replayOf?: string;
  readonly metadata?: Record<string, unknown>;
};

export type ListSagaExecutionsOptions = {
  readonly sagaName?: string;
  readonly status?: SagaExecutionStatus;
  readonly replayOf?: string | null;
  /** Positive integer maximum number of executions to return. */
  readonly limit?: number;
  /** Non-negative integer number of executions to skip. */
  readonly offset?: number;
};

export type ReplaySagaParams = {
  readonly payload?: unknown;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
};

export type SagaRunResult = {
  readonly executionId: string;
  readonly definition: SagaDefinition;
  readonly execution: SagaExecution;
  readonly steps: readonly SagaStepResult[];
  readonly result?: unknown;
  readonly reused: boolean;
};

export interface SagaStore {
  create(params: CreateSagaExecutionParams): Promise<SagaExecution>;
  findById(id: string): Promise<SagaExecution | null>;
  findByIdempotencyKey(sagaName: string, key: string): Promise<SagaExecution | null>;
  update(id: string, data: Partial<SagaExecution>): Promise<SagaExecution>;
  list(options?: ListSagaExecutionsOptions): Promise<SagaExecution[]>;
}
