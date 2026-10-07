import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./database";
async function main(): Promise<void> {
  await pool.query(
    await readFile(
      resolve(
        __dirname,
        "../../../packages/experience-drizzle/migrations/0002_saved_intent.up.sql",
      ),
      "utf8",
    ),
  );
  await pool.query(await readFile(resolve(__dirname, "../reports.sql"), "utf8"));
}
void main()
  .catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
