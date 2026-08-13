import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
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
          supported: false,
          reason: "DrizzleHealthScoreStore accepts a direct Drizzle client and no TxManager.",
        },
        rollback: {
          supported: false,
          reason: "Rollback is owned by the app-level Drizzle transaction boundary.",
        },
      },
      tenantIsolation: {
        supported: true,
        checks: [
          {
            name: "loads the latest health score through the tenant-scoped lookup",
            run: async () => {
              const store = new DrizzleHealthScoreStore(
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
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null when no tenant health score exists",
              run: async () => {
                const store = new DrizzleHealthScoreStore(createSelectClient(new Map()));

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
