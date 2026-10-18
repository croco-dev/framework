import { sql } from "drizzle-orm";
import { AcquisitionProblem } from "@croco/analytics-core/acquisition";
import type { FactHistoryDatabase } from "../libs/DrizzleFactHistoryStore";

/** Explicit, transactional additive migration. Never invoked by the service or store constructor. */
export async function createAcquisition(db: FactHistoryDatabase): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`CREATE TABLE IF NOT EXISTS analytics_acquisition_scopes (
        scope_key text PRIMARY KEY, revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0)
      )`);
      await tx.execute(sql`CREATE TABLE IF NOT EXISTS analytics_acquisition_records (
        scope_key text NOT NULL REFERENCES analytics_acquisition_scopes(scope_key),
        kind text NOT NULL CHECK(kind IN ('touchpoints','links','definitions','reports','deleted')),
        source text NOT NULL, record_key text NOT NULL, row_data jsonb NOT NULL,
        PRIMARY KEY(scope_key,kind,source,record_key)
      )`);
    });
  } catch (cause) {
    const problem = new AcquisitionProblem("persistence");
    Object.defineProperty(problem, "cause", { value: cause });
    throw problem;
  }
}
