import { AsyncLocalStorage } from "node:async_hooks";
import { isDeepStrictEqual } from "node:util";
import type { TxAdapter } from "@croco/tx-core";
import {
  type AppendOutboxMessageInput,
  createTransactionalEventDiagnostic,
  type InboxCompletionInput,
  type InboxFailureInput,
  type InboxStartInput,
  type InboxStartResult,
  type ListInboxRecordsOptions,
  type ListOutboxMessagesOptions,
  type OutboxClaimOptions,
  type OutboxCompletionInput,
  type OutboxDeadLetterInput,
  type OutboxFailureInput,
  type TransactionalEventDiagnostic,
  type TransactionalEventError,
  type TransactionalEventStore,
  type TransactionalEventStoreContext,
  type TransactionalInboxRecord,
  type TransactionalOutboxMessage,
} from "./TransactionalEvents";
import { findOutboxIdempotencyConflicts } from "./OutboxIdempotency";
import {
  InboxClaimConflictProblem,
  OutboxIdempotencyConflictProblem,
  OutboxStorageProblem,
} from "./problems/EventsTxProblems";

export type InMemoryTransactionalEventStoreState = {
  outbox: Map<string, TransactionalOutboxMessage>;
  outboxIdByIdempotencyKey: Map<string, string>;
  inbox: Map<string, TransactionalInboxRecord>;
};

export type InMemoryTransactionalEventStoreClient = {
  state: InMemoryTransactionalEventStoreState;
};

type OutboxAppendReservation = {
  owner: InMemoryTransactionalEventStoreClient;
  released: Promise<void>;
  release: () => void;
};

function createEmptyState(): InMemoryTransactionalEventStoreState {
  return {
    outbox: new Map(),
    outboxIdByIdempotencyKey: new Map(),
    inbox: new Map(),
  };
}

function cloneDate(value: Date | undefined): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}

function cloneDiagnostic(diagnostic: TransactionalEventDiagnostic): TransactionalEventDiagnostic {
  return {
    ...diagnostic,
    at: new Date(diagnostic.at.getTime()),
    ...(diagnostic.details ? { details: cloneRecord(diagnostic.details) } : {}),
  };
}

function cloneError(
  error: TransactionalEventError | undefined,
): TransactionalEventError | undefined {
  return error ? { ...error } : undefined;
}

function cloneOutboxMessage(message: TransactionalOutboxMessage): TransactionalOutboxMessage {
  return {
    ...message,
    payload: cloneRecord(message.payload),
    metadata: cloneRecord(message.metadata),
    ...(message.traceContext ? { traceContext: { ...message.traceContext } } : {}),
    visibleAt: new Date(message.visibleAt.getTime()),
    occurredAt: new Date(message.occurredAt.getTime()),
    createdAt: new Date(message.createdAt.getTime()),
    updatedAt: new Date(message.updatedAt.getTime()),
    ...(cloneDate(message.lockedUntil) ? { lockedUntil: cloneDate(message.lockedUntil) } : {}),
    ...(cloneDate(message.publishedAt) ? { publishedAt: cloneDate(message.publishedAt) } : {}),
    ...(cloneDate(message.deadLetteredAt)
      ? { deadLetteredAt: cloneDate(message.deadLetteredAt) }
      : {}),
    ...(cloneError(message.lastError) ? { lastError: cloneError(message.lastError) } : {}),
    diagnostics: message.diagnostics.map(cloneDiagnostic),
  };
}

function cloneInboxRecord(record: TransactionalInboxRecord): TransactionalInboxRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt.getTime()),
    updatedAt: new Date(record.updatedAt.getTime()),
    ...(cloneDate(record.processedAt) ? { processedAt: cloneDate(record.processedAt) } : {}),
    ...(cloneDate(record.failedAt) ? { failedAt: cloneDate(record.failedAt) } : {}),
    ...(cloneError(record.lastError) ? { lastError: cloneError(record.lastError) } : {}),
    metadata: cloneRecord(record.metadata),
    diagnostics: record.diagnostics.map(cloneDiagnostic),
  };
}

function cloneState(
  state: InMemoryTransactionalEventStoreState,
): InMemoryTransactionalEventStoreState {
  const outbox = new Map<string, TransactionalOutboxMessage>();
  for (const [id, message] of state.outbox) {
    outbox.set(id, cloneOutboxMessage(message));
  }

  const inbox = new Map<string, TransactionalInboxRecord>();
  for (const [key, record] of state.inbox) {
    inbox.set(key, cloneInboxRecord(record));
  }

  return {
    outbox,
    outboxIdByIdempotencyKey: new Map(state.outboxIdByIdempotencyKey),
    inbox,
  };
}

