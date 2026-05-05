import { sql } from 'drizzle-orm';

export async function up(db: { execute: (query: unknown) => Promise<unknown> }) {
  await db.execute(sql`
    DELETE FROM usage_records a USING usage_records b
     WHERE a.tenant_id = b.tenant_id
       AND a.meter_id = b.meter_id
       AND a.idempotency_key = b.idempotency_key
       AND a.idempotency_key IS NOT NULL
       AND (a.recorded_at < b.recorded_at
            OR (a.recorded_at = b.recorded_at AND a.id < b.id))
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS usage_records_idempotency_unique
      ON usage_records (tenant_id, meter_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `);
}

export async function down(db: { execute: (query: unknown) => Promise<unknown> }) {
  await db.execute(sql`DROP INDEX IF EXISTS usage_records_idempotency_unique`);
}
