import { sql, type SQL } from "drizzle-orm";

export type GoalMigrationClient = { execute(statement: SQL): Promise<unknown> };

/** Adds goal publication, episode, and receipt tables without changing checklist state. */
export async function addOnboardingGoals(db: GoalMigrationClient): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS onboarding_goal_definitions (
      tenant_id text NOT NULL,
      app_id text NOT NULL,
      environment_id text NOT NULL,
      definition_id text NOT NULL,
      version text NOT NULL,
      action_id text NOT NULL,
      anchor text NOT NULL CHECK (anchor IN ('signup', 'first_visit', 'return')),
      window_ms bigint NOT NULL CHECK (window_ms > 0),
      allowed_lateness_ms bigint NOT NULL CHECK (allowed_lateness_ms >= 0),
      timezone text NOT NULL,
      count_mode text NOT NULL CHECK (count_mode IN ('events', 'distinct_objects', 'distinct_calendar_days')),
      threshold bigint NOT NULL CHECK (threshold > 0),
      deleted_object_policy text NOT NULL CHECK (deleted_object_policy IN ('retain', 'retract')),
      presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
      revision bigint NOT NULL CHECK (revision > 0),
      actor_id text NOT NULL,
      reason text NOT NULL,
      idempotency_key text NOT NULL,
      published_at timestamptz NOT NULL,
      PRIMARY KEY (tenant_id, app_id, environment_id, definition_id, version)
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS onboarding_goal_definitions_revision_unique
      ON onboarding_goal_definitions (tenant_id, app_id, environment_id, definition_id, revision)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS onboarding_goal_definitions_idempotency_unique
      ON onboarding_goal_definitions (tenant_id, app_id, environment_id, definition_id, idempotency_key)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS onboarding_goal_episodes (
      tenant_id text NOT NULL,
      app_id text NOT NULL,
      environment_id text NOT NULL,
      subject_id text NOT NULL,
      episode_id text NOT NULL,
      definition_id text NOT NULL,
      definition_version text NOT NULL,
      action_id text NOT NULL,
      started_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL CHECK (ends_at > started_at),
      allowed_lateness_ms bigint NOT NULL CHECK (allowed_lateness_ms >= 0),
      timezone text NOT NULL,
      count_mode text NOT NULL CHECK (count_mode IN ('events', 'distinct_objects', 'distinct_calendar_days')),
      threshold bigint NOT NULL CHECK (threshold > 0),
      deleted_object_policy text NOT NULL CHECK (deleted_object_policy IN ('retain', 'retract')),
      progress bigint NOT NULL DEFAULT 0 CHECK (progress >= 0),
      status text NOT NULL CHECK (status IN ('in_progress', 'closing', 'achieved', 'expired', 'canceled')),
      achieved_at timestamptz,
      updated_at timestamptz NOT NULL,
      PRIMARY KEY (tenant_id, app_id, environment_id, subject_id, episode_id),
      CONSTRAINT onboarding_goal_episodes_definition_fk
        FOREIGN KEY (tenant_id, app_id, environment_id, definition_id, definition_version)
        REFERENCES onboarding_goal_definitions (tenant_id, app_id, environment_id, definition_id, version),
      CONSTRAINT onboarding_goal_episodes_achievement_valid
        CHECK ((status = 'achieved') = (achieved_at IS NOT NULL))
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS onboarding_goal_episodes_subject_idx
      ON onboarding_goal_episodes (tenant_id, app_id, environment_id, subject_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS onboarding_goal_receipts (
      tenant_id text NOT NULL,
      app_id text NOT NULL,
      environment_id text NOT NULL,
      subject_id text NOT NULL,
      episode_id text NOT NULL,
      event_id text NOT NULL,
      action_id text NOT NULL,
      object_digest text,
      occurred_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL,
      receipt_hash text NOT NULL,
      accepted text NOT NULL CHECK (accepted IN ('counted', 'late_correction')),
      kind text NOT NULL CHECK (kind IN ('action', 'retract_event', 'delete_object')),
      target_event_id text,
      retracted_at timestamptz,
      PRIMARY KEY (tenant_id, app_id, environment_id, subject_id, episode_id, event_id),
      CONSTRAINT onboarding_goal_receipts_episode_fk
        FOREIGN KEY (tenant_id, app_id, environment_id, subject_id, episode_id)
        REFERENCES onboarding_goal_episodes (tenant_id, app_id, environment_id, subject_id, episode_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS onboarding_goal_receipts_count_idx
      ON onboarding_goal_receipts
      (tenant_id, app_id, environment_id, subject_id, episode_id, accepted, occurred_at)
  `);
}

export async function removeOnboardingGoals(db: GoalMigrationClient): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS onboarding_goal_receipts`);
  await db.execute(sql`DROP TABLE IF EXISTS onboarding_goal_episodes`);
  await db.execute(sql`DROP TABLE IF EXISTS onboarding_goal_definitions`);
}
