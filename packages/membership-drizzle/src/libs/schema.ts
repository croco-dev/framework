import type {
  MembershipCommandResult,
  MembershipEventIntentEvent,
  MembershipRole,
} from "@croco/membership-core";
import {
  bigint,
  index,
  foreignKey,
  primaryKey,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const membershipSeatOrdinalSequence = pgSequence("membership_seat_ordinal_seq");

/**
 * 멤버십 엔터티를 저장하는 PostgreSQL 스키마입니다.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: text("id").notNull().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["owner", "admin", "member", "viewer"] })
      .$type<MembershipRole>()
      .notNull(),
    seatOrdinal: bigint("seat_ordinal", { mode: "bigint" })
      .default(sql`-nextval('membership_seat_ordinal_seq')`)
      .notNull(),
    createdAt: timestamp("created_at")
      .default(sql`(now() at time zone 'utc')`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`(now() at time zone 'utc')`)
      .notNull(),
  },
  (table) => [
    unique("memberships_tenant_id_user_id_unique").on(table.tenantId, table.userId),
    unique("memberships_tenant_id_seat_ordinal_unique").on(table.tenantId, table.seatOrdinal),
  ],
);

export const membershipIdempotencyRecords = pgTable(
  "membership_idempotency_records",
  {
    tenantId: text("tenant_id").notNull(),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    result: jsonb("result").notNull().$type<MembershipCommandResult>(),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.key] })],
);

export const membershipEventIntents = pgTable(
  "membership_event_intents",
  {
    intentId: text("intent_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    events: jsonb("events").notNull().$type<readonly MembershipEventIntentEvent[]>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [
    uniqueIndex("membership_event_intents_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "membership_event_intents_tenant_command_fk",
      columns: [table.tenantId, table.idempotencyKey],
      foreignColumns: [membershipIdempotencyRecords.tenantId, membershipIdempotencyRecords.key],
    }),
    index("membership_event_intents_tenant_pending_idx")
      .on(sql`(${table.events}->0->'data'->>'tenantId')`, table.createdAt, table.intentId)
      .where(sql`${table.publishedAt} is null`),
    index("membership_event_intents_pending_idx")
      .on(table.createdAt, table.intentId)
      .where(sql`${table.publishedAt} is null`),
  ],
);
