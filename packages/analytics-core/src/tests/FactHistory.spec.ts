import { describe, expect, it, vi } from "vitest";
import { ProblemCategory } from "@croco/problems-core";
import {
  evaluateFactsAt,
  FactHistoryProblem,
  FactHistoryService,
  factProjectionKey,
} from "../index";
import type {
  FactDefinition,
  FactHistoryStore,
  FactProjection,
  FactRow,
  ReadFactsAtInput,
} from "../index";

const scope = { app: "shop", environment: "test", tenantId: "tenant-1" };
const subject = { kind: "user" as const, id: "user-1" };
const definition: FactDefinition = {
  id: "verified",
  version: "1",
  validate: (value) => typeof value === "boolean",
};
const time = (hour: number) => `2026-09-25T${hour.toString().padStart(2, "0")}:00:00Z`;
const projection: FactProjection = {
  subject,
  definitionId: "verified",
  definitionVersion: "1",
  projectionId: "customer",
  projectionRowKey: "verified",
  materializationRevision: "1",
  value: false,
  validFrom: time(9),
};
const row = (overrides: Partial<FactRow> = {}): FactRow => ({
  ...projection,
  id: "one",
  scope,
  source: "app",
  sourceEventId: "event-1",
  recordedAt: time(9),
  ...overrides,
});
const query = (overrides: Partial<ReadFactsAtInput> = {}) => ({
  scope,
  subject,
  definitionId: "verified",
  definitionVersion: "1",
  materializationRevision: "1",
  effectiveAt: time(11),
  knownAt: time(13),
  ...overrides,
});
function store(rows: readonly FactRow[] = []): FactHistoryStore {
  return {
    appendFacts: vi.fn(async () => ({ rows: [], revision: 1 })),
    readHistory: vi.fn(async () => rows),
    getRevision: vi.fn(async () => 1),
    deleteSubject: vi.fn(async () => undefined),
  };
}

