import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { DrizzleEnrichmentStore } from "@croco/analytics-drizzle";
import { EnrichmentProblem } from "@croco/analytics-core/enrichment";

export function database() {
  const connectionString = process.env.ENRICHMENT_POSTGRES_URL;
  let url: URL | undefined;
  try {
    url = connectionString ? new URL(connectionString) : undefined;
  } catch (cause) {
    throw new EnrichmentProblem("local-database-required", cause);
  }
  if (
    !connectionString ||
    !url ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.searchParams.has("host") ||
    url.searchParams.has("hostaddr")
  )
    throw new EnrichmentProblem("local-database-required");
  const pool = new Pool({ connectionString, max: 4 });
  const db = drizzle(pool);
  return { pool, db, store: new DrizzleEnrichmentStore(db) };
}
