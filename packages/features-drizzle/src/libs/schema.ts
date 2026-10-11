import type { PolicyRevisionState, PolicyScheduleState } from "./contracts";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const featurePolicyDefinitions = pgTable(
  "croco_feature_policy_definitions",
  {
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    app: text("app").notNull(),
    environment: text("environment").notNull(),
    tenantId: text("tenant_id"),
    schemaVersion: text("schema_version").notNull(),
    codeRegistrationId: text("code_registration_id").notNull(),
    registrationFingerprint: varchar("registration_fingerprint", { length: 128 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.policyId, table.scopeKey] })],
);

export const featurePolicyRevisions = pgTable(
  "croco_feature_policy_revisions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    revision: integer("revision").notNull(),
    version: integer("version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    codeRegistrationId: text("code_registration_id").notNull(),
    registrationFingerprint: varchar("registration_fingerprint", { length: 128 }).notNull(),
    value: jsonb("value").notNull(),
    hash: varchar("hash", { length: 128 }).notNull(),
    state: text("state").notNull().$type<PolicyRevisionState>(),
    review: jsonb("review"),
    publication: jsonb("publication"),
    scheduleIdempotencyKey: text("schedule_idempotency_key"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    fallback: jsonb("fallback"),
    pauseReason: text("pause_reason"),
    rollbackOf: integer("rollback_of"),
    history: jsonb("history").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("croco_feature_policy_revisions_scope_revision_unique").on(
      table.policyId,
      table.scopeKey,
      table.revision,
    ),
    index("croco_feature_policy_revisions_scope_created_idx").on(
      table.policyId,
      table.scopeKey,
      table.createdAt,
    ),
  ],
);

export const featurePolicyHeads = pgTable(
  "croco_feature_policy_heads",
  {
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    revision: integer("revision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.policyId, table.scopeKey] })],
);

export const featurePolicyReviews = pgTable(
  "croco_feature_policy_reviews",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    revision: integer("revision").notNull(),
    reviewHash: varchar("review_hash", { length: 128 }).notNull(),
    review: jsonb("review").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("croco_feature_policy_reviews_identity_unique").on(
      table.policyId,
      table.scopeKey,
      table.revision,
      table.reviewHash,
    ),
    index("croco_feature_policy_reviews_scope_revision_idx").on(
      table.policyId,
      table.scopeKey,
      table.revision,
    ),
  ],
);

export const featurePolicyActivations = pgTable(
  "croco_feature_policy_activations",
  {
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    activeRevision: integer("active_revision").notNull(),
    activeHash: varchar("active_hash", { length: 128 }).notNull(),
    status: text("status").notNull().$type<"active" | "paused">(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.policyId, table.scopeKey] })],
);

export const featurePolicyCommandReceipts = pgTable(
  "croco_feature_policy_command_receipts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    commandFingerprint: varchar("command_fingerprint", { length: 128 }).notNull(),
    command: jsonb("command").notNull(),
    receipt: jsonb("receipt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("croco_feature_policy_commands_identity_unique").on(
      table.policyId,
      table.scopeKey,
      table.idempotencyKey,
    ),
    index("croco_feature_policy_commands_scope_idx").on(table.policyId, table.scopeKey),
  ],
);

export const featurePolicySchedules = pgTable(
  "croco_feature_policy_schedules",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    revision: integer("revision").notNull(),
    reviewHash: varchar("review_hash", { length: 128 }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    state: text("state").notNull().$type<PolicyScheduleState>(),
    executionId: varchar("execution_id", { length: 255 }),
    triggerId: varchar("trigger_id", { length: 255 }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    claimedBy: varchar("claimed_by", { length: 255 }),
    lastError: text("last_error"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("croco_feature_policy_schedules_command_unique").on(
      table.policyId,
      table.scopeKey,
      table.idempotencyKey,
    ),
    index("croco_feature_policy_schedules_due_idx").on(table.state, table.effectiveAt),
  ],
);

export const featurePolicyDecisions = pgTable(
  "croco_feature_policy_decisions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    version: integer("version").notNull(),
    revision: integer("revision").notNull(),
    hash: varchar("hash", { length: 128 }).notNull(),
    value: jsonb("value"),
    status: text("status").notNull(),
    reason: text("reason"),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("croco_feature_policy_decisions_scope_time_idx").on(
      table.policyId,
      table.scopeKey,
      table.evaluatedAt,
    ),
  ],
);

export const featurePolicyAudit = pgTable(
  "croco_feature_policy_audit",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    policyId: text("policy_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    action: text("action").notNull(),
    revisionId: varchar("revision_id", { length: 255 }),
    revision: integer("revision"),
    actor: jsonb("actor").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("croco_feature_policy_audit_scope_time_idx").on(
      table.policyId,
      table.scopeKey,
      table.occurredAt,
    ),
  ],
);

export type FeaturePolicyDefinitionRow = typeof featurePolicyDefinitions.$inferSelect;
export type FeaturePolicyRevisionRow = typeof featurePolicyRevisions.$inferSelect;
export type FeaturePolicyCommandReceiptRow = typeof featurePolicyCommandReceipts.$inferSelect;
export type FeaturePolicyScheduleRow = typeof featurePolicySchedules.$inferSelect;
export type FeaturePolicyAuditRow = typeof featurePolicyAudit.$inferSelect;
