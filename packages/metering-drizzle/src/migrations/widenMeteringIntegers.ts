import { sql } from "drizzle-orm";

export type MeteringIntegerMigrationClient = {
  execute(query: unknown): Promise<unknown>;
};

/** Widens PostgreSQL metering integers so safe-integer usage and quotas remain exact. */
export async function widenMeteringIntegersPostgres(
  db: MeteringIntegerMigrationClient,
): Promise<void> {
  await db.execute(sql`ALTER TABLE meters ALTER COLUMN quota TYPE BIGINT`);
  await db.execute(sql`ALTER TABLE usage_records ALTER COLUMN value TYPE BIGINT`);
}
