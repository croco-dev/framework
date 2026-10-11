import { describe, it, expect, vi } from "vitest";
import {
  createRetentionWorkbenchSource,
  RetentionWorkbenchProblem,
} from "../libs/RetentionWorkbench";
import type {
  RetentionWorkbenchRequest,
  RetentionWorkbenchAdapter,
  RetentionSavedViewStore,
} from "../libs/RetentionWorkbench";
import type { BehaviorDefinition, BehaviorDataset } from "@croco/metrics-core";

const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const definition: BehaviorDefinition = {
  id: "saved",
  version: "1",
  subjectKind: "user",
  timezone: "UTC",
  actions: ["report.saved"],
  deletedSubjectPolicy: "exclude",
  historyStart: "2026-01-01T00:00:00Z",
};
const baseline = {
  kind: "calendar" as const,
  from: "2026-01-01T00:00:00Z",
  to: "2026-01-08T00:00:00Z",
};
const returning = { kind: "calendar" as const, from: baseline.to, to: "2026-01-15T00:00:00Z" };
const request: RetentionWorkbenchRequest = {
  definitionId: "saved",
  definitionVersion: "1",
  scope,
  subjectKind: "user",
  selections: [
    { id: "period", kind: "periodic", options: { baseline, returning } },
    { id: "cohort", kind: "cohort", options: { baseline, returning } },
    { id: "frequency", kind: "frequency", options: { window: baseline, measure: "activeDays" } },
  ],
};
const dataset: BehaviorDataset = {
  definitionId: "saved",
  version: "1",
  subjectKind: "user",
  timezone: "UTC",
  scope,
  knownHistoryFrom: baseline.from,
  completeThrough: returning.to,
  events: [
    ["private@example.com", "e1", baseline.from],
    ["private@example.com", "e2", returning.from],
    ["other@example.com", "e3", baseline.from],
  ].map(([subjectId, eventId, occurredAt]) => ({
    subjectId,
    eventId,
    occurredAt,
    scope,
    source: "reports",
    action: "report.saved",
  })),
};
function source(
  data = dataset,
  authorize = vi.fn<RetentionWorkbenchAdapter["authorize"]>(async () => true),
  savedViews?: RetentionSavedViewStore,
) {
  const read = vi.fn(async () => data);
  const subjectLabel = vi.fn<RetentionWorkbenchAdapter["subjectLabel"]>(async ({ subjectId }) =>
    subjectId === "private@example.com" ? "customer-1" : "customer-2",
  );
  return {
    subjectLabel,
    read,
    authorize,
    source: createRetentionWorkbenchSource({
      definitions: [definition],
      adapter: {
        authorize,
        read,
        subjectLabel,
      },
      savedViews,
      maxEvents: 10,
      maxPageSize: 1,
    }),
  };
}
async function token(api: ReturnType<typeof source>["source"], value = request) {
  const state = await api.load(value);
  if (!("snapshot" in state)) throw new Error("Expected snapshot");
  return state.snapshot.inputToken;
}
describe("RetentionWorkbench source", () => {
  it("uses pure calculations and only returns aggregates to the browser", async () => {
    const { source: api, read } = source();
    const state = await api.load(request);
    expect(state.kind).toBe("ready");
    if ("snapshot" in state) {
      expect(state.snapshot.cards[0]).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
      expect(state.snapshot.cards[2].buckets).toEqual([
        { frequency: 1, numerator: 2, denominator: 2, value: 1 },
      ]);
    }
    expect(JSON.stringify(state)).not.toMatch(/private@|other@|subjectId|eventId/);
    expect(read).toHaveBeenCalledWith({ definition, scope, limit: 11 });
    const first = await api.drilldown(request, {
      selectionId: "period",
      offset: 0,
      limit: 1,
      inputToken: await token(api),
    });
    const second = await api.drilldown(request, {
      selectionId: "period",
      offset: 1,
      limit: 1,
      inputToken: await token(api),
    });
    expect(first.nextOffset).toBe(1);
    expect(second.nextOffset).toBeNull();
    expect([...first.rows, ...second.rows].map((row) => row.reason).sort()).toEqual([
      "not-returned",
      "retained",
    ]);
    expect(JSON.stringify([first, second])).not.toContain("@");
  });
  it("checks scoped read, saved view and drilldown permissions before data access", async () => {
    const denied = source(
      dataset,
      vi.fn<RetentionWorkbenchAdapter["authorize"]>(async () => false),
    );
    expect(await denied.source.load(request)).toEqual({
      kind: "denied",
      code: "admin-core/retention-denied",
    });
    expect(denied.read).not.toHaveBeenCalled();
    const granted = source();
    const inputToken = await token(granted.source, { ...request, savedViewId: "saved-view" });
    granted.authorize.mockClear();
    await granted.source.drilldown(
      { ...request, savedViewId: "saved-view" },
      { selectionId: "cohort", offset: 0, limit: 1, inputToken },
    );
    expect(granted.authorize.mock.calls.map((call) => call[0])).toEqual(
      [
        "retention:read",
        "retention:drilldown",
        "retention:saved-view:read",
        "retention:read",
        "retention:drilldown",
        "retention:saved-view:read",
        "retention:read",
        "retention:drilldown",
        "retention:saved-view:read",
      ].map((permission) => ({
        scope,
        subjectKind: "user",
        savedViewId: "saved-view",
        permission,
      })),
    );
  });
  it("distinguishes provisional, insufficient, empty and provider failure", async () => {
    expect(
      (await source({ ...dataset, completeThrough: undefined }).source.load(request)).kind,
    ).toBe("provisional");
    expect(
      (await source({ ...dataset, knownHistoryFrom: undefined }).source.load(request)).kind,
    ).toBe("insufficient");
    expect((await source({ ...dataset, events: [] }).source.load(request)).kind).toBe("empty");
    const failed = source();
    failed.read.mockRejectedValueOnce(new Error("secret SQL and credentials"));
    expect(await failed.source.load(request)).toEqual({
      kind: "error",
      code: "admin-core/retention-source-failed",
    });
  });
  it("rejects missing tenant, mismatched scope, oversized rows and pages", async () => {
    const valid = source();
    expect((await valid.source.load({ ...request, scope: { ...scope, tenantId: "" } })).kind).toBe(
      "error",
    );
    expect(valid.read).not.toHaveBeenCalled();
    expect(
      await source({ ...dataset, scope: { ...scope, tenantId: "other" } }).source.load(request),
    ).toEqual({ kind: "error", code: "admin-core/retention-scope-mismatch" });
    expect(
      await source({
        ...dataset,
        events: Array.from({ length: 11 }, () => dataset.events[0]),
      }).source.load(request),
    ).toEqual({ kind: "error", code: "admin-core/retention-row-limit" });
    await expect(
      valid.source.drilldown(request, {
        selectionId: "period",
        offset: 0,
        limit: 2,
        inputToken: "a".repeat(64),
      }),
    ).rejects.toBeInstanceOf(RetentionWorkbenchProblem);
  });
  it("preserves metric validation codes and rejects drilldown access before reading or identifying subjects", async () => {
    const mismatched = source({ ...dataset, version: "wrong" });
    expect(await mismatched.source.load(request)).toEqual({
      kind: "error",
      code: "metrics-core/invalid-behavior-metric",
    });
    const denied = source(
      dataset,
      vi.fn<RetentionWorkbenchAdapter["authorize"]>(
        async ({ permission }) => permission !== "retention:drilldown",
      ),
    );
    await expect(
      denied.source.drilldown(request, {
        selectionId: "period",
        offset: 0,
        limit: 1,
        inputToken: "a".repeat(64),
      }),
    ).rejects.toBeInstanceOf(RetentionWorkbenchProblem);
    expect(denied.read).not.toHaveBeenCalled();
  });
  it("rejects data drift before drilldown and between pages", async () => {
    const current = source();
    const inputToken = await token(current.source);
    const page = { selectionId: "period", offset: 0, limit: 1, inputToken };
    expect(inputToken).toMatch(/^[a-f0-9]{64}$/);
    expect(await token(source({ ...dataset, events: [...dataset.events].reverse() }).source)).toBe(
      inputToken,
    );
    current.read.mockResolvedValueOnce({ ...dataset, events: dataset.events.slice(0, 1) });
    await expect(current.source.drilldown(request, page)).rejects.toMatchObject({
      code: "admin-core/retention-stale-input",
    });
    expect(current.subjectLabel).not.toHaveBeenCalled();
    const first = await current.source.drilldown(request, page);
    expect(first.inputToken).toBe(inputToken);
    current.read.mockResolvedValueOnce({ ...dataset, completeThrough: "2026-01-16T00:00:00Z" });
    await expect(current.source.drilldown(request, { ...page, offset: 1 })).rejects.toMatchObject({
      code: "admin-core/retention-stale-input",
    });
  });
  it("binds options, history and deleted subjects to the input token", async () => {
    const current = source();
    const inputToken = await token(current.source);
    for (const changed of [
      { ...dataset, knownHistoryFrom: "2025-12-01T00:00:00Z" },
      { ...dataset, deletedSubjectIds: ["private@example.com"] },
    ]) {
      current.read.mockResolvedValueOnce(changed);
      await expect(
        current.source.drilldown(request, {
          selectionId: "period",
          offset: 0,
          limit: 1,
          inputToken,
        }),
      ).rejects.toMatchObject({ code: "admin-core/retention-stale-input" });
    }
    await expect(
      current.source.drilldown(
        { ...request, selections: request.selections.slice(0, 1) },
        { selectionId: "period", offset: 0, limit: 1, inputToken },
      ),
    ).rejects.toMatchObject({ code: "admin-core/retention-stale-input" });
  });
  it("rejects malformed drilldown selections before adapter access", async () => {
    const current = source();
    const malformed = { ...request, selections: [null] } as unknown as RetentionWorkbenchRequest;
    await expect(
      current.source.drilldown(malformed, {
        selectionId: "period",
        offset: 0,
        limit: 1,
        inputToken: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "admin-core/retention-invalid-request" });
    expect(current.read).not.toHaveBeenCalled();
    expect(current.authorize).not.toHaveBeenCalled();
    expect(current.subjectLabel).not.toHaveBeenCalled();
  });
  it("keeps the authorized scope and page when the caller mutates inputs during a read", async () => {
    const current = source();
    const inputToken = await token(current.source);
    const mutableRequest = structuredClone(request);
    const mutablePage = { selectionId: "period", offset: 0, limit: 1, inputToken };
    current.read.mockImplementationOnce(async () => {
      mutableRequest.scope.tenantId = "unauthorized-tenant";
      mutableRequest.subjectKind = "different-subject-kind";
      mutablePage.offset = 1;
      return dataset;
    });
    const page = await current.source.drilldown(mutableRequest, mutablePage);
    expect(page.offset).toBe(0);
    expect(current.subjectLabel).toHaveBeenCalledWith({
      scope,
      subjectKind: "user",
      subjectId: "other@example.com",
    });
  });
});

describe("Retention saved views", () => {
  it("persists pinned aggregate evidence in the host repository and detects changed or corrupt inputs", async () => {
    let record: Awaited<ReturnType<ReturnType<typeof source>["source"]["save"]>> | undefined;
    const store: RetentionSavedViewStore = {
      read: vi.fn(async () => record),
      write: vi.fn(async (_scope, _kind, value) => {
        record = structuredClone(value);
      }),
    };
    const pinned = { ...dataset, sourceRef: "run-1" };
    const savedRequest = { ...request, sourceRef: "run-1" };
    const current = source(pinned, undefined, store);
    const inputToken = await token(current.source, savedRequest);
    const saved = await current.source.save(savedRequest, "weekly", inputToken);
    expect(saved.snapshot.inputToken).toBe(inputToken);
    expect(JSON.stringify(saved)).not.toMatch(/private@|subjectId|eventId/);
    expect(
      await source(pinned, undefined, store).source.readSaved(scope, "user", "weekly"),
    ).toEqual(saved);
    expect(store.write).toHaveBeenCalledWith(scope, "user", saved);
    if (record) {
      record.snapshot = Object.fromEntries(
        Object.entries(record.snapshot).reverse(),
      ) as typeof record.snapshot;
      Object.assign(record.request, { unexpectedPrivateData: "private@example.com" });
    }
    expect(await current.source.readSaved(scope, "user", "weekly")).toEqual(saved);

    await expect(
      source({ ...pinned, completeThrough: baseline.to }, undefined, store).source.readSaved(
        scope,
        "user",
        "weekly",
      ),
    ).rejects.toMatchObject({ reason: "stale-input" });
    await expect(
      current.source.readSaved({ ...scope, tenantId: "other" }, "user", "weekly"),
    ).rejects.toMatchObject({ reason: "invalid-request" });
    if (record) record.snapshot.cards = [];
    await expect(current.source.readSaved(scope, "user", "weekly")).rejects.toMatchObject({
      reason: "stale-input",
    });
  });
  it("requires save permission, an immutable source and the displayed token before persistence", async () => {
    const store = { read: vi.fn(async () => undefined), write: vi.fn(async () => undefined) };
    const denied = source(
      { ...dataset, sourceRef: "run-1" },
      vi.fn(async (input) => input.permission !== "retention:saved-view:write"),
      store,
    );
    await expect(
      denied.source.save({ ...request, sourceRef: "run-1" }, "weekly", "0".repeat(64)),
    ).rejects.toMatchObject({ reason: "denied" });
    const allowed = source({ ...dataset, sourceRef: "run-1" }, undefined, store);
    await expect(allowed.source.save(request, "weekly", "0".repeat(64))).rejects.toMatchObject({
      reason: "invalid-request",
    });
    await expect(
      allowed.source.save({ ...request, sourceRef: "run-1" }, "weekly", "0".repeat(64)),
    ).rejects.toMatchObject({ reason: "stale-input" });
    expect(store.write).not.toHaveBeenCalled();
  });
});
