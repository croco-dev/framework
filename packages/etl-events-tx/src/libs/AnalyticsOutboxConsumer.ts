import { EventSourceEnvelopeProblem, parseEventSourceEnvelope } from "@croco/etl-core/source";
import { TransactionalInboxConsumer } from "@croco/events-tx";
import { WarehouseContractError } from "@croco/warehouse-core";
import type { EventSourceEnvelope } from "@croco/etl-core/source";
import type { TransactionalEventStore, TransactionalOutboxMessage } from "@croco/events-tx";
import type { CanonicalRow } from "@croco/warehouse-core";
import type {
  WarehouseCandidateRequest,
  WarehouseWriter,
  WriteReceipt,
} from "@croco/warehouse-core/runtime";
import { EtlEventProblem } from "./EtlEventProblem";

export type SourceEnvelope = EventSourceEnvelope;

export type QuarantineRecord = {
  readonly consumerId: string;
  readonly sourceRef: string;
  readonly outboxMessageId: string;
  readonly eventId: string | null;
  readonly code: string;
};

/** A successful return means the record is committed and can be recovered after a restart. */
export interface QuarantineStore {
  record(input: QuarantineRecord): Promise<"recorded" | "duplicate">;
}

export type SourceRetention = {
  readonly kind: "outbox";
  readonly knownHistoryFrom: string | null;
  readonly retainedFrom: string;
};

export type AnalyticsOutcome =
  | {
      readonly status: "accepted-durable";
      readonly batchId: string;
      readonly receipt: WriteReceipt;
    }
  | { readonly status: "quarantined"; readonly batchId: string; readonly code: string }
  | { readonly status: "duplicate" };

export type ReplayOutcome =
  | AnalyticsOutcome
  | {
      readonly status: "unavailable";
      readonly messageId: string;
      readonly retention: SourceRetention;
    };

export type AnalyticsConsumerConfig<TClient> = {
  readonly store: TransactionalEventStore<TClient>;
  readonly consumerId: string;
  readonly sourceRef: string;
  readonly writer: WarehouseWriter;
  readonly quarantine: QuarantineStore;
  /** Resolve this only from the server's authenticated context and active candidate. */
  readonly resolveBinding: (envelope: SourceEnvelope) => Promise<WarehouseCandidateRequest>;
  /** Map the confirmed event to fact grain; the event id is not the grain. */
  readonly mapRows: (
    envelope: SourceEnvelope,
    message: TransactionalOutboxMessage,
  ) => Promise<readonly CanonicalRow[]>;
  readonly visibilityTimeoutMs?: number;
  readonly now?: () => Date;
};

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSourceEnvelope(
  message: TransactionalOutboxMessage,
  expectedSourceRef: string,
): SourceEnvelope {
  const metadata = isRecord(message.metadata) ? message.metadata.analytics : undefined;
  if (!isRecord(metadata) || !nonBlank(expectedSourceRef)) {
    throw new EtlEventProblem("etl-events-tx/invalid-source-envelope");
  }
  let envelope: EventSourceEnvelope;
  try {
    envelope = parseEventSourceEnvelope({
      sourceRef: metadata.sourceRef,
      outboxMessageId: message.id,
      eventId: message.eventId,
      eventType: message.eventType,
      schemaVersion: metadata.schemaVersion,
      subject: metadata.subject,
      occurredAt:
        message.occurredAt instanceof Date && Number.isFinite(message.occurredAt.getTime())
          ? message.occurredAt.toISOString()
          : null,
      origin: metadata.origin,
    });
  } catch (error) {
    if (error instanceof EventSourceEnvelopeProblem) {
      throw new EtlEventProblem("etl-events-tx/invalid-source-envelope");
    }
    throw error;
  }
  if (envelope.sourceRef !== expectedSourceRef || envelope.outboxMessageId !== message.id) {
    throw new EtlEventProblem("etl-events-tx/invalid-source-envelope");
  }
  return envelope;
}

const DETERMINISTIC_FACT_CODES = new Set([
  "WAREHOUSE_FACT_CONFLICT",
  "WAREHOUSE_BATCH_CONFLICT",
  "WAREHOUSE_INVALID_ROW",
  "WAREHOUSE_UNKNOWN_FIELD",
  "WAREHOUSE_MISSING_FIELD",
  "WAREHOUSE_NULL_NOT_ALLOWED",
  "WAREHOUSE_INVALID_BOOLEAN",
  "WAREHOUSE_INVALID_ID",
  "WAREHOUSE_INVALID_STRING",
  "WAREHOUSE_INVALID_INSTANT",
  "WAREHOUSE_INVALID_DATE",
  "WAREHOUSE_INVALID_CURRENCY",
  "WAREHOUSE_INVALID_DECIMAL",
  "WAREHOUSE_DECIMAL_PRECISION",
  "WAREHOUSE_INVALID_INTEGER",
  "WAREHOUSE_INTEGER_OVERFLOW",
  "WAREHOUSE_INTEGER_BOUNDS",
]);

function isDurableReceipt(receipt: WriteReceipt | null, batchId: string): receipt is WriteReceipt {
  return (
    receipt !== null &&
    receipt.batchId === batchId &&
    receipt.state === "durable" &&
    nonBlank(receipt.providerRef) &&
    Number.isSafeInteger(receipt.attempt) &&
    receipt.attempt > 0
  );
}

