import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  createExperimentsSchema,
  dropExperimentsSchema,
  featureExperimentAssignments,
  featureExperimentExposures,
} from "../index";
import type { SQL } from "drizzle-orm";

async function statements(migration: typeof createExperimentsSchema): Promise<string[]> {
  const captured: string[] = [];
  const dialect = new PgDialect();
  await migration({
    execute: async (query: SQL) => {
      captured.push(dialect.sqlToQuery(query).sql.replace(/\s+/g, " ").trim());
    },
  });
  return captured;
}

describe("ExperimentSchema", () => {
  it("creates deterministic additive tables with assignment, delivery, and audit constraints", async () => {
    const queries = await statements(createExperimentsSchema);
    expect(queries).toEqual(await statements(createExperimentsSchema));
    expect(queries).toHaveLength(6);
    expect(
      queries.every((query) => query.startsWith("create ") && query.includes("if not exists")),
    ).toBe(true);
    expect(queries.join("\n")).not.toContain("croco_feature_policy_");
    expect(queries.join("\n")).toContain("unique (target_key, subject_kind, subject_id)");
    expect(queries.join("\n")).toContain("unique (assignment_id, delivery_instance_id)");
    expect(queries.join("\n")).toContain("references croco_feature_experiment_assignments(id)");
    expect(queries.join("\n")).toContain(
      "references croco_feature_experiment_commands(target_key, idempotency_key)",
    );
  });

  it("declares matching Drizzle uniqueness and foreign keys", () => {
    const assignment = getTableConfig(featureExperimentAssignments);
    const exposure = getTableConfig(featureExperimentExposures);
    expect(assignment.indexes[0]?.config.unique).toBe(true);
    expect(assignment.foreignKeys).toHaveLength(1);
    expect(exposure.indexes[0]?.config.unique).toBe(true);
    expect(exposure.foreignKeys).toHaveLength(1);
  });

  it("drops only experiment tables in dependency order without cascading policy data", async () => {
    const queries = await statements(dropExperimentsSchema);
    expect(queries).toHaveLength(5);
    expect(queries[0]).toBe("drop table if exists croco_feature_experiment_audit");
    expect(queries[4]).toBe("drop table if exists croco_feature_experiments");
    expect(queries.join(" ")).not.toMatch(/cascade|policy/);
  });

  it("preserves migration failure causes", async () => {
    const cause = new Error("unavailable");
    await expect(
      createExperimentsSchema({
        execute: async () => {
          throw cause;
        },
      }),
    ).rejects.toMatchObject({ cause });
  });
});
