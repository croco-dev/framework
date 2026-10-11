import { describe, expect, it, vi } from "vitest";
import { SourceDecodeProblem } from "@croco/etl-core/source";
import {
  compareAssignedOutcomes,
  hashAssignedOutcomeDefinition,
  hashAssignedOutcomeInput,
} from "../libs/outcome/compareAssignedOutcomes";
import { OUTCOME_KINDS } from "../libs/outcome/OutcomeLedgerNormalizer";
import {
  AssignedOutcomeRowProblem,
  importAssignedOutcomeEvents,
} from "../libs/read/AssignedOutcomeImport";
import {
  createAssignedOutcomeQuery,
  createWarehouseAssignedOutcomeLoader,
} from "../libs/read/AssignedOutcomeRead";
import { MetricReadService } from "../libs/read/MetricReadService";
import type { AssignedOutcomeInput } from "../libs/outcome/types";
import type {
  MetricReadAuthority,
  MetricReadContext,
  MetricReadQuality,
} from "../libs/read/MetricReadService";
import type { WarehouseAccess, WarehouseSnapshot } from "@croco/warehouse-core/runtime";

const scope = { app: "app", environment: "test", tenant: "tenant" };
const at = "2026-01-02T00:00:00.000Z";
const window = { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.001Z" };
const quality: MetricReadQuality = {
  temporalCompleteness: "complete",
  freshness: "fresh",
  populationCoverage: "complete",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
const limits = {
  maxRows: 100,
  maxBytes: 100000,
  maxTimeMs: 10000,
  maxWindowMs: 172800000,
  maxConcurrency: 1,
  maxCost: 100,
};
const rows = ["payment", "refund"].map((kind, index) => ({
  ...scope,
  source: "ledger",
  eventId: String(index),
  subject: "person",
  kind,
  amountMinor: index === 0 ? "100" : "20",
  currency: "USD",
  occurredAt: at,
  observedAt: at,
  relatedPaymentId: index === 0 ? null : "0",
  valuationKind: "cash",
  correctionSource: null,
  correctionEventId: null,
}));
async function* bytes(value: string) {
  yield new TextEncoder().encode(value);
}
const importRows = (value = rows) =>
  importAssignedOutcomeEvents(bytes(value.map((row) => JSON.stringify(row)).join("\n")), {
    format: "jsonl",
    limits: { maxBytes: 10000, maxRecords: 100, maxRowBytes: 2000 },
    scope,
    cutoff: { effectiveAt: at, knownAt: at },
  });
async function fixture(): Promise<AssignedOutcomeInput> {
  const input: AssignedOutcomeInput = {
    assignmentSnapshot: {
      id: "v1",
      scope,
      unit: "person",
      arms: ["a"],
      assignments: [{ subject: "person", arm: "a" }],
    },
    events: await importRows(),
    cutoff: { effectiveAt: at, knownAt: at },
    revision: "1",
    metricDefinitionVersion: "assigned-net-v1",
    inputHash: "",
    definitionHash: await hashAssignedOutcomeDefinition(),
    currencies: ["USD"],
    sources: ["ledger"],
    baselineArm: "a",
    retention: [{ subject: "person", retained: true }],
    costCompleteness: OUTCOME_KINDS.map((kind) => ({
      arm: "a",
      source: "ledger",
      kind,
      currency: "USD",
      status: "complete",
    })),
  };
  input.inputHash = await hashAssignedOutcomeInput(input);
  return input;
}
async function emptyRequest(input: AssignedOutcomeInput): Promise<AssignedOutcomeInput> {
  const submitted = { ...input, events: [] };
  submitted.inputHash = await hashAssignedOutcomeInput(submitted);
  return submitted;
}
const snapshot: WarehouseSnapshot = {
  id: "snapshot",
  revision: 1,
  modelVersion: "model",
  segmentRefs: [],
  partitionSelection: [],
  createdAt: at,
  permissionEpoch: 0,
  privacyEpoch: 0,
  quality: {
    freshness: { observedAt: at, newestEventAt: at },
    temporalCompleteness: "complete",
    populationCoverage: "complete",
    validity: "valid",
    reproducibility: "reproducible",
    sourceCoverage: [
      {
        sourceRef: "ledger",
        from: window.from,
        through: at,
        state: "complete",
        gaps: [],
        late: false,
      },
    ],
  },
};
const access: WarehouseAccess = {
  scope: { application: "app", environment: "test", tenant: "tenant" },
  actor: "operator",
  roles: ["read"],
  columns: Object.keys(rows[0]),
  permissionEpoch: 0,
  privacyEpoch: 0,
};
function authority(allowed = true): MetricReadAuthority {
  return {
    currentContext: (): MetricReadContext => ({
      principal: { ...scope, subject: "operator" },
      allowedFields: Object.keys(rows[0]),
      allowRaw: true,
      budget: limits,
      sourceRevisions: [{ sourceRef: "ledger", revision: "1" }],
      snapshotRefs: ["snapshot"],
    }),
    authorize: async () => (allowed ? { permissionEpoch: "0", privacyEpoch: "0" } : null),
  };
}
describe("Assigned outcome registered reads", () => {
  it.each(["cancelled", "timeout"] as const)(
    "withholds native financial rows when a registered warehouse read is %s",
    async (mode) => {
      const input = await emptyRequest(await fixture());
      let started!: () => void;
      const readStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      let forwardedSignal: AbortSignal | undefined;
      const load = createWarehouseAssignedOutcomeLoader({
        snapshot,
        pageSize: 1,
        quality,
        access: () => access,
        reader: {
          read: async (request) => {
            forwardedSignal = request.signal;
            started();
            return new Promise((_resolve, reject) => {
              request.signal?.addEventListener(
                "abort",
                () => reject(new Error("private financial row in provider failure")),
                { once: true },
              );
            });
          },
        },
      });
      const registered = await createAssignedOutcomeQuery({
        id: "native-cancellation",
        sourceRefs: ["ledger"],
        limits: { ...limits, maxTimeMs: 100 },
        load,
      });
      const service = new MetricReadService(
        [registered.definition],
        [registered.query],
        authority(),
      );
      const caller = new AbortController();
      vi.useFakeTimers();
      try {
        const pending = service.runRegisteredQuery("native-cancellation", input, window, {
          signal: caller.signal,
        });
        const observed = pending.catch((error: unknown) => error);
        await readStarted;
        if (mode === "timeout") await vi.advanceTimersByTimeAsync(100);
        else caller.abort();
        const error = await observed;
        expect(error).toMatchObject({
          code: mode === "timeout" ? "metrics-core/read-timeout" : "metrics-core/read-cancelled",
        });
        expect(forwardedSignal?.aborted).toBe(true);
        expect(error).not.toHaveProperty("data");
        expect(error).not.toHaveProperty("result");
        expect(error).toHaveProperty("cause", undefined);
        expect(String(error)).not.toContain("private financial row");
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("produces identical file, pure and paginated warehouse reports", async () => {
    const input = await fixture();
    const pure = await createAssignedOutcomeQuery({ id: "pure", sourceRefs: ["ledger"], limits });
    const service = new MetricReadService([pure.definition], [pure.query], authority());
    const pureResult = await service.runRegisteredQuery("pure", input, window);
    expect(pureResult.status).toBe("verified");
    expect(() =>
      pure.query.outputSchema.parse({
        ...compareAssignedOutcomes(input),
        rawFinancialRecord: "secret",
      }),
    ).toThrow();
    if (pureResult.status === "verified")
      expect(pureResult.result.data).toEqual(compareAssignedOutcomes(input));
    const calls: number[] = [];
    const load = createWarehouseAssignedOutcomeLoader({
      snapshot,
      pageSize: 1,
      quality,
      access: () => access,
      reader: {
        read: async (request) => {
          const index = request.cursor === undefined ? 0 : 1;
          calls.push(index);
          return {
            snapshotId: "snapshot",
            rows: [rows[index]],
            nextCursor: index === 0 ? "second" : null,
            permissionEpoch: 0,
            privacyEpoch: 0,
            exactness: "exact",
          };
        },
      },
    });
    const native = await createAssignedOutcomeQuery({
      id: "native",
      sourceRefs: ["ledger"],
      limits,
      load,
    });
    const submitted = await emptyRequest(input);
    expect(submitted.inputHash).not.toBe(input.inputHash);
    const nativeResult = await new MetricReadService(
      [native.definition],
      [native.query],
      authority(),
    ).runRegisteredQuery("native", submitted, window);
    expect(nativeResult.status).toBe("verified");
    if (nativeResult.status === "verified")
      expect(nativeResult.result.data).toEqual(compareAssignedOutcomes(input));
    expect(calls).toEqual([0, 1]);
  });
  it("reads one canonical snapshot once for multiple registered sources", async () => {
    const full = await fixture();
    const extra = { ...rows[0], source: "billing", eventId: "capture", amountMinor: "50" };
    full.sources = ["ledger", "billing"];
    full.events = await importRows([...rows, extra]);
    full.costCompleteness = [
      ...full.costCompleteness,
      ...full.costCompleteness.map((cost) => ({ ...cost, source: "billing" })),
    ];
    full.inputHash = await hashAssignedOutcomeInput(full);
    const submitted = await emptyRequest(full);
    let reads = 0;
    const load = createWarehouseAssignedOutcomeLoader({
      snapshot: {
        ...snapshot,
        quality: {
          ...snapshot.quality,
          sourceCoverage: [
            ...snapshot.quality.sourceCoverage,
            { ...snapshot.quality.sourceCoverage[0], sourceRef: "billing" },
          ],
        },
      },
      pageSize: 100,
      quality,
      access: () => access,
      reader: {
        read: async () => {
          reads += 1;
          return {
            snapshotId: "snapshot",
            rows: [...rows, extra],
            nextCursor: null,
            permissionEpoch: 0,
            privacyEpoch: 0,
            exactness: "exact",
          };
        },
      },
    });
    const registered = await createAssignedOutcomeQuery({
      id: "multi",
      sourceRefs: full.sources,
      limits,
      load,
    });
    const trusted = authority();
    const originalContext = trusted.currentContext;
    trusted.currentContext = () => ({
      ...originalContext(),
      sourceRevisions: [
        { sourceRef: "ledger", revision: "1" },
        { sourceRef: "billing", revision: "1" },
      ],
      snapshotRefs: ["snapshot", "snapshot"],
    });
    const result = await new MetricReadService(
      [registered.definition],
      [registered.query],
      trusted,
    ).runRegisteredQuery("multi", submitted, window);
    expect(result.status).toBe("verified");
    if (result.status !== "verified") throw new Error("expected verified result");
    expect(result.result.data).toEqual(compareAssignedOutcomes(full));
    expect(result.result.data).toMatchObject({
      inputHash: full.inputHash,
      byCurrency: [{ arms: [{ netMinor: "130" }] }],
    });
    expect(reads).toBe(1);
    await expect(
      load({
        input: { ...submitted, inputHash: full.inputHash },
        context: trusted.currentContext(),
        window,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("provenance_hash_mismatch");
    expect(reads).toBe(1);
    for (const incompatible of [
      { snapshotRefs: ["snapshot", "other"] },
      {
        sourceRevisions: [
          { sourceRef: "ledger", revision: "1" },
          { sourceRef: "billing", revision: "2" },
        ],
      },
      { snapshotRefs: ["snapshot"] },
      {
        sourceRevisions: [
          { sourceRef: "ledger", revision: "1" },
          { sourceRef: "unknown", revision: "1" },
        ],
      },
    ]) {
      await expect(
        load({
          input: submitted,
          context: { ...trusted.currentContext(), ...incompatible },
          window,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow();
      expect(reads).toBe(1);
    }
  });
  it.each([false, true])(
    "binds reviewed cache identity to the complete request (native=%s)",
    async (native) => {
      const input = await fixture();
      const submitted = native ? await emptyRequest(input) : input;
      const registered = await createAssignedOutcomeQuery({
        id: "cached",
        sourceRefs: ["ledger"],
        limits,
        ...(native ? { load: async () => ({ input, rows: 2, bytes: 1000 }) } : {}),
      });
      const initial = await new MetricReadService(
        [registered.definition],
        [registered.query],
        authority(),
      ).runRegisteredQuery("cached", submitted, window);
      expect(initial.status).toBe("verified");
      if (initial.status !== "verified") throw new Error("expected fixture result");
      const key = await registered.query.inputKey(submitted);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(key).not.toContain("person");
      const cached = {
        id: "reviewed",
        queryId: "cached",
        queryVersion: 1,
        inputKey: key,
        resultHash: "verified-digest",
        result: initial.result,
        reviewed: {
          reviewerId: "reviewer",
          reviewedAt: at,
          definitionHash: registered.definition.hash,
          resultHash: "verified-digest",
        },
        permissionEpoch: "0",
        privacyEpoch: "0",
        expiresAt: "2099-01-01T00:00:00.000Z",
      };
      const service = new MetricReadService(
        [registered.definition],
        [registered.query],
        authority(),
        {
          readCandidates: async () => [cached],
          verify: async () => true,
        },
      );
      expect((await service.getVerifiedReport("cached", submitted, window)).status).toBe(
        "verified",
      );
      for (const changed of [
        { ...submitted, revision: "2" },
        { ...submitted, cutoff: { ...submitted.cutoff, knownAt: "2026-01-03T00:00:00.000Z" } },
        { ...submitted, costCompleteness: [] },
        { ...submitted, assignmentSnapshot: { ...submitted.assignmentSnapshot, id: "different" } },
        { ...submitted, inputHash: "a".repeat(64) },
      ]) {
        expect((await service.getVerifiedReport("cached", changed, window)).status).toBe(
          "unavailable",
        );
      }
    },
  );
  it.each([
    { temporalCompleteness: "partial" },
    { populationCoverage: "partial" },
    { validity: "invalid" },
    { exactness: "approximate" },
    { reproducibility: "unverified" },
  ] as const)("keeps source incompleteness visible in financial reports: %j", async (degraded) => {
    const input = await fixture();
    input.assignmentSnapshot = {
      ...input.assignmentSnapshot,
      arms: ["a", "b"],
      assignments: [...input.assignmentSnapshot.assignments, { subject: "other", arm: "b" }],
    };
    input.costCompleteness = [
      ...input.costCompleteness,
      ...input.costCompleteness.map((cost) => ({ ...cost, arm: "b" })),
    ];
    input.retention = [...(input.retention ?? []), { subject: "other", retained: true }];
    input.inputHash = await hashAssignedOutcomeInput(input);
    const registered = await createAssignedOutcomeQuery({
      id: "quality",
      sourceRefs: ["ledger"],
      limits,
      load: async () => ({ input, rows: 2, bytes: 1000, quality: { ...quality, ...degraded } }),
    });
    const result = await new MetricReadService(
      [registered.definition],
      [registered.query],
      authority(),
    ).runRegisteredQuery("quality", await emptyRequest(input), window);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") throw new Error("expected partial result");
    expect(result.result?.quality).toMatchObject(degraded);
    expect(result.result?.diagnostics).toContain("incomplete-source");
    expect(result.result?.data).toMatchObject({
      diagnostics: [{ code: "incomplete_source", source: "ledger" }],
      quality: "partial",
      byCurrency: [
        {
          arms: [
            {
              arm: "a",
              netMinor: "80",
              complete: false,
              perUnit: null,
              refundRate: null,
              retentionRate: null,
            },
            { arm: "b", complete: false, perUnit: null },
          ],
          delta: [{ value: null }],
        },
      ],
    });
  });
  it.each([
    { from: "2026-01-01T00:00:00.001Z" },
    { through: "2026-01-01T23:59:59.999Z" },
    { from: "not-a-time" },
  ])(
    "marks native coverage partial when it does not span the requested window: %j",
    async (range) => {
      const input = await fixture();
      const load = createWarehouseAssignedOutcomeLoader({
        snapshot: {
          ...snapshot,
          quality: {
            ...snapshot.quality,
            sourceCoverage: snapshot.quality.sourceCoverage.map((coverage) => ({
              ...coverage,
              ...range,
            })),
          },
        },
        pageSize: 100,
        quality,
        access: () => access,
        reader: {
          read: async () => ({
            snapshotId: "snapshot",
            rows,
            nextCursor: null,
            permissionEpoch: 0,
            privacyEpoch: 0,
            exactness: "exact",
          }),
        },
      });
      const loaded = await load({
        input: await emptyRequest(input),
        context: authority().currentContext(),
        window,
        signal: new AbortController().signal,
      });
      expect(loaded.quality?.temporalCompleteness).toBe("partial");
    },
  );
  it.each([
    { observedAt: at, knownAt: "2026-01-02T00:00:00.001Z" },
    { observedAt: "not-a-time", knownAt: at },
  ])(
    "withholds native comparisons when snapshot observation cannot cover knownAt: %j",
    async ({ observedAt, knownAt }) => {
      const input = await fixture();
      input.cutoff = { ...input.cutoff, knownAt };
      input.inputHash = await hashAssignedOutcomeInput(input);
      const load = createWarehouseAssignedOutcomeLoader({
        snapshot: {
          ...snapshot,
          quality: {
            ...snapshot.quality,
            freshness: { ...snapshot.quality.freshness, observedAt },
          },
        },
        pageSize: 100,
        quality,
        access: () => access,
        reader: {
          read: async () => ({
            snapshotId: "snapshot",
            rows,
            nextCursor: null,
            permissionEpoch: 0,
            privacyEpoch: 0,
            exactness: "exact",
          }),
        },
      });
      const registered = await createAssignedOutcomeQuery({
        id: "observed",
        sourceRefs: ["ledger"],
        limits,
        load,
      });
      const result = await new MetricReadService(
        [registered.definition],
        [registered.query],
        authority(),
      ).runRegisteredQuery("observed", await emptyRequest(input), window);
      expect(result.status).toBe("partial");
      if (result.status !== "partial") throw new Error("expected partial result");
      expect(result.result?.quality.temporalCompleteness).toBe("partial");
      expect(result.result?.data).toMatchObject({
        quality: "partial",
        diagnostics: [{ code: "incomplete_source", source: "ledger" }],
        byCurrency: [{ arms: [{ netMinor: "80", complete: false, perUnit: null }] }],
      });
    },
  );
  it("preserves parser positions and masks semantic row failures", async () => {
    await expect(
      importAssignedOutcomeEvents(bytes("{broken"), {
        format: "jsonl",
        limits: { maxBytes: 1000, maxRecords: 10, maxRowBytes: 1000 },
        scope,
        cutoff: { effectiveAt: at, knownAt: at },
      }),
    ).rejects.toBeInstanceOf(SourceDecodeProblem);
    const imported = importRows([{ ...rows[0], amountMinor: "private-secret" }]);
    await expect(imported).rejects.toBeInstanceOf(AssignedOutcomeRowProblem);
    await expect(imported).rejects.toMatchObject({ row: 1 });
    const error: unknown = await imported.catch((reason: unknown) => reason);
    expect(String(error)).not.toContain("private-secret");
  });
  it("returns denied before reads and on revocation; refuses hashes and window drift", async () => {
    const input = await fixture();
    const registered = await createAssignedOutcomeQuery({
      id: "pure",
      sourceRefs: ["ledger"],
      limits,
    });
    expect(
      await new MetricReadService(
        [registered.definition],
        [registered.query],
        authority(false),
      ).runRegisteredQuery("pure", input, window),
    ).toEqual({ status: "denied" });
    let calls = 0;
    const revoked = authority();
    revoked.authorize = async () =>
      ++calls < 3 ? { permissionEpoch: "0", privacyEpoch: "0" } : null;
    expect(
      await new MetricReadService(
        [registered.definition],
        [registered.query],
        revoked,
      ).runRegisteredQuery("pure", input, window),
    ).toEqual({ status: "denied" });
    const service = new MetricReadService([registered.definition], [registered.query], authority());
    await expect(
      service.runRegisteredQuery("pure", { ...input, inputHash: "tampered" }, window),
    ).rejects.toThrow();
    await expect(
      service.runRegisteredQuery("pure", input, { ...window, to: "2026-01-02T01:00:00.000Z" }),
    ).rejects.toThrow();
  });
  it("returns only evidence for incomplete costs or native source quality", async () => {
    const input = await fixture();
    input.costCompleteness = [];
    input.inputHash = await hashAssignedOutcomeInput(input);
    const registered = await createAssignedOutcomeQuery({
      id: "partial",
      sourceRefs: ["ledger"],
      limits,
    });
    const result = await new MetricReadService(
      [registered.definition],
      [registered.query],
      authority(),
    ).runRegisteredQuery("partial", input, window);
    expect(result.status).toBe("partial");
    expect(result).toHaveProperty("result.data.quality", "partial");
    expect(result).not.toHaveProperty("data");
  });
  it("rejects changed warehouse page epochs and total row exhaustion", async () => {
    const input = await fixture();
    for (const privacyEpoch of [0, 1]) {
      const load = createWarehouseAssignedOutcomeLoader({
        snapshot,
        pageSize: 1,
        quality,
        access: () => access,
        reader: {
          read: async () => ({
            snapshotId: "snapshot",
            rows: [rows[0]],
            nextCursor: "more",
            permissionEpoch: 0,
            privacyEpoch,
            exactness: "exact",
          }),
        },
      });
      const context = authority().currentContext();
      await expect(
        load({
          input: await emptyRequest(input),
          context: { ...context, budget: { ...limits, maxRows: 1 } },
          window,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow();
    }
  });
});
