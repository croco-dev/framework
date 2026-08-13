import { sql } from "drizzle-orm";

export type CustomerHealthMigrationClient = {
  execute(query: unknown): Promise<unknown>;
};

export async function addHealthEventIntents(db: CustomerHealthMigrationClient): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS tenant_health_scores_transition_sequence_seq
  `);
  await db.execute(sql`
    ALTER TABLE tenant_health_scores
      ADD COLUMN IF NOT EXISTS transition_sequence bigint
  `);
  await db.execute(sql`
    WITH existing AS (
      SELECT COALESCE(MAX(transition_sequence), 0) AS maximum
      FROM tenant_health_scores
    ), ranked AS (
      SELECT ctid, ROW_NUMBER() OVER (ORDER BY calculated_at, tenant_id, ctid) AS position
      FROM tenant_health_scores
      WHERE transition_sequence IS NULL
    )
    UPDATE tenant_health_scores AS scores
    SET transition_sequence = existing.maximum + ranked.position
    FROM existing, ranked
    WHERE scores.ctid = ranked.ctid
  `);
  await db.execute(sql`
    SELECT setval(
      'tenant_health_scores_transition_sequence_seq',
      GREATEST(COALESCE(MAX(transition_sequence), 1), 1),
      COUNT(*) > 0
    )
    FROM tenant_health_scores
  `);
  await db.execute(sql`
    ALTER TABLE tenant_health_scores
      ALTER COLUMN transition_sequence
        SET DEFAULT nextval('tenant_health_scores_transition_sequence_seq'),
      ALTER COLUMN transition_sequence SET NOT NULL
  `);
  await db.execute(sql`
    ALTER SEQUENCE tenant_health_scores_transition_sequence_seq
      OWNED BY tenant_health_scores.transition_sequence
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_health_event_intents (
      event_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      transition_sequence bigint NOT NULL,
      intent_order integer NOT NULL,
      occurred_at timestamp with time zone NOT NULL,
      data jsonb NOT NULL,
      published_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS tenant_health_event_intents_pending_idx
      ON tenant_health_event_intents (tenant_id, transition_sequence, intent_order)
      WHERE published_at IS NULL
  `);
}

export async function removeHealthEventIntents(db: CustomerHealthMigrationClient): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS tenant_health_event_intents`);
  await db.execute(sql`
    ALTER TABLE tenant_health_scores
      DROP COLUMN IF EXISTS transition_sequence
  `);
}
