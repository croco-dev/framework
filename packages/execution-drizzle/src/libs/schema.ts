import type { ExecutionStatus } from "@croco/execution-core";
import {
  index,
  integer,
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 실행 엔터티를 저장하는 PostgreSQL 스키마입니다.
 */
export const executions = pgTable(
  "executions",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    type: text("type").notNull(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed", "cancelled", "retrying", "timed_out"],
    })
      .notNull()
      .$type<ExecutionStatus>(),
    payload: json("payload"),
    result: json("result"),
    error: json("error"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    scheduledFor: timestamp("scheduled_for"),
    timeout: integer("timeout"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    replayOf: varchar("replay_of", { length: 26 }),
    logs: jsonb("logs"),
    parentId: varchar("parent_id", { length: 26 }),
    metadata: json("metadata"),
    checkpoints: json("checkpoints"),
    progress: json("progress"),
  },
  (table) => ({
    idempotencyKeyIdx: uniqueIndex("executions_idempotency_key_idx").on(table.idempotencyKey),
    parentIdIdx: index("executions_parent_id_idx").on(table.parentId),
    replayOfIdx: index("executions_replay_of_idx").on(table.replayOf),
    statusIdx: index("executions_status_idx").on(table.status),
    typeIdx: index("executions_type_idx").on(table.type),
  }),
);

/**
 * 실행 조회 시 반환되는 행 타입입니다.
 */
export type ExecutionRow = typeof executions.$inferSelect;
/**
 * 실행 생성 시 사용하는 행 타입입니다.
 */
export type NewExecutionRow = typeof executions.$inferInsert;
