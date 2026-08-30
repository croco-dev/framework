import type { EventTraceContext } from "@croco/events-core";
import type { TxManager } from "@croco/tx-core";
import { and, asc, eq, gt, inArray, lte, or, type SQL } from "drizzle-orm";
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
  type OutboxReleaseInput,
  type TransactionalEventDiagnostic,
  type TransactionalEventError,
  type TransactionalEventStore,
  type TransactionalEventStoreContext,
  type TransactionalInboxRecord,
  type TransactionalOutboxMessage,
  resolveInboxLockedUntil,
} from "./TransactionalEvents";
import { findOutboxIdempotencyConflicts } from "./OutboxIdempotency";
import {
  InboxClaimConflictProblem,
  OutboxIdempotencyConflictProblem,
  OutboxMessageIdConflictProblem,
  OutboxStorageProblem,
} from "./problems/EventsTxProblems";
import { transactionalInboxRecords, transactionalOutboxMessages } from "./schema";

type AwaitableRows = PromiseLike<unknown[]>;

type InsertQuery = {
  values(values: Record<string, unknown>): {
    onConflictDoNothing(config?: { target: unknown }): {
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

type StorageRowKind = "outbox" | "inbox";

type StorageRowContext = {
  kind: StorageRowKind;
  identity: string;
};

const OUTBOX_STATUSES = new Set([
  "pending",
  "publishing",
  "published",
  "retrying",
  "poisoned",
  "dead_lettered",
]);
const INBOX_STATUSES = new Set(["processing", "processed", "failed"]);

function safeIdentityPart(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 255 &&
    ![...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
    ? value
    : undefined;
}

function storageRowContext(kind: StorageRowKind, row: unknown): StorageRowContext {
  if (!isRecord(row)) {
    return { kind, identity: "<unknown>" };
  }

  if (kind === "outbox") {
    return { kind, identity: safeIdentityPart(row["id"]) ?? "<unknown>" };
  }

  const consumerId = safeIdentityPart(row["consumerId"]);
  const inboxKey = safeIdentityPart(row["inboxKey"]);
  return {
    kind,
    identity: consumerId && inboxKey ? `${consumerId}:${inboxKey}` : "<unknown>",
  };
}

function invalidStorageField(context: StorageRowContext, field: string, expected: string): never {
  throw new OutboxStorageProblem(
    `Persisted ${context.kind} row '${context.identity}' has invalid field '${field}'; expected ${expected}. Inspect and repair or remove the corrupt row before retrying.`,
  );
}

function requireRow(value: unknown, kind: StorageRowKind): Record<string, unknown> {
  if (!isRecord(value)) {
    invalidStorageField(storageRowContext(kind, value), "row", "a record object");
  }
  return value;
}

function parseJsonField(value: unknown, context: StorageRowContext, field: string): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return invalidStorageField(
      context,
      field,
      "valid serialized JSON or its driver-native representation",
    );
  }
}

function requireRecordField(
  value: unknown,
  context: StorageRowContext,
  field: string,
): Record<string, unknown> {
  const parsed = parseJsonField(value, context, field);
  if (!isRecord(parsed)) {
    return invalidStorageField(context, field, "a JSON object");
  }
  return parsed;
}

function requireNonEmptyString(value: unknown, context: StorageRowContext, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return invalidStorageField(context, field, "a non-empty string");
  }
  return value;
}

function requireString(value: unknown, context: StorageRowContext, field: string): string {
  if (typeof value !== "string") {
    return invalidStorageField(context, field, "a string");
  }
  return value;
}

function optionalNonEmptyString(
  value: unknown,
  context: StorageRowContext,
  field: string,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return requireNonEmptyString(value, context, field);
}

function optionalString(
  value: unknown,
  context: StorageRowContext,
  field: string,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return requireString(value, context, field);
}

function requireCount(
  value: unknown,
  context: StorageRowContext,
  field: string,
  minimum: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    return invalidStorageField(
      context,
      field,
      `a finite integer greater than or equal to ${minimum}`,
    );
  }
  return value;
}

