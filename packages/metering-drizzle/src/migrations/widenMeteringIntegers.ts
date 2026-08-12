import { sql } from "drizzle-orm";

export type MeteringIntegerMigrationClient = {
  execute(query: unknown): Promise<unknown>;
  transaction<T>(
    callback: (tx: { execute(query: unknown): Promise<unknown> }) => Promise<T>,
  ): Promise<T>;
};

/** Widens PostgreSQL metering integers so safe-integer usage and quotas remain exact. */
export async function widenMeteringIntegersPostgres(
  db: MeteringIntegerMigrationClient,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`ALTER TABLE meters ALTER COLUMN quota TYPE BIGINT`);
    await tx.execute(sql`ALTER TABLE usage_records ALTER COLUMN value TYPE BIGINT`);
  });
}
