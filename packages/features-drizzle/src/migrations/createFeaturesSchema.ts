import { sql } from "drizzle-orm";
import { PolicyProblem } from "@croco/features-core";

export interface FeaturePolicyMigrationClient {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
  transaction?<T>(work: (client: FeaturePolicyMigrationClient) => Promise<T>): Promise<T>;
}

export class FeaturePolicyMigrationProblem extends PolicyProblem {
  constructor(operation: string, cause: unknown) {
    super(
      "unavailable",
      `Feature policy migration failed while attempting to ${operation}`,
      undefined,
      { cause: cause instanceof Error ? cause : undefined },
    );
  }
}

/** Creates all PostgreSQL tables and indexes required by the feature policy adapter. */
export async function createFeaturesSchema(client: FeaturePolicyMigrationClient): Promise<void> {
  const migrate = async (target: FeaturePolicyMigrationClient): Promise<void> => {
    await target.execute(sql`
      create table if not exists croco_feature_policy_definitions (
        policy_id text not null,
        scope_key text not null,
        app text not null,
        environment text not null,
        tenant_id text,
        schema_version text not null,
        code_registration_id text not null,
        registration_fingerprint varchar(128) not null,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint croco_feature_policy_definitions_pk primary key (policy_id, scope_key)
      )
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_revisions (
        id varchar(255) primary key,
        policy_id text not null,
        scope_key text not null,
        revision integer not null check (revision > 0),
        version integer not null check (version > 0),
        schema_version text not null,
        code_registration_id text not null,
        registration_fingerprint varchar(128) not null,
        value jsonb not null,
        hash varchar(128) not null,
        state text not null check (state in ('draft', 'reviewed', 'scheduled', 'published', 'paused')),
        review jsonb,
        publication jsonb,
        scheduled_for timestamptz,
        schedule_idempotency_key text,
        fallback jsonb,
        pause_reason text,
        rollback_of integer,
        history jsonb not null,
        created_at timestamptz not null default now(),
        constraint croco_feature_policy_revisions_scope_revision_unique
          unique (policy_id, scope_key, revision)
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_policy_revisions_scope_created_idx
        on croco_feature_policy_revisions(policy_id, scope_key, created_at)
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_heads (
        policy_id text not null,
        scope_key text not null,
        revision integer not null,
        updated_at timestamptz not null default now(),
        constraint croco_feature_policy_heads_pk primary key (policy_id, scope_key),
        constraint croco_feature_policy_heads_revision_fk
          foreign key (policy_id, scope_key, revision)
          references croco_feature_policy_revisions(policy_id, scope_key, revision)
      )
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_reviews (
        id varchar(255) primary key,
        policy_id text not null,
        scope_key text not null,
        revision integer not null,
        review_hash varchar(128) not null,
        review jsonb not null,
        reviewed_at timestamptz not null,
        constraint croco_feature_policy_reviews_identity_unique
          unique (policy_id, scope_key, revision, review_hash),
        constraint croco_feature_policy_reviews_revision_fk
          foreign key (policy_id, scope_key, revision)
          references croco_feature_policy_revisions(policy_id, scope_key, revision)
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_policy_reviews_scope_revision_idx
        on croco_feature_policy_reviews(policy_id, scope_key, revision)
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_activations (
        policy_id text not null,
        scope_key text not null,
        active_revision integer not null,
        active_hash varchar(128) not null,
        status text not null check (status in ('active', 'paused')),
        changed_at timestamptz not null,
        constraint croco_feature_policy_activations_pk primary key (policy_id, scope_key),
        constraint croco_feature_policy_activations_revision_fk
          foreign key (policy_id, scope_key, active_revision)
          references croco_feature_policy_revisions(policy_id, scope_key, revision)
      )
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_command_receipts (
        id varchar(255) primary key,
        policy_id text not null,
        scope_key text not null,
        idempotency_key varchar(255) not null,
        command_fingerprint varchar(128) not null,
        command jsonb not null,
        receipt jsonb not null,
        created_at timestamptz not null default now(),
        constraint croco_feature_policy_commands_identity_unique
          unique (policy_id, scope_key, idempotency_key)
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_policy_commands_scope_idx
        on croco_feature_policy_command_receipts(policy_id, scope_key)
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_schedules (
        id varchar(255) primary key,
        policy_id text not null,
        scope_key text not null,
        revision integer not null,
        review_hash varchar(128) not null,
        effective_at timestamptz not null,
        idempotency_key varchar(255) not null,
        state text not null check (state in ('pending', 'claimed', 'completed', 'cancelled', 'failed')),
        execution_id varchar(255),
        trigger_id varchar(255),
        lease_until timestamptz,
        claimed_by varchar(255),
        last_error text,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint croco_feature_policy_schedules_command_unique
          unique (policy_id, scope_key, idempotency_key),
        constraint croco_feature_policy_schedules_revision_fk
          foreign key (policy_id, scope_key, revision)
          references croco_feature_policy_revisions(policy_id, scope_key, revision)
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_policy_schedules_due_idx
        on croco_feature_policy_schedules(state, effective_at)
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_decisions (
        id varchar(255) primary key,
        policy_id text not null,
        scope_key text not null,
        version integer not null,
        revision integer not null,
        hash varchar(128) not null,
        value jsonb,
        status text not null,
        reason text,
        evaluated_at timestamptz not null
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_policy_decisions_scope_time_idx
        on croco_feature_policy_decisions(policy_id, scope_key, evaluated_at)
    `);
    await target.execute(sql`
      create table if not exists croco_feature_policy_audit (
        id varchar(255) primary key,
        policy_id text not null,
        scope_key text not null,
        action text not null,
        revision_id varchar(255),
        revision integer,
        actor jsonb not null,
        reason text not null,
        occurred_at timestamptz not null
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_policy_audit_scope_time_idx
        on croco_feature_policy_audit(policy_id, scope_key, occurred_at)
    `);
  };

  try {
    if (client.transaction) {
      await client.transaction((transaction) => migrate(transaction));
      return;
    }
    await migrate(client);
  } catch (error) {
    throw new FeaturePolicyMigrationProblem("create schema", error);
  }
}

/** Drops the feature policy tables in dependency order for isolated test databases. */
export async function dropFeaturesSchema(client: FeaturePolicyMigrationClient): Promise<void> {
  try {
    await client.execute(sql`drop table if exists croco_feature_policy_audit cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_decisions cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_schedules cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_command_receipts cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_activations cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_reviews cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_heads cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_revisions cascade`);
    await client.execute(sql`drop table if exists croco_feature_policy_definitions cascade`);
  } catch (error) {
    throw new FeaturePolicyMigrationProblem("drop schema", error);
  }
}
