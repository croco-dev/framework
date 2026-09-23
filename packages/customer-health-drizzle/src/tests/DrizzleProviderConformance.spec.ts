import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { TenantHealthScore } from "@croco/customer-health-core";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter, DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleHealthScoreStore } from "../libs/DrizzleHealthScoreStore";
import { tenantHealthEventIntents, tenantHealthScores } from "../libs/schema";

type DrizzleHealthClient = ConstructorParameters<typeof DrizzleHealthScoreStore>[0];

const createHealthScoreRow = (tenantId: string, overallScore: number) => ({
  transitionSequence: BigInt(overallScore),
  tenantId,
  overallScore,
  status: "healthy",
  categoryScores: {
    usage: 90,
    business: 95,
    engagement: 91,
  },
  signals: [],
  trend: "stable",
  previousScore: null,
  calculatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const createHealthScore = (tenantId: string, overallScore: number): TenantHealthScore => ({
  tenantId,
  overallScore,
  status: "healthy",
  categoryScores: {
    usage: overallScore,
    business: overallScore,
    engagement: overallScore,
  },
  signals: [],
  trend: "stable",
  calculatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

function collectSqlParamValues(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || !("queryChunks" in value)) {
    return [];
  }

  const queryChunks = value.queryChunks;
  if (!Array.isArray(queryChunks)) {
    return [];
  }

  return queryChunks.flatMap((chunk) => {
    const chunkValue =
      chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : undefined;

    if (chunkValue !== undefined && !Array.isArray(chunkValue)) {
      return [chunkValue];
    }

    return collectSqlParamValues(chunk);
  });
}

function createReadinessCheck(providerName: string) {
  return {
    name: "redacts database connection details from readiness failures",
    run: async () => {
      const detail = `failed postgres://${providerName}:provider-secret@db.example/app?password=query-secret token=raw-token`;
      const indicator = new DrizzleHealthIndicator(
        {
          transaction: vi
            .fn()
            .mockRejectedValue(
              ProblemFactory.internalServerError("testing/drizzle-readiness-failed", detail),
            ),
        } as never,
        { name: providerName },
      );
      const health = await indicator.check();
      const serialized = JSON.stringify(health);

      expect(health.status).toBe("down");
      expect(serialized).not.toContain("provider-secret");
      expect(serialized).not.toContain("query-secret");
      expect(serialized).not.toContain("raw-token");
      expect(health.details?.error).toBe(
        "failed postgres://[redacted]@db.example/app?password=[redacted] token=[redacted]",
      );
    },
  };
}

function createSelectClient(rowsByTenant: ReadonlyMap<string, unknown[]>): DrizzleHealthClient {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn((condition: unknown) => {
          const tenantId = collectSqlParamValues(condition).find(
            (param) => typeof param === "string",
          );

          return {
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rowsByTenant.get(String(tenantId)) ?? []),
            }),
          };
        }),
      }),
    }),
  } as unknown as DrizzleHealthClient;
}

function createRoundTripClient(): DrizzleHealthClient {
  let storedRows: unknown[] = [];
  let transactionRows: unknown[] | null = null;
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn(async () => transactionRows ?? storedRows),
        }),
      }),
    }),
  });
  const transactionClient = {
    execute: vi.fn().mockResolvedValue(undefined),
    select,
    insert: vi.fn().mockReturnValue({
      values: vi.fn((row: unknown) => {
        const nextRows = [{ transitionSequence: BigInt(1), ...(row as object) }];
        if (transactionRows) transactionRows = nextRows;
        else storedRows = nextRows;
        return {
          returning: vi.fn().mockResolvedValue([{ transitionSequence: BigInt(1) }]),
        };
      }),
    }),
  };

  return {
    transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) => {
      transactionRows = structuredClone(storedRows);
      try {
        const result = await callback(transactionClient);
        storedRows = transactionRows;
        return result;
      } finally {
        transactionRows = null;
      }
    }),
    select,
  } as unknown as DrizzleHealthClient;
}

function createStore(db: DrizzleHealthClient) {
  const txManager = new TxManager(createDrizzleTxAdapter(db));
  return {
    store: new DrizzleHealthScoreStore(db, txManager),
    txManager,
  };
}

