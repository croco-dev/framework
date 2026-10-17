import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EnrichmentService } from "@croco/analytics-core/enrichment";
import { DrizzleEnrichmentStore, createEnrichment } from "../index";
import type {
  EnrichmentStore,
  EnrichmentRun,
  EnrichmentReceipt,
} from "@croco/analytics-core/enrichment";

const connectionString = process.env.ANALYTICS_POSTGRES_URL ?? "";
const scope = { app: "test", environment: "test", tenant: "north" };
const definition = {
  id: "intent",
  version: "v1",
  schema: "label-id/v1" as const,
  labels: [
    { id: "buy", label: "Purchase" },
    { id: "help", label: "Support" },
  ],
  normalization: { version: "n1", form: "nfkc-trim-lowercase" as const },
  referenceCatalog: [],
  modelPolicy: { modelRef: "fixture", promptVersion: "p1", instructions: "Return a finite label." },
};
const limits = {
  maxInputBytes: 2048,
  maxOutputBytes: 512,
  maxOutputTokens: 128,
  timeoutMs: 1000,
  maxConcurrency: 1,
  maxAttempts: 2,
  maxRequests: 2,
  maxReservedTokens: 4096,
  tokensPerRequest: 2048,
};

describe.skipIf(!connectionString)("PostgreSQL enrichment receipts and CAS", () => {
  let pool: Pool;
  let otherPool: Pool;
  let store: DrizzleEnrichmentStore;
  let other: DrizzleEnrichmentStore;
  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 3 });
    otherPool = new Pool({ connectionString, max: 3 });
    store = new DrizzleEnrichmentStore(drizzle(pool));
    other = new DrizzleEnrichmentStore(drizzle(otherPool));
    await createEnrichment(drizzle(pool));
    await createEnrichment(drizzle(otherPool));
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE analytics_enrichment_runs, analytics_enrichment_inputs");
  });
  afterAll(async () => {
    await Promise.all([pool.end(), otherPool.end()]);
  });
  function fixture(
    target: EnrichmentStore = store,
    model = vi.fn(async () => ({
      json: '{"labelId":"buy"}',
      completion: "complete" as const,
      modelRef: "fixture",
      usage: { kind: "known" as const, inputTokens: 44, outputTokens: 9 },
    })),
  ) {
    const settle = vi.fn(async (_receipt: EnrichmentReceipt) => {});
    const clock = { offset: 0 };
    const service = new EnrichmentService({
      store: target,
      definitions: [definition],
      classifyText: model,
      authorize: async () => true,
      currentActor: async () => "operator",
      authorizationRevision: async () => "auth-1",
      sourceAvailable: async () => true,
      prepareInput: (input) => ({ text: input.text, context: input.context }),
      settle,
      now: () => Date.now() + clock.offset,
    });
    return { service, settle, model, clock };
  }
  async function enqueue(service: EnrichmentService, runId = "one") {
    return service.enqueueBatch(
      scope,
      runId,
      [
        {
          itemId: "a",
          inputRevision: "r1",
          text: "purchase request",
          sourceRef: "source-a",
          context: { locale: "en" },
        },
        {
          itemId: "b",
          inputRevision: "r1",
          text: "help request",
          sourceRef: "source-b",
          context: { locale: "en" },
        },
      ],
      limits,
      { rawMs: 60000, resultMs: 120000 },
    );
  }
  it("applies its additive migration twice and keeps data after reopening the adapter", async () => {
    const f = fixture();
    await enqueue(f.service);
    await f.service.classify(scope, "one", "a", "intent", "v1");
    await createEnrichment(drizzle(otherPool));
    const restarted = fixture(other, f.model);
    expect(await restarted.service.classify(scope, "one", "a", "intent", "v1")).toMatchObject({
      state: "classified",
      labelId: "buy",
    });
    expect(f.model).toHaveBeenCalledTimes(1);
    const loaded = await other.load(scope, "one");
    expect(loaded?.requests).toBe(1);
    expect(loaded?.receipts[0].candidate).not.toHaveProperty("labelId");
  });
  it("rejects a stale compare-and-set and isolates identical run IDs by tenant", async () => {
    const f = fixture();
    await enqueue(f.service);
    const left = (await store.load(scope, "one")) as EnrichmentRun;
    const right = (await other.load(scope, "one")) as EnrichmentRun;
    left.revision++;
    right.revision++;
    left.requests = 1;
    right.requests = 2;
    expect(
      (await Promise.all([store.compareAndSet(left, 0), other.compareAndSet(right, 0)])).filter(
        Boolean,
      ),
    ).toHaveLength(1);
    expect(await other.load({ ...scope, tenant: "south" }, "one")).toBeNull();
  });
  it("deduplicates concurrent model claims across PostgreSQL connections without duplicate billing", async () => {
    const f = fixture();
    await enqueue(f.service);
    const second = fixture(other, f.model);
    await Promise.all([
      f.service.classify(scope, "one", "a", "intent", "v1"),
      second.service.classify(scope, "one", "a", "intent", "v1"),
    ]);
    expect(f.model).toHaveBeenCalledTimes(1);
    expect((await store.load(scope, "one"))?.items[0].candidates).toHaveLength(1);
  });
  it("recovers only pending sink delivery after a new process-equivalent service instance", async () => {
    const f = fixture();
    await enqueue(f.service);
    const result = await f.service.classify(scope, "one", "a", "intent", "v1");
    f.settle.mockRejectedValueOnce(new Error("sink detail"));
    await expect(f.service.settle(scope, "one")).rejects.toMatchObject({
      code: "analytics-core/enrichment-settlement-failed",
    });
    const restarted = fixture(other, f.model);
    await restarted.service.settle(scope, "one");
    expect(restarted.settle.mock.calls[0][0]).toMatchObject({
      candidate: { receiptId: result.receiptId },
    });
    expect((await other.load(scope, "one"))?.receipts[0].candidate.delivery).toBe("delivered");
    expect(f.model).toHaveBeenCalledTimes(1);
  });
  it("keeps an actual killed worker claim and never calls the model just because its lease expired", async () => {
    const f = fixture();
    await f.service.enqueueBatch(
      scope,
      "crash",
      [
        {
          itemId: "a",
          inputRevision: "r1",
          text: "purchase request",
          sourceRef: "source-a",
          context: { locale: "en" },
        },
      ],
      { ...limits, timeoutMs: 60000 },
      { rawMs: 90000, resultMs: 120000 },
    );
    const script = `
      const { Pool } = require('pg');
      const { drizzle } = require('drizzle-orm/node-postgres');
      const { EnrichmentService } = require('@croco/analytics-core/enrichment');
      const { DrizzleEnrichmentStore } = require('./dist/index.js');
      const pool = new Pool({ connectionString: process.env.ANALYTICS_POSTGRES_URL });
      const service = new EnrichmentService({
        store: new DrizzleEnrichmentStore(drizzle(pool)), definitions: [${JSON.stringify(definition)}],
        authorize: async () => true, currentActor: async () => 'operator', authorizationRevision: async () => 'auth-1',
        sourceAvailable: async () => true, prepareInput: input => ({ text: input.text, context: input.context }), settle: async () => {},
        classifyText: () => { process.stdout.write('claim-persisted'); return new Promise(() => {}); }
      });
      void service.classify(${JSON.stringify(scope)}, 'crash', 'a', 'intent', 'v1');
    `;
    const child = spawn(
      process.execPath,
      [
        "--require",
        createRequire(import.meta.url).resolve("tsx/cjs"),
        "--input-type=commonjs",
        "-e",
        script,
      ],
      {
        cwd: process.cwd(),
        env: { ANALYTICS_POSTGRES_URL: connectionString, NODE_ENV: "test" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let workerError = "";
    child.stderr.on("data", (chunk) => {
      workerError += String(chunk);
    });
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        child.stdout.once("data", (data) =>
          String(data).includes("claim-persisted")
            ? resolve()
            : reject(new Error("Unexpected worker readiness")),
        );
        child.once("error", reject);
        child.once("exit", () =>
          reject(new Error(`Worker exited before persisting a claim: ${workerError.slice(-4000)}`)),
        );
      });
      child.kill("SIGKILL");
      await exited;
      const restarted = fixture(other, f.model);
      restarted.clock.offset = 70000;
      expect(await restarted.service.classify(scope, "crash", "a", "intent", "v1")).toMatchObject({
        state: "failed",
        reason: "acceptance-unknown",
      });
      expect(f.model).not.toHaveBeenCalled();
      expect((await other.load(scope, "crash"))?.requests).toBe(1);
    } finally {
      child.kill("SIGKILL");
      await exited;
    }
  });
  it("preserves completed work and independent run checkpoints on partial resume", async () => {
    const f = fixture();
    await enqueue(f.service);
    await enqueue(f.service, "two");
    await f.service.classify(scope, "one", "a", "intent", "v1");
    const restarted = fixture(other, f.model);
    await restarted.service.classify(scope, "one", "a", "intent", "v1");
    await restarted.service.classify(scope, "one", "b", "intent", "v1");
    expect(f.model).toHaveBeenCalledTimes(2);
    expect((await store.load(scope, "two"))?.requests).toBe(0);
    expect(
      (await store.load(scope, "one"))?.items.every(
        (item) => item.candidates[0].state === "classified",
      ),
    ).toBe(true);
  });
  it("rejects concurrent conflicting originals across run IDs and rolls back the losing run", async () => {
    const left = fixture();
    const right = fixture(other);
    const make = (service: EnrichmentService, runId: string, text: string) =>
      service.enqueueBatch(
        scope,
        runId,
        [{ itemId: "shared", inputRevision: "r1", sourceRef: "source", text, context: {} }],
        limits,
        { rawMs: 60000, resultMs: 120000 },
      );
    const results = await Promise.allSettled([
      make(left.service, "left", "Original A"),
      make(right.service, "right", "Original B"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
      "analytics-core/enrichment-input-conflict",
    );
    const rows = await pool.query("SELECT run_id FROM analytics_enrichment_runs");
    expect(rows.rows).toHaveLength(1);
  });
});
