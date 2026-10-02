import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import type {
  ExperimentAssignment,
  ExperimentCommandReceipt,
  ExperimentConfigureReceipt,
  ExperimentExposure,
  ExperimentRecord,
} from "@croco/features-core";

export const featureExperiments = pgTable(
  "croco_feature_experiments",
  {
    targetKey: text("target_key").primaryKey(),
    experimentId: text("experiment_id").notNull(),
    experimentRevision: text("experiment_revision").notNull(),
    scopeKey: text("scope_key").notNull(),
    record: jsonb("record").notNull().$type<ExperimentRecord>(),
  },
  (table) => [
    uniqueIndex("croco_feature_experiments_identity_unique").on(
      table.experimentId,
      table.experimentRevision,
      table.scopeKey,
    ),
    index("croco_feature_experiments_scope_idx").on(table.scopeKey),
  ],
);

export const featureExperimentAssignments = pgTable(
  "croco_feature_experiment_assignments",
  {
    id: text("id").primaryKey(),
    targetKey: text("target_key")
      .notNull()
      .references(() => featureExperiments.targetKey),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    assignment: jsonb("assignment").notNull().$type<ExperimentAssignment>(),
  },
  (table) => [
    check(
      "croco_feature_experiment_assignments_subject_kind_check",
      sql`${table.subjectKind} in ('user', 'tenant', 'anonymous')`,
    ),
    check(
      "croco_feature_experiment_assignments_subject_id_check",
      sql`length(${table.subjectId}) > 0`,
    ),
    uniqueIndex("croco_feature_experiment_assignments_identity_unique").on(
      table.targetKey,
      table.subjectKind,
      table.subjectId,
    ),
  ],
);

export const featureExperimentExposures = pgTable(
  "croco_feature_experiment_exposures",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => featureExperimentAssignments.id),
    deliveryInstanceId: text("delivery_instance_id").notNull(),
    exposure: jsonb("exposure").notNull().$type<ExperimentExposure>(),
  },
  (table) => [
    check(
      "croco_feature_experiment_exposures_delivery_instance_id_check",
      sql`length(${table.deliveryInstanceId}) > 0`,
    ),
    uniqueIndex("croco_feature_experiment_exposures_delivery_unique").on(
      table.assignmentId,
      table.deliveryInstanceId,
    ),
  ],
);

export const featureExperimentCommands = pgTable(
  "croco_feature_experiment_commands",
  {
    targetKey: text("target_key")
      .notNull()
      .references(() => featureExperiments.targetKey),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    receipt: jsonb("receipt")
      .notNull()
      .$type<ExperimentCommandReceipt | ExperimentConfigureReceipt>(),
  },
  (table) => [primaryKey({ columns: [table.targetKey, table.idempotencyKey] })],
);

export const featureExperimentAudit = pgTable(
  "croco_feature_experiment_audit",
  {
    targetKey: text("target_key").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    receipt: jsonb("receipt")
      .notNull()
      .$type<ExperimentCommandReceipt | ExperimentConfigureReceipt>(),
  },
  (table) => [
    primaryKey({ columns: [table.targetKey, table.idempotencyKey] }),
    foreignKey({
      columns: [table.targetKey, table.idempotencyKey],
      foreignColumns: [
        featureExperimentCommands.targetKey,
        featureExperimentCommands.idempotencyKey,
      ],
    }),
  ],
);