describe("FactHistory", () => {
  it.each([
    ["source-conflict", ProblemCategory.Conflict],
    ["projection-conflict", ProblemCategory.Conflict],
    ["revision-conflict", ProblemCategory.Conflict],
    ["deleted", ProblemCategory.Gone],
    ["denied", ProblemCategory.Forbidden],
    ["persistence-failed", ProblemCategory.InternalServerError],
  ] as const)("maps %s to its HTTP category and retains cause", (code, category) => {
    const cause = new Error("original failure");
    const problem = new FactHistoryProblem(code, "Fact operation failed", cause);
    expect(problem.category).toBe(category);
    expect(problem.cause).toBe(cause);
  });
  it("converts schema validator exceptions to invalid-value and preserves their cause", async () => {
    const persistence = store();
    const cause = new Error("validator rejected shape");
    const service = new FactHistoryService(
      persistence,
      [
        {
          ...definition,
          validate: () => {
            throw cause;
          },
        },
      ],
      { authorize: () => undefined, mask: (value) => value },
    );
    await expect(
      service.appendFact({
        scope,
        source: "app",
        sourceEventId: "event",
        sourceFingerprint: "hash",
        row: projection,
      }),
    ).rejects.toMatchObject({
      code: "analytics/fact-history/invalid-value",
      category: ProblemCategory.ValidationError,
      cause,
    });
    expect(persistence.appendFacts).not.toHaveBeenCalled();
  });

  it("separates effective time from trusted receipt time and leaves absent history unknown", () => {
    const rows = [
      row({ validTo: time(11) }),
      row({
        id: "two",
        sourceEventId: "event-2",
        value: true,
        validFrom: time(11),
        recordedAt: time(12),
      }),
    ];
    expect(evaluateFactsAt(rows, query({ effectiveAt: time(10) }), definition).value).toBe(false);
    expect(evaluateFactsAt(rows, { ...query(), knownAt: time(11) }, definition).status).toBe(
      "unknown",
    );
    expect(evaluateFactsAt(rows, query(), definition).value).toBe(true);
    expect(evaluateFactsAt(rows, query({ effectiveAt: time(8) }), definition).status).toBe(
      "unknown",
    );
  });
  it("applies half-open timezone-aware intervals", () => {
    expect(
      evaluateFactsAt(
        [row({ validTo: time(11) })],
        query({ effectiveAt: "2026-09-25T20:00:00+09:00" }),
        definition,
      ).status,
    ).toBe("unknown");
  });
  it("reports contradictions, explicit source precedence, and corrections at known cutoff", () => {
    const rows = [
      row(),
      row({ id: "two", value: true, source: "verified-provider", recordedAt: time(12) }),
    ];
    expect(evaluateFactsAt(rows, query(), definition).status).toBe("conflict");
    expect(
      evaluateFactsAt(rows, query(), { ...definition, sourcePriority: ["verified-provider"] })
        .value,
    ).toBe(true);
    const corrected = [rows[0], { ...rows[1], supersedes: "one" }];
    expect(evaluateFactsAt(corrected, query(), definition).value).toBe(true);
    expect(evaluateFactsAt(corrected, { ...query(), knownAt: time(11) }, definition).value).toBe(
      false,
    );
  });
  it("selects one generation, subject kind and tenant", () => {
    const rows = [
      row(),
      row({ id: "new", materializationRevision: "2", value: true }),
      row({ id: "tenant", subject: { kind: "anonymous", id: subject.id }, value: true }),
      row({ id: "other", scope: { ...scope, tenantId: "other" }, value: true }),
    ];
    expect(evaluateFactsAt(rows, query(), definition).value).toBe(false);
    expect(evaluateFactsAt(rows, query({ materializationRevision: "2" }), definition).value).toBe(
      true,
    );
  });
  it("encodes projected identities without delimiter ambiguity", () => {
    expect(
      factProjectionKey({ ...projection, projectionId: "a:b", projectionRowKey: "c" }),
    ).not.toBe(factProjectionKey({ ...projection, projectionId: "a", projectionRowKey: "b:c" }));
  });
  it("validates the entire batch before atomic persistence and freezes clock once", async () => {
    const persistence = store();
    const clock = vi.fn(() => new Date(time(12)));
    const service = new FactHistoryService(
      persistence,
      [definition],
      { authorize: () => undefined, mask: (value) => value },
      clock,
    );
    const input = {
      scope,
      source: "app",
      sourceEventId: "evt",
      sourceFingerprint: "hash",
      rows: [projection, { ...projection, projectionRowKey: "second", value: "bad" }],
    };
    await expect(service.appendFacts(input)).rejects.toThrow(FactHistoryProblem);
    expect(persistence.appendFacts).not.toHaveBeenCalled();
    await expect(
      service.appendFacts({
        ...input,
        rows: [
          projection,
          { ...projection, projectionRowKey: "second", materializationRevision: "2" },
        ],
      }),
    ).rejects.toMatchObject({ code: "analytics/fact-history/invalid-input" });
    expect(persistence.appendFacts).not.toHaveBeenCalled();
    await service.appendFacts({
      ...input,
      rows: [projection, { ...projection, projectionRowKey: "second" }],
    });
    expect(persistence.appendFacts).toHaveBeenCalledOnce();
    expect(clock).toHaveBeenCalledOnce();
    expect(persistence.appendFacts).toHaveBeenCalledWith(
      expect.objectContaining({ rows: expect.any(Array) }),
      time(12).replace("Z", ".000Z"),
    );
  });
  it("denies access before storage and propagates storage failures", async () => {
    const persistence = store();
    const denied = new FactHistoryService(persistence, [definition], {
      authorize: () => {
        throw new FactHistoryProblem("denied", "Denied");
      },
      mask: (value) => value,
    });
    await expect(denied.readFactsAt(query())).rejects.toMatchObject({
      code: "analytics/fact-history/denied",
    });
    expect(persistence.readHistory).not.toHaveBeenCalled();
    const failure = new FactHistoryProblem("deleted", "Deleted");
    vi.mocked(persistence.readHistory).mockRejectedValue(failure);
    const service = new FactHistoryService(persistence, [definition], {
      authorize: () => undefined,
      mask: (value) => value,
    });
    await expect(service.readFactsAt(query())).rejects.toBe(failure);
  });
  it.each(["write", "correct"] as const)(
    "rejects a later fan-out row denied for %s before any row persists",
    async (action) => {
      const persistence = store();
      const authorize = vi.fn((request: { action: string; definitionId?: string }) => {
        if (request.action === action && request.definitionId === "restricted")
          throw new FactHistoryProblem("denied", "Field access denied");
      });
      const service = new FactHistoryService(
        persistence,
        [definition, { ...definition, id: "restricted" }],
        {
          authorize,
          mask: (value) => value,
        },
      );
      await expect(
        service.appendFacts({
          scope,
          source: "app",
          sourceEventId: "fan-out",
          sourceFingerprint: "hash",
          rows: [
            { ...projection, ...(action === "correct" ? { supersedes: "old-first" } : {}) },
            {
              ...projection,
              definitionId: "restricted",
              projectionRowKey: "restricted",
              ...(action === "correct" ? { supersedes: "old-second" } : {}),
            },
          ],
          ...(action === "correct"
            ? {
                correction: {
                  actor: "operator",
                  reason: "reviewed",
                  expectedRevision: 1,
                  idempotencyKey: "correction",
                },
              }
            : {}),
        }),
      ).rejects.toMatchObject({ code: "analytics/fact-history/denied" });
      expect(authorize).toHaveBeenCalledWith(
        expect.objectContaining({ action, definitionId: "restricted" }),
      );
      expect(persistence.appendFacts).not.toHaveBeenCalled();
    },
  );
  it("preserves conflict evidence when values are masked and bounds queries", async () => {
    const persistence = store([row(), row({ id: "two", value: true })]);
    const service = new FactHistoryService(persistence, [definition], {
      authorize: () => undefined,
      mask: (value) => ({ ...value, value: "***" }),
    });
    expect((await service.readFactsAt(query())).status).toBe("conflict");
    await expect(service.readHistory({ ...query(), limit: 1 })).rejects.toMatchObject({
      code: "analytics/fact-history/history-limit",
    });
  });
});
