import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  integer as sqliteInteger,
  sqliteTable,
  text as sqliteText,
  uniqueIndex as sqliteUniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * PostgreSQL용 미터 정의 스키마입니다.
 */
export const metersPg = pgTable('meters', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),
  meterId: text('meter_id').notNull(),
  type: text('type').notNull(),
  quota: integer('quota'),
  allowOverQuota: integer('allow_over_quota').notNull().default(0),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * PostgreSQL용 사용량 기록 스키마입니다.
 */
export const usageRecordsPg = pgTable(
  'usage_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: text('tenant_id').notNull(),
    meterId: text('meter_id').notNull(),
    value: integer('value').notNull().default(1),
    recordedAt: timestamp('recorded_at').notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
    idempotencyKey: text('idempotency_key'),
  },
  (table) => [
    uniqueIndex('usage_records_idempotency_unique')
      .on(table.tenantId, table.meterId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
  ]
);

/**
 * SQLite용 미터 정의 스키마입니다.
 */
export const metersSqlite = sqliteTable('meters', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  tenantId: sqliteText('tenant_id').notNull(),
  meterId: sqliteText('meter_id').notNull(),
  type: sqliteText('type').notNull(),
  quota: sqliteInteger('quota'),
  allowOverQuota: sqliteInteger('allow_over_quota').notNull().default(0),
  metadata: sqliteText('metadata').notNull().default('{}'),
  createdAt: sqliteInteger('created_at').notNull(),
  updatedAt: sqliteInteger('updated_at').notNull(),
});

/**
 * SQLite용 사용량 기록 스키마입니다.
 */
export const usageRecordsSqlite = sqliteTable(
  'usage_records',
  {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    tenantId: sqliteText('tenant_id').notNull(),
    meterId: sqliteText('meter_id').notNull(),
    value: sqliteInteger('value').notNull().default(1),
    recordedAt: sqliteInteger('recorded_at').notNull(),
    metadata: sqliteText('metadata').notNull().default('{}'),
    idempotencyKey: sqliteText('idempotency_key'),
  },
  (table) => [
    sqliteUniqueIndex('usage_records_idempotency_unique')
      .on(table.tenantId, table.meterId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
  ]
);
