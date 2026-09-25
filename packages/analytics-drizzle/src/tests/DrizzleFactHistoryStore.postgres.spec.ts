import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppendFactsInput, FactHistoryQuery } from "@croco/analytics-core";
import { DrizzleFactHistoryStore, createFactHistory } from "../index";

const connectionString = process.env.ANALYTICS_POSTGRES_URL ?? "";
const scope = { app: "test", environment: "test", tenantId: "one" };
const subject = { kind: "user" as const, id: "user" };
const recordedAt = "2026-09-25T12:00:00.000Z";
function batch(event = "event"): AppendFactsInput {
  return {
    scope,
    source: "billing",
    sourceEventId: event,
    sourceFingerprint: "sha256:source",
    rows: ["plan", "status"].map((definitionId) => ({
      subject,
      definitionId,
      definitionVersion: "1",
      projectionId: "subscription",
      projectionRowKey: definitionId,
      materializationRevision: "1",
      value: "active",
      validFrom: "2026-09-25T11:00:00.000Z",
    })),
  };
}
const query: FactHistoryQuery = {
  scope,
  subject,
  definitionId: "plan",
  definitionVersion: "1",
  materializationRevision: "1",
  knownAt: recordedAt,
  limit: 100,
};

describe.skipIf(!connectionString)("PostgreSQL fact history", () => {
  let pool: Pool;
  let otherPool: Pool;
  let store: DrizzleFactHistoryStore;
  let other: DrizzleFactHistoryStore;
  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 2 });
    otherPool = new Pool({ connectionString, max: 2 });
    store = new DrizzleFactHistoryStore(drizzle(pool));
    other = new DrizzleFactHistoryStore(drizzle(otherPool));
    await createFactHistory(drizzle(pool));
  });
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE analytics_fact_history, analytics_fact_batches, analytics_fact_receipts, analytics_fact_deleted_subjects, analytics_fact_scopes CASCADE",
    );
  });
  afterAll(async () => {
    await pool.end();
    await otherPool.end();
  });

  it("deduplicates concurrent fan-out and reads after adapter restart", async () => {
    const input = batch();
    const extra = { ...input.rows[0], subject: { kind: "tenant" as const, id: "organization" } };
    const [first, second] = await Promise.all([
      store.appendFacts({ ...input, rows: [...input.rows, extra] }, recordedAt),
      other.appendFacts({ ...input, rows: [...input.rows, extra] }, recordedAt),
    ]);
    expect(first.rows).toHaveLength(3);
    expect(second.rows.map((row) => row.id)).toEqual(first.rows.map((row) => row.id));
    const restarted = new DrizzleFactHistoryStore(drizzle(otherPool));
    expect(await restarted.readHistory(query)).toHaveLength(1);
    expect((await pool.query("SELECT count(*) FROM analytics_fact_history")).rows[0].count).toBe(
      "3",
    );
  });

  it("rejects source and projection collisions but retains distinct source events", async () => {
    await store.appendFacts(batch(), recordedAt);
    await expect(
      other.appendFacts({ ...batch(), sourceFingerprint: "sha256:other" }, recordedAt),
    ).rejects.toMatchObject({ code: "analytics/fact-history/source-conflict" });
    const input = batch();
    await expect(
      other.appendFacts(
        { ...input, rows: input.rows.map((row) => ({ ...row, value: "changed" })) },
        recordedAt,
      ),
    ).rejects.toMatchObject({ code: "analytics/fact-history/projection-conflict" });
    await store.appendFacts(batch("another-event"), recordedAt);
    expect(await store.readHistory(query)).toHaveLength(2);
  });

  it("does not let a mixed-generation replay extend a completed projection set", async () => {
    const initial = batch();
    await store.appendFacts(initial, recordedAt);
    const replacement = {
      ...initial.rows[1],
      projectionRowKey: "replacement",
    };
    const nextGeneration = {
      ...initial.rows[0],
      materializationRevision: "2",
    };
    await expect(
      store.appendFacts(
        { ...initial, rows: [initial.rows[0], replacement, nextGeneration] },
        recordedAt,
      ),
    ).rejects.toMatchObject({ code: "analytics/fact-history/invalid-input" });
    expect(await store.getRevision(scope)).toBe(1);
    expect((await pool.query("SELECT count(*) FROM analytics_fact_history")).rows[0].count).toBe(
      "2",
    );
    const next = await store.appendFacts({ ...initial, rows: [nextGeneration] }, recordedAt);
    expect(next.rows).toHaveLength(1);
    expect(
      (await other.appendFacts({ ...initial, rows: [nextGeneration] }, recordedAt)).rows[0].id,
    ).toBe(next.rows[0].id);
  });

  it("replays optional undefined projection fields as the same row", async () => {
    const input = batch();
    const withUndefined = {
      ...input,
      rows: input.rows.map((row) => ({ ...row, validTo: undefined, supersedes: undefined })),
    };
    const first = await store.appendFacts(withUndefined, recordedAt);
    const replay = await other.appendFacts(withUndefined, recordedAt);
    expect(replay.rows.map((row) => row.id)).toEqual(first.rows.map((row) => row.id));
    expect(await store.getRevision(scope)).toBe(1);
  });

  it("rolls back receipt and first projection if the second insert fails, then resumes cleanly", async () => {
    await pool.query(
      "ALTER TABLE analytics_fact_history ADD CONSTRAINT injected_failure CHECK (definition_id <> 'status')",
    );
    try {
      await expect(store.appendFacts(batch(), recordedAt)).rejects.toMatchObject({
        code: "analytics/fact-history/persistence-failed",
        cause: expect.any(Error),
      });
    } finally {
      await pool.query("ALTER TABLE analytics_fact_history DROP CONSTRAINT injected_failure");
    }
    expect((await pool.query("SELECT count(*) FROM analytics_fact_history")).rows[0].count).toBe(
      "0",
    );
    expect((await pool.query("SELECT count(*) FROM analytics_fact_receipts")).rows[0].count).toBe(
      "0",
    );
    expect(
      (await new DrizzleFactHistoryStore(drizzle(otherPool)).appendFacts(batch(), recordedAt)).rows,
    ).toHaveLength(2);
  });

  it("allows only one competing correction at the expected scope revision", async () => {
    const initial = await store.appendFacts(batch(), recordedAt);
    const correction = (event: string): AppendFactsInput => ({
      ...batch(event),
      rows: [{ ...batch().rows[0], value: event, supersedes: initial.rows[0].id }],
      correction: {
        actor: "operator",
        reason: "verified",
        expectedRevision: 1,
        idempotencyKey: event,
      },
    });
    const results = await Promise.allSettled([
      store.appendFacts(correction("first"), recordedAt),
      other.appendFacts(correction("second"), recordedAt),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "analytics/fact-history/revision-conflict" },
    });
    expect(await store.getRevision(scope)).toBe(2);
  });

  it.each([
    { definitionVersion: "2", materializationRevision: "1" },
    { definitionVersion: "1", materializationRevision: "2" },
  ])("rejects corrections across definition or materialization generations", async (generation) => {
    const initial = await store.appendFacts(batch(), recordedAt);
    await expect(
      store.appendFacts(
        {
          ...batch("correction"),
          rows: [
            {
              ...batch().rows[0],
              ...generation,
              value: "corrected",
              supersedes: initial.rows[0].id,
            },
          ],
          correction: {
            actor: "operator",
            reason: "verified",
            expectedRevision: 1,
            idempotencyKey: "correction",
          },
        },
        recordedAt,
      ),
    ).rejects.toMatchObject({ code: "analytics/fact-history/invalid-input" });
    expect(await store.getRevision(scope)).toBe(1);
  });

  it("isolates generations, cutoffs, tenant scopes and permanently deletes subject projections", async () => {
    await store.appendFacts(batch(), recordedAt);
    await store.appendFacts(
      {
        ...batch(),
        rows: batch().rows.map((row) => ({ ...row, materializationRevision: "2", value: "new" })),
      },
      recordedAt,
    );
    expect((await store.readHistory(query))[0].value).toBe("active");
    expect((await store.readHistory({ ...query, materializationRevision: "2" }))[0].value).toBe(
      "new",
    );
    expect(await store.readHistory({ ...query, knownAt: "2026-09-25T11:59:59.000Z" })).toEqual([]);
    expect(await store.readHistory({ ...query, scope: { ...scope, tenantId: null } })).toEqual([]);
    await store.deleteSubject(scope, subject);
    await expect(other.readHistory(query)).rejects.toMatchObject({
      code: "analytics/fact-history/deleted",
    });
    await expect(other.appendFacts(batch(), recordedAt)).rejects.toMatchObject({
      code: "analytics/fact-history/deleted",
    });
    expect((await pool.query("SELECT count(*) FROM analytics_fact_history")).rows[0].count).toBe(
      "0",
    );
    const batches = await pool.query("SELECT projection_set FROM analytics_fact_batches");
    expect(batches.rows.every((row) => /^[a-f0-9]{64}$/.test(row.projection_set))).toBe(true);
  });
});
