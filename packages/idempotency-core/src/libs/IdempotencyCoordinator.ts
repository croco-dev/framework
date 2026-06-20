import type {
  IdempotencyAuditEvent,
  IdempotencyAuditSink,
  IdempotencyExecutionRequest,
  IdempotencyExecutionResult,
  IdempotencyHandler,
  IdempotencyStore,
} from "./types";
import { IdempotencyConflictProblem } from "./problems/IdempotencyProblems";

export type IdempotencyCoordinatorOptions<TResult = unknown> = {
  readonly store: IdempotencyStore<TResult>;
  readonly auditSink?: IdempotencyAuditSink;
};

export class IdempotencyCoordinator<TResult = unknown> {
  private readonly store: IdempotencyStore<TResult>;
  private readonly auditSink: IdempotencyAuditSink | undefined;

  constructor(options: IdempotencyCoordinatorOptions<TResult>) {
    this.store = options.store;
    this.auditSink = options.auditSink;
  }

  async execute(
    request: IdempotencyExecutionRequest,
    handler: IdempotencyHandler<TResult>,
  ): Promise<IdempotencyExecutionResult<TResult>> {
    const reservation = await this.reserve(request);

    if (reservation.outcome === "replay") {
      await this.record("idempotency.replayed", request, reservation.record.metadata);
      return {
        outcome: "replayed",
        response: reservation.response,
        record: reservation.record,
      };
    }

    if (reservation.outcome === "in-flight") {
      await this.record("idempotency.in_flight", request, reservation.record.metadata);
      return {
        outcome: "in-flight",
        record: reservation.record,
      };
    }

    if (reservation.outcome === "failed") {
      await this.record("idempotency.failed", request, reservation.record.metadata);
      return {
        outcome: "failed",
        record: reservation.record,
      };
    }

    await this.record("idempotency.reserved", request, reservation.record.metadata);

    let response: TResult;
    try {
      response = await handler();
    } catch (error) {
      await this.recordHandlerFailure(request, reservation.reservation.reservationId, error);
      throw error;
    }

    const record = await this.store.commit({
      key: request.key,
      reservationId: reservation.reservation.reservationId,
      response,
      ttlMs: request.ttlMs,
      metadata: request.metadata,
    });

    return {
      outcome: "executed",
      response,
      record,
    };
  }

  private async reserve(request: IdempotencyExecutionRequest) {
    try {
      return await this.store.reserve(request.key, {
        metadata: request.metadata,
        ttlMs: request.ttlMs,
      });
    } catch (error) {
      if (error instanceof IdempotencyConflictProblem) {
        await this.record("idempotency.conflict", request, request.metadata ?? {});
      }
      throw error;
    }
  }

  private async recordHandlerFailure(
    request: IdempotencyExecutionRequest,
    reservationId: string,
    error: unknown,
  ): Promise<void> {
    try {
      await this.store.fail({
        key: request.key,
        reservationId,
        problem: toProblemSummary(error),
        retryable: true,
        ttlMs: request.ttlMs,
        metadata: request.metadata,
      });
    } catch (failureRecordError) {
      attachFailureRecordError(error, failureRecordError);
    }
  }

  private async record(
    type: IdempotencyAuditEvent["type"],
    request: IdempotencyExecutionRequest,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditSink?.recordIdempotency({
      type,
      key: request.key.key,
      storageKey: request.key.storageKey,
      namespace: request.key.namespace,
      tenantId: request.key.tenantId,
      source: request.key.source,
      fingerprint: request.key.fingerprint,
      metadata,
    });
  }
}

function attachFailureRecordError(error: unknown, failureRecordError: unknown): void {
  if (typeof error !== "object" || error === null) {
    return;
  }

  Object.defineProperty(error, "idempotencyFailureRecordError", {
    configurable: true,
    enumerable: false,
    value: failureRecordError,
  });
}

export function createIdempotencyCoordinator<TResult>(
  options: IdempotencyCoordinatorOptions<TResult>,
): IdempotencyCoordinator<TResult> {
  return new IdempotencyCoordinator(options);
}

export function createIdempotentHandler<TContext, TResult>(
  coordinator: IdempotencyCoordinator<TResult>,
  resolveRequest: (context: TContext) => IdempotencyExecutionRequest,
  handler: (context: TContext) => Promise<TResult> | TResult,
): (context: TContext) => Promise<IdempotencyExecutionResult<TResult>> {
  return async (context) => coordinator.execute(resolveRequest(context), () => handler(context));
}

function toProblemSummary(error: unknown): {
  readonly code: string;
  readonly status?: number;
  readonly detail?: string;
} {
  if (typeof error !== "object" || error === null) {
    return {
      code: "unknown",
      detail: String(error),
    };
  }

  const candidate = error as {
    readonly code?: unknown;
    readonly status?: unknown;
    readonly detail?: unknown;
    readonly message?: unknown;
  };

  return {
    code: typeof candidate.code === "string" ? candidate.code : "unknown",
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
    detail:
      typeof candidate.detail === "string"
        ? candidate.detail
        : typeof candidate.message === "string"
          ? candidate.message
          : undefined,
  };
}
