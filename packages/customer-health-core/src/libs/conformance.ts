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
      {
        name: "isolates committed scores from input and result mutation",
        run: async () => {
          const store = await options.createStore();
          const submitted = scoreWithNestedSignal();

          assert.deepEqual(await store.saveTransition(submitted, null, []), { committed: true });
          assert.ok(submitted.transitionVersion);
          const committed = structuredClone(submitted);

          mutateScore(submitted);
          const latest = await store.findLatest("conformance-tenant");
          assert.deepEqual(latest, committed);
          assert.ok(latest);

          mutateScore(latest);
          const history = await store.findHistory("conformance-tenant", 1);
          assert.deepEqual(history, [committed]);
          assert.ok(history[0]);

          mutateScore(history[0]);
          const stalePrevious = {
            ...committed,
            transitionVersion: `${committed.transitionVersion}-stale`,
          };
          const conflict = await store.saveTransition(
            score(40, "critical", "2026-08-15T04:00:00.000Z"),
            stalePrevious,
            [],
          );
          assert.equal(conflict.committed, false);
          if (conflict.committed) assert.fail("Expected optimistic transition conflict");
          assert.deepEqual(conflict.latest, committed);
          assert.ok(conflict.latest);

          mutateScore(conflict.latest);
          const next = score(50, "healthy", "2026-08-15T05:00:00.000Z");
          assert.deepEqual(await store.saveTransition(next, committed, []), { committed: true });
          assert.ok(next.transitionVersion);
          assert.deepEqual(await store.findHistory("conformance-tenant", 2), [next, committed]);
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
    previousScore: undefined,
    calculatedAt: new Date(calculatedAt),
  };
}

function scoreWithNestedSignal(): TenantHealthScore {
  return {
    ...score(30, "at_risk", "2026-08-15T03:00:00.000Z"),
    categoryScores: { usage: 30, business: 20, engagement: 10 },
    signals: [
      {
        category: "usage",
        name: "nested-signal",
        value: 30,
        weight: 1,
        rawValue: { nested: { values: [1, { label: "preserved" }] } },
        collectedAt: new Date("2026-08-15T02:59:00.000Z"),
      },
    ],
  };
}

function mutateScore(value: TenantHealthScore): void {
  value.transitionVersion = "mutated";
  value.overallScore = -1;
  value.categoryScores.usage = -1;
  value.calculatedAt.setTime(0);

  const signal = value.signals[0];
  assert.ok(signal);
  signal.value = -1;
  signal.collectedAt.setTime(0);
  const rawValue = signal.rawValue as { nested: { values: [number, { label: string }] } };
  rawValue.nested.values[1].label = "mutated";
}
