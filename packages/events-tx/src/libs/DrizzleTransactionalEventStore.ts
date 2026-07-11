import type { EventTraceContext } from "@croco/events-core";
import type { TxManager } from "@croco/tx-core";
import { and, asc, eq, inArray, lte, or, type SQL } from "drizzle-orm";
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
import { InboxClaimConflictProblem, OutboxStorageProblem } from "./problems/EventsTxProblems";
import { transactionalInboxRecords, transactionalOutboxMessages } from "./schema";

type AwaitableRows = PromiseLike<unknown[]>;

type InsertQuery = {
  values(values: Record<string, unknown>): {
    onConflictDoNothing(config: { target: unknown }): {
      returning(): AwaitableRows;
    };
    returning(): AwaitableRows;
  };
};

type SelectWhereQuery = {
  limit(limit: number): AwaitableRows;
  orderBy(...orders: unknown[]): {
    limit(limit: number): AwaitableRows;
  };
};

type SelectQuery = {
  from(table: unknown): {
    where(condition: SQL<unknown> | undefined): SelectWhereQuery;
  };
};

type UpdateQuery = {
  set(values: Record<string, unknown>): {
    where(condition: SQL<unknown> | undefined): {
      returning(): AwaitableRows;
    };
  };
};

export type DrizzleTransactionalEventStoreDb = {
  insert(table: unknown): InsertQuery;
  select(): SelectQuery;
  update(table: unknown): UpdateQuery;
};

export type DrizzleTransactionalEventStoreTables = {
  outbox?: typeof transactionalOutboxMessages;
  inbox?: typeof transactionalInboxRecords;
};

export type DrizzleTransactionalEventStoreConfig<
  TDb extends DrizzleTransactionalEventStoreDb,
  TClient extends DrizzleTransactionalEventStoreDb = TDb,
> = {
  db: TDb;
  txManager?: Pick<TxManager<TClient>, "getClient">;
  tables?: DrizzleTransactionalEventStoreTables;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  const parsed = parseJson(value);
  return isRecord(parsed) ? parsed : {};
}

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return new Date(String(value));
}

function toOptionalDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return toDate(value);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toError(value: unknown): TransactionalEventError | undefined {
  const parsed = parseJson(value);
  if (!isRecord(parsed)) {
    return undefined;
  }

  return {
    name: typeof parsed.name === "string" ? parsed.name : "Error",
    message: typeof parsed.message === "string" ? parsed.message : "Unknown error",
    ...(typeof parsed.stack === "string" ? { stack: parsed.stack } : {}),
    ...(typeof parsed.code === "string" ? { code: parsed.code } : {}),
  };
}

function toDiagnostics(value: unknown): TransactionalEventDiagnostic[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isRecord).map((diagnostic) => ({
    code: typeof diagnostic.code === "string" ? diagnostic.code : "events-tx/unknown-diagnostic",
    message: typeof diagnostic.message === "string" ? diagnostic.message : "Unknown diagnostic",
    at: toDate(diagnostic.at),
    ...(isRecord(diagnostic.details) ? { details: diagnostic.details } : {}),
  }));
}

function appendDiagnostic(
  diagnostics: TransactionalEventDiagnostic[],
  diagnostic: TransactionalEventDiagnostic,
): TransactionalEventDiagnostic[] {
  return [...diagnostics, diagnostic];
}

function outboxId(row: Record<string, unknown>): string {
  return String(row.id);
}

/**
 * Drizzle query-client implementation for the transactional outbox/inbox store.
 */
export class DrizzleTransactionalEventStore<
  TDb extends DrizzleTransactionalEventStoreDb,
  TClient extends DrizzleTransactionalEventStoreDb = TDb,
