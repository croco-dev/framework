import { sql, type SQL } from "drizzle-orm";

export type MissionMigrationClient = { execute(query: SQL): Promise<unknown> };

/** Run explicitly through the application's migration owner before constructing the store. */
export async function addGamificationMissions(db: MissionMigrationClient): Promise<void> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS gamification_definitions (
    tenant_id text NOT NULL, app_id text NOT NULL, environment_id text NOT NULL,
    mission_id text NOT NULL, version integer NOT NULL, revision integer NOT NULL,
    idempotency_key text NOT NULL, publication jsonb NOT NULL,
    PRIMARY KEY (tenant_id, app_id, environment_id, mission_id, version),
    UNIQUE (tenant_id, app_id, environment_id, mission_id, revision),
    UNIQUE (tenant_id, app_id, environment_id, mission_id, idempotency_key)
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS gamification_instances (
    tenant_id text NOT NULL, app_id text NOT NULL, environment_id text NOT NULL,
    subject_id text NOT NULL, mission_id text NOT NULL, version integer NOT NULL,
    episode_id text NOT NULL, period_key text NOT NULL, definition jsonb NOT NULL, instances jsonb NOT NULL,
    PRIMARY KEY (tenant_id, app_id, environment_id, subject_id, mission_id, version, episode_id, period_key)
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS gamification_evidence (
    tenant_id text NOT NULL, app_id text NOT NULL, environment_id text NOT NULL,
    subject_id text NOT NULL, mission_id text NOT NULL, version integer NOT NULL,
    episode_id text NOT NULL, period_key text NOT NULL, event_id text NOT NULL, receipt jsonb NOT NULL,
    PRIMARY KEY (tenant_id, app_id, environment_id, subject_id, mission_id, event_id),
    FOREIGN KEY (tenant_id, app_id, environment_id, subject_id, mission_id, version, episode_id, period_key)
      REFERENCES gamification_instances (tenant_id, app_id, environment_id, subject_id, mission_id, version, episode_id, period_key)
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS gamification_completions (
    tenant_id text NOT NULL, app_id text NOT NULL, environment_id text NOT NULL,
    subject_id text NOT NULL, mission_id text NOT NULL, version integer NOT NULL,
    episode_id text NOT NULL, period_key text NOT NULL, completion_period_key text NOT NULL, completion jsonb NOT NULL,
    PRIMARY KEY (tenant_id, app_id, environment_id, subject_id, mission_id, version, episode_id, period_key, completion_period_key),
    FOREIGN KEY (tenant_id, app_id, environment_id, subject_id, mission_id, version, episode_id, period_key)
      REFERENCES gamification_instances (tenant_id, app_id, environment_id, subject_id, mission_id, version, episode_id, period_key)
  )`);
}

export async function removeGamificationMissions(db: MissionMigrationClient): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS gamification_completions`);
  await db.execute(sql`DROP TABLE IF EXISTS gamification_evidence`);
  await db.execute(sql`DROP TABLE IF EXISTS gamification_instances`);
  await db.execute(sql`DROP TABLE IF EXISTS gamification_definitions`);
}
