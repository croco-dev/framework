import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * 접근 제어 관계 튜플을 저장하는 기본 스키마입니다.
 */
export const relationTuples = pgTable(
  "relation_tuples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    object: text("object").notNull(),
    relation: text("relation").notNull(),
    subject: text("subject").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueTuple: unique().on(table.tenantId, table.object, table.relation, table.subject),
    objectIdx: index().on(table.object),
    subjectIdx: index().on(table.subject),
    tenantIdx: index().on(table.tenantId),
  }),
);
