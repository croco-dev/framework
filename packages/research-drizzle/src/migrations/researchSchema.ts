import { sql } from "drizzle-orm";
import { ResearchPersistenceProblem } from "@croco/research-core";
export type ResearchMigrationClient = Readonly<{
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
}>;
/** Explicit migration only. Application boot and store operations never run DDL. */
export async function createResearchSchema(client: ResearchMigrationClient): Promise<void> {
  try {
    await client.execute(
      sql`create table if not exists research_studies (identity text primary key, record jsonb not null, constraint research_record_object check (jsonb_typeof(record) = 'object'))`,
    );
  } catch {
    throw new ResearchPersistenceProblem();
  }
}
