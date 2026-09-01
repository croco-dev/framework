import { Problem } from "@croco/problems-core";
import { EngagementPersistenceProblem } from "@croco/engagement-core";
import { sql } from "drizzle-orm";

export type EngagementMigrationClient = Readonly<{
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
}>;

async function migrate(operation: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new EngagementPersistenceProblem(
      operation,
      "schema",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/** Creates the PostgreSQL schema required by the engagement persistence adapter. */
export async function createEngagementSchema(client: EngagementMigrationClient): Promise<void> {
  return migrate("create-schema", async () => {
    await client.execute(sql`
      create table if not exists engagement_contact_endpoints (
        tenant_id text not null,
        id text not null,
        recipient_id text not null,
        kind text not null check (kind in ('email', 'push')),
        address text,
        provider text,
        app text,
        platform text,
        environment text,
        token_reference text,
        last_seen_at timestamptz not null,
        version integer not null default 1,
        invalidated_at timestamptz,
        invalidation_reason text,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        constraint engagement_contact_endpoints_primary primary key (tenant_id, id),
        constraint engagement_contact_endpoints_version_positive check (version > 0),
        constraint engagement_contact_endpoints_shape_valid check (
          (
            kind = 'email'
            and address is not null
            and provider is null
            and app is null
            and platform is null
            and environment is null
            and token_reference is null
          ) or (
            kind = 'push'
            and address is null
            and provider is not null
            and app is not null
            and platform is not null
            and environment is not null
            and token_reference is not null
          )
        )
      )
    `);
    await client.execute(sql`
      create index if not exists engagement_contact_endpoints_recipient_active_idx
        on engagement_contact_endpoints (tenant_id, recipient_id, invalidated_at, kind, id)
    `);

    await client.execute(sql`
      create table if not exists engagement_preferences (
        tenant_id text not null,
        scope text not null check (scope in ('recipient', 'tenant')),
        recipient_key text not null,
        topic text not null,
        channel text not null,
        state text not null check (state in ('allow', 'deny')),
        source text not null,
        changed_at timestamptz not null,
        evidence jsonb,
        constraint engagement_preferences_primary
          primary key (tenant_id, scope, recipient_key, topic, channel),
        constraint engagement_preferences_scope_recipient_valid check (
          (scope = 'tenant' and recipient_key = '')
          or (scope = 'recipient' and recipient_key <> '')
        )
      )
    `);

    await client.execute(sql`
      create table if not exists engagement_suppressions (
        tenant_id text not null,
        id text not null,
        recipient_id text,
        endpoint_id text,
        channel text not null,
        topic text,
        reason text not null,
        source text not null,
        created_at timestamptz not null,
        expires_at timestamptz,
        evidence jsonb,
        constraint engagement_suppressions_primary primary key (tenant_id, id),
        constraint engagement_suppressions_target_required check (
          recipient_id is not null or endpoint_id is not null
        )
      )
    `);
    await client.execute(sql`
      create index if not exists engagement_suppressions_lookup_idx
        on engagement_suppressions (
          tenant_id,
          channel,
          recipient_id,
          endpoint_id,
          topic,
          expires_at
        )
    `);

    await client.execute(sql`
      create table if not exists engagement_dispatches (
        tenant_id text not null,
        id text not null,
        message_id text not null,
        recipient_id text not null,
        channel text not null,
        semantic_key text not null,
        topic text not null,
        outcome jsonb not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        constraint engagement_dispatches_primary primary key (tenant_id, id),
        constraint engagement_dispatches_logical_identity_unique unique (
          tenant_id,
          message_id,
          recipient_id,
          channel,
          semantic_key
        )
      )
    `);
    await client.execute(sql`
      create index if not exists engagement_dispatches_recipient_history_idx
        on engagement_dispatches (tenant_id, recipient_id, updated_at, id)
    `);

    await client.execute(sql`
      create table if not exists engagement_dispatch_targets (
        tenant_id text not null,
        dispatch_id text not null,
        endpoint_id text not null,
        endpoint_version integer not null,
        execution_id text,
        provider text,
        provider_message_id text,
        constraint engagement_dispatch_targets_primary
          primary key (tenant_id, dispatch_id, endpoint_id),
        constraint engagement_dispatch_targets_endpoint_version_positive
          check (endpoint_version > 0),
        constraint engagement_dispatch_targets_dispatch_fk
          foreign key (tenant_id, dispatch_id)
          references engagement_dispatches (tenant_id, id)
          on delete cascade
      )
    `);

    await client.execute(sql`
      create table if not exists engagement_delivery_events (
        tenant_id text not null,
        id text not null,
        provider text not null,
        provider_event_id text not null,
        dispatch_id text not null,
        endpoint_id text not null,
        type text not null check (
          type in (
            'accepted',
            'delivered',
            'opened',
            'clicked',
            'bounced',
            'complained',
            'unsubscribed',
            'token-invalid',
            'expired',
            'failed'
          )
        ),
        occurred_at timestamptz not null,
        evidence jsonb,
        recorded_at timestamptz not null,
        constraint engagement_delivery_events_primary primary key (tenant_id, id),
        constraint engagement_delivery_events_provider_identity_unique
          unique (tenant_id, provider, provider_event_id),
        constraint engagement_delivery_events_dispatch_fk
          foreign key (tenant_id, dispatch_id)
          references engagement_dispatches (tenant_id, id)
      )
    `);
    await client.execute(sql`
      create index if not exists engagement_delivery_events_dispatch_history_idx
        on engagement_delivery_events (tenant_id, dispatch_id, occurred_at, id)
    `);
  });
}

/** Removes the engagement adapter schema in dependency order. Intended for tests and local teardown. */
export async function dropEngagementSchema(client: EngagementMigrationClient): Promise<void> {
  return migrate("drop-schema", async () => {
    await client.execute(sql`drop table if exists engagement_delivery_events`);
    await client.execute(sql`drop table if exists engagement_dispatch_targets`);
    await client.execute(sql`drop table if exists engagement_dispatches`);
    await client.execute(sql`drop table if exists engagement_suppressions`);
    await client.execute(sql`drop table if exists engagement_preferences`);
    await client.execute(sql`drop table if exists engagement_contact_endpoints`);
  });
}
