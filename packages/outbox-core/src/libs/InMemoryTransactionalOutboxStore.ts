import { AsyncLocalStorage } from "node:async_hooks";
import type { Problem } from "@croco/problems-core";
import { assertValidClaimBatchOptions } from "./claimValidation";
import {
  createOutboxFailureProblemExtensions,
  OutboxFailureMetadataProblem,
  OutboxRecordIdConflictProblem,
  OutboxUnitOfWorkContextProblem,
  readOutboxFailureMetadata,
} from "./problems/OutboxProblems";
import type {
  ClaimBatchOptions,
  ClaimedOutboxRecord,
  DispatchResult,
  OutboxClaim,
  OutboxFailureMetadata,
  OutboxIntent,
  OutboxRecord,
  OutboxRecordOptions,
  OutboxRetryMetadata,
  OutboxTenantBoundary,
  TransactionalOutboxStore,
  TransactionalOutboxStoreContext,
} from "./types";

export type InMemoryTransactionalOutboxStoreState = {
  records: Map<string, OutboxRecord>;
  idByIdempotencyScope: Map<string, string>;
};

export type InMemoryTransactionalOutboxStoreClient = {
  state: InMemoryTransactionalOutboxStoreState;
};

const DEFAULT_MAX_ATTEMPTS = 3;

function createEmptyState(): InMemoryTransactionalOutboxStoreState {
  return {
    records: new Map(),
    idByIdempotencyScope: new Map(),
  };
}

function cloneDate(value: Date | undefined): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return structuredClone(value);
}

function cloneProblemDetails(
  problem: ReturnType<Problem["toJSON"]>,
): ReturnType<Problem["toJSON"]> {
  return structuredClone(problem);
}

function cloneRetry(retry: OutboxRetryMetadata): OutboxRetryMetadata {
  return {
    ...retry,
    ...(cloneDate(retry.lastFailedAt) ? { lastFailedAt: cloneDate(retry.lastFailedAt) } : {}),
    ...(cloneDate(retry.nextVisibleAt) ? { nextVisibleAt: cloneDate(retry.nextVisibleAt) } : {}),
  };
}

function cloneClaim(claim: OutboxClaim | undefined): OutboxClaim | undefined {
  return claim
    ? {
        ...claim,
        claimedAt: new Date(claim.claimedAt.getTime()),
        expiresAt: new Date(claim.expiresAt.getTime()),
      }
    : undefined;
}

function cloneDispatchResult(result: DispatchResult | undefined): DispatchResult | undefined {
  return result
    ? {
        ...result,
        dispatchedAt: new Date(result.dispatchedAt.getTime()),
        ...(result.metadata ? { metadata: cloneRecord(result.metadata) } : {}),
      }
    : undefined;
}

function cloneOutboxRecord(record: OutboxRecord): OutboxRecord {
  return {
    ...record,
    tenant: { ...record.tenant },
    source: { ...record.source },
    payload: cloneRecord(record.payload),
    ...(record.traceContext
      ? {
          traceContext: {
            ...record.traceContext,
            ...(record.traceContext.baggage ? { baggage: { ...record.traceContext.baggage } } : {}),
            ...(record.traceContext.attributes
              ? { attributes: { ...record.traceContext.attributes } }
              : {}),
          },
        }
      : {}),
    metadata: cloneRecord(record.metadata),
    retry: cloneRetry(record.retry),
    availableAt: new Date(record.availableAt.getTime()),
    occurredAt: new Date(record.occurredAt.getTime()),
    createdAt: new Date(record.createdAt.getTime()),
    updatedAt: new Date(record.updatedAt.getTime()),
    ...(cloneClaim(record.claim) ? { claim: cloneClaim(record.claim) } : {}),
    ...(cloneDispatchResult(record.dispatchResult)
      ? { dispatchResult: cloneDispatchResult(record.dispatchResult) }
      : {}),
    ...(record.failure
      ? {
          failure: {
            problem: cloneProblemDetails(record.failure.problem),
            retry: {
              ...record.failure.retry,
              failedAt: new Date(record.failure.retry.failedAt.getTime()),
              ...(record.failure.retry.nextVisibleAt
                ? {
                    nextVisibleAt: new Date(record.failure.retry.nextVisibleAt.getTime()),
                  }
                : {}),
            },
          },
        }
      : {}),
  };
}

