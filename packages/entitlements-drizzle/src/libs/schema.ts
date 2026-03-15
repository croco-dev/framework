import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const planEntitlements = pgTable('plan_entitlements', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  featureKey: text('feature_key').notNull(),
  type: text('type', { enum: ['boolean', 'metered', 'static'] }).notNull(),
  value: integer('value'),
  meterId: text('meter_id'),
  quota: integer('quota'),
  overagePolicy: text('overage_policy', { enum: ['block', 'warn', 'allow'] }).default('block'),
  createdAt: timestamp('created_at').defaultNow(),
});
