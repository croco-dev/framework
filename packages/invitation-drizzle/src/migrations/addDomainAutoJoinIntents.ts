import { sql } from "drizzle-orm";
import type { InvitationMigrationClient } from "./addEmailCreationIntents";

export async function addDomainAutoJoinIntents(db: InvitationMigrationClient): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS domain_auto_join_intents (
      tenant_id text NOT NULL,
      idempotency_key text NOT NULL,
      user_id text NOT NULL,
      email text NOT NULL,
      domain text NOT NULL,
      role text NOT NULL,
      membership_id text,
      membership_role text,
      membership_created_at timestamp,
      membership_updated_at timestamp,
      event_status text NOT NULL DEFAULT 'pending',
      event_claim_id text,
      event_claim_expires_at timestamp,
      event_id text NOT NULL,
      event_occurred_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT domain_auto_join_tenant_idempotency_unique
        UNIQUE (tenant_id, idempotency_key)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS domain_auto_join_event_status_idx
      ON domain_auto_join_intents (event_status, event_claim_expires_at)
  `);
}

export async function removeDomainAutoJoinIntents(db: InvitationMigrationClient): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS domain_auto_join_intents`);
}
