import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { PostgresSavedIntentStore } from "../index";
import type { ExperiencePgDatabase } from "../index";
import type { SavedIntentMutation } from "@croco/experience-core";

const scope = { appId: "shop", environment: "test", tenantId: "one" };
const subject = { kind: "customer", id: "one" };
const input: SavedIntentMutation = {
  scope,
  subject,
  resourceType: "report",
  resourceId: "one",
  sourceKind: "explicit",
  expectedRevision: null,
  idempotencyKey: "save-1",
  operation: "save",
  id: "intent-1",
  now: "2026-10-01T00:00:00.000Z",
};
function harness(responses: Record<string, unknown>[][] = []) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const dialect = new PgDialect();
  const db: ExperiencePgDatabase = {
    execute: async (statement) => {
      const query = dialect.sqlToQuery(statement);
      queries.push(query);
      return { rows: responses.shift() ?? [] };
    },
    transaction: async (work) => work(db),
  };
  return { store: new PostgresSavedIntentStore(db), queries };
}
describe("PostgresSavedIntentStore", () => {
  it("locks subject, command and whole resource before CAS and records exact receipt", async () => {
    const { store, queries } = harness();
    const result = await store.mutate(input);
    expect(result).toMatchObject({ id: "intent-1", state: "saved", revision: 1 });
    expect(queries[0]?.sql).toContain("pg_advisory_xact_lock_shared");
    expect(queries[1]?.params).toContain(
      JSON.stringify(["receipt", JSON.stringify(["customer", "one"]), "save-1"]),
    );
    expect(queries[2]?.params).toContain(
      JSON.stringify(["resource", JSON.stringify(["customer", "one"]), "report", "one"]),
    );
    expect(queries.some((query) => query.sql.includes("FOR UPDATE"))).toBe(true);
    expect(queries.at(-1)?.sql).toContain("INSERT INTO croco_saved_intent_receipts");
    expect(queries.at(-1)?.params).toContain(JSON.stringify(result));
  });
  it("rejects conflicting revisions before any write", async () => {
    const { store, queries } = harness([[], [], [], [], [{ intent: { ...input, revision: 2 } }]]);
    await expect(store.mutate({ ...input, expectedRevision: 1 })).rejects.toThrow("revision");
    expect(queries.some((query) => /INSERT|UPDATE SET|DELETE/.test(query.sql))).toBe(false);
  });
  it("returns original receipt even when generated identity and time change", async () => {
    const { id: _id, now: _now, ...command } = input;
    const result = { ...input, revision: 1 };
    const { store, queries } = harness([[], [], [], [{ command, result }]]);
    expect(await store.mutate({ ...input, id: "retry-id", now: "2026-10-02T00:00:00Z" })).toEqual(
      result,
    );
    expect(queries).toHaveLength(4);
  });
  it("rejects an idempotency key reused for a different command", async () => {
    const { store } = harness([[], [], [], [{ command: {}, result: {} }]]);
    await expect(store.mutate(input)).rejects.toThrow("different saved intent command");
  });
  it("orders all candidates before bounded pagination within exact scope and subject", async () => {
    const { store, queries } = harness();
    await store.list({ scope, subject, offset: 10, limit: 20 });
    expect(queries[0]?.sql).toContain("ASC NULLS LAST");
    expect(queries[0]?.sql).toContain("lastUsedAt')::timestamptz DESC");
    expect(queries[0]?.params).toEqual(['["shop","test","one"]', '["customer","one"]', 20, 10]);
    await expect(store.list({ scope, subject, offset: -1, limit: 20 })).rejects.toThrow();
  });
  it("reads the unique resource key without a list limit and returns absence explicitly", async () => {
    const intent = { ...input, revision: 3, state: "removed" };
    const { store, queries } = harness([[{ intent }], []]);
    const key = {
      scope,
      subject,
      resourceType: "report",
      resourceId: "one",
      sourceKind: "explicit" as const,
    };
    expect(await store.read(key)).toEqual(intent);
    expect(queries[0]?.sql).toMatch(/scope_key = \$1 AND subject_key = \$2/);
    expect(queries[0]?.sql).toMatch(/resource_type = \$3 AND resource_id = \$4/);
    expect(queries[0]?.sql).toContain("source_kind = $5");
    expect(queries[0]?.sql).not.toMatch(/LIMIT|OFFSET/);
    expect(queries[0]?.params).toEqual([
      '["shop","test","one"]',
      '["customer","one"]',
      "report",
      "one",
      "explicit",
    ]);
    expect(await store.read({ ...key, sourceKind: "recent" })).toBeUndefined();
    expect(queries[1]?.params.at(-1)).toBe("recent");
  });
  it("validates every direct read identity before querying", async () => {
    const { store, queries } = harness();
    const key = {
      scope,
      subject,
      resourceType: "report",
      resourceId: "one",
      sourceKind: "explicit" as const,
    };
    for (const invalid of [
      { ...key, scope: { ...scope, tenantId: "" } },
      { ...key, subject: { ...subject, id: "" } },
      { ...key, resourceType: "" },
      { ...key, resourceId: "" },
      { ...key, sourceKind: "invalid" as never },
    ])
      await expect(store.read(invalid)).rejects.toThrow();
    expect(queries).toHaveLength(0);
  });
  it("privacy deletes all subject copies under the exclusive subject lock", async () => {
    const { store, queries } = harness();
    await store.deleteSubject({ scope, subject });
    expect(queries[0]?.sql).toContain("pg_advisory_xact_lock(");
    expect(queries.slice(1).map((query) => query.sql.match(/DELETE FROM (\w+)/)?.[1])).toEqual([
      "croco_saved_intent_receipts",
      "croco_saved_intents",
      "croco_saved_intent_suppression",
    ]);
    expect(queries.every((query) => query.params.includes('["customer","one"]'))).toBe(true);
  });
  it("purges expired payloads and receipts without deleting resource suppression", async () => {
    const { store, queries } = harness();
    await store.purgeExpired({
      scope,
      subject,
      resourceType: "report",
      before: "2026-10-02T00:00:00Z",
    });
    expect(queries).toHaveLength(3);
    expect(queries[1]?.sql).toContain("result ->> 'lastUsedAt'");
    expect(queries[2]?.sql).toContain("intent ->> 'lastUsedAt'");
    expect(queries.some((query) => query.sql.includes("suppression"))).toBe(false);
  });
  it("rejects malformed pins and policy caps before database access", async () => {
    const { store, queries } = harness();
    await expect(store.mutate({ ...input, operation: "pin" })).rejects.toThrow("Invalid");
    await expect(store.mutate({ ...input, pinOrder: 10001 })).rejects.toThrow("Invalid");
    const policy = {
      scope,
      resourceType: "report",
      displayLimit: 101,
      retentionDays: 30,
      excludeCompleted: true,
      actorId: "operator",
      reason: "Test caps",
      revision: 1,
      updatedAt: input.now,
    };
    await expect(
      store.updatePolicy({ policy, expectedRevision: null, idempotencyKey: "policy" }),
    ).rejects.toThrow("Invalid");
    await expect(
      store.updatePolicy({
        policy: { ...policy, displayLimit: 5, retentionDays: 3651 },
        expectedRevision: null,
        idempotencyKey: "policy",
      }),
    ).rejects.toThrow("Invalid");
    expect(queries).toHaveLength(0);
  });
  it("propagates provider failure instead of returning an empty list", async () => {
    const failure = new Error("postgres unavailable");
    const store = new PostgresSavedIntentStore({
      execute: async () => {
        throw failure;
      },
      transaction: async () => {
        throw failure;
      },
    });
    await expect(store.list({ scope, subject, offset: 0, limit: 10 })).rejects.toBe(failure);
    await expect(
      store.read({
        scope,
        subject,
        resourceType: "report",
        resourceId: "one",
        sourceKind: "explicit",
      }),
    ).rejects.toBe(failure);
  });
});
