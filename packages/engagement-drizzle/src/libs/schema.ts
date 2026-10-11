import type {
  Reminder,
  ReminderOccurrence,
  ReminderSchedule,
  ContactPolicyConfig,
  ContactPolicyReconciliation,
  ContactPolicyTopic,
  CampaignMemberOutcomeStatus,
  CampaignSnapshotState,
  CampaignSnapshotValue,
  EngagementDeliveryPolicy,
  EndpointInvalidationReason,
  EngagementDeliveryEventType,
  EngagementDispatchOutcome,
  EngagementEvidence,
  EngagementPreferenceScope,
  EngagementPreferenceState,
} from "@croco/engagement-core";
import type { MessageChannel } from "@croco/engagement-core";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core";

export const engagementContactEndpoints = pgTable(
  "engagement_contact_endpoints",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    recipientId: text("recipient_id").notNull(),
    kind: text("kind", { enum: ["email", "push"] }).notNull(),
    address: text("address"),
    provider: text("provider"),
    app: text("app"),
    platform: text("platform"),
    environment: text("environment"),
    tokenReference: text("token_reference"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    version: integer("version").notNull().default(1),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    invalidationReason: text("invalidation_reason").$type<EndpointInvalidationReason>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "engagement_contact_endpoints_primary",
      columns: [table.tenantId, table.id],
    }),
    index("engagement_contact_endpoints_recipient_active_idx").on(
      table.tenantId,
      table.recipientId,
      table.invalidatedAt,
      table.kind,
      table.id,
    ),
    check("engagement_contact_endpoints_version_positive", sql`${table.version} > 0`),
    check(
      "engagement_contact_endpoints_shape_valid",
      sql`(
        ${table.kind} = 'email'
        and ${table.address} is not null
        and ${table.provider} is null
        and ${table.app} is null
        and ${table.platform} is null
        and ${table.environment} is null
        and ${table.tokenReference} is null
      ) or (
        ${table.kind} = 'push'
        and ${table.address} is null
        and ${table.provider} is not null
        and ${table.app} is not null
        and ${table.platform} is not null
        and ${table.environment} is not null
        and ${table.tokenReference} is not null
      )`,
    ),
  ],
);

export const engagementPreferences = pgTable(
  "engagement_preferences",
  {
    tenantId: text("tenant_id").notNull(),
    scope: text("scope", { enum: ["recipient", "tenant"] })
      .$type<EngagementPreferenceScope>()
      .notNull(),
    recipientKey: text("recipient_key").notNull(),
    topic: text("topic").notNull(),
    channel: text("channel").notNull().$type<MessageChannel>(),
    state: text("state", { enum: ["allow", "deny"] })
      .$type<EngagementPreferenceState>()
      .notNull(),
    source: text("source").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    evidence: jsonb("evidence").$type<EngagementEvidence>(),
  },
  (table) => [
    primaryKey({
      name: "engagement_preferences_primary",
      columns: [table.tenantId, table.scope, table.recipientKey, table.topic, table.channel],
    }),
    check(
      "engagement_preferences_scope_recipient_valid",
      sql`(
        ${table.scope} = 'tenant' and ${table.recipientKey} = ''
      ) or (
        ${table.scope} = 'recipient' and ${table.recipientKey} <> ''
      )`,
    ),
  ],
);

export const engagementSuppressions = pgTable(
  "engagement_suppressions",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    recipientId: text("recipient_id"),
    endpointId: text("endpoint_id"),
    channel: text("channel").notNull().$type<MessageChannel>(),
    topic: text("topic"),
    reason: text("reason").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    evidence: jsonb("evidence").$type<EngagementEvidence>(),
  },
  (table) => [
    primaryKey({
      name: "engagement_suppressions_primary",
      columns: [table.tenantId, table.id],
    }),
    index("engagement_suppressions_lookup_idx").on(
      table.tenantId,
      table.channel,
      table.recipientId,
      table.endpointId,
      table.topic,
      table.expiresAt,
    ),
    check(
      "engagement_suppressions_target_required",
      sql`${table.recipientId} is not null or ${table.endpointId} is not null`,
    ),
  ],
);

export const engagementDispatches = pgTable(
  "engagement_dispatches",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    messageId: text("message_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    channel: text("channel").notNull().$type<MessageChannel>(),
    semanticKey: text("semantic_key").notNull(),
    topic: text("topic").notNull(),
    outcome: jsonb("outcome").notNull().$type<EngagementDispatchOutcome>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "engagement_dispatches_primary",
      columns: [table.tenantId, table.id],
    }),
    uniqueIndex("engagement_dispatches_logical_identity_unique").on(
      table.tenantId,
      table.messageId,
      table.recipientId,
      table.channel,
      table.semanticKey,
    ),
    index("engagement_dispatches_recipient_history_idx").on(
      table.tenantId,
      table.recipientId,
      table.updatedAt,
      table.id,
    ),
  ],
);

