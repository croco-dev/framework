import type { HealthTransitionEventIntent, TenantHealthScore } from "@croco/customer-health-core";
import { describe, expect, it, vi } from "vitest";
import { DrizzleHealthScoreStore } from "../libs/DrizzleHealthScoreStore";
import type { DrizzleHealthClient } from "../libs/DrizzleHealthScoreStore";
import { tenantHealthScores } from "../libs/schema";

describe("DrizzleHealthScoreStore", () => {
  it("persists the score and transition intents in one transaction", async () => {
    const scoreReturning = vi.fn().mockResolvedValue([{ transitionSequence: BigInt(1) }]);
    const scoreValues = vi.fn().mockReturnValue({ returning: scoreReturning });
    const intentValues = vi.fn().mockResolvedValue(undefined);
    const transaction = createTransaction([], (table: unknown) => ({
      values: table === tenantHealthScores ? scoreValues : intentValues,
    }));
    const store = new DrizzleHealthScoreStore({ transaction } as unknown as DrizzleHealthClient);
    const score = createScore(50, "critical", "2026-03-15T11:00:00Z");
    const statusIntent: HealthTransitionEventIntent = {
      eventId: "event-1",
      tenantId: "tenant-1",
      occurredAt: score.calculatedAt,
      data: {
        kind: "status_changed",
        tenantId: "tenant-1",
        oldStatus: "healthy",
        newStatus: "critical",
        score: 50,
      },
    };
    const dropIntent: HealthTransitionEventIntent = {
      eventId: "event-2",
      tenantId: "tenant-1",
      occurredAt: score.calculatedAt,
      data: {
        kind: "score_dropped",
        tenantId: "tenant-1",
        previousScore: 90,
        currentScore: 50,
        dropPercentage: 44.44,
      },
    };

    const result = await store.saveTransition(score, null, [statusIntent, dropIntent]);

    expect(result).toEqual({ committed: true });
    expect(score.transitionVersion).toBe("1");
    expect(scoreValues).toHaveBeenCalledWith(score);
    expect(intentValues).toHaveBeenCalledWith([
      {
        eventId: "event-1",
        tenantId: "tenant-1",
        transitionSequence: BigInt(1),
        intentOrder: 0,
        occurredAt: score.calculatedAt,
        data: statusIntent.data,
      },
      {
        eventId: "event-2",
        tenantId: "tenant-1",
        transitionSequence: BigInt(1),
        intentOrder: 1,
        occurredAt: score.calculatedAt,
        data: dropIntent.data,
      },
    ]);
  });

  it("does not create an intent insert for a no-event transition", async () => {
    const returning = vi.fn().mockResolvedValue([{ transitionSequence: BigInt(1) }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const transaction = createTransaction([], insert);
    const store = new DrizzleHealthScoreStore({ transaction } as unknown as DrizzleHealthClient);

    const result = await store.saveTransition(
      createScore(85, "healthy", "2026-03-15T10:00:00Z"),
      null,
      [],
    );

    expect(result).toEqual({ committed: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(tenantHealthScores);
  });

  it("rejects a stale previous score before inserting a concurrent transition", async () => {
    const latest = createScore(70, "at_risk", "2026-03-15T11:00:00Z");
    latest.transitionVersion = "1";
    const stalePrevious = { ...latest, transitionVersion: "0" };
    const insert = vi.fn();
    let orderByExpression: unknown;
    const transaction = createTransaction(
      [{ ...latest, transitionSequence: BigInt(1) }],
      insert,
      (value) => {
        orderByExpression = value;
      },
    );
    const store = new DrizzleHealthScoreStore({ transaction } as unknown as DrizzleHealthClient);

    const result = await store.saveTransition(
      createScore(50, "critical", "2026-03-15T12:00:00Z"),
      stalePrevious,
      [],
    );

    expect(result).toEqual({ committed: false, latest });
    expect(insert).not.toHaveBeenCalled();
    expect(containsQueryChunk(orderByExpression, tenantHealthScores.transitionSequence)).toBe(true);
  });
});

function createTransaction(
  latestRows: readonly unknown[],
  insert: ReturnType<typeof vi.fn> | ((table: unknown) => unknown),
  onOrderBy?: (value: unknown) => void,
) {
  return vi.fn(async (run: (tx: DrizzleHealthClient) => Promise<unknown>) =>
    run({
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn((value: unknown) => {
              onOrderBy?.(value);
              return { limit: vi.fn().mockResolvedValue(latestRows) };
            }),
          }),
        }),
      }),
      insert,
    } as unknown as DrizzleHealthClient),
  );
}

function containsQueryChunk(value: unknown, target: unknown): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || !("queryChunks" in value)) return false;
  const queryChunks = value.queryChunks;
  return (
    Array.isArray(queryChunks) && queryChunks.some((chunk) => containsQueryChunk(chunk, target))
  );
}

function createScore(
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
