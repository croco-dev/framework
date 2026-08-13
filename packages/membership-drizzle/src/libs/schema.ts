import type {
  MembershipCommandResult,
  MembershipEventIntentEvent,
  MembershipRole,
} from "@croco/membership-core";
import {
  bigint,
  index,
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("memberships_tenant_id_user_id_unique").on(table.tenantId, table.userId),
    unique("memberships_tenant_id_seat_ordinal_unique").on(table.tenantId, table.seatOrdinal),
  ],
);

export const membershipIdempotencyRecords = pgTable("membership_idempotency_records", {
  key: text("key").primaryKey(),
  fingerprint: text("fingerprint").notNull(),
  result: jsonb("result").notNull().$type<MembershipCommandResult>(),
  committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const membershipEventIntents = pgTable(
  "membership_event_intents",
  {
    intentId: text("intent_id").primaryKey(),
    idempotencyKey: text("idempotency_key")
      .notNull()
      .references(() => membershipIdempotencyRecords.key),
    events: jsonb("events").notNull().$type<readonly MembershipEventIntentEvent[]>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("membership_event_intents_idempotency_unique").on(table.idempotencyKey),
    index("membership_event_intents_pending_idx")
      .on(table.createdAt, table.intentId)
      .where(sql`${table.publishedAt} is null`),
  ],
);