describe("customer-health-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "customer-health-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares tenant health score history columns",
            run: async () => {
              const columns = getTableColumns(tenantHealthScores);

              expect(Object.keys(columns)).toEqual(
                expect.arrayContaining([
                  "tenantId",
                  "transitionSequence",
                  "overallScore",
                  "status",
                  "categoryScores",
                  "signals",
                  "trend",
                  "calculatedAt",
                ]),
              );
              expect(columns.overallScore.getSQLType()).toBe("double precision");
              expect(columns.previousScore.getSQLType()).toBe("double precision");
            },
          },
          {
            name: "declares durable health transition event intent columns",
            run: async () => {
              const columns = getTableColumns(tenantHealthEventIntents);

              expect(Object.keys(columns)).toEqual(
                expect.arrayContaining([
                  "eventId",
                  "tenantId",
                  "transitionSequence",
                  "intentOrder",
                  "occurredAt",
                  "data",
                  "publishedAt",
                  "createdAt",
                ]),
              );
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("customer-health-drizzle")],
      },
      transaction: {
        participation: {
          supported: true,
          checks: [
            {
              name: "uses the active transaction for the advisory lock and transition write",
              run: async () => {
                const db = createRoundTripClient();
                const { store, txManager } = createStore(db);

                await txManager.run(() =>
                  store.saveTransition(createHealthScore("tenant-active", 84), null, []),
                );

                expect(db.transaction).toHaveBeenCalledTimes(1);
              },
            },
          ],
        },
        rollback: {
          supported: true,
          checks: [
            {
              name: "rolls back a transition with its caller transaction",
              run: async () => {
                const db = createRoundTripClient();
                const { store, txManager } = createStore(db);
                const rollback = new Error("rollback");

                await expect(
                  txManager.run(async () => {
                    await store.saveTransition(createHealthScore("tenant-rollback", 73), null, []);
                    throw rollback;
                  }),
                ).rejects.toBe(rollback);
                await expect(store.findLatest("tenant-rollback")).resolves.toBeNull();
              },
            },
          ],
        },
      },
      tenantIsolation: {
        supported: true,
        checks: [
          {
            name: "loads the latest health score through the tenant-scoped lookup",
            run: async () => {
              const { store } = createStore(
                createSelectClient(
                  new Map([
                    ["tenant-a", [createHealthScoreRow("tenant-a", 92)]],
                    ["tenant-b", [createHealthScoreRow("tenant-b", 71)]],
                  ]),
                ),
              );

              const tenantAScore = await store.findLatest("tenant-a");
              const tenantBScore = await store.findLatest("tenant-b");

              expect(tenantAScore?.tenantId).toBe("tenant-a");
              expect(tenantAScore?.overallScore).toBe(92);
              expect(tenantBScore?.tenantId).toBe("tenant-b");
              expect(tenantBScore?.overallScore).toBe(71);
            },
          },
          {
            name: "round-trips fractional current and previous health scores without precision loss",
            run: async () => {
              const score: TenantHealthScore = {
                tenantId: "tenant-fractional",
                overallScore: 74.5,
                status: "at_risk",
                categoryScores: { usage: 74.5, business: 81.25, engagement: 68.75 },
                signals: [],
                trend: "declining",
                previousScore: 81.25,
                calculatedAt: new Date("2026-01-01T00:00:00.000Z"),
              };
              const { store } = createStore(createRoundTripClient());

              await store.saveTransition(score, null, []);
              const reloaded = await store.findLatest("tenant-fractional");

              expect(reloaded?.overallScore).toBe(74.5);
              expect(reloaded?.previousScore).toBe(81.25);
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null when no tenant health score exists",
              run: async () => {
                const { store } = createStore(createSelectClient(new Map()));

                await expect(store.findLatest("tenant-missing")).resolves.toBeNull();
              },
            },
          ],
        },
        validation: {
          supported: false,
          reason: "Health score validation is enforced by customer-health-core.",
        },
        duplicate: {
          supported: false,
          reason:
            "Health scores are append-only history entries and intentionally do not deduplicate.",
        },
        conflict: {
          supported: false,
          reason: "Health score history has no compare-and-set or mutable conflict boundary.",
        },
        retryableFailure: {
          supported: false,
          reason:
            "Retryable database failures are exposed through the app-level Drizzle health indicator.",
        },
      },
    }).cases,
  )("$name", async ({ run }) => {
    await run();
  });
});
