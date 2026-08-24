import { describe, expect, it } from "vitest";
import {
  createHealthScoreStoreConformanceSuite,
  type HealthTransitionEventIntent,
  type TenantHealthScore,
} from "../index";
import { InMemoryHealthScoreStore } from "../libs/InMemoryHealthScoreStore";

describe("InMemoryHealthScoreStore", () => {
  const conformance = createHealthScoreStoreConformanceSuite({
    createStore: () => new InMemoryHealthScoreStore(),
  });

  for (const testCase of conformance.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, testCase.run);
  }

  it("rejects event identity reuse instead of committing a score without its intent", async () => {
    const store = new InMemoryHealthScoreStore();
    const first = score(90, "healthy", "2026-03-15T10:00:00Z");
    const second = score(50, "critical", "2026-03-15T11:00:00Z");
    const firstIntent = intent("event-1", first);
    const conflictingIntent = intent("event-1", second);

    await expect(store.saveTransition(first, null, [firstIntent])).resolves.toEqual({
      committed: true,
    });
    await expect(store.saveTransition(second, first, [conflictingIntent])).rejects.toMatchObject({
      code: "customer-health-core/event-intent-conflict",
    });

    expect(await store.findLatest("tenant-1")).toEqual(first);
    expect(await store.listPendingEventIntents("tenant-1")).toEqual([firstIntent]);
  });

  it("returns isolated snapshots from period history queries", async () => {
    const store = new InMemoryHealthScoreStore();
    const submitted = score(90, "healthy", "2026-03-15T10:00:00Z");
    submitted.signals = [
      {
        category: "usage",
        name: "nested-signal",
        value: 90,
        weight: 1,
        rawValue: { nested: { count: 9 } },
        collectedAt: new Date("2026-03-15T09:59:00Z"),
      },
    ];

    await expect(store.saveTransition(submitted, null, [])).resolves.toEqual({ committed: true });
    const committed = structuredClone(submitted);
    const history = await store.findHistoryByPeriod(
      "tenant-1",
      "day",
      new Date("2026-03-15T00:00:00Z"),
      new Date("2026-03-16T00:00:00Z"),
    );

    expect(history).toEqual([committed]);
    const result = history[0];
    if (result) {
      result.calculatedAt.setTime(0);
      result.categoryScores.usage = -1;
      result.signals[0]?.collectedAt.setTime(0);
      const rawValue = result.signals[0]?.rawValue as { nested: { count: number } } | undefined;
      if (rawValue) rawValue.nested.count = -1;
    }

    await expect(store.findLatest("tenant-1")).resolves.toEqual(committed);
  });

  it("does not assign or consume a transition version when snapshot creation fails", async () => {
    const store = new InMemoryHealthScoreStore();
    const uncloneable = score(90, "healthy", "2026-03-15T10:00:00Z");
    uncloneable.signals = [
      {
        category: "usage",
        name: "uncloneable-signal",
        value: 90,
        weight: 1,
        rawValue: () => "not cloneable",
        collectedAt: new Date("2026-03-15T09:59:00Z"),
      },
    ];

    await expect(store.saveTransition(uncloneable, null, [])).rejects.toThrow();
    expect(uncloneable.transitionVersion).toBeUndefined();
    await expect(store.findLatest("tenant-1")).resolves.toBeNull();
    await expect(store.listPendingEventIntents("tenant-1")).resolves.toEqual([]);

    const valid = score(80, "healthy", "2026-03-15T11:00:00Z");
    await expect(store.saveTransition(valid, null, [])).resolves.toEqual({ committed: true });
    expect(valid.transitionVersion).toBe("1");
  });
});

function score(
  overallScore: number,
  status: TenantHealthScore["status"],
  calculatedAt: string,
): TenantHealthScore {
  return {
    tenantId: "tenant-1",
    overallScore,
    status,
    categoryScores: { usage: overallScore, business: 0, engagement: 0 },
    signals: [],
    trend: "stable",
    calculatedAt: new Date(calculatedAt),
  };
}

function intent(eventId: string, value: TenantHealthScore): HealthTransitionEventIntent {
  return {
    eventId,
    tenantId: value.tenantId,
    occurredAt: value.calculatedAt,
    data: {
      kind: "status_changed",
      tenantId: value.tenantId,
      oldStatus: value.status === "healthy" ? "critical" : "healthy",
      newStatus: value.status,
      score: value.overallScore,
    },
  };
}
