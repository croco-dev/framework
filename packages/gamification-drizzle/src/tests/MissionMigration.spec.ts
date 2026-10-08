import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { addGamificationMissions, removeGamificationMissions } from "../index";

describe("mission migration", () => {
  it("creates scoped durable instances, evidence and unique completion before dependent cleanup", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
      },
    };
    await addGamificationMissions(db);
    expect(statements).toHaveLength(4);
    expect(statements[2]).toContain(
      "PRIMARY KEY (tenant_id, app_id, environment_id, subject_id, mission_id, event_id)",
    );
    expect(statements[3]).toContain("completion_period_key)");
    statements.length = 0;
    await removeGamificationMissions(db);
    expect(statements).toEqual([
      "DROP TABLE IF EXISTS gamification_completions",
      "DROP TABLE IF EXISTS gamification_evidence",
      "DROP TABLE IF EXISTS gamification_instances",
      "DROP TABLE IF EXISTS gamification_definitions",
    ]);
  });
});
