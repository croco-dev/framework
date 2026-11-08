import { sql } from "drizzle-orm";
import type { EntitlementMigrationClient } from "./addPlanVersionEntitlements";

/** Preserves fractional and large JavaScript numbers in existing PostgreSQL entitlement rules. */
export async function widenEntitlementNumericColumnsPostgres(
  db: EntitlementMigrationClient,
): Promise<void> {
  await db.execute(sql`ALTER TABLE plan_entitlements
    ALTER COLUMN value TYPE DOUBLE PRECISION,
    ALTER COLUMN quota TYPE DOUBLE PRECISION`);
}
