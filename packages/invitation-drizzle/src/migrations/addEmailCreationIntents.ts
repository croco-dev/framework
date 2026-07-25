import { sql } from "drizzle-orm";

export type InvitationMigrationClient = {
  execute(query: unknown): Promise<unknown>;
};

export async function addEmailCreationIntents(db: InvitationMigrationClient): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invitation_email_creation_intents (
      invitation_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      idempotency_key text NOT NULL,
      request_fingerprint text NOT NULL,
      token_ciphertext text NOT NULL,
      notification_idempotency_key text NOT NULL,
      notification_status text NOT NULL DEFAULT 'pending',
      notification_claim_id text,
      notification_claim_expires_at timestamp,
      event_status text NOT NULL DEFAULT 'pending',
      event_claim_id text,
      event_claim_expires_at timestamp,
      event_id text NOT NULL,
      event_occurred_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT invitation_email_creation_tenant_idempotency_unique
        UNIQUE (tenant_id, idempotency_key)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS invitation_email_creation_status_idx
      ON invitation_email_creation_intents (notification_status, event_status)
  `);
}

export async function removeEmailCreationIntents(db: InvitationMigrationClient): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS invitation_email_creation_intents`);
}
