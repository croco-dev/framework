import { readFile } from "node:fs/promises";
import { pool } from "./learningFixture";

async function setup(): Promise<void> {
  try {
    await pool.query("CREATE SCHEMA learning_example");
    await pool.query(
      await readFile(
        new URL(
          "../../../packages/admin-postgres/migrations/0002_learning_registry.up.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  } finally {
    await pool.end();
  }
}
void setup().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
