import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { PublishedCohortReader, cohortContentHash, evaluateCohort } from "@croco/cohort-core";
import { compileCohortPredicate, PostgresCohortStore } from "../index";
import type { CohortMaterialization, CohortPgDatabase, CohortPgExecutor } from "../index";
import type {
  CohortSnapshot,
  CohortPredicate,
  CohortSubject,
  CohortResult,
} from "@croco/cohort-core";
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const input: CohortMaterialization = {
  definition: {
    id: "trial",
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
  },
  registration: {
    fields: { plan: { type: "string", operators: ["eq", "ne"], values: ["trial", "paid"] } },
    events: ["report.created"],
    memberships: [],
  },
  context: { scope, subjectKind: "customer", allowedFields: ["plan"] },
  snapshotId: "source-1",
  mapping: {
    table: "cohort_source",
    subjectId: "id",
    snapshotId: "snapshot_id",
    appId: "app_id",
    environment: "environment",
    tenantId: "tenant_id",
    subjectKind: "subject_kind",
    facts: { plan: "plan" },
    events: "events",
    coverage: "coverage",
    memberships: "memberships",
  },
};
const asOf = "2026-09-20T00:00:00.000Z";
const dialect = new PgDialect();
describe("parameterized compiler", () => {
  it.each(["2026-09-20", "2026-09-20T00:00:00", "invalid"])(
    "rejects asOf without a valid timezone: %s",
    (asOfValue) => {
      expect(() =>
        compileCohortPredicate(
          input.definition,
          input.registration,
          input.context,
          input.mapping,
          asOfValue,
        ),
      ).toThrow("timestamp");
    },
  );
  it("binds literals and rejects unauthorized fields and identifiers", () => {
    const query = dialect.sqlToQuery(
      compileCohortPredicate(
        input.definition,
        input.registration,
        input.context,
        input.mapping,
        asOf,
      ),
    );
    expect(query.sql).not.toContain("report.created");
    expect(query.params).toContain("report.created");
    expect(query.params).toContain("trial");
    expect(() =>
      compileCohortPredicate(
        input.definition,
        input.registration,
        { ...input.context, allowedFields: [] },
        input.mapping,
        asOf,
      ),
    ).toThrow();
    expect(() =>
      compileCohortPredicate(
        input.definition,
        input.registration,
        input.context,
        { ...input.mapping, facts: { plan: "plan; DROP TABLE users" } },
        asOf,
      ),
    ).toThrow();
  });
});

