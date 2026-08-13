import { sql } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

export interface HealthScorePrecisionMigrationClient {
  execute(query: SQLWrapper): Promise<unknown>;
  transaction<T>(
    callback: (tx: { execute(query: SQLWrapper): Promise<unknown> }) => Promise<T>,
  ): Promise<T>;
}

/** Widens PostgreSQL health scores so fractional JavaScript numbers round-trip unchanged. */
export async function widenHealthScorePrecisionPostgres(
  db: HealthScorePrecisionMigrationClient,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`ALTER TABLE tenant_health_scores
        ALTER COLUMN overall_score TYPE DOUBLE PRECISION,
        ALTER COLUMN previous_score TYPE DOUBLE PRECISION`,
    );
  });
}