function compareDates(left: Date, right: Date): number {
  return left.getTime() - right.getTime();
}

function inboxStorageKey(consumerId: string, inboxKey: string): string {
  return `${consumerId}:${inboxKey}`;
}

function getAbortError(signal?: AbortSignal): Error | null {
  if (!signal?.aborted) {
    return null;
  }

  return signal.reason instanceof Error ? signal.reason : new Error("Transaction aborted");
}

function assertNotAborted(signal?: AbortSignal): void {
  const error = getAbortError(signal);
  if (error) {
    throw error;
  }
}

/**
 * In-memory transactional event store. It is intended for tests, local fixtures, and conformance suites.
 */
export class InMemoryTransactionalEventStore implements TransactionalEventStore<InMemoryTransactionalEventStoreClient> {
  private rootState = createEmptyState();
  private commitTail: Promise<void> = Promise.resolve();
  private clearGeneration = 0;
  private readonly outboxReservations = new Map<string, OutboxAppendReservation>();
  private readonly transactionOwnerByClient = new WeakMap<
    InMemoryTransactionalEventStoreClient,
    InMemoryTransactionalEventStoreClient
  >();
  private readonly transactionBaseByOwner = new WeakMap<
    InMemoryTransactionalEventStoreClient,
    InMemoryTransactionalEventStoreState
  >();
  private readonly transactionParentByOwner = new WeakMap<
    InMemoryTransactionalEventStoreClient,
    InMemoryTransactionalEventStoreClient
  >();
  private readonly transactionOwnerContext =
    new AsyncLocalStorage<InMemoryTransactionalEventStoreClient>();

  createTxAdapter(): TxAdapter<InMemoryTransactionalEventStoreClient> {
    return {
      transaction: async (fn, _options, signal) => {
        assertNotAborted(signal);
        const clearGeneration = this.clearGeneration;
        const baseState = cloneState(this.rootState);
        const client: InMemoryTransactionalEventStoreClient = {
          state: cloneState(baseState),
        };
        const parent = this.transactionOwnerContext.getStore();
        if (parent) {
          this.transactionParentByOwner.set(client, parent);
        }
        this.transactionOwnerByClient.set(client, client);
        this.transactionBaseByOwner.set(client, baseState);
        try {
          const result = await this.transactionOwnerContext.run(client, () => fn(client));
          assertNotAborted(signal);
          await this.commitTransaction(baseState, client.state, clearGeneration);
          return result;
        } finally {
          this.releaseOutboxReservations(client);
        }
      },
      savepoint: async (client, fn, _options, signal) => {
        assertNotAborted(signal);
        const nestedClient: InMemoryTransactionalEventStoreClient = {
          state: cloneState(client.state),
        };
        const owner = this.transactionOwnerByClient.get(client) ?? client;
        this.transactionOwnerByClient.set(nestedClient, owner);
        const result = await fn(nestedClient);
        assertNotAborted(signal);
        client.state = cloneState(nestedClient.state);
        return result;
      },
      supportsSavepoint: () => true,
    };
  }

  clear(): void {
    this.clearGeneration += 1;
    this.rootState = createEmptyState();
  }