// Use a separately supplied test driver so production has no driver dependency.
const url = process.env.COHORT_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL materialization and publication", () => {
  it("resumes fixed snapshots, preserves unknown and prevents two-connection publication races", async () => {
    const require = createRequire(import.meta.url);
    const { Pool } = require("pg") as {
      Pool: new (options: { connectionString: string }) => {
        query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
        connect(): Promise<{
          query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
          release(): void;
        }>;
        end(): Promise<void>;
      };
    };
    const pool = new Pool({ connectionString: url as string });
    function executor(client: {
      query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
    }): CohortPgExecutor {
      return {
        execute: (query) => {
          const q = dialect.sqlToQuery(query);
          return client.query(q.sql, q.params);
        },
      };
    }
    const database: CohortPgDatabase = {
      ...executor(pool),
      transaction: async (work) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await work(executor(client));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
    try {
      const parityRegistration: CohortMaterialization["registration"] = {
        fields: {
          score: { type: "number", operators: ["eq", "ne", "gt", "gte", "lt", "lte"] },
          active: { type: "boolean", operators: ["eq", "ne"] },
        },
        events: ["report.created"],
        memberships: ["vip", "other"],
      };
      const paritySubject: CohortSubject = {
        subjectId: "fixture",
        facts: { score: 7, active: true },
        memberships: ["vip"],
        coverage: [
          {
            event: "report.created",
            from: "2026-09-13T00:00:00Z",
            to: "2026-09-16T14:00:00+02:00",
          },
          { event: "report.created", from: "2026-09-16T08:00:00-04:00", to: asOf },
        ],
        events: [
          { event: "report.created", occurredAt: "2026-09-12T20:00:00-04:00" },
          { event: "report.created", occurredAt: "2026-09-14T01:00:00+02:00" },
          { event: "report.created", occurredAt: "2026-09-19T20:00:00+02:00" },
          { event: "report.created", occurredAt: asOf },
          { event: "report.created", occurredAt: "2026-09-12T23:59:59Z" },
        ],
      };
      async function expectParity(
        root: CohortPredicate,
        expected: CohortResult,
        subject = paritySubject,
      ): Promise<void> {
        const definition = { ...input.definition, root };
        const compiled = compileCohortPredicate(
          definition,
          parityRegistration,
          { ...input.context, allowedFields: ["score", "active"] },
          { ...input.mapping, facts: { score: "score", active: "active" } },
          asOf,
        );
        const result = await database.execute(
          sql`SELECT (${compiled}) AS result FROM (SELECT ${subject.facts.score}::double precision AS score, ${subject.facts.active}::boolean AS active, ${JSON.stringify(subject.events)}::jsonb AS events, ${JSON.stringify(subject.coverage)}::jsonb AS coverage, ${JSON.stringify(subject.memberships)}::jsonb AS memberships) fixture`,
        );
        expect(evaluateCohort(definition, subject, asOf).result, JSON.stringify(root)).toBe(
          expected,
        );
        expect(result.rows[0]?.result, JSON.stringify(root)).toBe(
          expected === "unknown" ? null : expected === "match",
        );
      }
      for (const [operator, value, expected] of [
        ["eq", 7, "match"],
        ["eq", 8, "no_match"],
        ["ne", 7, "no_match"],
        ["ne", 8, "match"],
        ["gt", 7, "no_match"],
        ["gt", 6, "match"],
        ["gte", 7, "match"],
        ["gte", 8, "no_match"],
        ["lt", 7, "no_match"],
        ["lt", 8, "match"],
        ["lte", 7, "match"],
        ["lte", 6, "no_match"],
      ] as const)
        await expectParity({ kind: "fact", field: "score", operator, value }, expected);
      for (const [operator, value, expected] of [
        ["eq", true, "match"],
        ["eq", false, "no_match"],
        ["ne", true, "no_match"],
        ["ne", false, "match"],
      ] as const)
        await expectParity({ kind: "fact", field: "active", operator, value }, expected);
      await expectParity(
        { kind: "fact", field: "active", operator: "eq", value: true },
        "unknown",
        { ...paritySubject, facts: { score: 7, active: null } },
      );
      await expectParity({ kind: "static", membershipId: "vip" }, "match");
      await expectParity({ kind: "static", membershipId: "other" }, "no_match");
      for (const [active, expected] of [
        [true, "match"],
        [false, "unknown"],
      ] as const) {
        await expectParity(
          {
            kind: "any",
            children: [
              { kind: "fact", field: "score", operator: "gt", value: 5 },
              { kind: "fact", field: "active", operator: "eq", value: true },
            ],
          },
          expected,
          { ...paritySubject, facts: { score: null, active } },
        );
      }
      const distinct: CohortPredicate = {
        kind: "event",
        event: "report.created",
        metric: "distinct-calendar-days",
        operator: "eq",
        value: 2,
        windowDays: 7,
      };
      await expectParity(distinct, "match");
      await expectParity({ ...distinct, value: 3 }, "no_match");
      await expectParity(distinct, "unknown", { ...paritySubject, coverage: [] });
      await expectParity({ ...distinct, metric: "count", value: 3 }, "match");
      await pool.query(
        "DROP TABLE IF EXISTS croco_cohort_erased,croco_cohort_current,croco_cohort_publications,croco_cohort_members,croco_cohort_runs,croco_cohort_definitions,cohort_source CASCADE",
      );
      await pool.query(
        readFileSync(new URL("../../migrations/0001_cohort.up.sql", import.meta.url), "utf8"),
      );
      await pool.query(
        "CREATE TABLE cohort_source(id text, snapshot_id text, app_id text, environment text, tenant_id text, subject_kind text, plan text, events jsonb, coverage jsonb, memberships jsonb)",
      );
      const coverage = [{ event: "report.created", from: "2026-09-13T00:00:00.000Z", to: asOf }];
      for (const [id, events, observed] of [
        ["c", [], []],
        ["a", [{ event: "report.created", occurredAt: "2026-09-19T00:00:00.000Z" }], coverage],
        ["b", [], coverage],
      ] as const) {
        await pool.query("INSERT INTO cohort_source VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
          id,
          "source-1",
          "app",
          "test",
          "tenant",
          "customer",
          "trial",
          JSON.stringify(events),
          JSON.stringify(observed),
          "[]",
        ]);
      }
      let store = new PostgresCohortStore(database);
      await store.saveDefinition(input.definition, input.registration, input.context);
      const run = {
        id: "run-1",
        definitionVersion: 1,
        asOf,
        sourceSnapshotRefs: ["source-1"],
        sourceWatermarks: { source: "v1" },
        status: "running" as const,
      };
      await store.start(input, run);
      const first = await store.materializePage(input, run.id, 0, 1);
      expect(first.members[0]?.result).toBe("no_match");
      store = new PostgresCohortStore(database);
      const second = await store.materializePage(input, run.id, 1, 10);
      expect(second.complete).toBe(true);
      expect(second.members.map((member) => member.result)).toEqual(["match", "unknown"]);
      await expect(store.materializePage(input, run.id, 1, 10)).rejects.toThrow();
      await store.start(input, { ...run, id: "run-all" });
      const all = await store.materializePage(input, "run-all", 0, 10);
      expect(all.members).toEqual([...first.members, ...second.members]);
      const negatedInput = {
        ...input,
        definition: {
          ...input.definition,
          root: { kind: "not" as const, child: input.definition.root },
        },
      };
      await expect(store.start(negatedInput, { ...run, id: "changed-definition" })).rejects.toThrow(
        "saved version",
      );
      await expect(store.checkpoint("changed-definition", scope)).rejects.toThrow("Run is absent");
      negatedInput.definition.version = 2;
      await expect(
        store.start(negatedInput, { ...run, id: "missing-definition", definitionVersion: 2 }),
      ).rejects.toThrow("saved version");
      await store.saveDefinition(
        negatedInput.definition,
        negatedInput.registration,
        negatedInput.context,
      );
      await store.start(negatedInput, { ...run, id: "run-not", definitionVersion: 2 });
      const exactCostInput = { ...input, context: { ...input.context, limits: { cost: 9 } } };
      await store.start(exactCostInput, { ...run, id: "exact-cost" });
      expect((await store.materializePage(exactCostInput, "exact-cost", 0, 10)).members).toEqual(
        all.members,
      );
      await expect(
        store.start(
          { ...input, context: { ...input.context, limits: { cost: 8 } } },
          { ...run, id: "exceeded-cost" },
        ),
      ).rejects.toThrow("budget");
      expect(
        (await store.materializePage(negatedInput, "run-not", 0, 10)).members.map(
          (member) => member.result,
        ),
      ).toEqual(["match", "no_match", "unknown"]);
      await expect(
        store.start(
          { ...input, context: { ...input.context, limits: { rows: 2 } } },
          { ...run, id: "over-budget" },
        ),
      ).rejects.toThrow("budget");
      await expect(
        store.materializePage(
          { ...input, context: { ...input.context, scope: { ...scope, tenantId: "other" } } },
          "run-all",
          1,
          10,
        ),
      ).rejects.toThrow();
      const snapshot: CohortSnapshot = {
        snapshotId: "snapshot-1",
        scope,
        subjectKind: "customer",
        definitionId: "trial",
        definitionVersion: 1,
        schemaVersion: 1,
        sourceSnapshotRefs: ["source-1"],
        asOf,
        generatedAt: asOf,
        validUntil: "2026-09-21T00:00:00.000Z",
        contentHash: cohortContentHash(["b"]),
        publicationRevision: 1,
        privacyVersion: "1",
        membershipRef: run.id,
      };
      const audit = { actor: "operator", reason: "test", idempotencyKey: "publish-1" };
      for (const field of ["generatedAt", "validUntil"] as const) {
        const snapshotId = `invalid-${field}`;
        const invalid = {
          ...snapshot,
          snapshotId,
          [field]: field === "generatedAt" ? "2026-09-20" : "2026-09-21",
        };
        await expect(
          store.publish(run.id, invalid, 0, { ...audit, idempotencyKey: snapshotId }),
        ).rejects.toThrow("timestamp");
        expect(await store.read(snapshotId)).toBeUndefined();
        expect(await store.current(scope, "trial")).toBeUndefined();
      }
      const unfinishedRun = { ...run, id: "unfinished-run" };
      await store.start(input, unfinishedRun);
      for (const state of ["running", "partial", "failed"] as const) {
        if (state === "partial")
          expect((await store.materializePage(input, unfinishedRun.id, 0, 1)).complete).toBe(false);
        if (state === "failed") await store.stop(unfinishedRun.id, scope, 1, "failed");
        const snapshotId = `rejected-${state}`;
        await expect(
          store.publish(
            unfinishedRun.id,
            { ...snapshot, snapshotId, membershipRef: unfinishedRun.id },
            0,
            { ...audit, idempotencyKey: snapshotId },
          ),
        ).rejects.toThrow("complete run");
        expect(await store.read(snapshotId)).toBeUndefined();
        expect(await store.current(scope, "trial")).toBeUndefined();
      }
      const race = await Promise.allSettled([
        store.publish(run.id, snapshot, 0, audit),
        new PostgresCohortStore(database).publish(
          run.id,
          { ...snapshot, snapshotId: "snapshot-2" },
          0,
          { ...audit, idempotencyKey: "publish-2" },
        ),
      ]);
      expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(race.filter((result) => result.status === "rejected")).toHaveLength(1);
      const winner = race.find((result) => result.status === "fulfilled");
      if (winner?.status !== "fulfilled") throw new Error("Missing winner");
      expect((await store.read(winner.value.snapshot.snapshotId))?.subjectIds).toEqual(["b"]);
      expect((await store.current(scope, "trial"))?.snapshot.snapshotId).toBe(
        winner.value.snapshot.snapshotId,
      );
      const privacy = { currentVersion: async () => "1", isAllowed: async () => true };
      const rolled = await store.rollback(
        winner.value.snapshot.snapshotId,
        { ...snapshot, snapshotId: "rollback", publicationRevision: 2 },
        1,
        { ...audit, idempotencyKey: "rollback" },
        privacy,
        new Date(asOf),
      );
      expect(rolled.subjectIds).toEqual(["b"]);
      await expect(
        store.rollback(
          rolled.snapshot.snapshotId,
          {
            ...rolled.snapshot,
            snapshotId: "invalid-rollback-time",
            publicationRevision: 3,
            validUntil: "2026-09-21",
          },
          2,
          { ...audit, idempotencyKey: "invalid-rollback-time" },
          privacy,
          new Date(asOf),
        ),
      ).rejects.toThrow("timestamp");
      expect(await store.read("invalid-rollback-time")).toBeUndefined();
      expect((await store.current(scope, "trial"))?.snapshot.snapshotId).toBe("rollback");

      await expect(
        store.rollback(
          rolled.snapshot.snapshotId,
          { ...rolled.snapshot, snapshotId: "suppressed", publicationRevision: 3 },
          2,
          { ...audit, idempotencyKey: "suppressed" },
          { ...privacy, isAllowed: async () => false },
          new Date(asOf),
        ),
      ).rejects.toThrow();
      await expect(
        store.rollback(
          rolled.snapshot.snapshotId,
          { ...rolled.snapshot, snapshotId: "privacy", publicationRevision: 3 },
          2,
          { ...audit, idempotencyKey: "privacy" },
          { ...privacy, currentVersion: async () => "2" },
          new Date(asOf),
        ),
      ).rejects.toThrow();
      await database.execute(sql`ALTER TABLE cohort_source RENAME TO unavailable_source`);
      expect(
        (
          await new PublishedCohortReader(store, privacy).read(
            "rollback",
            scope,
            "customer",
            new Date(asOf),
          )
        ).subjectIds,
      ).toEqual(["b"]);
      await database.execute(sql`ALTER TABLE unavailable_source RENAME TO cohort_source`);
      await store.withdraw(winner.value.snapshot.snapshotId, scope);
      expect((await store.read(winner.value.snapshot.snapshotId))?.withdrawn).toBe(true);
      await store.start(input, { ...run, id: "run-2" });
      await database.execute(sql`UPDATE cohort_source SET plan='paid' WHERE id='b'`);
      await expect(store.materializePage(input, "run-2", 0, 10)).rejects.toThrow(
        "Source snapshot content changed",
      );
      await store.stop("run-2", scope, 0, "canceled");
      await expect(
        store.publish(
          "run-2",
          { ...snapshot, snapshotId: "partial", membershipRef: "run-2", publicationRevision: 3 },
          2,
          { ...audit, idempotencyKey: "partial" },
        ),
      ).rejects.toThrow();
      await database.execute(sql`UPDATE cohort_source SET plan='trial' WHERE id='b'`);
      await store.start(input, { ...run, id: "run-3" });
      await store.eraseSubject(scope, "b");
      const erasedPublication = await store.read("rollback");
      expect(erasedPublication?.withdrawn).toBe(true);
      expect(erasedPublication?.subjectIds).toEqual([]);
      expect(erasedPublication?.snapshot.contentHash).toBe(snapshot.contentHash);
      const retainedSubjects = await pool.query(
        "SELECT snapshot_id FROM croco_cohort_publications WHERE publication->'subjectIds' @> $1::jsonb",
        ['["b"]'],
      );
      expect(retainedSubjects.rows).toEqual([]);
      await expect(
        new PublishedCohortReader(store, privacy).read(
          "rollback",
          scope,
          "customer",
          new Date(asOf),
        ),
      ).rejects.toThrow("withdrawn");
      await expect(store.materializePage(input, "run-3", 0, 10)).rejects.toThrow("erased subjects");
      await pool.query(
        readFileSync(new URL("../../migrations/0001_cohort.down.sql", import.meta.url), "utf8"),
      );
    } finally {
      await pool.end();
    }
  }, 30000);
});
