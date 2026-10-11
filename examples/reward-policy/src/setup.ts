import "reflect-metadata";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createRewardSchema } from "@croco/gamification-drizzle";

async function setup() {
  if (!process.env.REWARD_EXAMPLE_DATABASE_URL)
    throw new Error("REWARD_EXAMPLE_DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.REWARD_EXAMPLE_DATABASE_URL });
  try {
    await createRewardSchema(drizzle(pool));
    await pool.query(
      "create table reward_example_reports (id text primary key, subject text not null, tenant_id text not null, app_id text not null, environment_id text not null, title text not null)",
    );
  } finally {
    await pool.end();
  }
}
void setup().catch((cause: unknown) => {
  console.error(cause);
  process.exitCode = 1;
});