function requireDate(value: unknown, context: StorageRowContext, field: string): Date {
  if (!(value instanceof Date) && typeof value !== "string") {
    return invalidStorageField(context, field, "a valid Date or date string");
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return invalidStorageField(context, field, "a valid Date or date string");
  }
  return date;
}

function optionalDate(value: unknown, context: StorageRowContext, field: string): Date | undefined {
  return value === null || value === undefined ? undefined : requireDate(value, context, field);
}

function requireStatus<T extends string>(
  value: unknown,
  context: StorageRowContext,
  field: string,
  statuses: ReadonlySet<string>,
): T {
  if (typeof value !== "string" || !statuses.has(value)) {
    return invalidStorageField(context, field, `one of ${[...statuses].join(", ")}`);
  }
  return value as T;
}

function optionalError(
  value: unknown,
  context: StorageRowContext,
  field: string,
): TransactionalEventError | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = requireRecordField(value, context, field);
  const name = requireString(parsed["name"], context, `${field}.name`);
  const message = requireString(parsed["message"], context, `${field}.message`);
  const stack = optionalString(parsed["stack"], context, `${field}.stack`);
  const code = optionalString(parsed["code"], context, `${field}.code`);
  return {
    name,
    message,
    ...(stack !== undefined ? { stack } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}

function requireDiagnostics(
  value: unknown,
  context: StorageRowContext,
  field: string,
): TransactionalEventDiagnostic[] {
  const parsed = parseJsonField(value, context, field);
  if (!Array.isArray(parsed)) {
    return invalidStorageField(context, field, "a JSON array of diagnostic objects");
  }
  return parsed.map((value, index) => {
    const itemField = `${field}[${index}]`;
    if (!isRecord(value)) {
      return invalidStorageField(context, itemField, "a diagnostic object");
    }
    const code = requireString(value["code"], context, `${itemField}.code`);
    const message = requireString(value["message"], context, `${itemField}.message`);
    const at = requireDate(value["at"], context, `${itemField}.at`);
    if (value["details"] !== undefined && !isRecord(value["details"])) {
      return invalidStorageField(context, `${itemField}.details`, "a JSON object when present");
    }
    return {
      code,
      message,
      at,
      ...(value["details"] ? { details: value["details"] } : {}),
    };
  });
}

function optionalTraceContext(
  value: unknown,
  context: StorageRowContext,
): EventTraceContext | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = requireRecordField(value, context, "traceContext");
  if (parsed["traceId"] !== undefined && typeof parsed["traceId"] !== "string") {
    return invalidStorageField(context, "traceContext.traceId", "a string when present");
  }
  if (parsed["spanId"] !== undefined && typeof parsed["spanId"] !== "string") {
    return invalidStorageField(context, "traceContext.spanId", "a string when present");
  }
  if (parsed["traceFlags"] !== undefined && typeof parsed["traceFlags"] !== "number") {
    return invalidStorageField(context, "traceContext.traceFlags", "a number when present");
  }
  if (parsed["isValid"] !== undefined && typeof parsed["isValid"] !== "boolean") {
    return invalidStorageField(context, "traceContext.isValid", "a boolean when present");
  }
  return {
    ...(typeof parsed["traceId"] === "string" ? { traceId: parsed["traceId"] } : {}),
    ...(typeof parsed["spanId"] === "string" ? { spanId: parsed["spanId"] } : {}),
    ...(typeof parsed["traceFlags"] === "number" ? { traceFlags: parsed["traceFlags"] } : {}),
    ...(typeof parsed["isValid"] === "boolean" ? { isValid: parsed["isValid"] } : {}),
  };
}

