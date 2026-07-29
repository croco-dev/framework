import { sql } from "drizzle-orm";

export type ApiKeyRotationMigrationClient = {
  execute(query: unknown): Promise<unknown>;
};

export async function addApiKeyRotations(db: ApiKeyRotationMigrationClient): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_key_rotations (
      old_key_id uuid PRIMARY KEY REFERENCES api_keys(id) ON DELETE RESTRICT,
      new_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE RESTRICT,
      tenant_id text NOT NULL,
      idempotency_key text NOT NULL,
      recovery_ciphertext text NOT NULL,
      event_status text NOT NULL DEFAULT 'pending',
      event_claim_id text,
      event_claim_expires_at timestamp,
      event_id text NOT NULL,
      event_occurred_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT api_key_rotations_tenant_idempotency_unique
        UNIQUE (tenant_id, idempotency_key),
      CONSTRAINT api_key_rotations_new_key_unique UNIQUE (new_key_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS api_key_rotations_event_status_idx
      ON api_key_rotations (event_status, event_claim_expires_at)
  `);
}

export async function removeApiKeyRotations(db: ApiKeyRotationMigrationClient): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS api_key_rotations`);
}
