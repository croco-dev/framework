import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
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
