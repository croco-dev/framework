import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CohortInvalidProblem } from "@croco/cohort-core";
import { PostgresCohortStore } from "@croco/cohort-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { CohortDefinition } from "@croco/cohort-core";
import type { CohortPgDatabase, CohortPgExecutor } from "@croco/cohort-drizzle";
import type { SQL } from "drizzle-orm";

const databaseUrl = process.env.COHORT_EXAMPLE_DATABASE_URL;
if (!databaseUrl) throw new CohortInvalidProblem("COHORT_EXAMPLE_DATABASE_URL is required");

const schema = `cohort_example_${randomUUID().replaceAll("-", "")}`;
export const pool = new Pool({
  connectionString: databaseUrl,
  options: `-c search_path=${schema}`,
});
const orm = drizzle(pool);
const execute = (connection: {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}): CohortPgExecutor => ({
  execute: (query) => connection.execute(query),
});
const database: CohortPgDatabase = {
  execute: (query) => orm.execute(query),
  transaction: (work) => orm.transaction((tx) => work(execute(tx))),
};

export async function createExample() {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const migration = readFileSync(
    resolve(__dirname, "../../../packages/cohort-drizzle/migrations/0001_cohort.up.sql"),
    "utf8",
  );
  await pool.query(migration);
  await pool.query(`CREATE TABLE IF NOT EXISTS cohort_example_source (
    app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
    subject_kind text NOT NULL, snapshot_id text NOT NULL, subject_id text NOT NULL,
    plan text NOT NULL, events jsonb NOT NULL, coverage jsonb NOT NULL, memberships jsonb NOT NULL,
    PRIMARY KEY (snapshot_id, subject_id)
  )`);

  const sourceSnapshotId = randomUUID();
  const scope = { appId: "cohort-example", environment: "local", tenantId: "demo-tenant" };
  const asOf = "2026-09-27T00:00:00.000Z";
  const coverage = [{ event: "report.created", from: "2026-09-20T00:00:00.000Z", to: asOf }];
  for (const [subjectId, events, observed] of [
    ["active-trial", [{ event: "report.created", occurredAt: "2026-09-26T00:00:00.000Z" }], true],
    ["inactive-trial", [], true],
    ["unobserved-trial", [], false],
  ] as const) {
    await pool.query(`INSERT INTO cohort_example_source VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
      scope.appId,
      scope.environment,
      scope.tenantId,
      "customer",
      sourceSnapshotId,
      subjectId,
      "trial",
      JSON.stringify(events),
      JSON.stringify(observed ? coverage : []),
      "[]",
    ]);
  }

  const definition: CohortDefinition = {
    id: `inactive-trials-${sourceSnapshotId}`,
    version: 1,
    subjectKind: "customer",
    scope,
    root: {
      kind: "all",
      children: [
        { kind: "fact", field: "plan", operator: "eq", value: "trial" },
        {
          kind: "event",
          event: "report.created",
          metric: "count",
          operator: "eq",
          value: 0,
          windowDays: 7,
        },
      ],
    },
  };
  const registration = {
    fields: { plan: { type: "string" as const, operators: ["eq" as const], values: ["trial"] } },
    events: ["report.created"],
    memberships: [],
  };
  const context = { scope, subjectKind: "customer", allowedFields: ["plan"] };
  const mapping = {
    table: "cohort_example_source",
    appId: "app_id",
    environment: "environment",
    tenantId: "tenant_id",
    subjectKind: "subject_kind",
    snapshotId: "snapshot_id",
    subjectId: "subject_id",
    facts: { plan: "plan" },
    events: "events",
    coverage: "coverage",
    memberships: "memberships",
  };
  const store = new PostgresCohortStore(database);
  return { pool, store, definition, registration, context, mapping, sourceSnapshotId, scope, asOf };
}
