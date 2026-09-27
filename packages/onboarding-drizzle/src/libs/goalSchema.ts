import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  bigint,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const scope = {
  tenantId: text("tenant_id").notNull(),
  appId: text("app_id").notNull(),
  environmentId: text("environment_id").notNull(),
};

export const onboardingGoalDefinitions = pgTable(
  "onboarding_goal_definitions",
  {
    ...scope,
    definitionId: text("definition_id").notNull(),
    version: text("version").notNull(),
    actionId: text("action_id").notNull(),
    anchor: text("anchor").notNull(),
    windowMs: bigint("window_ms", { mode: "number" }).notNull(),
    allowedLatenessMs: bigint("allowed_lateness_ms", { mode: "number" }).notNull(),
    timezone: text("timezone").notNull(),
    countMode: text("count_mode", {
      enum: ["events", "distinct_objects", "distinct_calendar_days"],
    }).notNull(),
    threshold: bigint("threshold", { mode: "number" }).notNull(),
    deletedObjectPolicy: text("deleted_object_policy", { enum: ["retain", "retract"] }).notNull(),
    presentation: jsonb("presentation")
      .$type<{
        title?: string;
        description?: string;
        nextActionHref?: string;
        guidanceSteps?: readonly {
          id: string;
          title: string;
          description?: string;
          href?: string;
        }[];
      }>()
      .notNull()
      .default({}),
    revision: bigint("revision", { mode: "number" }).notNull(),
    actorId: text("actor_id").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.appId,
        table.environmentId,
        table.definitionId,
        table.version,
      ],
    }),
    uniqueIndex("onboarding_goal_definitions_revision_unique").on(
      table.tenantId,
      table.appId,
      table.environmentId,
      table.definitionId,
      table.revision,
    ),
    uniqueIndex("onboarding_goal_definitions_idempotency_unique").on(
      table.tenantId,
      table.appId,
      table.environmentId,
      table.definitionId,
      table.idempotencyKey,
    ),
    check("onboarding_goal_definitions_threshold_positive", sql`${table.threshold} > 0`),
    check("onboarding_goal_definitions_window_positive", sql`${table.windowMs} > 0`),
    check("onboarding_goal_definitions_lateness_nonnegative", sql`${table.allowedLatenessMs} >= 0`),
  ],
);

export const onboardingGoalEpisodes = pgTable(
  "onboarding_goal_episodes",
  {
    ...scope,
    subjectId: text("subject_id").notNull(),
    episodeId: text("episode_id").notNull(),
    definitionId: text("definition_id").notNull(),
    definitionVersion: text("definition_version").notNull(),
    actionId: text("action_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allowedLatenessMs: bigint("allowed_lateness_ms", { mode: "number" }).notNull(),
    timezone: text("timezone").notNull(),
    countMode: text("count_mode", {
      enum: ["events", "distinct_objects", "distinct_calendar_days"],
    }).notNull(),
    threshold: bigint("threshold", { mode: "number" }).notNull(),
    deletedObjectPolicy: text("deleted_object_policy", { enum: ["retain", "retract"] }).notNull(),
    progress: bigint("progress", { mode: "number" }).notNull().default(0),
    status: text("status", {
      enum: ["in_progress", "closing", "achieved", "expired", "canceled"],
    }).notNull(),
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.appId, table.environmentId, table.subjectId, table.episodeId],
    }),
    foreignKey({
      name: "onboarding_goal_episodes_definition_fk",
      columns: [
        table.tenantId,
        table.appId,
        table.environmentId,
        table.definitionId,
        table.definitionVersion,
      ],
      foreignColumns: [
        onboardingGoalDefinitions.tenantId,
        onboardingGoalDefinitions.appId,
        onboardingGoalDefinitions.environmentId,
        onboardingGoalDefinitions.definitionId,
        onboardingGoalDefinitions.version,
      ],
    }),
    index("onboarding_goal_episodes_subject_idx").on(
      table.tenantId,
      table.appId,
      table.environmentId,
      table.subjectId,
    ),
    check("onboarding_goal_episodes_window_valid", sql`${table.endsAt} > ${table.startedAt}`),
    check("onboarding_goal_episodes_progress_nonnegative", sql`${table.progress} >= 0`),
    check("onboarding_goal_episodes_threshold_positive", sql`${table.threshold} > 0`),
    check("onboarding_goal_episodes_lateness_nonnegative", sql`${table.allowedLatenessMs} >= 0`),
    check(
      "onboarding_goal_episodes_achievement_valid",
      sql`(${table.status} = 'achieved') = (${table.achievedAt} is not null)`,
    ),
  ],
);

export const onboardingGoalReceipts = pgTable(
  "onboarding_goal_receipts",
  {
    ...scope,
    subjectId: text("subject_id").notNull(),
    episodeId: text("episode_id").notNull(),
    eventId: text("event_id").notNull(),
    actionId: text("action_id").notNull(),
    objectDigest: text("object_digest"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    receiptHash: text("receipt_hash").notNull(),
    accepted: text("accepted", { enum: ["counted", "late_correction"] }).notNull(),
    kind: text("kind", { enum: ["action", "retract_event", "delete_object"] }).notNull(),
    targetEventId: text("target_event_id"),
    retractedAt: timestamp("retracted_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.appId,
        table.environmentId,
        table.subjectId,
        table.episodeId,
        table.eventId,
      ],
    }),
    foreignKey({
      name: "onboarding_goal_receipts_episode_fk",
      columns: [table.tenantId, table.appId, table.environmentId, table.subjectId, table.episodeId],
      foreignColumns: [
        onboardingGoalEpisodes.tenantId,
        onboardingGoalEpisodes.appId,
        onboardingGoalEpisodes.environmentId,
        onboardingGoalEpisodes.subjectId,
        onboardingGoalEpisodes.episodeId,
      ],
    }),
    index("onboarding_goal_receipts_count_idx").on(
      table.tenantId,
      table.appId,
      table.environmentId,
      table.subjectId,
      table.episodeId,
      table.accepted,
      table.occurredAt,
    ),
  ],
);