export const engagementDispatchTargets = pgTable(
  "engagement_dispatch_targets",
  {
    tenantId: text("tenant_id").notNull(),
    dispatchId: text("dispatch_id").notNull(),
    endpointId: text("endpoint_id").notNull(),
    endpointVersion: integer("endpoint_version").notNull(),
    executionId: text("execution_id"),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
  },
  (table) => [
    primaryKey({
      name: "engagement_dispatch_targets_primary",
      columns: [table.tenantId, table.dispatchId, table.endpointId],
    }),
    foreignKey({
      name: "engagement_dispatch_targets_dispatch_fk",
      columns: [table.tenantId, table.dispatchId],
      foreignColumns: [engagementDispatches.tenantId, engagementDispatches.id],
    }).onDelete("cascade"),
    check(
      "engagement_dispatch_targets_endpoint_version_positive",
      sql`${table.endpointVersion} > 0`,
    ),
  ],
);

export const engagementDeliveryEvents = pgTable(
  "engagement_delivery_events",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    dispatchId: text("dispatch_id").notNull(),
    endpointId: text("endpoint_id").notNull(),
    type: text("type").notNull().$type<EngagementDeliveryEventType>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    evidence: jsonb("evidence").$type<EngagementEvidence>(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "engagement_delivery_events_primary",
      columns: [table.tenantId, table.id],
    }),
    uniqueIndex("engagement_delivery_events_provider_identity_unique").on(
      table.tenantId,
      table.provider,
      table.providerEventId,
    ),
    index("engagement_delivery_events_dispatch_history_idx").on(
      table.tenantId,
      table.dispatchId,
      table.occurredAt,
      table.id,
    ),
    foreignKey({
      name: "engagement_delivery_events_dispatch_fk",
      columns: [table.tenantId, table.dispatchId],
      foreignColumns: [engagementDispatches.tenantId, engagementDispatches.id],
    }),
  ],
);