  async appendOutbox(
    input: AppendOutboxMessageInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage> {
    const directOwner = await this.acquireOutboxReservation(input.idempotencyKey, context?.client);
    try {
      const state = this.resolveState(context);
      const existingId = state.outboxIdByIdempotencyKey.get(input.idempotencyKey);
      if (existingId) {
        const existing = state.outbox.get(existingId);
        if (existing) {
          this.assertIdempotentReplay(input, existing);
          return cloneOutboxMessage(existing);
        }
      }

      const now = input.diagnostics?.[0]?.at ?? new Date();
      const message: TransactionalOutboxMessage = {
        id: input.id,
        eventId: input.eventId,
        eventType: input.eventType,
        ...(input.aggregateId ? { aggregateId: input.aggregateId } : {}),
        idempotencyKey: input.idempotencyKey,
        payload: cloneRecord(input.payload),
        metadata: cloneRecord(input.metadata ?? {}),
        ...(input.traceContext ? { traceContext: { ...input.traceContext } } : {}),
        attempts: 0,
        maxAttempts: input.maxAttempts,
        status: "pending",
        visibleAt: new Date(input.visibleAt.getTime()),
        occurredAt: new Date(input.occurredAt.getTime()),
        createdAt: new Date(now.getTime()),
        updatedAt: new Date(now.getTime()),
        diagnostics: (input.diagnostics ?? []).map(cloneDiagnostic),
      };

      state.outbox.set(message.id, cloneOutboxMessage(message));
      state.outboxIdByIdempotencyKey.set(message.idempotencyKey, message.id);
      return cloneOutboxMessage(message);
    } finally {
      if (directOwner) {
        this.releaseOutboxReservations(directOwner);
      }
    }
  }

  async findOutboxById(
    id: string,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const message = this.resolveState(context).outbox.get(id);
    return message ? cloneOutboxMessage(message) : null;
  }

  async findOutboxByIdempotencyKey(
    idempotencyKey: string,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const state = this.resolveState(context);
    const id = state.outboxIdByIdempotencyKey.get(idempotencyKey);
    if (!id) {
      return null;
    }

    const message = state.outbox.get(id);
    return message ? cloneOutboxMessage(message) : null;
  }

  async claimOutboxBatch(
    options: OutboxClaimOptions,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage[]> {
    const state = this.resolveState(context);
    const lockedUntil = new Date(options.now.getTime() + options.visibilityTimeoutMs);
    const ready = [...state.outbox.values()]
      .filter((message) => this.isClaimable(message, options.now))
      .sort((left, right) => {
        const visibleOrder = compareDates(left.visibleAt, right.visibleAt);
        return visibleOrder === 0 ? compareDates(left.createdAt, right.createdAt) : visibleOrder;
      })
      .slice(0, options.limit);

    return ready.map((message) => {
      const updated: TransactionalOutboxMessage = {
        ...cloneOutboxMessage(message),
        attempts: message.attempts + 1,
        status: "publishing",
        lockedUntil,
        updatedAt: new Date(options.now.getTime()),
        diagnostics: [
          ...message.diagnostics.map(cloneDiagnostic),
          createTransactionalEventDiagnostic(
            "events-tx/outbox-claimed",
            "Outbox message claimed.",
            options.now,
            {
              attempts: message.attempts + 1,
            },
          ),
        ],
      };
      state.outbox.set(updated.id, cloneOutboxMessage(updated));
      return cloneOutboxMessage(updated);
    });
  }

  async markOutboxPublished(
    input: OutboxCompletionInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const state = this.resolveState(context);
    const message = this.requireOutboxMessage(state, input.id);
    if (!this.isActiveClaim(message, input.expectedAttempts)) {
      return null;
    }

    const updated: TransactionalOutboxMessage = {
      ...cloneOutboxMessage(message),
      status: "published",
      updatedAt: new Date(input.now.getTime()),
      publishedAt: new Date(input.now.getTime()),
      lockedUntil: undefined,
      diagnostics: [
        ...message.diagnostics.map(cloneDiagnostic),
        createTransactionalEventDiagnostic(
          "events-tx/outbox-published",
          "Outbox message published.",
          input.now,
        ),
      ],
    };
    state.outbox.set(input.id, cloneOutboxMessage(updated));
    return cloneOutboxMessage(updated);
  }

  async markOutboxFailed(
    input: OutboxFailureInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const state = this.resolveState(context);
    const message = this.requireOutboxMessage(state, input.id);
    if (!this.isActiveClaim(message, input.expectedAttempts)) {
      return null;
    }

    const exhausted = message.attempts >= message.maxAttempts;
    const updated: TransactionalOutboxMessage = {
      ...cloneOutboxMessage(message),
      status: exhausted ? "poisoned" : "retrying",
      visibleAt: exhausted
        ? new Date(input.now.getTime())
        : new Date(input.nextVisibleAt.getTime()),
      updatedAt: new Date(input.now.getTime()),
      lockedUntil: undefined,
      lastError: cloneError(input.error),
      ...(exhausted ? { deadLetterReason: input.error.message } : {}),
      diagnostics: [
        ...message.diagnostics.map(cloneDiagnostic),
        cloneDiagnostic(input.diagnostic),
        ...(exhausted
          ? [
              createTransactionalEventDiagnostic(
                "events-tx/outbox-poisoned",
                "Outbox message exhausted publish attempts.",
                input.now,
                {
                  attempts: message.attempts,
                  maxAttempts: message.maxAttempts,
                },
              ),
            ]
          : []),
      ],
    };
    state.outbox.set(input.id, cloneOutboxMessage(updated));
    return cloneOutboxMessage(updated);
  }

  async markOutboxDeadLettered(
    input: OutboxDeadLetterInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const state = this.resolveState(context);
    const message = this.requireOutboxMessage(state, input.id);
    if (message.status !== "poisoned" || message.attempts !== input.expectedAttempts) {
      return null;
    }

    const updated: TransactionalOutboxMessage = {
      ...cloneOutboxMessage(message),
      status: "dead_lettered",
      updatedAt: new Date(input.now.getTime()),
      deadLetteredAt: new Date(input.now.getTime()),
      deadLetterReason: input.reason,
      lockedUntil: undefined,
      diagnostics: [...message.diagnostics.map(cloneDiagnostic), cloneDiagnostic(input.diagnostic)],
    };
    state.outbox.set(input.id, cloneOutboxMessage(updated));
    return cloneOutboxMessage(updated);
  }

  async listOutboxMessages(
    options: ListOutboxMessagesOptions = {},
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalOutboxMessage[]> {
    const messages = [...this.resolveState(context).outbox.values()]
      .filter((message) => !options.status || message.status === options.status)
      .sort((left, right) => compareDates(left.createdAt, right.createdAt));

    return messages.slice(0, options.limit ?? messages.length).map(cloneOutboxMessage);
  }

  async startInboxProcessing(
    input: InboxStartInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<InboxStartResult> {
    await this.waitForPendingCommits(context);
    const state = this.resolveState(context);
    const storageKey = inboxStorageKey(input.consumerId, input.inboxKey);
    const existing = state.inbox.get(storageKey);

    if (existing && existing.status !== "failed") {
      return {
        status: "duplicate",
        record: cloneInboxRecord(existing),
      };
    }

    if (existing) {
      const retrying: TransactionalInboxRecord = {
        ...cloneInboxRecord(existing),
        status: "processing",
        attempts: existing.attempts + 1,
        updatedAt: new Date(input.now.getTime()),
        diagnostics: [
          ...existing.diagnostics.map(cloneDiagnostic),
          createTransactionalEventDiagnostic(
            "events-tx/inbox-retry-started",
            "Inbox retry started.",
            input.now,
          ),
        ],
      };
      state.inbox.set(storageKey, cloneInboxRecord(retrying));
      return {
        status: "started",
        record: cloneInboxRecord(retrying),
      };
    }

    const record: TransactionalInboxRecord = {
      consumerId: input.consumerId,
      messageId: input.messageId,
      inboxKey: input.inboxKey,
      eventType: input.eventType,
      status: "processing",
      attempts: 1,
      createdAt: new Date(input.now.getTime()),
      updatedAt: new Date(input.now.getTime()),
      metadata: cloneRecord(input.metadata ?? {}),
      diagnostics: [
        createTransactionalEventDiagnostic(
          "events-tx/inbox-started",
          "Inbox processing started.",
          input.now,
          {
            eventType: input.eventType,
          },
        ),
      ],
    };
    state.inbox.set(storageKey, cloneInboxRecord(record));
    return {
      status: "started",
      record: cloneInboxRecord(record),
    };
  }

  async markInboxProcessed(
    input: InboxCompletionInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalInboxRecord> {
    await this.waitForPendingCommits(context);
    const state = this.resolveState(context);
    const storageKey = inboxStorageKey(input.consumerId, input.inboxKey);
    const record = this.requireInboxRecord(state, storageKey);
    this.requireActiveInboxClaim(record, input);
    const updated: TransactionalInboxRecord = {
      ...cloneInboxRecord(record),
      status: "processed",
      updatedAt: new Date(input.now.getTime()),
      processedAt: new Date(input.now.getTime()),
      diagnostics: [
        ...record.diagnostics.map(cloneDiagnostic),
        ...(input.diagnostic ? [cloneDiagnostic(input.diagnostic)] : []),
      ],
    };
    state.inbox.set(storageKey, cloneInboxRecord(updated));
    return cloneInboxRecord(updated);
  }

  async markInboxFailed(
    input: InboxFailureInput,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalInboxRecord> {
    await this.waitForPendingCommits(context);
    const state = this.resolveState(context);
    const storageKey = inboxStorageKey(input.consumerId, input.inboxKey);
    const record = this.requireInboxRecord(state, storageKey);
    this.requireActiveInboxClaim(record, input);
    const updated: TransactionalInboxRecord = {
      ...cloneInboxRecord(record),
      status: "failed",
      updatedAt: new Date(input.now.getTime()),
      failedAt: new Date(input.now.getTime()),
      lastError: cloneError(input.error),
      failureReason: input.reason,
      diagnostics: [
        ...record.diagnostics.map(cloneDiagnostic),
        ...(input.diagnostic ? [cloneDiagnostic(input.diagnostic)] : []),
      ],
    };
    state.inbox.set(storageKey, cloneInboxRecord(updated));
    return cloneInboxRecord(updated);
  }

  async findInboxRecord(
    consumerId: string,
    inboxKey: string,
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalInboxRecord | null> {
    const record = this.resolveState(context).inbox.get(inboxStorageKey(consumerId, inboxKey));
    return record ? cloneInboxRecord(record) : null;
  }

  async listInboxRecords(
    options: ListInboxRecordsOptions = {},
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<TransactionalInboxRecord[]> {
    const records = [...this.resolveState(context).inbox.values()]
      .filter((record) => !options.consumerId || record.consumerId === options.consumerId)
      .filter((record) => !options.status || record.status === options.status)
      .sort((left, right) => compareDates(left.createdAt, right.createdAt));

    return records.slice(0, options.limit ?? records.length).map(cloneInboxRecord);
  }

  private resolveState(
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): InMemoryTransactionalEventStoreState {
    return context?.client?.state ?? this.rootState;
  }

  private async waitForPendingCommits(
    context?: TransactionalEventStoreContext<InMemoryTransactionalEventStoreClient>,
  ): Promise<void> {
    if (!context?.client) {
      await this.commitTail;
    }
  }

  private async commitTransaction(
    baseState: InMemoryTransactionalEventStoreState,
    stagedState: InMemoryTransactionalEventStoreState,
    clearGeneration: number,
  ): Promise<void> {
    const previousCommit = this.commitTail;
    let releaseCommit = (): void => {};
    this.commitTail = new Promise((resolve) => {
      releaseCommit = resolve;
    });

    await previousCommit;
    try {
      if (clearGeneration !== this.clearGeneration) {
        throw new OutboxStorageProblem("In-memory transaction was invalidated by clear().");
      }
      this.mergeTransactionState(baseState, stagedState);
    } finally {
      releaseCommit();
    }
  }

  private mergeTransactionState(
    baseState: InMemoryTransactionalEventStoreState,
    stagedState: InMemoryTransactionalEventStoreState,
  ): void {
    const nextState = cloneState(this.rootState);

    this.mergeMap(
      baseState.outbox,
      stagedState.outbox,
      nextState.outbox,
      cloneOutboxMessage,
      (key) => new OutboxStorageProblem(`Outbox message '${key}' changed concurrently.`),
    );
    this.mergeMap(
      baseState.outboxIdByIdempotencyKey,
      stagedState.outboxIdByIdempotencyKey,
      nextState.outboxIdByIdempotencyKey,
      (value) => value,
      (key) => new OutboxStorageProblem(`Outbox idempotency key '${key}' changed concurrently.`),
    );
    this.mergeMap(
      baseState.inbox,
      stagedState.inbox,
      nextState.inbox,
      cloneInboxRecord,
      (key, base, staged, actual) => {
        if (actual) {
          const expectedAttempts = staged?.attempts ?? base?.attempts ?? 0;
          return new InboxClaimConflictProblem(
            actual.consumerId,
            actual.inboxKey,
            expectedAttempts,
            actual.attempts,
            actual.status,
          );
        }
        return new OutboxStorageProblem(`Inbox record '${key}' changed concurrently.`);
      },
    );

    this.rootState = nextState;
  }

  private mergeMap<T>(
    base: Map<string, T>,
    staged: Map<string, T>,
    target: Map<string, T>,
    clone: (value: T) => T,
    conflict: (
      key: string,
      base: T | undefined,
      staged: T | undefined,
      actual: T | undefined,
    ) => Error,
  ): void {
    for (const key of new Set([...base.keys(), ...staged.keys()])) {
      const baseValue = base.get(key);
      const stagedValue = staged.get(key);
      if (isDeepStrictEqual(baseValue, stagedValue)) {
        continue;
      }

      const actualValue = target.get(key);
      if (!isDeepStrictEqual(baseValue, actualValue)) {
        throw conflict(key, baseValue, stagedValue, actualValue);
      }

      if (stagedValue === undefined) {
        target.delete(key);
      } else {
        target.set(key, clone(stagedValue));
      }
    }
  }

  private assertIdempotentReplay(
    input: AppendOutboxMessageInput,
    existing: TransactionalOutboxMessage,
  ): void {
    const conflictingFields = findOutboxIdempotencyConflicts(input, existing);
    if (conflictingFields.length > 0) {
      throw new OutboxIdempotencyConflictProblem(input.idempotencyKey, conflictingFields);
    }
  }

  private async acquireOutboxReservation(
    idempotencyKey: string,
    client: InMemoryTransactionalEventStoreClient | undefined,
  ): Promise<InMemoryTransactionalEventStoreClient | undefined> {
    const owner = client
      ? (this.transactionOwnerByClient.get(client) ?? client)
      : { state: this.rootState };
    while (true) {
      const reservation = this.outboxReservations.get(idempotencyKey);
      if (!reservation) {
        if (client) {
          this.adoptCommittedOutbox(idempotencyKey, client, owner);
        }
        let release = (): void => {};
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        this.outboxReservations.set(idempotencyKey, { owner, released, release });
        return client ? undefined : owner;
      }
      if (reservation.owner === owner) {
        return undefined;
      }
      if (client && this.isNestedTransaction(owner, reservation.owner)) {
        throw new OutboxStorageProblem(
          `Nested transaction cannot append reserved outbox idempotency key '${idempotencyKey}'.`,
        );
      }
      await reservation.released;
      if (client) {
        this.adoptCommittedOutbox(idempotencyKey, client, owner);
      }
    }
  }

  private adoptCommittedOutbox(
    idempotencyKey: string,
    client: InMemoryTransactionalEventStoreClient,
    owner: InMemoryTransactionalEventStoreClient,
  ): void {
    const id = this.rootState.outboxIdByIdempotencyKey.get(idempotencyKey);
    const message = id ? this.rootState.outbox.get(id) : undefined;
    const baseState = this.transactionBaseByOwner.get(owner);
    if (!id || !message || !baseState) {
      return;
    }
    for (const state of [baseState, client.state]) {
      state.outbox.set(id, cloneOutboxMessage(message));
      state.outboxIdByIdempotencyKey.set(idempotencyKey, id);
    }
  }

  private releaseOutboxReservations(owner: InMemoryTransactionalEventStoreClient): void {
    for (const [idempotencyKey, reservation] of this.outboxReservations) {
      if (reservation.owner === owner) {
        this.outboxReservations.delete(idempotencyKey);
        reservation.release();
      }
    }
  }

  private isNestedTransaction(
    owner: InMemoryTransactionalEventStoreClient,
    possibleAncestor: InMemoryTransactionalEventStoreClient,
  ): boolean {
    let current = this.transactionParentByOwner.get(owner);
    while (current) {
      if (current === possibleAncestor) {
        return true;
      }
      current = this.transactionParentByOwner.get(current);
    }
    return false;
  }

  private isClaimable(message: TransactionalOutboxMessage, now: Date): boolean {
    const visible = message.visibleAt.getTime() <= now.getTime();
    if (!visible) {
      return false;
    }

    if (message.status === "pending" || message.status === "retrying") {
      return true;
    }

    return (
      message.status === "publishing" &&
      message.lockedUntil !== undefined &&
      message.lockedUntil.getTime() <= now.getTime()
    );
  }

  private isActiveClaim(message: TransactionalOutboxMessage, expectedAttempts: number): boolean {
    return message.status === "publishing" && message.attempts === expectedAttempts;
  }

  private requireOutboxMessage(
    state: InMemoryTransactionalEventStoreState,
    id: string,
  ): TransactionalOutboxMessage {
    const message = state.outbox.get(id);
    if (!message) {
      throw new OutboxStorageProblem(`Outbox message '${id}' was not found.`);
    }
    return message;
  }

  private requireInboxRecord(
    state: InMemoryTransactionalEventStoreState,
    storageKey: string,
  ): TransactionalInboxRecord {
    const record = state.inbox.get(storageKey);
    if (!record) {
      throw new OutboxStorageProblem(`Inbox record '${storageKey}' was not found.`);
    }
    return record;
  }

  private requireActiveInboxClaim(
    record: TransactionalInboxRecord,
    input: InboxCompletionInput,
  ): void {
    if (record.status === "processing" && record.attempts === input.expectedAttempts) {
      return;
    }

    throw new InboxClaimConflictProblem(
      input.consumerId,
      input.inboxKey,
      input.expectedAttempts,
      record.attempts,
      record.status,
    );
  }
}
