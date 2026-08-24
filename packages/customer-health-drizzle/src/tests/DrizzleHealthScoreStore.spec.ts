import {
  createHealthScoreStoreConformanceSuite,
  type HealthSignal,
  type HealthTransitionEventIntent,
  type TenantHealthScore,
} from "@croco/customer-health-core";
import { describe, expect, it, vi } from "vitest";
import { DrizzleHealthScoreStore } from "../libs/DrizzleHealthScoreStore";
import type { DrizzleHealthClient } from "../libs/DrizzleHealthScoreStore";
import { tenantHealthEventIntents, tenantHealthScores } from "../libs/schema";

describe("DrizzleHealthScoreStore", () => {
  const conformance = createHealthScoreStoreConformanceSuite({
    createStore: () => new DrizzleHealthScoreStore(createStatefulClient()),
  });

  for (const testCase of conformance.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, testCase.run);
  }

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

  it("loads pending intents in committed transition and declaration order", async () => {
    const orderBy = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ orderBy }),
        }),
      }),
    } as unknown as DrizzleHealthClient;
    const store = new DrizzleHealthScoreStore(db);

    await store.listPendingEventIntents("tenant-1");

    expect(orderBy).toHaveBeenCalledTimes(1);
    const ordering = orderBy.mock.calls[0];
    expect(ordering).toHaveLength(2);
    expect(containsQueryChunk(ordering?.[0], tenantHealthEventIntents.transitionSequence)).toBe(
      true,
    );
    expect(containsQueryChunk(ordering?.[1], tenantHealthEventIntents.intentOrder)).toBe(true);
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

function createStatefulClient(): DrizzleHealthClient {
  const rows: StatefulScoreRow[] = [];
  let transitionSequence = BigInt(0);
  const select = () => ({
    from: () => ({
      where: () => ({
        orderBy: (...ordering: unknown[]) => ({
          limit: (limit: number) => {
            const primaryOrdering = ordering[0];
            const transitionSequenceDescending =
              containsQueryChunk(primaryOrdering, tenantHealthScores.transitionSequence) &&
              containsQueryText(primaryOrdering, " desc");
            if (!transitionSequenceDescending) {
              throw new Error("Expected transition sequence descending order");
            }
            const ordered = structuredClone(rows);
            ordered.reverse();
            return Promise.resolve(ordered.slice(0, limit));
          },
        }),
      }),
    }),
  });
  const client = {
    select,
    execute: vi.fn().mockResolvedValue(undefined),
    insert: (table: unknown) => ({
      values: (value: TenantHealthScore) => {
        if (table !== tenantHealthScores) return Promise.resolve(undefined);
        return {
          returning: () => {
            transitionSequence += BigInt(1);
            rows.push({
              ...structuredClone(value),
              signals: serializeHealthSignals(value.signals),
              transitionSequence,
            });
            return Promise.resolve([{ transitionSequence }]);
          },
        };
      },
    }),
    transaction: async (run: (tx: DrizzleHealthClient) => Promise<unknown>) => run(client),
  } as unknown as DrizzleHealthClient;
  return client;
}

type StatefulScoreRow = Omit<TenantHealthScore, "signals"> & {
  signals: SerializedHealthSignal[];
  transitionSequence: bigint;
};

type SerializedHealthSignal = Omit<HealthSignal, "collectedAt"> & {
  collectedAt: string;
};

function serializeHealthSignals(signals: readonly HealthSignal[]): SerializedHealthSignal[] {
  return signals.map((signal) => ({
    ...signal,
    rawValue: serializeJsonValue(signal.rawValue),
    collectedAt: signal.collectedAt.toISOString(),
  }));
}

function serializeJsonValue(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? undefined : (JSON.parse(serialized) as unknown);
}

function containsQueryChunk(value: unknown, target: unknown): boolean {
  if (value === target) return true;
  if (!value || typeof value !== "object" || !("queryChunks" in value)) return false;
  const queryChunks = value.queryChunks;
  return (
    Array.isArray(queryChunks) && queryChunks.some((chunk) => containsQueryChunk(chunk, target))
  );
}

function containsQueryText(value: unknown, target: string): boolean {
  if (!value || typeof value !== "object") return false;
  if ("value" in value) {
    const content = value.value;
    if (Array.isArray(content) && content.some((part) => part === target)) return true;
  }
  if (!("queryChunks" in value)) return false;
  const queryChunks = value.queryChunks;
  return (
    Array.isArray(queryChunks) && queryChunks.some((chunk) => containsQueryText(chunk, target))
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
