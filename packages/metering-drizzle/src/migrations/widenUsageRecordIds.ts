import { sql } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

export type UsageRecordIdMigrationClient = {
  execute(query: SQLWrapper): Promise<unknown>;
  transaction<T>(
    callback: (tx: { execute(query: SQLWrapper): Promise<unknown> }) => Promise<T>,
  ): Promise<T>;
};

/** Widens PostgreSQL usage record IDs from UUID to text so metering operation IDs remain intact. */
export async function widenUsageRecordIdsPostgres(db: UsageRecordIdMigrationClient): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      ALTER TABLE usage_records
        ALTER COLUMN id DROP DEFAULT,
        ALTER COLUMN id TYPE TEXT USING id::text,
        ALTER COLUMN id SET DEFAULT gen_random_uuid()::text
    `);
  });
}