function appendDiagnostic(
  diagnostics: TransactionalEventDiagnostic[],
  diagnostic: TransactionalEventDiagnostic,
): TransactionalEventDiagnostic[] {
  return [...diagnostics, diagnostic];
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
      this.assertIdempotentReplay(input, existing);
      return existing;
    }

    const occupied = await this.findOutboxById(input.id, context);
    if (occupied) {
      throw new OutboxMessageIdConflictProblem(input.id);
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
      .onConflictDoNothing()
      .returning();

    if (inserted !== undefined) {
      return this.mapOutboxRow(inserted);
    }

    const duplicated = await this.findOutboxByIdempotencyKey(input.idempotencyKey, context);
    if (duplicated) {
      this.assertIdempotentReplay(input, duplicated);
      return duplicated;
    }

    const conflictingId = await this.findOutboxById(input.id, context);
    if (conflictingId) {
      throw new OutboxMessageIdConflictProblem(input.id);
    }

    throw new OutboxStorageProblem("Failed to insert or resolve outbox message conflict.");
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

  async findOutboxById(
    id: string,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const [row] = await this.client(context)
      .select()
      .from(this.outbox)
      .where(eq(this.outbox.id, id))
      .limit(1);
    return row === undefined ? null : this.mapOutboxRow(row);
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
    return row === undefined ? null : this.mapOutboxRow(row);
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
        .where(
          and(
            eq(this.outbox.id, current.id),
            eq(this.outbox.attempts, current.attempts),
            this.outboxClaimableCondition(options.now),
          ),
        )
        .returning();

      if (updated !== undefined) {
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
    return updated === undefined ? null : this.mapOutboxRow(updated);
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
    return updated === undefined ? null : this.mapOutboxRow(updated);
  }

  async releaseOutboxClaim(
    input: OutboxReleaseInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<TransactionalOutboxMessage | null> {
    const current = await this.requireOutbox(input.id, context);
    if (!this.isActiveClaim(current, input.expectedAttempts)) {
      return null;
    }

    const [updated] = await this.client(context)
      .update(this.outbox)
      .set({
        attempts: current.attempts - 1,
        status: "retrying",
        visibleAt: input.now,
        updatedAt: input.now,
        lockedUntil: null,
        diagnostics: appendDiagnostic(current.diagnostics, input.diagnostic),
      })
      .where(this.activeClaimCondition(input.id, input.expectedAttempts))
      .returning();
    return updated === undefined ? null : this.mapOutboxRow(updated);
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
    return updated === undefined ? null : this.mapOutboxRow(updated);
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
    return rows.map((row) => this.mapOutboxRow(row));
  }

  async startInboxProcessing(
    input: InboxStartInput,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<InboxStartResult> {
    const lockedUntil = resolveInboxLockedUntil(input);
    const existing = await this.findInboxRecord(input.consumerId, input.inboxKey, context);
    if (existing && !this.isReclaimableInboxRecord(existing, input.now)) {
      return {
        status: "duplicate",
        record: existing,
      };
    }

    if (existing) {
      return this.reclaimInboxRecord(existing, input, lockedUntil, context);
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
        lockedUntil,
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

    if (inserted === undefined) {
      const duplicated = await this.findInboxRecord(input.consumerId, input.inboxKey, context);
      if (!duplicated) {
        throw new OutboxStorageProblem(
          `Inbox record '${input.consumerId}:${input.inboxKey}' conflict could not be resolved.`,
        );
      }

      if (!this.isReclaimableInboxRecord(duplicated, input.now)) {
        return {
          status: "duplicate",
          record: duplicated,
        };
      }

      return this.reclaimInboxRecord(duplicated, input, lockedUntil, context);
    }

    return {
      status: "started",
      record: this.mapInboxRow(inserted),
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
        lockedUntil: null,
        diagnostics: input.diagnostic
          ? appendDiagnostic(current.diagnostics, input.diagnostic)
          : current.diagnostics,
      })
      .where(this.activeInboxClaimCondition(input))
      .returning();
    return updated !== undefined
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
        lockedUntil: null,
        lastError: input.error,
        failureReason: input.reason,
        diagnostics: input.diagnostic
          ? appendDiagnostic(current.diagnostics, input.diagnostic)
          : current.diagnostics,
      })
      .where(this.activeInboxClaimCondition(input))
      .returning();
    return updated !== undefined
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
    return row === undefined ? null : this.mapInboxRow(row);
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
    return rows.map((row) => this.mapInboxRow(row));
  }

  private client(
    context?: TransactionalEventStoreContext<TClient>,
  ): DrizzleTransactionalEventStoreDb {
    return context?.client ?? this.config.txManager?.getClient() ?? this.config.db;
  }

  private async reclaimInboxRecord(
    existing: TransactionalInboxRecord,
    input: InboxStartInput,
    lockedUntil: Date,
    context?: TransactionalEventStoreContext<TClient>,
  ): Promise<InboxStartResult> {
    const reclaimed = existing.status === "processing";
    const [updated] = await this.client(context)
      .update(this.inbox)
      .set({
        status: "processing",
        attempts: existing.attempts + 1,
        updatedAt: input.now,
        lockedUntil,
        diagnostics: appendDiagnostic(
          existing.diagnostics,
          createTransactionalEventDiagnostic(
            reclaimed ? "events-tx/inbox-lease-reclaimed" : "events-tx/inbox-retry-started",
            reclaimed ? "Expired inbox processing lease reclaimed." : "Inbox retry started.",
            input.now,
          ),
        ),
      })
      .where(this.reclaimableInboxCondition(input, existing.attempts))
      .returning();
    if (updated !== undefined) {
      return {
        status: "started",
        record: this.mapInboxRow(updated),
      };
    }

    const current = await this.findInboxRecord(input.consumerId, input.inboxKey, context);
    if (!current) {
      throw new OutboxStorageProblem(
        `Inbox record '${input.consumerId}:${input.inboxKey}' reclaim conflict could not be resolved.`,
      );
    }
    return {
      status: "duplicate",
      record: current,
    };
  }

  private isReclaimableInboxRecord(record: TransactionalInboxRecord, now: Date): boolean {
    return (
      record.status === "failed" ||
      (record.status === "processing" &&
        record.lockedUntil !== undefined &&
        record.lockedUntil.getTime() <= now.getTime())
    );
  }

  private inboxStorageCondition(consumerId: string, inboxKey: string): SQL<unknown> | undefined {
    return and(eq(this.inbox.consumerId, consumerId), eq(this.inbox.inboxKey, inboxKey));
  }

  private reclaimableInboxCondition(
    input: InboxStartInput,
    expectedAttempts: number,
  ): SQL<unknown> | undefined {
    return and(
      eq(this.inbox.consumerId, input.consumerId),
      eq(this.inbox.inboxKey, input.inboxKey),
      eq(this.inbox.attempts, expectedAttempts),
      or(
        eq(this.inbox.status, "failed"),
        and(eq(this.inbox.status, "processing"), lte(this.inbox.lockedUntil, input.now)),
      ),
    );
  }

  private activeInboxClaimCondition(input: InboxCompletionInput): SQL<unknown> | undefined {
    return and(
      eq(this.inbox.consumerId, input.consumerId),
      eq(this.inbox.inboxKey, input.inboxKey),
      eq(this.inbox.status, "processing"),
      eq(this.inbox.attempts, input.expectedAttempts),
      gt(this.inbox.lockedUntil, input.now),
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

  private isActiveClaim(message: TransactionalOutboxMessage, expectedAttempts: number): boolean {
    return message.status === "publishing" && message.attempts === expectedAttempts;
  }

  private mapOutboxRow(value: unknown): TransactionalOutboxMessage {
    const row = requireRow(value, "outbox");
    const context = storageRowContext("outbox", row);
    const aggregateId = optionalNonEmptyString(row["aggregateId"], context, "aggregateId");
    const traceContext = optionalTraceContext(row["traceContext"], context);
    const lockedUntil = optionalDate(row["lockedUntil"], context, "lockedUntil");
    const publishedAt = optionalDate(row["publishedAt"], context, "publishedAt");
    const lastError = optionalError(row["lastError"], context, "lastError");
    const deadLetteredAt = optionalDate(row["deadLetteredAt"], context, "deadLetteredAt");
    const deadLetterReason = optionalString(row["deadLetterReason"], context, "deadLetterReason");
    return {
      id: requireNonEmptyString(row["id"], context, "id"),
      eventId: requireNonEmptyString(row["eventId"], context, "eventId"),
      eventType: requireNonEmptyString(row["eventType"], context, "eventType"),
      ...(aggregateId ? { aggregateId } : {}),
      idempotencyKey: requireNonEmptyString(row["idempotencyKey"], context, "idempotencyKey"),
      payload: requireRecordField(row["payload"], context, "payload"),
      metadata: requireRecordField(row["metadata"], context, "metadata"),
      ...(traceContext ? { traceContext } : {}),
      attempts: requireCount(row["attempts"], context, "attempts", 0),
      maxAttempts: requireCount(row["maxAttempts"], context, "maxAttempts", 1),
      status: requireStatus<TransactionalOutboxMessage["status"]>(
        row["status"],
        context,
        "status",
        OUTBOX_STATUSES,
      ),
      visibleAt: requireDate(row["visibleAt"], context, "visibleAt"),
      occurredAt: requireDate(row["occurredAt"], context, "occurredAt"),
      createdAt: requireDate(row["createdAt"], context, "createdAt"),
      updatedAt: requireDate(row["updatedAt"], context, "updatedAt"),
      ...(lockedUntil ? { lockedUntil } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      ...(lastError !== undefined ? { lastError } : {}),
      ...(deadLetteredAt ? { deadLetteredAt } : {}),
      ...(deadLetterReason !== undefined ? { deadLetterReason } : {}),
      diagnostics: requireDiagnostics(row["diagnostics"], context, "diagnostics"),
    };
  }

  private mapInboxRow(value: unknown): TransactionalInboxRecord {
    const row = requireRow(value, "inbox");
    const context = storageRowContext("inbox", row);
    const processedAt = optionalDate(row["processedAt"], context, "processedAt");
    const failedAt = optionalDate(row["failedAt"], context, "failedAt");
    const lockedUntil = optionalDate(row["lockedUntil"], context, "lockedUntil");
    const lastError = optionalError(row["lastError"], context, "lastError");
    const failureReason = optionalString(row["failureReason"], context, "failureReason");
    return {
      consumerId: requireNonEmptyString(row["consumerId"], context, "consumerId"),
      messageId: requireNonEmptyString(row["messageId"], context, "messageId"),
      inboxKey: requireNonEmptyString(row["inboxKey"], context, "inboxKey"),
      eventType: requireNonEmptyString(row["eventType"], context, "eventType"),
      status: requireStatus<TransactionalInboxRecord["status"]>(
        row["status"],
        context,
        "status",
        INBOX_STATUSES,
      ),
      attempts: requireCount(row["attempts"], context, "attempts", 0),
      createdAt: requireDate(row["createdAt"], context, "createdAt"),
      updatedAt: requireDate(row["updatedAt"], context, "updatedAt"),
      ...(lockedUntil ? { lockedUntil } : {}),
      ...(processedAt ? { processedAt } : {}),
      ...(failedAt ? { failedAt } : {}),
      ...(lastError !== undefined ? { lastError } : {}),
      ...(failureReason !== undefined ? { failureReason } : {}),
      metadata: requireRecordField(row["metadata"], context, "metadata"),
      diagnostics: requireDiagnostics(row["diagnostics"], context, "diagnostics"),
    };
  }
}
