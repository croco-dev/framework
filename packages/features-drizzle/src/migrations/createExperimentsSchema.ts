import { sql } from "drizzle-orm";
import { ExperimentProblem } from "@croco/features-core";
import type { FeaturePolicyMigrationClient } from "./createFeaturesSchema";

/** Additive experiment tables; existing feature policy data is untouched. */
export async function createExperimentsSchema(client: FeaturePolicyMigrationClient): Promise<void> {
  const migrate = async (target: FeaturePolicyMigrationClient): Promise<void> => {
    await target.execute(sql`
      create table if not exists croco_feature_experiments (
        target_key text primary key,
        experiment_id text not null,
        experiment_revision text not null,
        scope_key text not null,
        record jsonb not null,
        constraint croco_feature_experiments_identity_unique unique (experiment_id, experiment_revision, scope_key)
      )
    `);
    await target.execute(sql`
      create index if not exists croco_feature_experiments_scope_idx
      on croco_feature_experiments(scope_key)
    `);
    await target.execute(sql`
      create table if not exists croco_feature_experiment_assignments (
        id text primary key,
        target_key text not null references croco_feature_experiments(target_key),
        subject_kind text not null check (subject_kind in ('user', 'tenant', 'anonymous')),
        subject_id text not null check (length(subject_id) > 0),
        assignment jsonb not null,
        constraint croco_feature_experiment_assignments_identity_unique unique (target_key, subject_kind, subject_id)
      )
    `);
    await target.execute(sql`
      create table if not exists croco_feature_experiment_exposures (
        id text primary key,
        assignment_id text not null references croco_feature_experiment_assignments(id),
        delivery_instance_id text not null check (length(delivery_instance_id) > 0),
        exposure jsonb not null,
        constraint croco_feature_experiment_exposures_delivery_unique unique (assignment_id, delivery_instance_id)
      )
    `);
    await target.execute(sql`
      create table if not exists croco_feature_experiment_commands (
        target_key text not null references croco_feature_experiments(target_key),
        idempotency_key text not null,
        fingerprint text not null,
        receipt jsonb not null,
        primary key (target_key, idempotency_key)
      )
    `);
    await target.execute(sql`
      create table if not exists croco_feature_experiment_audit (
        target_key text not null,
        idempotency_key text not null,
        receipt jsonb not null,
        primary key (target_key, idempotency_key),
        foreign key (target_key, idempotency_key)
          references croco_feature_experiment_commands(target_key, idempotency_key)
      )
    `);
  };
  try {
    if (client.transaction) await client.transaction(migrate);
    else await migrate(client);
  } catch (error) {
    throw new ExperimentProblem("unavailable", "Could not create experiment schema", {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/** Only for isolated test databases; drops experiment tables in dependency order. */
export async function dropExperimentsSchema(client: FeaturePolicyMigrationClient): Promise<void> {
  try {
    await client.execute(sql`drop table if exists croco_feature_experiment_audit`);
    await client.execute(sql`drop table if exists croco_feature_experiment_commands`);
    await client.execute(sql`drop table if exists croco_feature_experiment_exposures`);
    await client.execute(sql`drop table if exists croco_feature_experiment_assignments`);
    await client.execute(sql`drop table if exists croco_feature_experiments`);
  } catch (error) {
    throw new ExperimentProblem("unavailable", "Could not drop experiment schema", {
      cause: error instanceof Error ? error : undefined,
    });
  }
}
