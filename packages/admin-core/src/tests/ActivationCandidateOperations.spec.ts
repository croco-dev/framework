import { calculateActivationCandidates } from "@croco/metrics-core";
import { describe, expect, it, vi } from "vitest";
import { ActivationCandidateOperations } from "../libs/ActivationCandidateOperations";
import type {
  ActivationAdminAccess,
  ActivationSavedReport,
} from "../libs/ActivationCandidateOperations";
import type { ActivationDefinition, ActivationRow } from "@croco/metrics-core";

const definition: ActivationDefinition = {
  id: "activation",
  version: 1,
  subjectKind: "user",
  cohortPolicy: "new",
  timezone: "UTC",
  unit: "subjects",
  sourceRevisions: { events: "v1" },
  sourceRunRef: "run-1",
  minSupport: 0,
  maxRows: 10,
  maxCandidates: 10,
  windows: [{ id: "first", fromMs: 0, toMs: 1000 }],
  outcomeWindow: { fromMs: 1000, toMs: 2000 },
  candidates: [
    { id: "publish", actionId: "publish", windowId: "first", threshold: 1, countMode: "frequency" },
  ],
};
const rows: ActivationRow[] = [
  {
    subjectId: "private-subject",
    anchorAt: "2026-01-01T00:00:00.000Z",
    cohort: "new",
    actionCountsByWindow: { first: { publish: 2 } },
    outcome: true,
    outcomeWindow: definition.outcomeWindow,
    completeThrough: "2026-01-01T00:00:02.000Z",
  },
];
const expectedReport = calculateActivationCandidates(rows, definition);
function fixture() {
  let access: ActivationAdminAccess = {
    scope: { app: "app", environment: "test", tenantId: "tenant", subjectKind: "user" },
    permissions: ["activation.read", "activation.report-write"],
  };
  let record: ActivationSavedReport | undefined;
  const loadInput = vi.fn(async () => ({ definition, rows }));
  const write = vi.fn(async (_scope, value: ActivationSavedReport) => {
    record = structuredClone(value);
  });
  const operations = new ActivationCandidateOperations({
    authenticate: async () => access,
    loadInput,
    store: { read: async () => record, write },
  });
  return {
    operations,
    write,
    loadInput,
    setAccess: (value: ActivationAdminAccess) => {
      access = value;
    },
    access: () => access,
    tamper: (change: (value: ActivationSavedReport) => ActivationSavedReport) => {
      if (record) record = change(record);
    },
  };
}
describe("ActivationCandidateOperations", () => {
  it.each(["app", "environment", "tenantId", "subjectKind"] as const)(
    "rejects omitted authenticated scope field %s before adapters",
    async (field) => {
      const f = fixture();
      const scope = { ...f.access().scope };
      Reflect.deleteProperty(scope, field);
      f.setAccess({ ...f.access(), scope });
      await expect(f.operations.load()).rejects.toThrow();
      await expect(f.operations.save("report", "publish", "new", expectedReport)).rejects.toThrow();
      expect(f.loadInput).not.toHaveBeenCalled();
      expect(f.write).not.toHaveBeenCalled();
    },
  );
  it("rejects unsupported authenticated subject kinds before adapters", async () => {
    const f = fixture();
    const scope = { ...f.access().scope };
    Reflect.set(scope, "subjectKind", "organization");
    f.setAccess({ ...f.access(), scope });
    await expect(f.operations.load()).rejects.toThrow();
    expect(f.loadInput).not.toHaveBeenCalled();
  });
  it("rejects an already aborted load and a stale viewed report before any write", async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(f.operations.load(controller.signal)).rejects.toThrow();
    expect(f.loadInput).not.toHaveBeenCalled();
    await expect(
      f.operations.save("report", "publish", "new", { ...expectedReport, rowCount: 999 }),
    ).rejects.toThrow();
    expect(f.write).not.toHaveBeenCalled();
  });
  it("calculates, persists, rereads and exports only aggregate data with immutable metadata", async () => {
    const { operations, loadInput } = fixture();
    const report = await operations.load();
    expect(report.candidates[0]?.precision.value).toBe(1);
    const saved = await operations.save("report", "publish", "new", expectedReport);
    expect(saved).toMatchObject({
      sourceRunRef: "run-1",
      selectedCandidateId: "publish",
      selectedCohort: "new",
    });
    expect(saved.definitionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await operations.read("report")).toEqual(saved);
    expect(JSON.parse(await operations.export("report"))).toEqual(saved);
    expect(JSON.stringify(saved)).not.toContain("private-subject");
    expect(loadInput).toHaveBeenCalledWith(saved.scope, "run-1", undefined);
  });
  it("accepts JSON storage that reorders object keys", async () => {
    const f = fixture();
    const saved = await f.operations.save("report", "publish", "new", expectedReport);
    f.tamper(
      (value) => Object.fromEntries(Object.entries(value).reverse()) as ActivationSavedReport,
    );
    expect(await f.operations.read("report")).toEqual(saved);
  });
  it("denies read and write before source or persistence access", async () => {
    const f = fixture();
    f.setAccess({ ...f.access(), permissions: [] });
    await expect(f.operations.load()).rejects.toThrow();
    await expect(f.operations.save("report", "publish", "new", expectedReport)).rejects.toThrow();
    expect(f.loadInput).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
  });
  it("rechecks revoked permission after awaiting source input", async () => {
    const f = fixture();
    f.loadInput.mockImplementationOnce(async () => {
      f.setAccess({ ...f.access(), permissions: ["activation.read"] });
      return { definition, rows };
    });
    await expect(f.operations.save("report", "publish", "new", expectedReport)).rejects.toThrow();
    expect(f.write).not.toHaveBeenCalled();
  });
  it.each(["scope", "report", "hash", "selection"] as const)(
    "rejects tampered %s on reread/export",
    async (field) => {
      const f = fixture();
      await f.operations.save("report", "publish", "new", expectedReport);
      f.tamper((value) =>
        field === "scope"
          ? { ...value, scope: { ...value.scope, tenantId: "other" } }
          : field === "report"
            ? { ...value, report: { ...value.report, rowCount: 800 } }
            : field === "hash"
              ? { ...value, inputHash: "changed" }
              : { ...value, selectedCohort: "returning" },
      );
      await expect(f.operations.read("report")).rejects.toThrow();
      await expect(f.operations.export("report")).rejects.toThrow();
    },
  );
  it("rejects source revision changes under a pinned run", async () => {
    const f = fixture();
    await f.operations.save("report", "publish", "new", expectedReport);
    f.loadInput.mockResolvedValue({
      definition: { ...definition, sourceRevisions: { events: "v2" } },
      rows,
    });
    await expect(f.operations.read("report")).rejects.toThrow();
  });
  it("rejects changed scope and foreign subject kind from the source", async () => {
    const f = fixture();
    f.loadInput.mockImplementationOnce(async () => {
      f.setAccess({ ...f.access(), scope: { ...f.access().scope, tenantId: "other" } });
      return { definition, rows };
    });
    await expect(f.operations.load()).rejects.toThrow();
    f.loadInput.mockResolvedValue({ definition: { ...definition, subjectKind: "account" }, rows });
    await expect(f.operations.load()).rejects.toThrow();
  });
});
