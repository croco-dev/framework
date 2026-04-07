import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';

export const auditLogsPg = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  payload: jsonb('payload').notNull().default({}),
  diff: jsonb('diff'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogsSqlite = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: sqliteText('tenant_id').notNull(),
  actorId: sqliteText('actor_id').notNull(),
  action: sqliteText('action').notNull(),
  resourceType: sqliteText('resource_type').notNull(),
  resourceId: sqliteText('resource_id').notNull(),
  payload: sqliteText('payload').notNull().default('{}'),
  diff: sqliteText('diff'),
  metadata: sqliteText('metadata').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export interface AuditLogsTable {
  id: string | number;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: unknown;
  diff: unknown | null;
  metadata: unknown;
  createdAt: Date;
}

export type AuditLogInsert = Omit<AuditLogsTable, 'id' | 'createdAt'>;

export type AuditLogFilter = {
  tenantId: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
};

export type AuditLogQueryOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
};
