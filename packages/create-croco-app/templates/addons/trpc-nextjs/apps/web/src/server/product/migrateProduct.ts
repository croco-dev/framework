import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { TrialProblem } from "./ProductTrials";

export function migrateProduct(path: string): void {
  let database: DatabaseSync | undefined;
  try {
    mkdirSync(dirname(path), { recursive: true });
    database = new DatabaseSync(path);
    const version = database.prepare("PRAGMA user_version").get()?.user_version;
    if (version === 1) return;
    if (version !== 0) {
      throw new TrialProblem(
        "TRIAL_SCHEMA_UNSUPPORTED",
        ProblemCategory.InternalServerError,
        "Unsupported product database schema version.",
      );
    }
    database.exec(`BEGIN IMMEDIATE;
      CREATE TABLE product_trials (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
        command_id TEXT NOT NULL, title TEXT NOT NULL, audience TEXT NOT NULL,
        brief TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE,
        correlation_id TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE (tenant_id, user_id, command_id)
      );
      CREATE TABLE product_trial_facts (
        event_id TEXT PRIMARY KEY, result_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL, occurred_at TEXT NOT NULL
      );
      CREATE TRIGGER product_trial_facts_no_update BEFORE UPDATE ON product_trial_facts
        BEGIN SELECT RAISE(ABORT, 'Committed trial facts are immutable'); END;
      CREATE TRIGGER product_trial_facts_no_delete BEFORE DELETE ON product_trial_facts
        BEGIN SELECT RAISE(ABORT, 'Committed trial facts are immutable'); END;
      PRAGMA user_version = 1;
      COMMIT;`);
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new TrialProblem(
      "TRIAL_MIGRATION_FAILED",
      ProblemCategory.InternalServerError,
      "The product database migration failed.",
      error instanceof Error ? error : new Error(String(error)),
    );
  } finally {
    database?.close();
  }
}