> implements TransactionalEventStore<TClient> {
  private readonly outbox: typeof transactionalOutboxMessages;
  private readonly inbox: typeof transactionalInboxRecords;

  constructor(private readonly config: DrizzleTransactionalEventStoreConfig<TDb, TClient>) {
    this.outbox = config.tables?.outbox ?? transactionalOutboxMessages;
    this.inbox = config.tables?.inbox ?? transactionalInboxRecords;
  }

  async appendOutbox(
    input: AppendOutboxMessageInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage> {
    const existing = await this.findOutboxByIdempotencyKey(input.idempotencyKey, context);
    if (existing) {
      return existing;
    }

    const [inserted] = await this.client(context)
      .insert(this.outbox)
      .values({
        id: input.id,
        eventId: input.eventId,
        eventType: input.eventType,
        aggregateId: input.aggregateId ?? null,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        metadata: input.metadata ?? {},
        traceContext: input.traceContext ?? null,
        attempts: 0,
        maxAttempts: input.maxAttempts,
        status: "pending",
        visibleAt: input.visibleAt,
        occurredAt: input.occurredAt,
        createdAt: input.diagnostics?.[0]?.at ?? new Date(),
        updatedAt: input.diagnostics?.[0]?.at ?? new Date(),
        lockedUntil: null,
        publishedAt: null,
        lastError: null,
        deadLetteredAt: null,
        deadLetterReason: null,
        diagnostics: input.diagnostics ?? [],
      })
      .onConflictDoNothing({ target: this.outbox.idempotencyKey })
      .returning();

    if (inserted && isRecord(inserted)) {
      return this.mapOutboxRow(inserted);
    }

    const duplicated = await this.findOutboxByIdempotencyKey(input.idempotencyKey, context);
    if (duplicated) {
      return duplicated;
    }

    throw new OutboxStorageProblem("Failed to insert or resolve outbox message conflict.");
  }

  async findOutboxById(
    id: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const [row] = await this.client(context)
      .select()
      .from(this.outbox)
      .where(eq(this.outbox.id, id))
      .limit(1);
    return isRecord(row) ? this.mapOutboxRow(row) : null;
  }

  async findOutboxByIdempotencyKey(
    idempotencyKey: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const [row] = await this.client(context)
      .select()
      .from(this.outbox)
      .where(eq(this.outbox.idempotencyKey, idempotencyKey))
      .limit(1);
    return isRecord(row) ? this.mapOutboxRow(row) : null;
  }

  async claimOutboxBatch(
    options: OutboxClaimOptions,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage[]> {
    const rows = await this.client(context)
      .select()
      .from(this.outbox)
      .where(this.outboxClaimableCondition(options.now))
      .orderBy(asc(this.outbox.visibleAt), asc(this.outbox.createdAt))
      .limit(options.limit);

    const lockedUntil = new Date(options.now.getTime() + options.visibilityTimeoutMs);
    const claimed: TransactionalOutboxMessage[] = [];

    for (const row of rows) {
      if (!isRecord(row)) {
        continue;
      }

      const current = this.mapOutboxRow(row);
      const [updated] = await this.client(context)
        .update(this.outbox)
        .set({
          attempts: current.attempts + 1,
          status: "publishing",
          lockedUntil,
          updatedAt: options.now,
          diagnostics: appendDiagnostic(
            current.diagnostics,
            createTransactionalEventDiagnostic(
              "events-tx/outbox-claimed",
              "Outbox message claimed.",
              options.now,
              {
                attempts: current.attempts + 1,
              },
            ),
          ),
        })
        .where(and(eq(this.outbox.id, current.id), this.outboxClaimableCondition(options.now)))
        .returning();

      if (isRecord(updated)) {
        claimed.push(this.mapOutboxRow(updated));
      }
    }

    return claimed;
  }

  async markOutboxPublished(
    input: OutboxCompletionInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const current = await this.requireOutbox(input.id, context);
    if (!this.isActiveClaim(current, input.expectedAttempts)) {
      return null;
    }

    const [updated] = await this.client(context)
      .update(this.outbox)
      .set({
        status: "published",
        updatedAt: input.now,
        publishedAt: input.now,
        lockedUntil: null,
        diagnostics: appendDiagnostic(
          current.diagnostics,
          createTransactionalEventDiagnostic(
            "events-tx/outbox-published",
            "Outbox message published.",
            input.now,
          ),
        ),
      })
      .where(this.activeClaimCondition(input.id, input.expectedAttempts))
      .returning();
    return isRecord(updated) ? this.mapOutboxRow(updated) : null;
  }

  async markOutboxFailed(
    input: OutboxFailureInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const current = await this.requireOutbox(input.id, context);
    if (!this.isActiveClaim(current, input.expectedAttempts)) {
      return null;
    }

    const exhausted = current.attempts >= current.maxAttempts;
    const diagnostics = appendDiagnostic(current.diagnostics, input.diagnostic);
    const [updated] = await this.client(context)
      .update(this.outbox)
      .set({
        status: exhausted ? "poisoned" : "retrying",
        visibleAt: exhausted ? input.now : input.nextVisibleAt,
        updatedAt: input.now,
        lockedUntil: null,
        lastError: input.error,
        deadLetterReason: exhausted ? input.error.message : null,
        diagnostics: exhausted
          ? appendDiagnostic(
              diagnostics,
              createTransactionalEventDiagnostic(
                "events-tx/outbox-poisoned",
                "Outbox message exhausted publish attempts.",
                input.now,
                {
                  attempts: current.attempts,
                  maxAttempts: current.maxAttempts,
                },
              ),
            )
          : diagnostics,
      })
      .where(this.activeClaimCondition(input.id, input.expectedAttempts))
      .returning();
    return isRecord(updated) ? this.mapOutboxRow(updated) : null;
  }

  async markOutboxDeadLettered(
    input: OutboxDeadLetterInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const current = await this.requireOutbox(input.id, context);
    if (current.status !== "poisoned" || current.attempts !== input.expectedAttempts) {
      return null;
    }

    const [updated] = await this.client(context)
      .update(this.outbox)
      .set({
        status: "dead_lettered",
        updatedAt: input.now,
        deadLetteredAt: input.now,
        deadLetterReason: input.reason,
        lockedUntil: null,
        diagnostics: appendDiagnostic(current.diagnostics, input.diagnostic),
      })
      .where(this.poisonedClaimCondition(input.id, input.expectedAttempts))
      .returning();
    return isRecord(updated) ? this.mapOutboxRow(updated) : null;
  }

  async listOutboxMessages(
    options: ListOutboxMessagesOptions = {},
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage[]> {
    const rows = await this.client(context)
      .select()
      .from(this.outbox)
      .where(options.status ? eq(this.outbox.status, options.status) : undefined)
      .orderBy(asc(this.outbox.createdAt))
      .limit(options.limit ?? 100);
    return rows.filter(isRecord).map((row) => this.mapOutboxRow(row));
  }

  async startInboxProcessing(
    input: InboxStartInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<InboxStartResult> {
    const existing = await this.findInboxRecord(input.consumerId, input.inboxKey, context);
    if (existing && existing.status !== "failed") {
      return {
        status: "duplicate",
        record: existing,
      };
    }

    if (existing) {
      const [updated] = await this.client(context)
        .update(this.inbox)
        .set({
          status: "processing",
          attempts: existing.attempts + 1,
          updatedAt: input.now,
          diagnostics: appendDiagnostic(
            existing.diagnostics,
            createTransactionalEventDiagnostic(
              "events-tx/inbox-retry-started",
              "Inbox retry started.",
              input.now,
            ),
          ),
        })
        .where(this.failedInboxCondition(input.consumerId, input.inboxKey))
        .returning();
      return isRecord(updated)
        ? {
            status: "started",
            record: this.mapInboxRow(updated),
          }
        : {
            status: "duplicate",
            record: existing,
          };
    }

    const [inserted] = await this.client(context)
      .insert(this.inbox)
      .values({
        consumerId: input.consumerId,
        messageId: input.messageId,
        inboxKey: input.inboxKey,
        eventType: input.eventType,
        status: "processing",
        attempts: 1,
        createdAt: input.now,
        updatedAt: input.now,
        processedAt: null,
        failedAt: null,
        lastError: null,
        failureReason: null,
        metadata: input.metadata ?? {},
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
      })
      .onConflictDoNothing({ target: [this.inbox.consumerId, this.inbox.inboxKey] })
      .returning();

    if (!inserted || !isRecord(inserted)) {
      const duplicated = await this.findInboxRecord(input.consumerId, input.inboxKey, context);
      if (!duplicated) {
        throw new OutboxStorageProblem(
          `Inbox record '${input.consumerId}:${input.inboxKey}' conflict could not be resolved.`,
        );
      }

      if (duplicated.status !== "failed") {
        return {
          status: "duplicate",
          record: duplicated,
        };
      }

      const [retrying] = await this.client(context)
        .update(this.inbox)
        .set({
          status: "processing",
          attempts: duplicated.attempts + 1,
          updatedAt: input.now,
          diagnostics: appendDiagnostic(
            duplicated.diagnostics,
            createTransactionalEventDiagnostic(
              "events-tx/inbox-retry-started",
              "Inbox retry started.",
              input.now,
            ),
          ),
        })
        .where(this.failedInboxCondition(input.consumerId, input.inboxKey))
        .returning();

      return isRecord(retrying)
        ? {
            status: "started",
            record: this.mapInboxRow(retrying),
          }
        : {
            status: "duplicate",
            record: duplicated,
          };
    }

    return {
      status: "started",
      record: this.requireMappedInbox(inserted, input.consumerId, input.inboxKey),
    };
  }

  async markInboxProcessed(
    input: InboxCompletionInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord> {
    const current = await this.requireInbox(input.consumerId, input.inboxKey, context);
    const [updated] = await this.client(context)
      .update(this.inbox)
      .set({
        status: "processed",
        processedAt: input.now,
        updatedAt: input.now,
        diagnostics: input.diagnostic
          ? appendDiagnostic(current.diagnostics, input.diagnostic)
          : current.diagnostics,
      })
      .where(
        this.activeInboxClaimCondition(input.consumerId, input.inboxKey, input.expectedAttempts),
      )
      .returning();
    return isRecord(updated)
      ? this.mapInboxRow(updated)
      : this.throwInboxClaimConflict(input, context);
  }

  async markInboxFailed(
    input: InboxFailureInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord> {
    const current = await this.requireInbox(input.consumerId, input.inboxKey, context);
    const [updated] = await this.client(context)
      .update(this.inbox)
      .set({
        status: "failed",
        failedAt: input.now,
        updatedAt: input.now,
        lastError: input.error,
        failureReason: input.reason,
        diagnostics: input.diagnostic
          ? appendDiagnostic(current.diagnostics, input.diagnostic)
          : current.diagnostics,
      })
      .where(
        this.activeInboxClaimCondition(input.consumerId, input.inboxKey, input.expectedAttempts),
      )
      .returning();
    return isRecord(updated)
      ? this.mapInboxRow(updated)
      : this.throwInboxClaimConflict(input, context);
  }

  async findInboxRecord(
    consumerId: string,
    inboxKey: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord | null> {
    const [row] = await this.client(context)
      .select()
      .from(this.inbox)
      .where(this.inboxStorageCondition(consumerId, inboxKey))
      .limit(1);
    return isRecord(row) ? this.mapInboxRow(row) : null;
  }

  async listInboxRecords(
    options: ListInboxRecordsOptions = {},
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord[]> {
    const conditions: SQL<unknown>[] = [];
    if (options.consumerId) {
      conditions.push(eq(this.inbox.consumerId, options.consumerId));
    }
    if (options.status) {
      conditions.push(eq(this.inbox.status, options.status));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await this.client(context)
      .select()
      .from(this.inbox)
      .where(whereClause)
      .orderBy(asc(this.inbox.createdAt))
      .limit(options.limit ?? 100);
    return rows.filter(isRecord).map((row) => this.mapInboxRow(row));
  }

  private client(
    context?: TransactionalEventStoreContext<TClient>,
  ): DrizzleTransactionalEventStoreDb {
    return context?.client ?? this.config.txManager?.getClient() ?? this.config.db;
  }

  private inboxStorageCondition(consumerId: string, inboxKey: string): SQL<unknown> | undefined {
    return and(eq(this.inbox.consumerId, consumerId), eq(this.inbox.inboxKey, inboxKey));
  }

  private failedInboxCondition(consumerId: string, inboxKey: string): SQL<unknown> | undefined {
    return and(
      eq(this.inbox.consumerId, consumerId),
      eq(this.inbox.inboxKey, inboxKey),
      eq(this.inbox.status, "failed"),
    );
  }

  private activeInboxClaimCondition(
    consumerId: string,
    inboxKey: string,
    expectedAttempts: number,
  ): SQL<unknown> | undefined {
    return and(
      eq(this.inbox.consumerId, consumerId),
      eq(this.inbox.inboxKey, inboxKey),
      eq(this.inbox.status, "processing"),
      eq(this.inbox.attempts, expectedAttempts),
    );
  }

  private activeClaimCondition(id: string, expectedAttempts: number): SQL<unknown> | undefined {
    return and(
      eq(this.outbox.id, id),
      eq(this.outbox.status, "publishing"),
      eq(this.outbox.attempts, expectedAttempts),
    );
  }

  private poisonedClaimCondition(id: string, expectedAttempts: number): SQL<unknown> | undefined {
    return and(
      eq(this.outbox.id, id),
      eq(this.outbox.status, "poisoned"),
      eq(this.outbox.attempts, expectedAttempts),
    );
  }

  private outboxClaimableCondition(now: Date): SQL<unknown> | undefined {
    return and(
      lte(this.outbox.visibleAt, now),
      or(
        inArray(this.outbox.status, ["pending", "retrying"]),
        and(eq(this.outbox.status, "publishing"), lte(this.outbox.lockedUntil, now)),
      ),
    );
  }

  private async requireOutbox(
    id: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage> {
    const message = await this.findOutboxById(id, context);
    if (!message) {
      throw new OutboxStorageProblem(`Outbox message '${id}' was not found.`);
    }
    return message;
  }

  private async requireInbox(
    consumerId: string,
    inboxKey: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalInboxRecord> {
    const record = await this.findInboxRecord(consumerId, inboxKey, context);
    if (!record) {
      throw new OutboxStorageProblem(`Inbox record '${consumerId}:${inboxKey}' was not found.`);
    }
    return record;
  }

  private async throwInboxClaimConflict(
    input: InboxCompletionInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<never> {
    const actual = await this.requireInbox(input.consumerId, input.inboxKey, context);
    throw new InboxClaimConflictProblem(
      input.consumerId,
      input.inboxKey,
      input.expectedAttempts,
      actual.attempts,
      actual.status,
    );
  }

  private requireMappedOutbox(row: unknown, id: string): TransactionalOutboxMessage {
    if (!isRecord(row)) {
      throw new OutboxStorageProblem(`Outbox message '${id}' was not found.`);
    }
    return this.mapOutboxRow(row);
  }

  private isActiveClaim(message: TransactionalOutboxMessage, expectedAttempts: number): boolean {
    return message.status === "publishing" && message.attempts === expectedAttempts;
  }

  private requireMappedInbox(
    row: unknown,
    consumerId: string,
    inboxKey: string,
  ): TransactionalInboxRecord {
    if (!isRecord(row)) {
      throw new OutboxStorageProblem(`Inbox record '${consumerId}:${inboxKey}' was not found.`);
    }
    return this.mapInboxRow(row);
  }

  private mapOutboxRow(row: Record<string, unknown>): TransactionalOutboxMessage {
    return {
      id: outboxId(row),
      eventId: String(row.eventId),
      eventType: String(row.eventType),
      ...(toOptionalString(row.aggregateId)
        ? { aggregateId: toOptionalString(row.aggregateId) }
        : {}),
      idempotencyKey: String(row.idempotencyKey),
      payload: toRecord(row.payload),
      metadata: toRecord(row.metadata),
      ...(this.toTraceContext(row.traceContext)
        ? { traceContext: this.toTraceContext(row.traceContext) }
        : {}),
      attempts: Number(row.attempts ?? 0),
      maxAttempts: Number(row.maxAttempts ?? 1),
      status: String(row.status) as TransactionalOutboxMessage["status"],
      visibleAt: toDate(row.visibleAt),
      occurredAt: toDate(row.occurredAt),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
      ...(toOptionalDate(row.lockedUntil) ? { lockedUntil: toOptionalDate(row.lockedUntil) } : {}),
      ...(toOptionalDate(row.publishedAt) ? { publishedAt: toOptionalDate(row.publishedAt) } : {}),
      lastError: toError(row.lastError),
      ...(toOptionalDate(row.deadLetteredAt)
        ? { deadLetteredAt: toOptionalDate(row.deadLetteredAt) }
        : {}),
      ...(toOptionalString(row.deadLetterReason)
        ? { deadLetterReason: toOptionalString(row.deadLetterReason) }
        : {}),
      diagnostics: toDiagnostics(row.diagnostics),
    };
  }

  private mapInboxRow(row: Record<string, unknown>): TransactionalInboxRecord {
    return {
      consumerId: String(row.consumerId),
      messageId: String(row.messageId),
      inboxKey: String(row.inboxKey),
      eventType: String(row.eventType),
      status: String(row.status) as TransactionalInboxRecord["status"],
      attempts: Number(row.attempts ?? 0),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
      ...(toOptionalDate(row.processedAt) ? { processedAt: toOptionalDate(row.processedAt) } : {}),
      ...(toOptionalDate(row.failedAt) ? { failedAt: toOptionalDate(row.failedAt) } : {}),
      lastError: toError(row.lastError),
      ...(toOptionalString(row.failureReason)
        ? { failureReason: toOptionalString(row.failureReason) }
        : {}),
      metadata: toRecord(row.metadata),
      diagnostics: toDiagnostics(row.diagnostics),
    };
  }

  private toTraceContext(value: unknown): EventTraceContext | undefined {
    const parsed = parseJson(value);
    if (!isRecord(parsed)) {
      return undefined;
    }

    return {
      ...(typeof parsed.traceId === "string" ? { traceId: parsed.traceId } : {}),
      ...(typeof parsed.spanId === "string" ? { spanId: parsed.spanId } : {}),
      ...(typeof parsed.traceFlags === "number" ? { traceFlags: parsed.traceFlags } : {}),
      ...(typeof parsed.isValid === "boolean" ? { isValid: parsed.isValid } : {}),
    };
  }
}
