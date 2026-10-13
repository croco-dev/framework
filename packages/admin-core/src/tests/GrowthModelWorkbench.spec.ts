import { describe, expect, it, vi } from "vitest";
import {
  createGrowthModelWorkbenchSource,
  GrowthWorkbenchProblem,
} from "../libs/GrowthModelWorkbench";
import type {
  GrowthWorkbenchRequest,
  GrowthReportRecord,
  GrowthReportStore,
} from "../libs/GrowthModelWorkbench";
import type { GrowthDataset } from "@croco/metrics-core";
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const request: GrowthWorkbenchRequest = {
  scope,
  sourceRevision: "run-1",
  model: {
    id: "adoption",
    version: "v1",
    unit: "users",
    period: "week",
    stateDefinitions: [
      { id: "new", label: "New", evidence: "No activation" },
      { id: "active", label: "Active", evidence: "Value action" },
    ],
    definitionCutoff: 0,
    transitionEstimationWindow: { from: 0, to: 1 },
    purpose: "Compare activation assumptions",
    assumptions: ["First order"],
  },
  scenario: {
    horizon: 2,
    initialPopulation: [100, 0],
    inflows: {
      unit: "users",
      label: "assumption",
      rationale: "No inflows",
      values: [
        [0, 0],
        [0, 0],
      ],
    },
    matrixOverrides: [],
  },
  backtest: {
    trainEnd: 1,
    testWindow: { from: 2, to: 2 },
    errorMetric: "MAE",
    inflows: {
      unit: "users",
      label: "assumption",
      rationale: "Known zero budget",
      values: [[0, 0]],
    },
  },
};
const data: GrowthDataset = {
  scope,
  sourceRevision: "run-1",
  unit: "users",
  period: "week",
  stateIds: ["new", "active"],
  partitionValidation: "aggregate-only",
  diagnostics: [],
  populations: [
    { period: 0, values: [10, 10], complete: true },
    { period: 1, values: [9, 11], complete: true },
    { period: 2, values: [8, 12], complete: true },
  ],
  transitions: [
    {
      from: 0,
      counts: [
        [8, 2],
        [1, 9],
      ],
      inflows: [0, 0],
      complete: true,
    },
  ],
};
const limits = { maxRows: 100, maxStates: 4, maxHorizon: 10 };
function host(
  options: { denied?: boolean; dataset?: GrowthDataset; store?: GrowthReportStore } = {},
) {
  const read = vi.fn(async () => structuredClone(options.dataset ?? data));
  const authorize = vi.fn(
    async (
      s: typeof scope,
      _permission: "growth:read" | "growth:report:read" | "growth:report:write",
    ) =>
      !options.denied &&
      s.appId === scope.appId &&
      s.environment === scope.environment &&
      s.tenantId === scope.tenantId,
  );
  const source = createGrowthModelWorkbenchSource({
    limits,
    adapter: { authorize, read, actor: async () => "operator-1" },
    ...(options.store ? { reports: options.store } : {}),
  });
  return { source, read, authorize };
}
describe("GrowthModelWorkbench source", () => {
  it("returns a stable Problem when a save request is missing", async () => {
    const { source } = host({
      store: {
        read: async () => undefined,
        append: async () => undefined,
      },
    });
    await expect(
      source.save(undefined as unknown as GrowthWorkbenchRequest, "report", 0, "hash"),
    ).rejects.toMatchObject({ reason: "invalid-request" });
  });
  it("rejects an unsafe next revision without overwriting a valid historical report", async () => {
    let record: GrowthReportRecord | undefined;
    const { source } = host({
      store: {
        read: async () => record,
        append: async (_scope, next) => {
          record = next;
        },
      },
    });
    const report = await source.calculate(request);
    record = await source.save(request, "report", 0, report.analysisHash);
    record.revision = Number.MAX_SAFE_INTEGER;
    const before = structuredClone(record);
    await expect(
      source.save(request, "report", Number.MAX_SAFE_INTEGER, report.analysisHash),
    ).rejects.toMatchObject({ reason: "invalid-request" });
    expect(record).toEqual(before);
  });
  it("calculates from bounded observed inputs, hashes reproducibly and returns only aggregates", async () => {
    const { source, read } = host();
    const a = await source.calculate(request),
      b = await source.calculate(structuredClone(request));
    expect(a).toEqual(b);
    expect(a.projection.populations[1]).toEqual([80, 20]);
    expect(a.partitionValidation).toBe("aggregate-only");
    expect(a.analysisHash).toMatch(/^[a-f0-9]{64}$/);
    expect(read.mock.calls.length).toBe(2);
    expect(JSON.stringify(a)).not.toContain("subjectId");
    const different = await source.calculate({
      ...request,
      scenario: { ...request.scenario, initialPopulation: [50, 0] },
    });
    expect(different.inputHash).toBe(a.inputHash);
    expect(different.analysisHash).not.toBe(a.analysisHash);
  });
  it("denies before reading, rejects absent tenants and cross-tenant provider responses", async () => {
    const denied = host({ denied: true });
    expect((await denied.source.load(request)).kind).toBe("denied");
    expect(denied.read).not.toHaveBeenCalled();
    await expect(
      host().source.calculate({ ...request, scope: { ...scope, tenantId: "" } }),
    ).rejects.toThrow();
    await expect(
      host({ dataset: { ...data, scope: { ...scope, tenantId: "other" } } }).source.calculate(
        request,
      ),
    ).rejects.toMatchObject({ reason: "scope-mismatch" });
  });
  it("rejects changed source revisions and revoked read permission after reading", async () => {
    await expect(
      host({ dataset: { ...data, sourceRevision: "run-2" } }).source.calculate(request),
    ).rejects.toMatchObject({ reason: "stale-input" });
    const { source, authorize } = host();
    authorize.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await source.load(request)).kind).toBe("denied");
  });
  it("does not convert unknown periods, empty estimates or provider failures into success zeros", async () => {
    const empty = host({ dataset: { ...data, transitions: [] } });
    expect((await empty.source.load(request)).kind).toBe("empty");
    const partial = host({
      dataset: {
        ...data,
        populations: data.populations.map((p) => (p.period === 1 ? { ...p, complete: false } : p)),
        transitions: [],
      },
    });
    expect((await partial.source.load(request)).kind).not.toBe("ready");
    const broken = host();
    broken.read.mockRejectedValueOnce(new TypeError("private provider detail"));
    expect(await broken.source.load(request)).toEqual({
      kind: "error",
      code: "admin-core/growth-source-failed",
    });
  });
  it("pins hashes and cutoff, preserves audited revisions and rejects stale saves and corrupt scope", async () => {
    const records: GrowthReportRecord[] = [];
    const store: GrowthReportStore = {
      read: async () => records.at(-1),
      append: async (_scope, record, expected) => {
        if ((records.at(-1)?.revision ?? 0) !== expected)
          throw new GrowthWorkbenchProblem("revision-conflict");
        records.push(structuredClone(record));
      },
    };
    const { source } = host({ store });
    const report = await source.calculate(request);
    await expect(source.save(request, "report", 0, "wrong-hash")).rejects.toMatchObject({
      reason: "stale-input",
    });
    const first = await source.save(request, "report", 0, report.analysisHash);
    expect(first).toMatchObject({ actor: "operator-1", revision: 1, previousAnalysisHash: null });
    expect(await source.readSaved(scope, "report")).toEqual(first);
    const nextRequest = {
      ...request,
      model: { ...request.model, version: "v2", purpose: "Revised decision" },
    };
    const next = await source.calculate(nextRequest);
    await expect(source.save(nextRequest, "report", 0, next.analysisHash)).rejects.toMatchObject({
      reason: "revision-conflict",
    });
    const second = await source.save(nextRequest, "report", 1, next.analysisHash);
    expect(second.previousAnalysisHash).toBe(first.report.analysisHash);
    expect(records[0]).toEqual(first);
    const invalid = records.at(-1);
    if (invalid) invalid.report.scope.tenantId = "other";
    await expect(source.readSaved(scope, "report")).rejects.toMatchObject({
      reason: "scope-mismatch",
    });
  });
  it("requires write authority, rejects mutation under the same model version and detects stored corruption", async () => {
    let saved: GrowthReportRecord | undefined;
    const store: GrowthReportStore = {
      read: async () => saved,
      append: async (_scope, record) => {
        saved = record;
      },
    };
    const { source, authorize } = host({ store });
    const report = await source.calculate(request);
    await source.save(request, "report", 0, report.analysisHash);
    const changed = { ...request, model: { ...request.model, purpose: "Changed without version" } };
    const changedReport = await source.calculate(changed);
    await expect(
      source.save(changed, "report", 1, changedReport.analysisHash),
    ).rejects.toMatchObject({ reason: "revision-conflict" });
    authorize.mockImplementation(
      async (_scope, permission) => permission !== "growth:report:write",
    );
    await expect(source.save(request, "report", 1, report.analysisHash)).rejects.toMatchObject({
      reason: "denied",
    });
    authorize.mockResolvedValue(true);
    if (saved) saved.report.projection.populations = [[100, 100]];
    await expect(source.readSaved(scope, "report")).rejects.toMatchObject({
      reason: "stale-input",
    });
  });
});
