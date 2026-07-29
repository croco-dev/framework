import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { TransactionalEventDiagnostic, TransactionalEventError } from "./TransactionalEvents";
import type { InboxMessageStatus, OutboxMessageStatus } from "./TransactionalEventTypes";

export const transactionalOutboxMessages = pgTable(
  "croco_outbox_messages",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    eventId: varchar("event_id", { length: 128 }).notNull(),
    eventType: text("event_type").notNull(),
    aggregateId: text("aggregate_id"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    traceContext: jsonb("trace_context").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    status: text("status").$type<OutboxMessageStatus>().notNull(),
    visibleAt: timestamp("visible_at").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lockedUntil: timestamp("locked_until"),
    publishedAt: timestamp("published_at"),
    lastError: jsonb("last_error").$type<TransactionalEventError>(),
    deadLetteredAt: timestamp("dead_lettered_at"),
    deadLetterReason: text("dead_letter_reason"),
    diagnostics: jsonb("diagnostics").$type<TransactionalEventDiagnostic[]>().notNull(),
  },
  (table) => ({
    idempotencyKeyIdx: uniqueIndex("croco_outbox_messages_idempotency_key_idx").on(
      table.idempotencyKey,
    ),
    statusVisibleAtIdx: index("croco_outbox_messages_status_visible_at_idx").on(
      table.status,
      table.visibleAt,
    ),
    eventTypeIdx: index("croco_outbox_messages_event_type_idx").on(table.eventType),
  }),
);

export const transactionalInboxRecords = pgTable(
  "croco_inbox_records",
  {
    consumerId: varchar("consumer_id", { length: 128 }).notNull(),
    messageId: varchar("message_id", { length: 128 }).notNull(),
    inboxKey: varchar("inbox_key", { length: 255 }).notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").$type<InboxMessageStatus>().notNull(),
    attempts: integer("attempts").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lockedUntil: timestamp("locked_until"),
    processedAt: timestamp("processed_at"),
    failedAt: timestamp("failed_at"),
    lastError: jsonb("last_error").$type<TransactionalEventError>(),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    diagnostics: jsonb("diagnostics").$type<TransactionalEventDiagnostic[]>().notNull(),
  },
  (table) => ({
    consumerInboxKeyIdx: uniqueIndex("croco_inbox_records_consumer_key_idx").on(
      table.consumerId,
      table.inboxKey,
    ),
    statusIdx: index("croco_inbox_records_status_idx").on(table.status),
    statusLockedUntilIdx: index("croco_inbox_records_status_locked_until_idx").on(
      table.status,
      table.lockedUntil,
    ),
    eventTypeIdx: index("croco_inbox_records_event_type_idx").on(table.eventType),
  }),
);

export type TransactionalOutboxMessageRow = typeof transactionalOutboxMessages.$inferSelect;
export type NewTransactionalOutboxMessageRow = typeof transactionalOutboxMessages.$inferInsert;
export type TransactionalInboxRecordRow = typeof transactionalInboxRecords.$inferSelect;
export type NewTransactionalInboxRecordRow = typeof transactionalInboxRecords.$inferInsert;
