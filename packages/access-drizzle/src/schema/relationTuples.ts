import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const relationTuples = pgTable(
  'relation_tuples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    object: text('object').notNull(),
    relation: text('relation').notNull(),
    subject: text('subject').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueTuple: unique().on(table.tenantId, table.object, table.relation, table.subject),
    objectIdx: index().on(table.object),
    subjectIdx: index().on(table.subject),
    tenantIdx: index().on(table.tenantId),
  })
);
