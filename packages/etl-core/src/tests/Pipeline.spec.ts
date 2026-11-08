import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExecutionJobsOperations } from "@croco/execution-core";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPipelineOperations } from "../pipeline/definePipeline";
import { defineProjection } from "../pipeline/projection";
import { PipelineProblem } from "../pipeline/PipelineProblem";
import * as fileSources from "../pipeline/fileSource";
import { createExecutionFixture, pipelineClock } from "./PipelineFixtures";
import type { CanonicalRow } from "@croco/warehouse-core";
import type {
  CatalogStore,
  WarehouseAccess,
  WarehouseCandidate,
  WarehouseSnapshot,
  WarehouseWriter,
  WriteReceipt,
} from "@croco/warehouse-core/runtime";
import type { PipelineDefinition, PipelineRuntime } from "../pipeline/definePipeline";
import type { FileSource } from "../pipeline/fileSource";
import type { SourceSchema } from "../source/types";

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const schema = {
  format: "jsonl",
  encoding: "utf-8",
  fields: [
    { name: "id", type: "string" },
    { name: "count", type: "number" },
    { name: "at", type: "date" },
  ],
  limits: { maxBytes: 20_000_000, maxRecords: 100_000, maxRowBytes: 1024 },
} as const satisfies SourceSchema;
const target = defineFact("pipeline_rows", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One record", key: ["id"] },
  columns: { id: c.id(), count: c.int64(), at: c.instant({ precision: "millisecond" }) },
  time: { event: "at" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});
const projection = defineProjection({
  source: schema,
  target,
  columns: {
    id: { kind: "column", field: "id" },
    count: { kind: "column", field: "count", cast: "integer" },
    at: { kind: "column", field: "at", cast: "instant" },
  },
});
const raw = (id: string, count = 1) => ({ id, count, at: "2026-10-01T00:00:00.000Z" });
const access: WarehouseAccess = {
  scope: { application: "test", environment: "test", tenant: "tenant-a" },
  actor: "test",
  roles: ["import", "publish", "read"],
  columns: ["id", "count", "at"],
  permissionEpoch: 0,
  privacyEpoch: 0,
};

