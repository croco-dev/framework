import { Pool } from "pg";
import { PgDialect } from "drizzle-orm/pg-core";
import type { ExperiencePgDatabase, ExperiencePgExecutor } from "@croco/experience-drizzle";
const connectionString = process.env.SAVED_INTENTS_DATABASE_URL;
if (!connectionString) throw new Error("SAVED_INTENTS_DATABASE_URL is required");
export const pool = new Pool({ connectionString });
const dialect = new PgDialect();
function executor(client: Pick<Pool, "query">): ExperiencePgExecutor {
  return {
    execute: (statement) => {
      const query = dialect.sqlToQuery(statement);
      return client.query(query.sql, query.params) as Promise<{ rows: Record<string, unknown>[] }>;
    },
  };
}
export const database: ExperiencePgDatabase = {
  ...executor(pool),
  transaction: async (work) => {
    const client = await pool.connect();
    let discard = false;
    try {
      await client.query("BEGIN");
      const result = await work(executor(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
        process.stderr.write("Saved intent transaction rollback failed; connection discarded\n");
      }
      throw error;
    } finally {
      client.release(discard);
    }
  },
};