function cloneState(
  state: InMemoryTransactionalOutboxStoreState,
): InMemoryTransactionalOutboxStoreState {
  const records = new Map<string, OutboxRecord>();
  for (const [id, record] of state.records) {
    records.set(id, cloneOutboxRecord(record));
  }

  return {
    records,
    idByIdempotencyScope: new Map(state.idByIdempotencyScope),
  };
}

function compareDates(left: Date, right: Date): number {
  return left.getTime() - right.getTime();
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function encodeIdentity(parts: readonly (string | null)[]): string {
  return JSON.stringify(parts);
}

function tenantKey(tenant: OutboxTenantBoundary): string {
  return encodeIdentity([tenant.tenantId, tenant.isolationKey ?? null]);
}

function idempotencyScopeKey(intent: OutboxIntent): string {
  return encodeIdentity([
    intent.tenant.tenantId,
    intent.tenant.isolationKey ?? null,
    intent.idempotencyKey,
  ]);
}

function defaultIdFactory(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFailureMetadata(
  failure: OutboxFailureMetadata,
  maxAttempts: number,
): OutboxFailureMetadata {
  const terminal = failure.terminal || failure.attempt >= maxAttempts;
  const shouldRetry = failure.retryable && !terminal;

  return {
    retryable: failure.retryable,
    terminal,
    attempt: failure.attempt,
    maxAttempts,
    failedAt: new Date(failure.failedAt.getTime()),
    ...(shouldRetry && failure.nextVisibleAt
      ? { nextVisibleAt: new Date(failure.nextVisibleAt.getTime()) }
      : {}),
  };
}

/**
 * In-memory transactional outbox store implementation for conformance tests and local fixtures.
 */
export class InMemoryTransactionalOutboxStore implements TransactionalOutboxStore<InMemoryTransactionalOutboxStoreClient> {
  private rootState = createEmptyState();
  private readonly clients = new WeakSet<InMemoryTransactionalOutboxStoreClient>();
  private readonly activeUnitOfWork =
    new AsyncLocalStorage<InMemoryTransactionalOutboxStoreClient>();
  private mutationQueue: Promise<void> = Promise.resolve();

  async runInUnitOfWork<T>(
    fn: (
      context: TransactionalOutboxStoreContext<InMemoryTransactionalOutboxStoreClient>,
    ) => Promise<T>,
  ): Promise<T> {
    this.assertNoActiveUnitOfWorkRootMutation();

    return this.enqueue(async () => {
      const client: InMemoryTransactionalOutboxStoreClient = {
        state: cloneState(this.rootState),
      };
      this.clients.add(client);

      try {
        const result = await this.activeUnitOfWork.run(client, () => fn({ client }));
        this.rootState = cloneState(client.state);
        return result;
      } finally {
        this.clients.delete(client);
      }
    });
  }

  async clear(): Promise<void> {
    this.assertNoActiveUnitOfWorkRootMutation();

    await this.enqueue(() => {
      this.rootState = createEmptyState();
    });
  }

  async record(
    intent: OutboxIntent,
    options: OutboxRecordOptions<InMemoryTransactionalOutboxStoreClient>,
  ): Promise<OutboxRecord> {
    if (!options.context) {
      this.assertNoActiveUnitOfWorkRootMutation();
      return this.enqueue(() => this.recordInState(this.rootState, intent, options));
    }

    return this.recordInState(this.resolveState(options.context), intent, options);
  }

  async claimBatch(
    options: ClaimBatchOptions<InMemoryTransactionalOutboxStoreClient>,
  ): Promise<ClaimedOutboxRecord[]> {
    const claimOptions: ClaimBatchOptions<InMemoryTransactionalOutboxStoreClient> = {
      ...options,
      now: new Date(options.now.getTime()),
      ...(options.tenant ? { tenant: { ...options.tenant } } : {}),
    };
    assertValidClaimBatchOptions(claimOptions);

    if (!claimOptions.context) {
      this.assertNoActiveUnitOfWorkRootMutation();
      return this.enqueue(() => this.claimBatchInState(this.rootState, claimOptions));
    }

    return this.claimBatchInState(this.resolveState(claimOptions.context), claimOptions);
  }

  async markDispatched(id: string, result: DispatchResult): Promise<void> {
    this.assertNoActiveUnitOfWorkRootMutation();

    await this.enqueue(() => {
      this.markDispatchedInState(this.rootState, id, result);
    });
  }

  async markFailed(id: string, problem: Problem): Promise<void> {
    this.assertNoActiveUnitOfWorkRootMutation();

    const failure = readOutboxFailureMetadata(problem);
    if (!failure) {
      throw new OutboxFailureMetadataProblem();
    }

    await this.enqueue(() => {
      this.markFailedInState(this.rootState, id, problem, failure);
    });
  }

  async findRecord(id: string): Promise<OutboxRecord | null> {
    const record = this.rootState.records.get(id);
    return record ? cloneOutboxRecord(record) : null;
  }

  async listRecords(): Promise<OutboxRecord[]> {
    return [...this.rootState.records.values()]
      .sort((left, right) => compareDates(left.createdAt, right.createdAt))
      .map(cloneOutboxRecord);
  }

  private enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(task, task);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private recordInState(
    state: InMemoryTransactionalOutboxStoreState,
    intent: OutboxIntent,
    options: OutboxRecordOptions<InMemoryTransactionalOutboxStoreClient>,
  ): OutboxRecord {
    const scopedKey = idempotencyScopeKey(intent);
    const existingId = state.idByIdempotencyScope.get(scopedKey);
    if (existingId) {
      const existing = state.records.get(existingId);
      if (existing) {
        return cloneOutboxRecord(existing);
      }
    }

    const now = options.now ?? new Date();
    const id = options.id ?? defaultIdFactory();
    if (state.records.has(id)) {
      throw new OutboxRecordIdConflictProblem(id);
    }

    const record: OutboxRecord = {
      id,
      type: intent.type,
      status: "pending",
      tenant: { ...intent.tenant },
      idempotencyKey: intent.idempotencyKey,
      source: { ...intent.source },
      payload: cloneRecord(intent.payload),
      ...(intent.traceContext ? { traceContext: { ...intent.traceContext } } : {}),
      metadata: cloneRecord(intent.metadata ?? {}),
      retry: {
        attempt: 0,
        maxAttempts: options.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        retryable: true,
        terminal: false,
      },
      availableAt: new Date((options.availableAt ?? now).getTime()),
      occurredAt: new Date((intent.occurredAt ?? now).getTime()),
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
    };

    state.records.set(record.id, cloneOutboxRecord(record));
    state.idByIdempotencyScope.set(scopedKey, record.id);
    return cloneOutboxRecord(record);
  }

  private claimBatchInState(
    state: InMemoryTransactionalOutboxStoreState,
    options: ClaimBatchOptions<InMemoryTransactionalOutboxStoreClient>,
  ): ClaimedOutboxRecord[] {
    const limit = Math.max(0, options.limit);
    const ready = [...state.records.values()]
      .filter((record) => this.isClaimable(record, options))
      .sort((left, right) => {
        const availableOrder = compareDates(left.availableAt, right.availableAt);
        return availableOrder === 0
          ? compareDates(left.createdAt, right.createdAt)
          : availableOrder;
      })
      .slice(0, limit);

    return ready.map((record) => {
      const attempt = record.retry.attempt + 1;
      const claim: OutboxClaim = {
        id: `${record.id}:${attempt}`,
        attempt,
        claimedAt: new Date(options.now.getTime()),
        expiresAt: addMs(options.now, options.visibilityTimeoutMs),
        ...(options.dispatcherId ? { dispatcherId: options.dispatcherId } : {}),
      };
      const claimed: ClaimedOutboxRecord = {
        ...cloneOutboxRecord(record),
        status: "claimed",
        retry: {
          ...cloneRetry(record.retry),
          attempt,
          nextVisibleAt: undefined,
        },
        claim,
        updatedAt: new Date(options.now.getTime()),
      };

      state.records.set(claimed.id, cloneOutboxRecord(claimed));
      return cloneOutboxRecord(claimed) as ClaimedOutboxRecord;
    });
  }

  private markDispatchedInState(
    state: InMemoryTransactionalOutboxStoreState,
    id: string,
    result: DispatchResult,
  ): void {
    const record = state.records.get(id);
    if (!record || !this.isActiveClaim(record, result.expectedAttempt)) {
      return;
    }

    state.records.set(
      id,
      cloneOutboxRecord({
        ...record,
        status: "dispatched",
        claim: undefined,
        dispatchResult: cloneDispatchResult(result),
        updatedAt: new Date(result.dispatchedAt.getTime()),
      }),
    );
  }

  private markFailedInState(
    state: InMemoryTransactionalOutboxStoreState,
    id: string,
    problem: Problem,
    failure: OutboxFailureMetadata,
  ): void {
    const record = state.records.get(id);
    if (!record || !this.isActiveClaim(record, failure.attempt)) {
      return;
    }

    const normalizedFailure = normalizeFailureMetadata(failure, record.retry.maxAttempts);
    const shouldRetry = normalizedFailure.retryable && !normalizedFailure.terminal;
    const problemDetails = {
      ...problem.toJSON(),
      ...createOutboxFailureProblemExtensions(normalizedFailure),
    };

    state.records.set(
      id,
      cloneOutboxRecord({
        ...record,
        status: shouldRetry ? "retrying" : "failed",
        claim: undefined,
        failure: {
          problem: problemDetails,
          retry: normalizedFailure,
        },
        retry: {
          attempt: normalizedFailure.attempt,
          maxAttempts: normalizedFailure.maxAttempts,
          retryable: normalizedFailure.retryable,
          terminal: normalizedFailure.terminal,
          lastFailedAt: new Date(normalizedFailure.failedAt.getTime()),
          ...(shouldRetry && normalizedFailure.nextVisibleAt
            ? {
                nextVisibleAt: new Date(normalizedFailure.nextVisibleAt.getTime()),
              }
            : {}),
        },
        availableAt:
          shouldRetry && normalizedFailure.nextVisibleAt
            ? new Date(normalizedFailure.nextVisibleAt.getTime())
            : new Date(record.availableAt.getTime()),
        updatedAt: new Date(normalizedFailure.failedAt.getTime()),
      }),
    );
  }

  private resolveState(
    context?: TransactionalOutboxStoreContext<InMemoryTransactionalOutboxStoreClient>,
  ): InMemoryTransactionalOutboxStoreState {
    if (!context) {
      return this.rootState;
    }

    const client = context.client;
    if (typeof client !== "object" || client === null || !this.clients.has(client)) {
      throw new OutboxUnitOfWorkContextProblem();
    }

    return client.state;
  }

  private assertNoActiveUnitOfWorkRootMutation(): void {
    if (this.activeUnitOfWork.getStore()) {
      throw new OutboxUnitOfWorkContextProblem();
    }
  }

  private isClaimable(
    record: OutboxRecord,
    options: ClaimBatchOptions<InMemoryTransactionalOutboxStoreClient>,
  ): boolean {
    if (options.tenant && tenantKey(record.tenant) !== tenantKey(options.tenant)) {
      return false;
    }

    if (record.status === "dispatched" || record.status === "failed") {
      return false;
    }

    if (record.availableAt.getTime() > options.now.getTime()) {
      return false;
    }

    if (record.status === "claimed") {
      return Boolean(record.claim && record.claim.expiresAt.getTime() <= options.now.getTime());
    }

    return record.status === "pending" || record.status === "retrying";
  }

  private isActiveClaim(record: OutboxRecord, expectedAttempt: number): boolean {
    return record.status === "claimed" && record.claim?.attempt === expectedAttempt;
  }
}
