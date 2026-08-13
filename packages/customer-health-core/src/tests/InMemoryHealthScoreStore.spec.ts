import { describe, expect, it } from "vitest";
import type { HealthTransitionEventIntent, TenantHealthScore } from "../index";
import { InMemoryHealthScoreStore } from "../libs/InMemoryHealthScoreStore";

describe("InMemoryHealthScoreStore", () => {
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
