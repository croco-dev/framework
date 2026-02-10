import type { ExecutionStatus } from '@croco/execution-core';
import { index, integer, json, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

/**
 * Drizzle schema for executions table.
 *
 * This schema maps to the Execution entity from @croco/execution-core.
 * Uses PostgreSQL dialect with json columns for flexible data storage.
 */
export const executions = pgTable(
  'executions',
  {
    /** Primary key - ULID-based UUID */
    id: varchar('id', { length: 26 }).primaryKey(),
    /** Execution type: 'task' | 'batch' | 'workflow' */
    type: text('type').notNull(),
    /** Current execution status */
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying', 'timed_out'],
    })
      .notNull()
      .$type<ExecutionStatus>(),
    /** Optional payload data (JSON) */
    payload: json('payload'),
    /** Execution result (JSON, set on completion) */
    result: json('result'),
    /** Error details (JSON, set on failure) */
    error: json('error'),
    /** Current attempt count */
    attempts: integer('attempts').notNull().default(0),
    /** Maximum allowed attempts */
    maxAttempts: integer('max_attempts').notNull().default(1),
    /** Creation timestamp */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    /** Execution start timestamp */
    startedAt: timestamp('started_at'),
    /** Execution completion timestamp */
    completedAt: timestamp('completed_at'),
    /** Optional scheduled start time */
    scheduledFor: timestamp('scheduled_for'),
    /** Timeout in milliseconds */
    timeout: integer('timeout'),
    /** Optional idempotency key for deduplication */
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    /** Optional parent execution ID for nested executions */
    parentId: varchar('parent_id', { length: 26 }),
    /** Optional metadata (JSON) */
    metadata: json('metadata'),
    /** Checkpoints for batch resume (JSON key-value pairs) */
    checkpoints: json('checkpoints'),
    /** Progress information (JSON) */
    progress: json('progress'),
  },
  (table) => ({
    /** Unique index on idempotency key for deduplication */
    idempotencyKeyIdx: uniqueIndex('executions_idempotency_key_idx').on(table.idempotencyKey),
    /** Index on parent ID for querying nested executions */
    parentIdIdx: index('executions_parent_id_idx').on(table.parentId),
    /** Index on status for filtering */
    statusIdx: index('executions_status_idx').on(table.status),
    /** Index on type for filtering */
    typeIdx: index('executions_type_idx').on(table.type),
  })
);

export type ExecutionRow = typeof executions.$inferSelect;
export type NewExecutionRow = typeof executions.$inferInsert;
