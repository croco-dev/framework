import {
  compareAssignedOutcomes,
  hashAssignedOutcomeInput,
  hashAssignedOutcomeDefinition,
  ASSIGNED_OUTCOME_DEFINITION,
} from "@croco/metrics-core";
import type { AssignedOutcomeInput } from "@croco/metrics-core";
import { describe, expect, it, vi } from "vitest";
import { createNetOutcomeOperations } from "../libs/NetOutcomeOperations";
import type { NetOutcomeAuthority, NetOutcomeSource } from "../libs/NetOutcomeOperations";
const request = {
  cutoff: { effectiveAt: "2026-09-30T00:00:00Z", knownAt: "2026-10-01T00:00:00Z" },
  revision: "1",
};
const scope = { app: "app", environment: "test", tenant: "tenant" };
function fixture() {
  let epoch = "1";
  let allowed = true;
  const source: NetOutcomeSource = {
    read: vi.fn(async () => null),
    drilldown: vi.fn(async () => ({
      rows: [
        { kind: "payment", occurredAt: request.cutoff.effectiveAt, maskedReference: "[masked]" },
      ],
      truncated: false,
      assumptions: [],
    })),
  };
  const authority: NetOutcomeAuthority = {
    currentScope: () => scope,
    authorize: vi.fn(async () =>
      allowed ? { permissionEpoch: epoch, privacyEpoch: epoch } : null,
    ),
  };
  return {
    source,
    authority,
    operations: createNetOutcomeOperations(source, authority),
    revoke: () => {
      allowed = false;
    },
    changeEpoch: () => {
      epoch = "2";
    },
  };
}
async function input(): Promise<AssignedOutcomeInput> {
  const result: AssignedOutcomeInput = {
    assignmentSnapshot: {
      id: "snapshot",
      scope,
      unit: "person",
      arms: ["control"],
      assignments: [{ subject: "private-person", arm: "control" }],
    },
    events: [],
    cutoff: request.cutoff,
    revision: request.revision,
    metricDefinitionVersion: ASSIGNED_OUTCOME_DEFINITION.version,
    definitionHash: await hashAssignedOutcomeDefinition(),
    inputHash: "",
    currencies: ["USD"],
    sources: ["ledger"],
    baselineArm: "control",
    costCompleteness: [],
  };
  result.inputHash = await hashAssignedOutcomeInput(result);
  return result;
}
describe("NetOutcomeOperations", () => {
  it("removes unknown sensitive properties from raw cutoff and cost completeness", async () => {
    const f = fixture();
    const raw = await input();
    const privateCutoffFields = { privateNote: "cutoff-secret" };
    const privateCostFields = { privateNote: "cost-secret" };
    raw.cutoff = { ...request.cutoff, ...privateCutoffFields };
    raw.costCompleteness = [
      {
        arm: "control",
        source: "ledger",
        kind: "cashback",
        currency: "USD",
        status: "pending",
        pendingCount: 1,
        ...privateCostFields,
      },
    ];
    raw.inputHash = await hashAssignedOutcomeInput(raw);
    f.source.read = async () => raw;
    const state = await f.operations.read(request);
    expect(state.kind).toBe("partial");
    if (state.kind !== "partial") throw new Error("Expected partial outcome");
    expect(state.snapshot.cutoff).toEqual(request.cutoff);
    expect(state.snapshot.costCompleteness).toEqual([
      {
        arm: "control",
        source: "ledger",
        kind: "cashback",
        currency: "USD",
        status: "pending",
        pendingCount: 1,
      },
    ]);
    expect(JSON.stringify(state)).not.toContain("secret");
  });

  it("preserves authoritative partial report totals without recalculating events", async () => {
    const f = fixture();
    const raw = await input();
    raw.events = [
      {
        scope,
        source: "ledger",
        eventId: "payment-1",
        subject: "private-person",
        kind: "payment",
        amountMinor: "9007199254740993",
        currency: "USD",
        occurredAt: request.cutoff.effectiveAt,
        observedAt: request.cutoff.knownAt,
        valuationKind: "cash",
      },
    ];
    raw.inputHash = await hashAssignedOutcomeInput(raw);
    const report = compareAssignedOutcomes(raw);
    f.source.read = async () => report;
    const state = await f.operations.read(request);
    expect(state.kind).toBe("partial");
    if (state.kind !== "partial") throw new Error("Expected partial outcome");
    expect(state.snapshot.byCurrency).toEqual(report.byCurrency);
    expect(state.snapshot.byCurrency[0].arms[0].netMinor).toBe("9007199254740993");
    expect(state.snapshot.quality).toBe(report.quality);
    expect(JSON.stringify(state)).not.toContain("private-person");
  });

  it.each([
    { name: "empty sources", sources: [], costSource: "ledger" },
    { name: "duplicate sources", sources: ["ledger", "ledger"], costSource: "ledger" },
    {
      name: "too many sources",
      sources: Array.from({ length: 101 }, (_, index) => `source-${index}`),
      costSource: "source-0",
    },
    { name: "undeclared cost source", sources: ["ledger"], costSource: "other-ledger" },
  ])(
    "rejects authoritative reports with $name for read and export",
    async ({ sources, costSource }) => {
      const f = fixture();
      const raw = await input();
      const report = compareAssignedOutcomes(raw);
      raw.sources = sources;
      raw.costCompleteness = [
        {
          arm: "control",
          source: costSource,
          kind: "cashback",
          currency: "USD",
          status: "pending",
          pendingCount: 1,
        },
      ];
      raw.inputHash = await hashAssignedOutcomeInput(raw);
      report.sources = raw.sources;
      report.costCompleteness = raw.costCompleteness;
      report.inputHash = raw.inputHash;
      f.source.read = async () => report;
      for (const action of ["read", "export"] as const) {
        await expect(f.operations[action](request)).rejects.toMatchObject({
          code: "admin/net-outcome/source-mismatch",
        });
      }
    },
  );

  it("rejects an authoritative report with a different definition hash", async () => {
    const f = fixture();
    const report = compareAssignedOutcomes(await input());
    report.definitionHash = "wrong-definition";
    f.source.read = async () => report;
    await expect(f.operations.read(request)).rejects.toMatchObject({
      code: "metrics-core/invalid-outcome",
      reason: "invalid_report_provenance",
    });
  });

  it("rejects an authoritative report with malformed totals", async () => {
    const f = fixture();
    const report = compareAssignedOutcomes(await input());
    report.byCurrency[0].arms[0].netMinor = "not-money";
    f.source.read = async () => report;
    await expect(f.operations.read(request)).rejects.toMatchObject({
      code: "metrics-core/invalid-outcome",
    });
  });

  it.each(["permissionEpoch", "privacyEpoch"] as const)(
    "denies an empty %s before reading the source",
    async (field) => {
      const f = fixture();
      f.authority.authorize = async () => ({
        permissionEpoch: "1",
        privacyEpoch: "1",
        [field]: "",
      });
      await expect(f.operations.read(request)).resolves.toMatchObject({ kind: "denied" });
      expect(f.source.read).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized request revision before reading the source", async () => {
    const f = fixture();
    await expect(
      f.operations.read({ ...request, revision: "r".repeat(1025) }),
    ).rejects.toMatchObject({
      code: "admin/net-outcome/invalid-request",
    });
    expect(f.source.read).not.toHaveBeenCalled();
  });

  it("discards an authoritative partial report when permission is revoked during the read", async () => {
    const f = fixture();
    const report = compareAssignedOutcomes(await input());
    f.source.read = async () => {
      f.revoke();
      return report;
    };
    await expect(f.operations.read(request)).resolves.toEqual({
      kind: "denied",
      code: "admin/net-outcome/denied",
    });
  });

  it("checks separate read, export and drilldown permissions on every call", async () => {
    const f = fixture();
    await expect(f.operations.read(request)).resolves.toEqual({ kind: "empty" });
    await f.operations.export(request);
    await f.operations.drilldown({
      ...request,
      arm: "a",
      currency: "USD",
      source: "ledger",
      limit: 1,
    });
    expect(f.authority.authorize).toHaveBeenCalledWith("read", scope);
    expect(f.authority.authorize).toHaveBeenCalledWith("export", scope);
    expect(f.authority.authorize).toHaveBeenCalledWith("drilldown", scope);
    f.revoke();
    await expect(f.operations.read(request)).resolves.toMatchObject({ kind: "denied" });
    await expect(f.operations.export(request)).resolves.toMatchObject({ kind: "denied" });
    await expect(
      f.operations.drilldown({ ...request, arm: "a", currency: "USD", source: "ledger", limit: 1 }),
    ).rejects.toMatchObject({ code: "admin/net-outcome/denied" });
    expect(f.source.read).toHaveBeenCalledTimes(2);
  });
  it("suppresses a result when epochs change in flight", async () => {
    const f = fixture();
    f.source.read = async () => {
      f.changeEpoch();
      return null;
    };
    await expect(f.operations.read(request)).resolves.toMatchObject({ kind: "denied" });
  });
  it("rejects oversized pages and invalid bounds", async () => {
    const f = fixture();
    const drilldown = { ...request, arm: "a", currency: "USD", source: "ledger", limit: 101 };
    await expect(f.operations.drilldown(drilldown)).rejects.toMatchObject({
      code: "admin/net-outcome/invalid-drilldown",
    });
    f.source.drilldown = async () => ({
      rows: Array.from({ length: 2 }, () => ({
        kind: "payment",
        occurredAt: "now",
        maskedReference: "[masked]",
      })),
      truncated: false,
      assumptions: [],
    });
    await expect(f.operations.drilldown({ ...drilldown, limit: 1 })).rejects.toMatchObject({
      code: "admin/net-outcome/page-bound-exceeded",
    });
  });
  it("returns only sanitized assigned totals and validates input provenance", async () => {
    const f = fixture();
    const raw = await input();
    f.source.read = async () => raw;
    const state = await f.operations.read(request);
    expect(state.kind).toBe("partial");
    expect(JSON.stringify(state)).not.toContain("private-person");
    expect(JSON.stringify(state)).not.toContain("assignments");
    raw.inputHash = "tampered";
    await expect(f.operations.read(request)).rejects.toMatchObject({
      code: "admin/net-outcome/input-hash-mismatch",
    });
  });
  it("rejects cross-scope source data and absent trusted tenant", async () => {
    const f = fixture();
    const raw = await input();
    raw.assignmentSnapshot.scope = { ...scope, tenant: "other" };
    raw.inputHash = await hashAssignedOutcomeInput(raw);
    f.source.read = async () => raw;
    await expect(f.operations.read(request)).rejects.toMatchObject({
      code: "admin/net-outcome/source-mismatch",
    });
    f.authority.currentScope = () => ({ ...scope, tenant: "" });
    await expect(f.operations.read(request)).resolves.toMatchObject({ kind: "denied" });
  });
  it("copies request arguments before authorization can yield", async () => {
    const f = fixture();
    const selected = structuredClone(request);
    const read = f.operations.read(selected);
    selected.revision = "mutated";
    await read;
    expect(f.source.read).toHaveBeenCalledWith(request, scope);
  });
});
