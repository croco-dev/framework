import * as assert from "node:assert/strict";
import type { HealthScoreStore } from "./interfaces";
import type { HealthStatus, TenantHealthScore } from "./types";

export type HealthScoreStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type HealthScoreStoreConformanceOptions = {
  readonly createStore: () => HealthScoreStore | Promise<HealthScoreStore>;
};

export type HealthScoreStoreConformanceSuite = {
  readonly cases: readonly HealthScoreStoreConformanceCase[];
};

export function createHealthScoreStoreConformanceSuite(
  options: HealthScoreStoreConformanceOptions,
): HealthScoreStoreConformanceSuite {
  return {
    cases: [
      {
        name: "returns transition history newest-first and keeps latest aligned",
        run: async () => {
          const store = await options.createStore();
          const scores = [
            score(10, "healthy", "2026-08-15T03:00:00.000Z"),
            score(20, "at_risk", "2026-08-15T01:00:00.000Z"),
            score(30, "critical", "2026-08-15T02:00:00.000Z"),
          ];
          await commitAll(store, scores);

          const history = await store.findHistory("conformance-tenant", scores.length);

          assert.deepEqual(
            history.map((entry) => entry.overallScore),
            [30, 20, 10],
          );
          assert.deepEqual(await store.findLatest("conformance-tenant"), history[0]);
        },
      },
      {
        name: "limits history to the newest transitions before ordering",
        run: async () => {
          const store = await options.createStore();
          const scores = [
            score(10, "healthy", "2026-08-15T01:00:00.000Z"),
            score(20, "healthy", "2026-08-15T02:00:00.000Z"),
            score(30, "at_risk", "2026-08-15T03:00:00.000Z"),
            score(40, "critical", "2026-08-15T04:00:00.000Z"),
          ];
          await commitAll(store, scores);

          const history = await store.findHistory("conformance-tenant", 2);

          assert.deepEqual(
            history.map((entry) => entry.overallScore),
            [40, 30],
          );
        },
      },
    ],
  };
}

async function commitAll(
  store: HealthScoreStore,
  scores: readonly TenantHealthScore[],
): Promise<void> {
  let previous: TenantHealthScore | null = null;
  for (const current of scores) {
    const result = await store.saveTransition(current, previous, []);
    assert.deepEqual(result, { committed: true });
    previous = current;
  }
}

function score(
  overallScore: number,
  status: HealthStatus,
  calculatedAt: string,
): TenantHealthScore {
  return {
    tenantId: "conformance-tenant",
    overallScore,
    status,
    categoryScores: { usage: overallScore, business: 0, engagement: 0 },
    signals: [],
    trend: "stable",
    calculatedAt: new Date(calculatedAt),
  };
}
