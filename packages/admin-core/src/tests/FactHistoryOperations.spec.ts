import { describe, expect, it, vi } from "vitest";
import { FactHistoryService, FactHistoryProblem } from "@croco/analytics-core";
import type { FactHistoryStore, FactRow } from "@croco/analytics-core";
import { createFactHistoryOperations } from "../libs/FactHistoryOperations";
import { validateFactHistoryComparison } from "../libs/FactHistoryValidation";

const scope = { app: "app", environment: "test", tenantId: "tenant" };
const subject = { kind: "user" as const, id: "customer" };
const request = {
  scope,
  subject,
  definitionId: "verified",
  definitionVersion: "1",
  materializationRevision: "1",
  effectiveAt: "2026-09-25T09:00:00Z",
  knownAt: "2026-09-25T13:00:00Z",
  compareEffectiveAt: "2026-09-25T11:00:00Z",
  compareKnownAt: "2026-09-25T13:00:00Z",
  limit: 10,
};

function memoryStore(): FactHistoryStore {
  const rows: FactRow[] = [];
  let revision = 0;
  return {
    async appendFacts(input, recordedAt) {
      const added = input.rows.map((row) => ({
        ...row,
        id: `row-${rows.length + 1}`,
        scope: input.scope,
        source: input.source,
        sourceEventId: input.sourceEventId,
        recordedAt,
        correction: input.correction,
      }));
      rows.push(...added);
      revision++;
      return { rows: added, revision };
    },
    async readHistory() {
      return rows;
    },
    async getRevision() {
      return revision;
    },
    async deleteSubject() {
      rows.splice(0);
    },
  };
}

describe("Fact history operations", () => {
  it("uses canonical time evaluation and appends an audited correction", async () => {
    const authorize = vi.fn();
    const service = new FactHistoryService(
      memoryStore(),
      [{ id: "verified", version: "1", validate: (value) => typeof value === "boolean" }],
      { authorize, mask: (row) => row },
      () => new Date("2026-09-25T12:00:00Z"),
    );
    await service.appendFact({
      scope,
      source: "verification",
      sourceEventId: "event-1",
      sourceFingerprint: "hash",
      row: {
        subject,
        definitionId: "verified",
        definitionVersion: "1",
        projectionId: "verified",
        projectionRowKey: "verified",
        materializationRevision: "1",
        value: true,
        validFrom: "2026-09-25T11:00:00Z",
      },
    });
    const operations = createFactHistoryOperations(service, "operator");
    const state = await operations.compare(request);
    expect(state.kind).toBe("ready");
    if (!("snapshot" in state)) throw new Error("Expected snapshot");
    expect(state.snapshot.before.status).toBe("unknown");
    expect(state.snapshot.after.value).toBe("true");
    const correction = {
      ...request,
      rowId: state.snapshot.rows[0].id,
      value: false,
      validFrom: request.compareEffectiveAt,
      reason: "Fix verification",
      source: "manual",
      actor: "operator",
      expectedRevision: state.snapshot.revision,
      idempotencyKey: "correction-1",
    };
    await expect(operations.correct({ ...correction, actor: "spoof" })).rejects.toThrow();
    await expect(operations.correct(correction)).resolves.toMatchObject({
      auditId: "correction-1",
    });
    expect(await operations.compare(request)).toMatchObject({
      snapshot: { after: { value: "false" } },
    });
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ action: "correct", actor: "operator" }),
    );
  });
  it("rejects unbounded queries", () => {
    expect(() => validateFactHistoryComparison({ ...request, limit: 101 })).toThrow();
    expect(() => validateFactHistoryComparison({ ...request, knownAt: "invalid" })).toThrow();
  });
  it("rejects a comparison when the scope revision changes during its reads", async () => {
    const persistence = memoryStore();
    persistence.getRevision = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const service = new FactHistoryService(
      persistence,
      [{ id: "verified", version: "1", validate: () => true }],
      { authorize: () => {}, mask: (row) => row },
    );

    await expect(
      createFactHistoryOperations(service, "operator").compare(request),
    ).rejects.toMatchObject({
      code: "analytics/fact-history/revision-conflict",
    });
  });
  it("keeps denial and infrastructure failure distinct from empty history", async () => {
    const denied = new FactHistoryService(
      memoryStore(),
      [{ id: "verified", version: "1", validate: () => true }],
      {
        authorize: () => {
          throw new FactHistoryProblem("denied", "Denied");
        },
        mask: (row) => row,
      },
    );
    expect(await createFactHistoryOperations(denied, "operator").compare(request)).toEqual({
      kind: "denied",
      code: "analytics/fact-history/denied",
    });
    const store = memoryStore();
    const failure = new Error("database unavailable");
    store.readHistory = async () => {
      throw failure;
    };
    const broken = new FactHistoryService(
      store,
      [{ id: "verified", version: "1", validate: () => true }],
      { authorize: () => {}, mask: (row) => row },
    );
    await expect(createFactHistoryOperations(broken, "operator").compare(request)).rejects.toBe(
      failure,
    );
  });
  it("sends only masked display values and reports bounded history as partial", async () => {
    const service = new FactHistoryService(
      memoryStore(),
      [{ id: "verified", version: "1", validate: () => true }],
      { authorize: () => {}, mask: (row) => ({ ...row, value: "[masked]" }) },
      () => new Date("2026-09-25T12:00:00Z"),
    );
    for (const index of [1, 2])
      await service.appendFact({
        scope,
        source: "source",
        sourceEventId: `event-${index}`,
        sourceFingerprint: `hash-${index}`,
        row: {
          subject,
          definitionId: "verified",
          definitionVersion: "1",
          projectionId: "p",
          projectionRowKey: `row-${index}`,
          materializationRevision: "1",
          value: "private",
          validFrom: request.effectiveAt,
        },
      });
    const state = await createFactHistoryOperations(service, "operator").compare({
      ...request,
      limit: 1,
    });
    expect(state.kind).toBe("partial");
    expect(JSON.stringify(state)).not.toContain("private");
    if ("snapshot" in state) expect(state.snapshot.rows).toHaveLength(1);
  });
});