async function fixture(partitions = [[raw("a"), raw("b")]]) {
  const directory = await mkdtemp(join(tmpdir(), "croco-pipeline-test-"));
  directories.push(directory);
  const sources: FileSource[] = [];
  for (const [index, rows] of partitions.entries()) {
    const content = rows.map((row) => JSON.stringify(row)).join("\n");
    const path = join(directory, `${index}.jsonl`);
    await writeFile(path, content);
    sources.push({
      id: `partition-${index}`,
      path,
      schema,
      revision: createHash("sha256").update(content).digest("hex"),
      replayability: "snapshot-stable",
    });
  }
  const { store, executions } = createExecutionFixture();
  const descriptor = await compileFact(target);
  const candidates = new Map<string, WarehouseCandidate>();
  const rows = new Map<string, CanonicalRow>();
  const receipts = new Map<string, WriteReceipt>();
  let head: WarehouseSnapshot | null = null;
  const catalog: CatalogStore = {
    readReceipts: async (request) =>
      [...receipts.values()]
        .filter((receipt) => !request.afterBatchId || receipt.batchId > request.afterBatchId)
        .sort((a, b) => (a.batchId < b.batchId ? -1 : 1))
        .slice(0, request.limit),
    createCandidate: vi.fn<CatalogStore["createCandidate"]>(async (request) => {
      const previous = candidates.get(request.id);
      if (previous) return previous;
      const candidate: WarehouseCandidate = {
        id: request.id,
        scope: request.access.scope,
        modelVersion: descriptor.semanticHash,
        transformHash: request.transformHash,
        sourceRefs: request.sourceRefs,
        expectedHead: request.expectedHead,
        fence: 1,
        state: "open",
        quality: null,
        partitionSelection: null,
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      candidates.set(candidate.id, candidate);
      return candidate;
    }),
    getCandidate: vi.fn<CatalogStore["getCandidate"]>(async (request) =>
      requireCandidate(request.candidateId),
    ),
    sealCandidate: vi.fn<CatalogStore["sealCandidate"]>(async (request) => {
      if (
        request.expectedBatchIds
          ? request.expectedBatchIds.some((id) => !receipts.has(id))
          : request.expectedManifest.count !== receipts.size
      )
        throw new PipelineProblem("receipt-unresolved");
      const candidate: WarehouseCandidate = {
        ...requireCandidate(request.candidateId),
        quality: request.quality,
        state: "sealed",
      };
      candidates.set(candidate.id, candidate);
      return candidate;
    }),
    failCandidate: vi.fn<CatalogStore["failCandidate"]>(async (request) => {
      const candidate: WarehouseCandidate = {
        ...requireCandidate(request.candidateId),
        state: "failed",
      };
      candidates.set(candidate.id, candidate);
      return candidate;
    }),
    publishCandidate: vi.fn<CatalogStore["publishCandidate"]>(async (request) => {
      const candidate = requireCandidate(request.candidateId);
      if (!candidate.quality || candidate.state !== "sealed")
        throw new PipelineProblem("receipt-unresolved");
      head = {
        id: `snapshot:${candidate.id}`,
        revision: 1,
        modelVersion: descriptor.semanticHash,
        segmentRefs: [candidate.id],
        partitionSelection: [],
        quality: candidate.quality,
        createdAt: pipelineClock().toISOString(),
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      candidates.set(candidate.id, { ...candidate, state: "published" });
      return head;
    }),
    pinSnapshot: vi.fn<CatalogStore["pinSnapshot"]>(async () => {
      if (!head) throw new PipelineProblem("invalid-definition");
      return head;
    }),
    describeDataset: vi.fn<CatalogStore["describeDataset"]>(async () => ({
      descriptor,
      headId: head?.id ?? null,
      headStatus: head ? "readable" : "empty",
      head,
      candidates: [...candidates.values()],
      revision: 0,
      permissionEpoch: 0,
      privacyEpoch: 0,
    })),
    suppress: async () => {
      throw new PipelineProblem("invalid-definition");
    },
    expireSnapshots: async () => {
      throw new PipelineProblem("invalid-definition");
    },
    synchronizePermissionEpoch: async () => {
      throw new PipelineProblem("invalid-definition");
    },
    removePublication: async () => {
      throw new PipelineProblem("invalid-definition");
    },
  };
  function requireCandidate(id: string) {
    const value = candidates.get(id);
    if (!value) throw new PipelineProblem("invalid-definition");
    return value;
  }
  const writer: WarehouseWriter = {
    write: vi.fn<WarehouseWriter["write"]>(async (request) => {
      let inserted = 0;
      let identical = 0;
      for (const row of request.rows) {
        const id = String(row.id);
        const prior = rows.get(id);
        if (prior) {
          if (JSON.stringify(prior) !== JSON.stringify(row))
            throw new PipelineProblem("invalid-definition");
          identical++;
        } else {
          rows.set(id, structuredClone(row));
          inserted++;
        }
      }
      const receipt: WriteReceipt = {
        batchId: request.batchId,
        attempt: request.attempt,
        state: "durable",
        providerRef: request.candidateId,
        inserted,
        identical,
        evidence: request.evidence,
      };
      receipts.set(request.batchId, receipt);
      return receipt;
    }),
    reconcileReceipt: async (request) => receipts.get(request.batchId) ?? null,
  };
  const definition: PipelineDefinition = {
    id: "pipeline",
    version: 1,
    source: {
      id: "input",
      partitions: sources,
      coverage: {
        sourceRef: "input",
        from: "2026-10-01",
        through: "2026-10-02",
        state: "complete",
        gaps: [],
        late: false,
      },
    },
    project: projection,
    load: "strict",
    resume: "checkpoint",
  };
  const publication: PipelineRuntime["publication"] = {
    executions,
    async publish({ request, token, result, signal }) {
      if (signal?.aborted) throw new PipelineProblem("interrupted");
      const snapshot = await catalog.publishCandidate(request);
      const published = { ...result, snapshotId: snapshot.id };
      await executions.completeAttempt(token, published);
      return published;
    },
  };
  const runtime: PipelineRuntime = {
    publication,
    executions,
    catalog,
    writer,
    resolveAccess: () => access,
    chunkSize: 1,
    maxAttempts: 3,
    previewLimit: 2,
    clock: pipelineClock,
    maxInputRecords: 100,
  };
  return {
    definition,
    runtime,
    store,
    executions,
    catalog,
    writer,
    rows,
    sources,
    receipts,
    operations: createPipelineOperations(definition, runtime),
  };
}

describe("pipeline operations", () => {
  describe("secondary failures", () => {
    const cases = (["processor", "writer", "publication"] as const).flatMap((primary) =>
      (["execution-state", "failure-record", "reader-close"] as const).map((phase) => ({
        primary,
        phase,
      })),
    );

    it.each(cases)("preserves $primary failure when $phase fails", async ({ primary, phase }) => {
      const f = await fixture();
      const original = new PipelineProblem("interrupted");
      const secondary = new PipelineProblem("invalid-checkpoint");
      const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
      let failed = false;
      const fail = () => {
        failed = true;
        throw original;
      };
      const get = f.executions.get.bind(f.executions);
      if (phase === "execution-state")
        vi.spyOn(f.executions, "get").mockImplementation((id) => {
          if (failed) return Promise.reject(secondary);
          return get(id);
        });
      if (phase === "failure-record")
        vi.spyOn(f.executions, "failAttempt").mockRejectedValue(secondary);
      const open = fileSources.openFileSource;
      let opened = 0;
      const closed = vi.fn();
      vi.spyOn(fileSources, "openFileSource").mockImplementation(async (source) => {
        const reader = await open(source);
        if (++opened > f.sources.length) {
          const close = reader.close;
          reader.close = async () => {
            await close();
            closed();
            if (phase === "reader-close") throw secondary;
          };
        }
        return reader;
      });
      const definition =
        primary === "processor"
          ? {
              ...f.definition,
              processor: { artifactHash: "f".repeat(64), dependencies: [], process: fail },
            }
          : f.definition;
      if (primary === "writer") vi.mocked(f.writer.write).mockImplementation(fail);
      if (primary === "publication")
        vi.spyOn(f.runtime.publication, "publish").mockImplementation(fail);
      await expect(createPipelineOperations(definition, f.runtime).run()).rejects.toBe(original);
      expect(closed).toHaveBeenCalledTimes(f.sources.length);
      expect(diagnostics).toHaveBeenCalledWith(
        "[Pipeline] Secondary failure",
        expect.objectContaining({
          code: "etl-core/pipeline-secondary-failure",
          executionId: "execution-1",
          phase,
          outcome: primary === "publication" ? "indeterminate" : "failed",
        }),
      );
    });

    it("retains each secondary failure alongside a frozen primary", async () => {
      const f = await fixture([[raw("a")], [raw("b")]]);
      const original = Object.freeze(new PipelineProblem("interrupted"));
      const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
      const open = fileSources.openFileSource;
      let opened = 0;
      vi.spyOn(fileSources, "openFileSource").mockImplementation(async (source) => {
        const reader = await open(source);
        if (++opened > f.sources.length) {
          const close = reader.close;
          reader.close = async () => {
            await close();
            throw new Error("private cleanup data");
          };
        }
        return reader;
      });
      vi.spyOn(f.runtime.publication, "publish").mockRejectedValue(original);
      vi.spyOn(f.executions, "failAttempt").mockRejectedValue(new Error("private storage data"));
      await expect(f.operations.run()).rejects.toBe(original);
      expect(diagnostics.mock.calls).toEqual([
        [
          "[Pipeline] Secondary failure",
          expect.objectContaining({ phase: "failure-record", outcome: "indeterminate" }),
        ],
        [
          "[Pipeline] Secondary failure",
          expect.objectContaining({
            phase: "reader-close",
            readerIndex: 0,
            outcome: "indeterminate",
          }),
        ],
        [
          "[Pipeline] Secondary failure",
          expect.objectContaining({
            phase: "reader-close",
            readerIndex: 1,
            outcome: "indeterminate",
          }),
        ],
      ]);
      expect(JSON.stringify(diagnostics.mock.calls)).not.toContain("private");
    });

    it.each([undefined, Object.freeze(new PipelineProblem("interrupted"))])(
      "preserves an unmodifiable publication failure when diagnostics also throw: %s",
      async (original) => {
        const f = await fixture();
        const get = f.executions.get.bind(f.executions);
        let failed = false;
        vi.spyOn(console, "error").mockImplementation(() => {
          throw new Error("sink unavailable");
        });
        vi.spyOn(f.executions, "get").mockImplementation((id) =>
          failed ? Promise.reject(new PipelineProblem("invalid-checkpoint")) : get(id),
        );
        vi.spyOn(f.runtime.publication, "publish").mockImplementation(async () => {
          failed = true;
          throw original;
        });
        await expect(f.operations.run()).rejects.toBe(original);
      },
    );

    it("retains partial coverage when reader cleanup fails", async () => {
      const f = await fixture();
      const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
      const open = fileSources.openFileSource;
      let opened = 0;
      vi.spyOn(fileSources, "openFileSource").mockImplementation(async (source) => {
        const reader = await open(source);
        if (++opened > f.sources.length) {
          const close = reader.close;
          reader.close = async () => {
            await close();
            throw new Error("secret");
          };
        }
        return reader;
      });
      const result = await createPipelineOperations(
        {
          ...f.definition,
          source: {
            ...f.definition.source,
            coverage: { ...f.definition.source.coverage, state: "partial" },
          },
        },
        f.runtime,
      ).run();
      expect(result).toMatchObject({ state: "partial", outputCount: 2, snapshotId: null });
      expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
      expect((await f.executions.get(result.executionId)).status).toBe("failed");
      expect(diagnostics).toHaveBeenCalledWith(
        "[Pipeline] Secondary failure",
        expect.objectContaining({
          phase: "reader-close",
          outcome: "partial",
          snapshotId: null,
        }),
      );
    });

    it("returns committed publication and awaits every reader cleanup without exposing error data", async () => {
      const f = await fixture([[raw("a")], [raw("b")]]);
      const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
      const open = fileSources.openFileSource;
      let opened = 0;
      const closed: number[] = [];
      vi.spyOn(fileSources, "openFileSource").mockImplementation(async (source) => {
        const reader = await open(source);
        const index = opened++;
        if (index >= f.sources.length) {
          const close = reader.close;
          reader.close = async () => {
            await close();
            closed.push(index);
            throw new Error("secret row contents");
          };
        }
        return reader;
      });
      const result = await f.operations.run();
      expect(result).toMatchObject({
        state: "published",
        outputCount: 2,
        snapshotId: "snapshot:etl:execution-1",
      });
      expect((await f.executions.get(result.executionId)).result).toEqual(result);
      expect(closed.sort()).toEqual([2, 3]);
      expect(diagnostics).toHaveBeenCalledTimes(2);
      for (const call of diagnostics.mock.calls) {
        expect(call).toEqual([
          "[Pipeline] Secondary failure",
          expect.objectContaining({
            code: "etl-core/pipeline-secondary-failure",
            executionId: result.executionId,
            phase: "reader-close",
            outcome: "published",
            snapshotId: result.snapshotId,
          }),
        ]);
        expect(JSON.stringify(call)).not.toContain("secret row contents");
      }
    });
  });

  it("replays the same partition-local batches after a checkpoint failure with filters", async () => {
    const f = await fixture([
      [raw("a"), raw("skip"), raw("b")],
      [raw("c"), raw("d")],
    ]);
    const definition = {
      ...f.definition,
      resume: "restart-partition" as const,
      processor: {
        artifactHash: "a".repeat(64),
        dependencies: [],
        process: (row: CanonicalRow) => (row.id === "skip" ? null : row),
      },
    };
    let checkpoints = 0;
    f.store.beforeCheckpoint = () => {
      if (++checkpoints === 2) throw new PipelineProblem("invalid-checkpoint");
    };
    const runtime = { ...f.runtime, chunkSize: 2 };
    await expect(createPipelineOperations(definition, runtime).run()).rejects.toThrow(
      "invalid-checkpoint",
    );
    const first = vi.mocked(f.writer.write).mock.calls.map(([request]) => request);
    expect(first.map((request) => request.rows.map((row) => row.id))).toEqual([["a"], ["b"]]);
    await expect(
      createPipelineOperations(definition, { ...runtime, chunkSize: 3 }).retry("execution-1"),
    ).rejects.toThrow("binding-changed");
    expect((await f.executions.get("execution-1")).attempts).toBe(1);
    const result = await createPipelineOperations(definition, runtime).retry("execution-1");
    expect(result).toMatchObject({ inputCount: 5, outputCount: 4, filteredCount: 1 });
    const calls = vi.mocked(f.writer.write).mock.calls.map(([request]) => request);
    expect(calls.slice(2, 4).map((request) => request.batchId)).toEqual(
      first.map((request) => request.batchId),
    );
    expect(calls.at(-1)?.rows.map((row) => row.id)).toEqual(["c", "d"]);
    expect(f.rows.size).toBe(4);
  });

  it.each([undefined, 2])(
    "requires a new run for legacy format %s receipts",
    async (formatVersion) => {
      const f = await fixture();
      f.store.beforeCheckpoint = () => {
        throw new PipelineProblem("invalid-checkpoint");
      };
      await expect(f.operations.run()).rejects.toThrow("invalid-checkpoint");
      const saved = f.store.records.get("execution-1");
      if (!saved) throw new Error("missing execution");
      const payload = { ...(saved.payload as Record<string, unknown>) };
      payload.formatVersion = formatVersion;
      f.store.records.set(saved.id, { ...saved, payload });
      await expect(f.operations.retry(saved.id)).rejects.toThrow("binding-changed");
      expect(f.writer.write).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, 2])("rejects legacy checkpoint format %s", async (formatVersion) => {
    const f = await fixture();
    let count = 0;
    f.store.beforeCheckpoint = () => {
      if (++count === 2) throw new PipelineProblem("invalid-checkpoint");
    };
    await expect(f.operations.run()).rejects.toThrow("invalid-checkpoint");
    const saved = f.store.records.get("execution-1");
    if (!saved?.checkpoints) throw new Error("missing checkpoint");
    const checkpoint = saved.checkpoints["pipeline.chunkCheckpoint"] as {
      cursor: Record<string, unknown>;
    };
    checkpoint.cursor.formatVersion = formatVersion;
    f.store.records.set(saved.id, saved);
    await expect(f.operations.retry(saved.id)).rejects.toThrow("invalid-checkpoint");
    expect(f.writer.write).toHaveBeenCalledTimes(2);
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });

  it("checkpoints fully filtered input ranges before replaying a later durable output batch", async () => {
    const f = await fixture([[raw("skip-1"), raw("skip-2"), raw("a"), raw("b"), raw("skip-3")]]);
    const definition = {
      ...f.definition,
      processor: {
        artifactHash: "e".repeat(64),
        dependencies: [],
        process: (row: CanonicalRow) => (String(row.id).startsWith("skip-") ? null : row),
      },
    };
    let count = 0;
    f.store.beforeCheckpoint = () => {
      if (++count === 2) throw new PipelineProblem("invalid-checkpoint");
    };
    const operations = createPipelineOperations(definition, { ...f.runtime, chunkSize: 2 });
    await expect(operations.run()).rejects.toThrow("invalid-checkpoint");
    expect(f.writer.write).toHaveBeenCalledTimes(2);
    expect(await operations.retry("execution-1")).toMatchObject({
      inputCount: 5,
      outputCount: 2,
      filteredCount: 3,
    });
    const calls = vi.mocked(f.writer.write).mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[2][0].batchId).toBe(calls[1][0].batchId);
    expect(calls[0][0].rows).toEqual([]);
    expect(calls[3][0].rows).toEqual([]);
    expect(f.store.checkpointWrites.at(-1)?.value).toMatchObject({ processedCount: 3 });
    expect(f.rows.size).toBe(2);
  });

  it.each([1000, 10_000, 100_000])(
    "writes %i inputs as bounded batches and seals exactly their receipts",
    async (count) => {
      const started = performance.now();
      const heapBefore = process.memoryUsage().heapUsed;
      const f = await fixture([Array.from({ length: count }, (_, index) => raw(`row-${index}`))]);
      const operations = createPipelineOperations(f.definition, {
        ...f.runtime,
        chunkSize: 100,
        maxInputRecords: 100_000,
      });
      expect(await operations.run()).toMatchObject({ inputCount: count, outputCount: count });
      expect(f.writer.write).toHaveBeenCalledTimes(count / 100);
      const requests = vi.mocked(f.writer.write).mock.calls.map(([request]) => request);
      const checkpointBytes = f.store.checkpointWrites.map(({ value }) =>
        Buffer.byteLength(JSON.stringify(value)),
      );
      process.stdout.write(
        JSON.stringify({
          workload: "checkpoint-growth",
          rows: count,
          maxCheckpointBytes: Math.max(...checkpointBytes),
          cumulativeCheckpointBytes: checkpointBytes.reduce((sum, bytes) => sum + bytes, 0),
          receiptBytes: Buffer.byteLength(JSON.stringify([...f.receipts.values()])),
          heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
          note: "Heap includes retained source rows, fixture receipts, checkpoint history and spies; not peak production memory.",
        }) + "\n",
      );
      expect(Math.max(...checkpointBytes)).toBeLessThan(3000);
      expect(requests.map((request) => request.rows.length)).toEqual(Array(count / 100).fill(100));
      expect(new Set(requests.map((request) => request.batchId)).size).toBe(count / 100);
      expect(f.catalog.sealCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedManifest: expect.objectContaining({
            formatVersion: 1,
            count: requests.length,
            hash: requests.at(-1)?.evidence?.hash,
          }),
        }),
      );
      console.info(
        JSON.stringify({
          workload: "file-pipeline",
          rows: count,
          writerCalls: requests.length,
          elapsedMs: performance.now() - started,
          heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
          note: "In-memory execution/catalog/writer fixture; heap includes retained rows, receipts and spies.",
        }),
      );
    },
    120_000,
  );

  it("validates and previews actual files without loading, then publishes normalized rows", async () => {
    const f = await fixture();
    expect(await f.operations.validate()).toMatchObject({ inputCount: 2 });
    expect(await f.operations.preview()).toMatchObject({
      inputCount: 2,
      coverage: "preview",
      rows: [
        { id: "a", count: "1" },
        { id: "b", count: "1" },
      ],
    });
    expect(f.writer.write).not.toHaveBeenCalled();
    expect(f.catalog.createCandidate).not.toHaveBeenCalled();
    const result = await f.operations.run();
    expect(result).toMatchObject({ state: "published", inputCount: 2, outputCount: 2 });
    expect((await f.operations.status(result.executionId)).status).toBe("completed");
    expect(f.rows.size).toBe(2);
  });

  it("binds republication to the catalog identity and revision when snapshot metadata is unavailable", async () => {
    const f = await fixture();
    const dataset = await f.catalog.describeDataset({ access });
    vi.mocked(f.catalog.describeDataset).mockResolvedValue({
      ...dataset,
      headId: "unavailable-head",
      headStatus: "unavailable",
      head: null,
      revision: 17,
    });
    await f.operations.run();
    expect(f.catalog.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedHead: "unavailable-head",
        audit: expect.objectContaining({ expectedRevision: 17 }),
      }),
    );
  });

  it("rejects an unsafe numeric cast anywhere in strict input before durable writes", async () => {
    const f = await fixture([[raw("a"), raw("b", 1.5)]]);
    await expect(f.operations.validate()).rejects.toMatchObject({ reason: "unsafe-cast" });
    await expect(f.operations.run()).rejects.toMatchObject({ reason: "unsafe-cast" });
    expect(f.writer.write).not.toHaveBeenCalled();
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });

  it("restores durable bindings when locale collation changes between attempts", async () => {
    const f = await fixture();
    let fail = true;
    f.store.beforeCheckpoint = () => {
      if (fail) {
        fail = false;
        throw new PipelineProblem("invalid-checkpoint");
      }
    };
    await expect(f.operations.run()).rejects.toMatchObject({ reason: "invalid-checkpoint" });
    const collation = vi
      .spyOn(String.prototype, "localeCompare")
      .mockImplementation(function (this: string, other) {
        const value = String(this);
        return value < other ? 1 : value > other ? -1 : 0;
      });
    try {
      const result = await f.operations.retry("execution-1");
      expect(result).toMatchObject({ state: "published", inputCount: 2, outputCount: 2 });
      expect(f.rows.size).toBe(2);
    } finally {
      collation.mockRestore();
    }
  });

  it("advances input checkpoints for fully filtered chunks and distinguishes zero output", async () => {
    const f = await fixture();
    const operations = createPipelineOperations(
      {
        ...f.definition,
        processor: { artifactHash: "a".repeat(64), dependencies: [], process: () => null },
      },
      f.runtime,
    );
    const result = await operations.run();
    expect(result).toMatchObject({
      state: "published",
      inputCount: 2,
      outputCount: 0,
      filteredCount: 2,
    });
    expect(f.writer.write).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(f.writer.write).mock.calls.every(([request]) => request.rows.length === 0),
    ).toBe(true);
    expect(f.store.checkpointWrites.length).toBeGreaterThanOrEqual(2);
    expect(f.store.checkpointWrites.at(-1)?.value).toMatchObject({
      cursor: { cursor: { partition: 1, counts: { input: 2, filtered: 2 } } },
      processedCount: 2,
    });
  });

  it("restores the final checkpoint of an empty pipeline after sealing fails", async () => {
    const f = await fixture([[]]);
    const failure = new PipelineProblem("interrupted");
    vi.mocked(f.catalog.sealCandidate).mockRejectedValueOnce(failure);

    await expect(f.operations.run()).rejects.toBe(failure);
    expect((await f.operations.status("execution-1")).checkpoints).toMatchObject({
      "pipeline.chunkCheckpoint": {
        cursor: { cursor: { partition: 1, record: 0 } },
        processedCount: 0,
      },
    });
    await expect(f.operations.retry("execution-1")).resolves.toMatchObject({
      state: "published",
      inputCount: 0,
      outputCount: 0,
    });
    expect(f.writer.write).not.toHaveBeenCalled();
  });

  it("replays durable rows after a checkpoint failure without duplicating the grain", async () => {
    const f = await fixture();
    let fail = true;
    f.store.beforeCheckpoint = () => {
      if (fail) {
        fail = false;
        throw new PipelineProblem("invalid-checkpoint");
      }
    };
    await expect(f.operations.run()).rejects.toMatchObject({ reason: "invalid-checkpoint" });
    expect(f.rows.size).toBe(1);
    expect((await f.executions.get("execution-1")).status).toBe("failed");
    const result = await f.operations.retry("execution-1");
    expect(result).toMatchObject({ state: "published", inputCount: 2, outputCount: 2 });
    expect(f.rows.size).toBe(2);
    expect(f.writer.write).toHaveBeenCalledTimes(3);
  });

  it("restarts only the unfinished mutable partition while preserving prior partition counts", async () => {
    const f = await fixture([[raw("a")], [raw("b"), raw("c")]]);
    const calls: string[] = [];
    let failuresRemaining = 2;
    const definition: PipelineDefinition = {
      ...f.definition,
      source: {
        ...f.definition.source,
        partitions: f.sources.map((source) => ({ ...source, replayability: "mutable" })),
      },
      resume: "restart-partition",
      processor: {
        artifactHash: "a".repeat(64),
        dependencies: [],
        process(row) {
          calls.push(String(row.id));
          if (row.id === "c" && failuresRemaining > 0) {
            failuresRemaining--;
            throw new PipelineProblem("interrupted");
          }
          return row;
        },
      },
    };
    const operations = createPipelineOperations(definition, f.runtime);
    await expect(operations.run()).rejects.toMatchObject({ reason: "interrupted" });
    calls.length = 0;
    await expect(operations.retry("execution-1")).rejects.toMatchObject({ reason: "interrupted" });
    expect(calls).toEqual(["b", "c"]);
    expect((await operations.status("execution-1")).checkpoints).toMatchObject({
      "pipeline.chunkCheckpoint": {
        cursor: { cursor: { partition: 1, record: 1, counts: { input: 2, output: 2 } } },
        processedCount: 2,
      },
    });

    calls.length = 0;
    const result = await operations.retry("execution-1");
    expect(calls).toEqual(["b", "c"]);
    expect(result).toMatchObject({ inputCount: 3, outputCount: 3 });
    expect(f.rows.size).toBe(3);
  });

  it.each(["mutable", "snapshot-stable"] as const)(
    "preserves a completed %s partition when the next partition fails before checkpointing",
    async (replayability) => {
      const f = await fixture([[raw("a")], [], [], [raw("b"), raw("c")]]);
      const calls: string[] = [];
      let fail = true;
      const operations = createPipelineOperations(
        {
          ...f.definition,
          source: {
            ...f.definition.source,
            partitions: f.sources.map((source) => ({ ...source, replayability })),
          },
          resume: "restart-partition",
          processor: {
            artifactHash: "d".repeat(64),
            dependencies: [],
            process(row) {
              calls.push(String(row.id));
              if (row.id === "b" && fail) {
                fail = false;
                throw new PipelineProblem("interrupted");
              }
              return row;
            },
          },
        },
        f.runtime,
      );
      await expect(operations.run()).rejects.toMatchObject({ reason: "interrupted" });
      expect((await f.executions.get("execution-1")).checkpoints).toMatchObject({
        "pipeline.chunkCheckpoint": {
          cursor: { cursor: { partition: 0, record: 1, counts: { input: 1, output: 1 } } },
          processedCount: 1,
        },
      });
      calls.length = 0;
      const result = await operations.retry("execution-1");
      expect(calls).toEqual(["b", "c"]);
      expect(result).toMatchObject({ state: "published", inputCount: 3, outputCount: 3 });
      expect(f.writer.write).toHaveBeenCalledTimes(3);
      expect(f.rows.size).toBe(3);
    },
  );

  it.each(["source", "transform", "model"] as const)(
    "rejects %s binding drift on retry",
    async (change) => {
      const f = await fixture();
      f.store.beforeCheckpoint = () => {
        throw new PipelineProblem("invalid-checkpoint");
      };
      await expect(f.operations.run()).rejects.toThrow();
      f.store.beforeCheckpoint = undefined;
      const definition =
        change === "source"
          ? {
              ...f.definition,
              source: {
                ...f.definition.source,
                partitions: f.sources.map((source) => ({ ...source, revision: "f".repeat(64) })),
              },
            }
          : change === "transform"
            ? {
                ...f.definition,
                processor: {
                  artifactHash: "b".repeat(64),
                  dependencies: [],
                  process: (row: CanonicalRow) => row,
                },
              }
            : { ...f.definition, project: { ...projection, target: { ...target, version: 2 } } };
      await expect(
        createPipelineOperations(definition, f.runtime).retry("execution-1"),
      ).rejects.toMatchObject({ reason: "binding-changed" });
      expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
    },
  );

  it("records quarantine evidence and partial counts without completion or publication", async () => {
    const f = await fixture([[raw("a"), raw("b", 1.5)]]);
    const result = await createPipelineOperations(
      { ...f.definition, load: "quarantine" },
      f.runtime,
    ).run();
    expect(result).toMatchObject({
      state: "partial",
      inputCount: 2,
      outputCount: 1,
      rejectedCount: 1,
      snapshotId: null,
    });
    const execution = await f.executions.get(result.executionId);
    expect(execution.status).toBe("failed");
    expect(execution.checkpoints).toMatchObject({
      "pipeline.chunkCheckpoint": {
        cursor: { formatVersion: 3, cursor: { counts: { rejected: 1 }, manifest: { count: 2 } } },
        processedCount: 2,
      },
    });
    const evidence = await f.catalog.readReceipts({
      access,
      candidateId: "etl:execution-1",
      limit: 10,
    });
    expect(evidence.flatMap((receipt) => receipt.evidence?.rejections ?? [])).toEqual([
      {
        sourceId: "partition-0",
        record: 2,
        reason: "etl-core/projection-failed",
        sensitivity: "sensitive",
      },
    ]);
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
    expect(JSON.stringify(execution)).not.toContain("2026-10-01T00:00:00.000Z");
  });

  it("keeps quarantine checkpoints bounded while diagnostics stay in paginated receipts", async () => {
    const f = await fixture([
      Array.from({ length: 1000 }, (_, index) => raw(`rejected-${index}`, 1.5)),
    ]);
    const result = await createPipelineOperations(
      { ...f.definition, load: "quarantine" },
      {
        ...f.runtime,
        chunkSize: 100,
        maxInputRecords: 1000,
      },
    ).run();
    expect(result).toMatchObject({ state: "partial", rejectedCount: 1000, outputCount: 0 });
    expect(
      Math.max(
        ...f.store.checkpointWrites.map(({ value }) => Buffer.byteLength(JSON.stringify(value))),
      ),
    ).toBeLessThan(3000);
    const first = await f.catalog.readReceipts({
      access,
      candidateId: "etl:execution-1",
      limit: 3,
    });
    const next = await f.catalog.readReceipts({
      access,
      candidateId: "etl:execution-1",
      afterBatchId: first.at(-1)?.batchId,
      limit: 3,
    });
    expect(first).toHaveLength(3);
    expect(next).toHaveLength(3);
    expect(next.some((receipt) => first.some((prior) => prior.batchId === receipt.batchId))).toBe(
      false,
    );
    expect(
      [...f.receipts.values()].flatMap((receipt) => receipt.evidence?.rejections ?? []),
    ).toHaveLength(1000);
    expect(JSON.stringify((await f.executions.get(result.executionId)).checkpoints)).not.toContain(
      "rejected-999",
    );
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });

  it("refuses durable receipts that do not prove the written input range", async () => {
    const f = await fixture();
    const original = f.writer.write;
    f.writer.write = async (request) => ({ ...(await original(request)), evidence: undefined });
    await expect(createPipelineOperations(f.definition, f.runtime).run()).rejects.toMatchObject({
      reason: "receipt-unresolved",
    });
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });

  it("does not publish interrupted or over-budget runs", async () => {
    const f = await fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      createPipelineOperations(f.definition, { ...f.runtime, signal: controller.signal }).run(),
    ).rejects.toMatchObject({ reason: "interrupted" });
    await expect(
      createPipelineOperations(f.definition, { ...f.runtime, maxInputRecords: 1 }).run(),
    ).rejects.toMatchObject({ reason: "invalid-definition" });
    expect(f.writer.write).not.toHaveBeenCalled();
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
    expect(
      [...f.store.records.values()].every((execution) => execution.status !== "completed"),
    ).toBe(true);
  });

  it("keeps a cancelled execution terminal when cancellation races with processing", async () => {
    const f = await fixture();
    const operations = createPipelineOperations(
      {
        ...f.definition,
        processor: {
          artifactHash: "c".repeat(64),
          dependencies: [],
          async process(row) {
            await f.executions.cancel("execution-1", "test cancellation");
            return row;
          },
        },
      },
      f.runtime,
    );
    await expect(operations.run()).rejects.toMatchObject({ reason: "interrupted" });
    expect((await f.executions.get("execution-1")).status).toBe("cancelled");
    expect(f.writer.write).not.toHaveBeenCalled();
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });

  it.each(["partial", "unknown"] as const)(
    "does not upgrade %s source coverage to complete",
    async (state) => {
      const f = await fixture();
      const result = await createPipelineOperations(
        {
          ...f.definition,
          source: { ...f.definition.source, coverage: { ...f.definition.source.coverage, state } },
        },
        f.runtime,
      ).run();
      expect(result).toMatchObject({ state: "partial", rejectedCount: 0, snapshotId: null });
      expect((await f.executions.get(result.executionId)).status).toBe("failed");
      expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
    },
  );

  it("retains indeterminate write evidence and never publishes it", async () => {
    const f = await fixture();
    vi.mocked(f.writer.write).mockImplementation(async (request) => ({
      batchId: request.batchId,
      attempt: request.attempt,
      state: "indeterminate",
      providerRef: request.candidateId,
      inserted: 0,
      identical: 0,
    }));
    await expect(f.operations.run()).rejects.toMatchObject({ reason: "receipt-unresolved" });
    expect((await f.executions.get("execution-1")).error).toMatchObject({ indeterminate: true });
    const unresolved = await f.executions.get("execution-1");
    await expect(f.executions.retry("execution-1")).rejects.toMatchObject({
      code: "execution/indeterminate-retry-blocked",
    });
    await expect(f.executions.replay("execution-1")).rejects.toMatchObject({
      code: "execution/indeterminate-retry-blocked",
    });
    await expect(
      createExecutionJobsOperations(f.executions).show("execution-1"),
    ).resolves.toMatchObject({
      failurePolicy: { retryable: false, replayable: false, recoveryAction: "inspect" },
    });
    expect(await f.executions.get("execution-1")).toEqual(unresolved);
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });
  it("preserves uncertainty when receipt reconciliation fails", async () => {
    const f = await fixture();
    vi.mocked(f.writer.write).mockImplementation(async (request) => ({
      batchId: request.batchId,
      attempt: request.attempt,
      state: "indeterminate",
      providerRef: request.candidateId,
      inserted: 0,
      identical: 0,
    }));
    f.writer.reconcileReceipt = async () => {
      throw new PipelineProblem("interrupted");
    };
    await expect(f.operations.run()).rejects.toMatchObject({ reason: "interrupted" });
    expect((await f.executions.get("execution-1")).error).toMatchObject({ indeterminate: true });
    expect(f.catalog.publishCandidate).not.toHaveBeenCalled();
  });

  it("records uncertain publication without completing the execution", async () => {
    const f = await fixture();
    const publication: PipelineRuntime["publication"] = {
      executions: f.executions,
      async publish() {
        throw new PipelineProblem("interrupted");
      },
    };
    await expect(
      createPipelineOperations(f.definition, { ...f.runtime, publication }).run(),
    ).rejects.toMatchObject({ reason: "interrupted" });
    expect((await f.executions.get("execution-1")).error).toMatchObject({ indeterminate: true });
    expect((await f.executions.get("execution-1")).status).toBe("failed");
  });

  it("rejects a publication coordinator with a different execution owner", async () => {
    const f = await fixture();
    const other = createExecutionFixture();
    expect(() =>
      createPipelineOperations(f.definition, {
        ...f.runtime,
        publication: { ...f.runtime.publication, executions: other.executions },
      }),
    ).toThrow(PipelineProblem);
  });

  it("does not expose another tenant's execution through status", async () => {
    const f = await fixture();
    const result = await f.operations.run();
    const other = createPipelineOperations(f.definition, {
      ...f.runtime,
      resolveAccess: () => ({ ...access, scope: { ...access.scope, tenant: "tenant-b" } }),
    });
    await expect(other.status(result.executionId)).rejects.toMatchObject({
      reason: "binding-changed",
    });
  });
});
