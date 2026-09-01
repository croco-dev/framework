import type {
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

export type EngagementContactEndpointRow = typeof engagementContactEndpoints.$inferSelect;
export type EngagementDispatchRow = typeof engagementDispatches.$inferSelect;
export type EngagementDispatchTargetRow = typeof engagementDispatchTargets.$inferSelect;
export type EngagementDeliveryEventRow = typeof engagementDeliveryEvents.$inferSelect;
