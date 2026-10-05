import { describe, expect, it, vi } from "vitest";
import {
  calculateActivationSource,
  importActivationSource,
  normalizeActivationRow,
  readActivationWarehouse,
  registerActivationQuery,
} from "../libs/activation/ActivationSources";
import { calculateActivationCandidates } from "../libs/activation/ActivationCandidates";
import { MetricReadService } from "../libs/read/MetricReadService";
import type { ActivationDefinition } from "../libs/activation/ActivationCandidates";
import type { ActivationColumnBinding } from "../libs/activation/ActivationSources";
import type {
  WarehousePage,
  WarehouseReadRequest,
  WarehouseReader,
} from "@croco/warehouse-core/runtime";
import type { SourceSchema } from "@croco/etl-core/source";
import type { MetricReadQuality, MetricReadContext } from "../libs/read/MetricReadService";

const definition: ActivationDefinition = {
  id: "activation",
  version: 1,
  subjectKind: "user",
  cohortPolicy: "new",
  timezone: "UTC",
  unit: "subjects",
  sourceRevisions: { events: "snapshot-1" },
  sourceRunRef: "run-1",
  minSupport: 0,
  maxRows: 100,
  maxCandidates: 10,
  windows: [{ id: "w", fromMs: 0, toMs: 1000 }],
  outcomeWindow: { fromMs: 1000, toMs: 2000 },
  candidates: [
    { id: "c", actionId: "report.created", windowId: "w", threshold: 1, countMode: "frequency" },
  ],
};
const binding: ActivationColumnBinding = {
  subjectId: "id",
  anchorAt: "anchor",
  cohort: "cohort",
  outcome: "retained",
  completeThrough: "through",
  actionCountsByWindow: { w: { "report.created": "count" } },
  activeDaysByWindow: {},
};
const flat = {
  id: "s1",
  anchor: "2026-01-01T00:00:00.000Z",
  cohort: "new",
  retained: "true",
  through: "2026-01-01T00:00:02.000Z",
  count: "2",
};
async function* source(rows: readonly Readonly<Record<string, unknown>>[] = [flat]) {
  yield* rows;
}
async function* bytes(value: string) {
  yield new TextEncoder().encode(value);
}
const schema: SourceSchema = {
  format: "csv",
  encoding: "utf-8",
  header: true,
  fields: Object.keys(flat).map((name) => ({ name, type: name === "count" ? "number" : "string" })),
  limits: { maxBytes: 10000, maxRecords: 100, maxRowBytes: 2000 },
};
const request: WarehouseReadRequest = {
  access: {
    scope: { application: "app", environment: "test", tenant: "one" },
    actor: "operator",
    roles: ["read"],
    columns: Object.keys(flat),
    permissionEpoch: 1,
    privacyEpoch: 2,
  },
  snapshotId: "snapshot-1",
  projection: Object.keys(flat),
  filters: [],
  order: [],
  maxRows: 1,
  maxBytes: 1000,
  timeoutMs: 1000,
};
const page = (overrides: Partial<WarehousePage> = {}): WarehousePage => ({
  snapshotId: "snapshot-1",
  rows: [flat],
  nextCursor: null,
  permissionEpoch: 1,
  privacyEpoch: 2,
  exactness: "exact",
  ...overrides,
});
const limits = { maxRows: 100, maxBytes: 10000, maxPages: 10 };
const quality: MetricReadQuality = {
  freshness: "fresh",
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
const budget = {
  maxWindowMs: 86400000,
  maxRows: 100,
  maxBytes: 10000,
  maxTimeMs: 1000,
  maxConcurrency: 1,
  maxCost: 100,
};
const context: MetricReadContext = {
  principal: { app: "app", environment: "test", tenant: "one", subject: "operator" },
  allowedFields: ["count"],
  allowRaw: false,
  budget,
  sourceRevisions: [{ sourceRef: "events", revision: "snapshot-1" }],
  snapshotRefs: ["snapshot-1"],
};

describe("activation shared sources", () => {
  it("uses the shared CSV and JSONL decoder with the same standalone denominators", async () => {
    const expected = calculateActivationCandidates(
      [normalizeActivationRow(flat, binding, definition)],
      definition,
    );
    const csv = `${Object.keys(flat).join(",")}\n${Object.values(flat).join(",")}\n`;
    expect((await importActivationSource(bytes(csv), schema, binding, definition)).report).toEqual(
      expected,
    );
    expect(
      (
        await importActivationSource(
          bytes(`${JSON.stringify(flat)}\n`),
          { ...schema, header: undefined, format: "jsonl" },
          binding,
          definition,
        )
      ).report,
    ).toEqual(expected);
  });
  it("propagates decoder errors and rejects semantic numeric errors rather than dropping rows", async () => {
    const csv = `${Object.keys(flat).join(",")}\n${Object.values({ ...flat, count: "oops" }).join(",")}\n`;
    await expect(importActivationSource(bytes(csv), schema, binding, definition)).rejects.toThrow();
    for (const count of ["1e2", "", "1.2", "9007199254740993", -1, undefined]) {
      expect(() => normalizeActivationRow({ ...flat, count }, binding, definition)).toThrow();
    }
  });
  it("retains missing count and null outcome as exclusions", async () => {
    const { report } = await calculateActivationSource(
      source([
        { ...flat, count: null },
        { ...flat, id: "s2", retained: null },
      ]),
      binding,
      definition,
    );
    expect(report.candidates[0]?.excluded).toMatchObject({ missingCount: 1, missingOutcome: 1 });
  });
  it("bounds source row accumulation and cancellation", async () => {
    await expect(
      calculateActivationSource(source([flat, { ...flat, id: "s2" }]), binding, {
        ...definition,
        maxRows: 1,
      }),
    ).rejects.toThrow();
    await expect(
      calculateActivationSource(source(), binding, definition, AbortSignal.abort()),
    ).rejects.toThrow();
  });
  it("preserves cancellation reasons before consuming source or import bytes", async () => {
    const reason = { code: "caller-cancelled" };
    const signal = AbortSignal.abort(reason);
    const next = vi.fn(async () => ({ done: true as const, value: undefined }));
    const unconsumed = { [Symbol.asyncIterator]: () => ({ next }) };
    await expect(calculateActivationSource(unconsumed, binding, definition, signal)).rejects.toBe(
      reason,
    );
    await expect(
      importActivationSource(unconsumed, schema, binding, definition, signal),
    ).rejects.toBe(reason);
    expect(next).not.toHaveBeenCalled();
  });
  it("preserves cancellation during source iteration", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Read deadline exceeded", "TimeoutError");
    async function* interrupted() {
      await Promise.resolve();
      controller.abort(reason);
      yield flat;
    }
    await expect(
      calculateActivationSource(interrupted(), binding, definition, controller.signal),
    ).rejects.toBe(reason);
  });
  it.each(["before", "during"] as const)(
    "preserves warehouse cancellation %s reading a page",
    async (when) => {
      const controller = new AbortController();
      const reason = { code: "warehouse-cancelled" };
      if (when === "before") controller.abort(reason);
      const read = vi.fn<WarehouseReader["read"]>(async () => {
        await Promise.resolve();
        controller.abort(reason);
        return page();
      });
      const iterator = readActivationWarehouse(
        { read },
        { ...request, signal: controller.signal },
        limits,
      )[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toBe(reason);
      expect(read).toHaveBeenCalledTimes(when === "before" ? 0 : 1);
    },
  );
  it.each(["before", "during"] as const)(
    "preserves executor cancellation %s awaiting source",
    async (when) => {
      const controller = new AbortController();
      const reason = new DOMException("Query deadline exceeded", "TimeoutError");
      const sourceRead = vi.fn(async () => {
        await Promise.resolve();
        controller.abort(reason);
        return { rows: [normalizeActivationRow(flat, binding, definition)], quality };
      });
      const registration = await registerActivationQuery({
        definition,
        source: sourceRead,
        requiredFields: [],
        limits: budget,
      });
      if (when === "before") controller.abort(reason);
      await expect(
        registration.query.readExecutor({
          input: null,
          window: { from: flat.anchor, to: "2026-01-02T00:00:00.000Z" },
          context,
          signal: controller.signal,
        }),
      ).rejects.toBe(reason);
      expect(sourceRead).toHaveBeenCalledTimes(when === "before" ? 0 : 1);
    },
  );
  it("keeps one snapshot through pages and feeds the actual calculator", async () => {
    const read = vi
      .fn<WarehouseReader["read"]>()
      .mockResolvedValueOnce(page({ nextCursor: "next" }))
      .mockResolvedValueOnce(page({ rows: [{ ...flat, id: "s2", count: "0" }] }));
    const { report } = await calculateActivationSource(
      readActivationWarehouse({ read }, request, limits),
      binding,
      definition,
    );
    expect(report.candidates[0]).toMatchObject({ DO: 1, RE: 1, NO: 1, eligibleN: 2 });
    expect(read.mock.calls[1]?.[0]).toMatchObject({ snapshotId: "snapshot-1", cursor: "next" });
  });
  it.each(["snapshot", "epoch", "repeat", "rows", "bytes", "pages"] as const)(
    "rejects invalid or unbounded warehouse %s",
    async (kind) => {
      const read = vi.fn<WarehouseReader["read"]>().mockResolvedValue(
        page({
          ...(kind === "snapshot" ? { snapshotId: "changed" } : {}),
          ...(kind === "epoch" ? { privacyEpoch: 3 } : {}),
          ...(kind === "repeat" || kind === "pages" ? { nextCursor: "repeated" } : {}),
        }),
      );
      const bounded = {
        maxRows: kind === "rows" ? 0 : 100,
        maxBytes: kind === "bytes" ? 1 : 10000,
        maxPages: kind === "pages" ? 1 : 10,
      };
      await expect(
        calculateActivationSource(
          readActivationWarehouse({ read }, request, bounded),
          binding,
          definition,
        ),
      ).rejects.toThrow();
    },
  );
  it("registers real calculation through the existing authorized metric runner", async () => {
    const sourceRead = vi
      .fn()
      .mockResolvedValue({ rows: [normalizeActivationRow(flat, binding, definition)], quality });
    const registration = await registerActivationQuery({
      definition,
      source: sourceRead,
      requiredFields: ["count"],
      limits: budget,
    });
    let denied = false;
    const service = new MetricReadService([registration.definition], [registration.query], {
      currentContext: () => context,
      authorize: async () => (denied ? null : { permissionEpoch: "1", privacyEpoch: "2" }),
    });
    const outcome = await service.runRegisteredQuery("activation", null, {
      from: flat.anchor,
      to: "2026-01-02T00:00:00.000Z",
    });
    expect(outcome.status).toBe("verified");
    if (outcome.status === "verified")
      expect(outcome.result.data).toEqual(
        calculateActivationCandidates(
          [normalizeActivationRow(flat, binding, definition)],
          definition,
        ),
      );
    denied = true;
    expect(
      (
        await service.runRegisteredQuery("activation", null, {
          from: flat.anchor,
          to: "2026-01-02T00:00:00.000Z",
        })
      ).status,
    ).toBe("denied");
    expect(sourceRead).toHaveBeenCalledTimes(1);
  });
  it("returns declared exclusions through the runner with accepted diagnostic codes", async () => {
    const registration = await registerActivationQuery({
      definition,
      source: async () => ({
        rows: [normalizeActivationRow({ ...flat, retained: null }, binding, definition)],
        quality,
      }),
      requiredFields: [],
      limits: budget,
    });
    const service = new MetricReadService([registration.definition], [registration.query], {
      currentContext: () => context,
      authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "2" }),
    });
    const result = await service.runRegisteredQuery("activation", null, {
      from: flat.anchor,
      to: "2026-01-02T00:00:00.000Z",
    });
    expect(result.status).toBe("verified");
    if (result.status === "verified")
      expect(result.result.diagnostics).toEqual(["activation-exclusions"]);
  });
  it("rejects malformed, mismatched and numerically inconsistent saved report data", async () => {
    const registration = await registerActivationQuery({
      definition,
      source: async () => ({ rows: [normalizeActivationRow(flat, binding, definition)], quality }),
      requiredFields: [],
      limits: budget,
    });
    const window = { from: flat.anchor, to: "2026-01-02T00:00:00.000Z" };
    const result = await registration.query.readExecutor({
      input: null,
      window,
      context,
      signal: new AbortController().signal,
    });
    const good = result.data as ReturnType<typeof calculateActivationCandidates>;
    for (const data of [
      { definition: null, candidates: null },
      { ...good, subjectIds: ["pii"] },
      { ...good, definition: { ...definition, unit: "other" } },
      { ...good, candidates: good.candidates.map((cell) => ({ ...cell, DO: -1 })) },
      {
        ...good,
        candidates: good.candidates.map((cell) => ({
          ...cell,
          precision: { value: 0.2, zeroDenominatorReason: null },
        })),
      },
      {
        ...good,
        candidates: good.candidates.map((cell) => ({
          ...cell,
          excluded: { ...cell.excluded, missingOutcome: 2 },
        })),
      },
      {
        ...good,
        candidates: good.candidates.map((cell) => ({
          ...cell,
          achievementCurve: {
            status: "available",
            points: [{ elapsedMs: 2000, achieved: 1, fraction: 1 }],
          },
        })),
      },
    ]) {
      expect(() => registration.query.outputSchema.parse(data)).toThrow();
      const service = new MetricReadService(
        [registration.definition],
        [registration.query],
        {
          currentContext: () => context,
          authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "2" }),
        },
        {
          readCandidates: async () => [
            {
              id: "saved",
              queryId: "activation",
              queryVersion: 1,
              inputKey: registration.query.inputKey(null),
              resultHash: "trusted-digest",
              result: { ...result, data },
              reviewed: {
                reviewerId: "reviewer",
                reviewedAt: "2026-01-02T12:00:00.000Z",
                definitionHash: registration.definition.hash,
                resultHash: "trusted-digest",
              },
              permissionEpoch: "1",
              privacyEpoch: "2",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          ],
          verify: async () => true,
        },
      );
      // Corrupt verified evidence fails explicitly instead of becoming a successful result.
      await expect(service.runRegisteredQuery("activation", null, window)).rejects.toThrow();
    }
    expect(registration.query.outputSchema.parse(good)).toEqual(good);
  });
  it("isolates registered declarations from returned reports and registration inputs", async () => {
    const input = structuredClone(definition);
    const requiredFields = ["count"];
    const inputLimits = { ...budget };
    const options = {
      definition: input,
      source: async () => ({ rows: [normalizeActivationRow(flat, binding, definition)], quality }),
      requiredFields,
      limits: inputLimits,
    };
    const registering = registerActivationQuery(options);
    Object.assign(input.candidates[0]!, { threshold: 9 });
    Object.assign(input.sourceRevisions, { events: "changed" });
    requiredFields.push("unexpected");
    inputLimits.maxRows = 1;
    const registration = await registering;
    const hash = registration.definition.hash;
    const execution = {
      input: null,
      window: { from: flat.anchor, to: "2026-01-02T00:00:00.000Z" },
      context,
      signal: new AbortController().signal,
    };
    const first = await registration.query.readExecutor(execution);
    const report = first.data as ReturnType<typeof calculateActivationCandidates>;
    expect(report.candidates[0]?.DO).toBe(1);
    Object.assign(report.definition.candidates[0]!, { threshold: 3 });
    Object.assign(report.candidates[0]!.candidate, { threshold: 4 });
    Object.assign(report.definition.sourceRevisions, { events: "changed-report" });
    Object.assign(first.definition, { hash: "changed-result-hash" });
    Object.assign(registration.definition, { hash: "changed-registration-hash" });
    const second = await registration.query.readExecutor(execution);
    expect(second.data).toEqual(
      calculateActivationCandidates(
        [normalizeActivationRow(flat, binding, definition)],
        definition,
      ),
    );
    expect(second.definition.hash).toBe(hash);
    expect(registration.query.inputKey(null)).toBe(hash);
    expect(second.fieldRefs).toEqual(["count"]);
    expect(registration.query.limits.maxRows).toBe(budget.maxRows);
    expect(() => registration.query.outputSchema.parse(second.data)).not.toThrow();
    expect(() => registration.query.outputSchema.parse(report)).toThrow();
  });
  it("does not promote source partial quality to complete", async () => {
    const registration = await registerActivationQuery({
      definition,
      source: async () => ({ rows: [], quality: { ...quality, temporalCompleteness: "partial" } }),
      requiredFields: [],
      limits: budget,
    });
    const service = new MetricReadService([registration.definition], [registration.query], {
      currentContext: () => context,
      authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "2" }),
    });
    expect(
      (
        await service.runRegisteredQuery("activation", null, {
          from: flat.anchor,
          to: "2026-01-02T00:00:00.000Z",
        })
      ).status,
    ).toBe("partial");
  });
});