export const engagementCampaignSnapshots = pgTable(
  "engagement_campaign_snapshots",
  {
    scopeKey: text("scope_key").notNull(),
    id: text("id").notNull(),
    audienceId: text("audience_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    campaignVersion: text("campaign_version").notNull(),
    messageId: text("message_id").notNull(),
    descriptorFingerprint: text("descriptor_fingerprint").notNull(),
    state: text("state", { enum: ["building", "complete", "failed"] })
      .$type<CampaignSnapshotState>()
      .notNull(),
    memberCount: integer("member_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
  },
  (table) => [
    primaryKey({
      name: "engagement_campaign_snapshots_primary",
      columns: [table.scopeKey, table.id],
    }),
    check("engagement_campaign_snapshots_member_count_nonnegative", sql`${table.memberCount} >= 0`),
    check(
      "engagement_campaign_snapshots_terminal_shape_valid",
      sql`(
        ${table.state} = 'building'
        and ${table.completedAt} is null
        and ${table.failureCode} is null
      ) or (
        ${table.state} = 'complete'
        and ${table.completedAt} is not null
        and ${table.failureCode} is null
      ) or (
        ${table.state} = 'failed'
        and ${table.completedAt} is not null
        and ${table.failureCode} is not null
      )`,
    ),
  ],
);

export const engagementCampaignSnapshotMembers = pgTable(
  "engagement_campaign_snapshot_members",
  {
    scopeKey: text("scope_key").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    memberKey: text("member_key").notNull(),
    recipient: jsonb("recipient").$type<Readonly<{ tenantId: string; userId: string }>>(),
    state: text("state", { enum: ["ready", "mapping-failed"] }).notNull(),
    data: jsonb("data").$type<CampaignSnapshotValue>(),
    policy: text("policy", {
      enum: ["first-reachable", "all-reachable"],
    }).$type<EngagementDeliveryPolicy>(),
    failureCode: text("failure_code"),
  },
  (table) => [
    primaryKey({
      name: "engagement_campaign_snapshot_members_primary",
      columns: [table.scopeKey, table.snapshotId, table.ordinal],
    }),
    uniqueIndex("engagement_campaign_snapshot_members_key_unique").on(
      table.scopeKey,
      table.snapshotId,
      table.memberKey,
    ),
    foreignKey({
      name: "engagement_campaign_snapshot_members_snapshot_fk",
      columns: [table.scopeKey, table.snapshotId],
      foreignColumns: [engagementCampaignSnapshots.scopeKey, engagementCampaignSnapshots.id],
    }).onDelete("cascade"),
    check("engagement_campaign_snapshot_members_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
    check(
      "engagement_campaign_snapshot_members_shape_valid",
      sql`(
        ${table.state} = 'ready'
        and ${table.recipient} is not null
        and ${table.data} is not null
        and ${table.failureCode} is null
      ) or (
        ${table.state} = 'mapping-failed'
        and ${table.data} is null
        and ${table.policy} is null
        and ${table.failureCode} is not null
      )`,
    ),
  ],
);

export const engagementCampaignMemberOutcomes = pgTable(
  "engagement_campaign_member_outcomes",
  {
    scopeKey: text("scope_key").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    memberKey: text("member_key").notNull(),
    outcome: jsonb("outcome").notNull().$type<
      Readonly<{
        status: CampaignMemberOutcomeStatus;
        executionIds?: readonly string[];
        reason?: string;
        failureCode?: string;
        retryable?: boolean;
      }>
    >(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "engagement_campaign_member_outcomes_primary",
      columns: [table.scopeKey, table.snapshotId, table.memberKey],
    }),
    foreignKey({
      name: "engagement_campaign_member_outcomes_member_fk",
      columns: [table.scopeKey, table.snapshotId, table.memberKey],
      foreignColumns: [
        engagementCampaignSnapshotMembers.scopeKey,
        engagementCampaignSnapshotMembers.snapshotId,
        engagementCampaignSnapshotMembers.memberKey,
      ],
    }).onDelete("cascade"),
    check(
      "engagement_campaign_member_outcomes_status_valid",
      sql`${table.outcome} ->> 'status' in ('queued', 'suppressed', 'failed', 'skipped')`,
    ),
  ],
);

export type EngagementContactEndpointRow = typeof engagementContactEndpoints.$inferSelect;
export type EngagementDispatchRow = typeof engagementDispatches.$inferSelect;
export type EngagementDispatchTargetRow = typeof engagementDispatchTargets.$inferSelect;
export type EngagementDeliveryEventRow = typeof engagementDeliveryEvents.$inferSelect;
export type EngagementCampaignSnapshotRow = typeof engagementCampaignSnapshots.$inferSelect;
export type EngagementCampaignSnapshotMemberRow =
  typeof engagementCampaignSnapshotMembers.$inferSelect;
export type EngagementCampaignMemberOutcomeRow =
  typeof engagementCampaignMemberOutcomes.$inferSelect;

export const engagementContactPolicyBuckets = pgTable(
  "engagement_contact_policy_buckets",
  { scopeKey: text("scope_key").notNull(), subject: text("subject").notNull() },
  (table) => [
    primaryKey({
      name: "engagement_contact_policy_buckets_primary",
      columns: [table.scopeKey, table.subject],
    }),
  ],
);

export const engagementContactPolicyReservations = pgTable(
  "engagement_contact_policy_reservations",
  {
    scopeKey: text("scope_key").notNull(),
    subject: text("subject").notNull(),
    logicalSendId: text("logical_send_id").notNull(),
    recipient: text("recipient").notNull(),
    channel: text("channel").notNull().$type<MessageChannel>(),
    topic: text("topic").notNull(),
    messageId: text("message_id").notNull(),
    campaignId: text("campaign_id"),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    policyVersion: text("policy_version").notNull(),
    windowKey: text("window_key").notNull(),
    state: text("state", { enum: ["reserved", "committed", "released", "unknown"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    executionIds: jsonb("execution_ids").$type<string[]>().notNull(),
    exempt: boolean("exempt").notNull(),
    reconciliation: jsonb("reconciliation").$type<ContactPolicyReconciliation>(),
  },
  (table) => [
    primaryKey({
      name: "engagement_contact_policy_reservations_primary",
      columns: [table.scopeKey, table.subject, table.logicalSendId],
    }),
    foreignKey({
      name: "engagement_contact_policy_reservations_bucket_fk",
      columns: [table.scopeKey, table.subject],
      foreignColumns: [
        engagementContactPolicyBuckets.scopeKey,
        engagementContactPolicyBuckets.subject,
      ],
    }),
    check(
      "engagement_contact_policy_reservations_state_valid",
      sql`${table.state} in ('reserved', 'committed', 'released', 'unknown')`,
    ),
    index("engagement_contact_policy_reservations_history_idx").on(
      table.scopeKey,
      table.subject,
      table.createdAt,
    ),
  ],
);

export const engagementContactPolicySettings = pgTable(
  "engagement_contact_policy_settings",
  {
    scopeKey: text("scope_key").notNull(),
    revision: integer("revision").notNull(),
    config: jsonb("config").$type<ContactPolicyConfig>().notNull(),
    topics: jsonb("topics").$type<ContactPolicyTopic[]>().notNull(),
  },
  (table) => [
    primaryKey({
      name: "engagement_contact_policy_settings_primary",
      columns: [table.scopeKey],
    }),
    check("engagement_contact_policy_settings_revision_positive", sql`${table.revision} > 0`),
  ],
);

export const engagementContactPolicyAudit = pgTable(
  "engagement_contact_policy_audit",
  {
    scopeKey: text("scope_key").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    actorId: text("actor_id").notNull(),
    reason: text("reason").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    policy: jsonb("policy")
      .$type<
        Readonly<{
          revision: number;
          config: ContactPolicyConfig;
          topics: readonly ContactPolicyTopic[];
        }>
      >()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "engagement_contact_policy_audit_primary",
      columns: [table.scopeKey, table.idempotencyKey],
    }),
  ],
);

export const engagementReminderBuckets = pgTable(
  "engagement_reminder_buckets",
  {
    scopeKey: text("scope_key").notNull(),
    subject: text("subject").notNull(),
  },
  (table) => [primaryKey({ columns: [table.scopeKey, table.subject] })],
);

export const engagementReminders = pgTable(
  "engagement_reminders",
  {
    scopeKey: text("scope_key").notNull(),
    subject: text("subject").notNull(),
    id: text("id").notNull(),
    topic: text("topic").notNull(),
    resourceRef: text("resource_ref").notNull(),
    timezone: text("timezone").notNull(),
    schedule: jsonb("schedule").$type<ReminderSchedule>().notNull(),
    channel: text("channel").$type<MessageChannel>().notNull(),
    lateDeliveryMs: bigint("late_delivery_ms", { mode: "number" }).notNull(),
    version: integer("version").notNull(),
    state: text("state").$type<Reminder["state"]>().notNull(),
    nextScheduledAt: timestamp("next_scheduled_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.scopeKey, table.subject, table.id] }),
    foreignKey({
      columns: [table.scopeKey, table.subject],
      foreignColumns: [engagementReminderBuckets.scopeKey, engagementReminderBuckets.subject],
    }),
    check("engagement_reminders_version_positive", sql`${table.version} > 0`),
    check(
      "engagement_reminders_state_valid",
      sql`${table.state} in ('active', 'snoozed', 'canceled')`,
    ),
    check("engagement_reminders_late_nonnegative", sql`${table.lateDeliveryMs} >= 0`),
  ],
);

export const engagementReminderOccurrences = pgTable(
  "engagement_reminder_occurrences",
  {
    scopeKey: text("scope_key").notNull(),
    subject: text("subject").notNull(),
    id: text("id").notNull(),
    reminderId: text("reminder_id").notNull(),
    reminderVersion: integer("reminder_version").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    state: text("state").$type<ReminderOccurrence["state"]>().notNull(),
    reason: text("reason").$type<ReminderOccurrence["reason"]>(),
    executionIds: jsonb("execution_ids").$type<readonly string[]>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeKey, table.subject, table.id] }),
    foreignKey({
      columns: [table.scopeKey, table.subject, table.reminderId],
      foreignColumns: [
        engagementReminders.scopeKey,
        engagementReminders.subject,
        engagementReminders.id,
      ],
    }),
    uniqueIndex("engagement_reminder_occurrence_identity").on(
      table.scopeKey,
      table.subject,
      table.reminderId,
      table.reminderVersion,
      table.scheduledAt,
    ),
    check(
      "engagement_reminder_occurrences_state_valid",
      sql`${table.state} in ('pending', 'claimed', 'queued', 'suppressed', 'expired', 'unknown')`,
    ),
  ],
);

export const engagementReminderMutations = pgTable(
  "engagement_reminder_mutations",
  {
    scopeKey: text("scope_key").notNull(),
    subject: text("subject").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    result: jsonb("result")
      .$type<Omit<Reminder, "nextScheduledAt"> & { nextScheduledAt: string | null }>()
      .notNull(),
    occurrenceId: text("occurrence_id"),
    evidence: text("evidence"),
    outcome: text("outcome").$type<"accepted" | "not-accepted">(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeKey, table.subject, table.idempotencyKey] }),
    foreignKey({
      columns: [table.scopeKey, table.subject],
      foreignColumns: [engagementReminderBuckets.scopeKey, engagementReminderBuckets.subject],
    }),
  ],
);