function assertRetention(retention: SourceRetention): void {
  const retainedAt = Date.parse(retention.retainedFrom);
  const knownAt =
    retention.knownHistoryFrom === null ? null : Date.parse(retention.knownHistoryFrom);
  if (
    retention.kind !== "outbox" ||
    !nonBlank(retention.retainedFrom) ||
    !Number.isFinite(retainedAt) ||
    (knownAt !== null &&
      (!nonBlank(retention.knownHistoryFrom) || !Number.isFinite(knownAt) || knownAt > retainedAt))
  ) {
    throw new EtlEventProblem("etl-events-tx/invalid-retention");
  }
}

export class AnalyticsOutboxConsumer<TClient = unknown> {
  private readonly inbox: TransactionalInboxConsumer<TClient>;

  constructor(private readonly config: AnalyticsConsumerConfig<TClient>) {
    if (!nonBlank(config.sourceRef)) throw new EtlEventProblem("etl-events-tx/invalid-source-ref");
    this.inbox = new TransactionalInboxConsumer({
      store: config.store,
      consumerId: config.consumerId,
      visibilityTimeoutMs: config.visibilityTimeoutMs,
      now: config.now,
    });
  }

  async handle(message: TransactionalOutboxMessage): Promise<AnalyticsOutcome> {
    if (!nonBlank(message.id)) throw new EtlEventProblem("etl-events-tx/invalid-message-id");
    const batchId = JSON.stringify([this.config.sourceRef, message.id]);
    let outcome: AnalyticsOutcome | undefined;
    const result = await this.inbox.handle(message, async () => {
      let envelope: SourceEnvelope;
      try {
        envelope = validateSourceEnvelope(message, this.config.sourceRef);
      } catch (error) {
        if (
          error instanceof EtlEventProblem &&
          error.code === "etl-events-tx/invalid-source-envelope"
        ) {
          outcome = await this.quarantine(message, batchId, error.code);
          return;
        }
        throw error;
      }

      let binding: WarehouseCandidateRequest;
      try {
        binding = await this.config.resolveBinding(envelope);
      } catch {
        throw new EtlEventProblem("etl-events-tx/binding-unavailable");
      }
      let rows: readonly CanonicalRow[];
      try {
        rows = await this.config.mapRows(envelope, message);
      } catch (error) {
        if (error instanceof EtlEventProblem && error.code === "etl-events-tx/invalid-fact") {
          outcome = await this.quarantine(message, batchId, error.code);
          return;
        }
        if (error instanceof WarehouseContractError && DETERMINISTIC_FACT_CODES.has(error.code)) {
          outcome = await this.quarantine(message, batchId, error.code);
          return;
        }
        throw new EtlEventProblem("etl-events-tx/mapping-failed");
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        outcome = await this.quarantine(message, batchId, "etl-events-tx/empty-fact-batch");
        return;
      }

      const receiptRequest = { ...binding, batchId, attempt: 1 };
      let receipt: WriteReceipt | null;
      try {
        receipt = await this.config.writer.write({ ...receiptRequest, rows });
      } catch (error) {
        if (error instanceof WarehouseContractError) {
          if (DETERMINISTIC_FACT_CODES.has(error.code)) {
            outcome = await this.quarantine(message, batchId, error.code);
            return;
          }
          throw error;
        }
        receipt = null;
      }
      if (receipt !== null && receipt.batchId !== batchId) {
        throw new EtlEventProblem("etl-events-tx/receipt-mismatch");
      }
      if (receipt?.state === "rejected") {
        throw new EtlEventProblem("etl-events-tx/write-rejected");
      }
      if (!isDurableReceipt(receipt, batchId)) {
        try {
          receipt = await this.config.writer.reconcileReceipt(receiptRequest);
        } catch {
          throw new EtlEventProblem("etl-events-tx/receipt-unavailable");
        }
      }
      if (!isDurableReceipt(receipt, batchId)) {
        throw new EtlEventProblem("etl-events-tx/receipt-unavailable");
      }
      outcome = { status: "accepted-durable", batchId, receipt };
    });

    if (result.status === "duplicate") return { status: "duplicate" };
    if (result.status !== "processed" || outcome === undefined) {
      throw new EtlEventProblem("etl-events-tx/inbox-not-complete");
    }
    return outcome;
  }

  async replayById(messageId: string, retention: SourceRetention): Promise<ReplayOutcome> {
    assertRetention(retention);
    if (!nonBlank(messageId)) throw new EtlEventProblem("etl-events-tx/invalid-message-id");
    const message = await this.config.store.findOutboxById(messageId);
    if (message === null) return { status: "unavailable", messageId, retention };
    return this.handle(message);
  }

  private async quarantine(
    message: TransactionalOutboxMessage,
    batchId: string,
    code: string,
  ): Promise<AnalyticsOutcome> {
    try {
      const result = await this.config.quarantine.record({
        consumerId: this.config.consumerId,
        sourceRef: this.config.sourceRef,
        outboxMessageId: message.id,
        eventId: nonBlank(message.eventId) ? message.eventId : null,
        code,
      });
      if (result !== "recorded" && result !== "duplicate") {
        throw new EtlEventProblem("etl-events-tx/quarantine-unavailable");
      }
    } catch {
      throw new EtlEventProblem("etl-events-tx/quarantine-unavailable");
    }
    return { status: "quarantined", batchId, code };
  }
}
