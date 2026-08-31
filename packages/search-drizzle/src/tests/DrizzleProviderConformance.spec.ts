import { CasingCache } from "drizzle-orm/casing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { Context } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import {
  assertDrizzleProblem,
  createDrizzleProviderConformanceSuite,
} from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzleSearchEngine } from "../libs/DrizzleSearchEngine";
import { PGroongaStrategy } from "../libs/strategies/PGroongaStrategy";
import { PgSearchStrategy } from "../libs/strategies/PgSearchStrategy";
import { PgTrgmStrategy } from "../libs/strategies/PgTrgmStrategy";
import type { SearchStrategy } from "../libs/types";

type NodePgTransactionRunner = Parameters<NodePgDatabase<Record<string, never>>["transaction"]>[0];

vi.mock("@croco/framework-context", async () => {
  const actual = await vi.importActual("@croco/framework-context");
  return {
    ...actual,
    Context: {
      getTenantId: vi.fn(),
    },
  };
});

type SQLRenderable = {
  toQuery(config: {
    escapeName: (value: string) => string;
    escapeParam: () => string;
    escapeString: (value: string) => string;
    casing: CasingCache;
  }): { sql: string };
};

function renderSql(sql: unknown): string {
  return (sql as SQLRenderable).toQuery({
    escapeName: (value: string) => `"${value}"`,
    escapeParam: () => "$1",
    escapeString: (value: string) => `'${value}'`,
    casing: new CasingCache(),
  }).sql;
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

function createStrategy(overrides: Partial<SearchStrategy> = {}): SearchStrategy {
  const strategy = new PgSearchStrategy();

  return {
    buildSearchQuery: vi.fn(strategy.buildSearchQuery.bind(strategy)),
    buildIndexQuery: vi.fn(strategy.buildIndexQuery.bind(strategy)),
    buildDeleteQuery: vi.fn(strategy.buildDeleteQuery.bind(strategy)),
    checkCapability: vi.fn().mockResolvedValue(true),
    getCapabilities: vi.fn(strategy.getCapabilities.bind(strategy)),
    getRequiredExtensions: vi.fn(strategy.getRequiredExtensions.bind(strategy)),
    ...overrides,
  };
}

describe("search-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "search-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "documents caller-owned table requirements through strategy SQL",
            run: async () => {
              const strategy = new PgSearchStrategy();
              const indexSql = renderSql(
                strategy.buildIndexQuery(
                  "documents",
                  { id: "doc-1", tenantId: "tenant-a", title: "Croco" },
                  "tenant-a",
                ),
              );
              const deleteSql = renderSql(
                strategy.buildDeleteQuery("documents", "doc-1", "tenant-a"),
              );

              expect(indexSql).toContain('"id"');
              expect(indexSql).toContain('"tenant_id"');
              expect(deleteSql).toContain('"id" = $1');
              expect(deleteSql).toContain('"tenant_id" = $1');
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("search-drizzle")],
      },
      transaction: {
        participation: {
          supported: true,
          checks: [
            {
              name: "uses one driver transaction for every bulk index chunk",
              run: async () => {
                (Context.getTenantId as Mock).mockReturnValue("tenant-a");
                const capabilityExecute = vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 });
                const transactionExecute = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
                const transaction = vi.fn(async (run: NodePgTransactionRunner) =>
                  run({ execute: transactionExecute } as never),
                );
                const db = { execute: capabilityExecute, transaction } as unknown as NodePgDatabase<
                  Record<string, never>
                >;
                const engine = new DrizzleSearchEngine(db, new PgSearchStrategy());

                await engine.bulkIndex("documents", [
                  { id: "doc-1", tenantId: "tenant-a", title: "First" },
                  { id: "doc-2", tenantId: "tenant-a", title: "Second" },
                ]);

                expect(transaction).toHaveBeenCalledOnce();
                expect(transactionExecute).toHaveBeenCalledOnce();
              },
            },
          ],
        },
        rollback: {
          supported: true,
          checks: [
            {
              name: "leaves earlier bulk chunks uncommitted when a later chunk fails",
              run: async () => {
                (Context.getTenantId as Mock).mockReturnValue("tenant-a");
                const committedChunks: number[] = [];
                const capabilityExecute = vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 });
                const transaction = vi.fn(async (run: NodePgTransactionRunner) => {
                  const pendingChunks: number[] = [];
                  const transactionExecute = vi.fn(async () => {
                    if (pendingChunks.length === 1) {
                      throw new Error("second chunk failed");
                    }
                    pendingChunks.push(0);
                    return { rows: [], rowCount: 0 };
                  });

                  const result = await run({ execute: transactionExecute } as never);
                  committedChunks.push(...pendingChunks);
                  return result;
                });
                const db = { execute: capabilityExecute, transaction } as unknown as NodePgDatabase<
                  Record<string, never>
                >;
                const engine = new DrizzleSearchEngine(db, new PgSearchStrategy());

                await assertDrizzleProblem(
                  () =>
                    engine.bulkIndex(
                      "documents",
                      Array.from({ length: 101 }, (_, index) => ({
                        id: String(index),
                        tenantId: "tenant-a",
                      })),
                    ),
                  { code: "search-drizzle/bulk-index-chunk-failed", status: 500 },
                );

                expect(committedChunks).toEqual([]);
              },
            },
          ],
        },
      },
      tenantIsolation: {
        supported: true,
        checks: [
          {
            name: "passes the active tenant id into search strategy queries",
            run: async () => {
              (Context.getTenantId as Mock).mockReturnValue("tenant-a");
              const strategy = createStrategy();
              const db = {
                execute: vi
                  .fn()
                  .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                  .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 }),
              } as unknown as NodePgDatabase<Record<string, never>>;
              const engine = new DrizzleSearchEngine(db, strategy);

              await engine.search("documents", { query: "croco" });

              expect(strategy.buildSearchQuery).toHaveBeenCalledWith(
                "documents",
                { query: "croco" },
                "tenant-a",
              );
            },
          },
        ],
      },
      repositoryErrors: {
        notFound: {
          supported: false,
          reason: "Search misses are modeled as empty hit sets rather than not-found errors.",
        },
        validation: {
          supported: true,
          checks: [
            {
              name: "fails missing tenant context with a stable Problem code",
              run: async () => {
                (Context.getTenantId as Mock).mockReturnValue(null);
                const db = {
                  execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
                } as unknown as NodePgDatabase<Record<string, never>>;
                const engine = new DrizzleSearchEngine(db, createStrategy());

                await assertDrizzleProblem(() => engine.search("documents", { query: "croco" }), {
                  code: "MISSING_TENANT",
                  status: 400,
                });
              },
            },
          ],
        },
        duplicate: {
          supported: true,
          checks: [
            {
              name: "upserts repeated tenant-scoped documents across PostgreSQL strategies",
              run: async () => {
                const strategies = [
                  new PgSearchStrategy(),
                  new PgTrgmStrategy(),
                  new PGroongaStrategy(),
                ];

                for (const strategy of strategies) {
                  const replacementSql = renderSql(
                    strategy.buildIndexQuery(
                      "documents",
                      { id: "doc-1", tenantId: "tenant-a", title: "Newest" },
                      "tenant-a",
                    ),
                  );
                  const otherTenantSql = renderSql(
                    strategy.buildIndexQuery(
                      "documents",
                      { id: "doc-1", tenantId: "tenant-b", title: "Independent" },
                      "tenant-b",
                    ),
                  );

                  expect(replacementSql).toContain('ON CONFLICT ("tenant_id", "id")');
                  expect(replacementSql).toContain('"title" = EXCLUDED."title"');
                  expect(otherTenantSql).toContain('ON CONFLICT ("tenant_id", "id")');
                }
              },
            },
          ],
        },
        conflict: {
          supported: true,
          checks: [
            {
              name: "fails unsupported index creation with a stable Problem code",
              run: async () => {
                (Context.getTenantId as Mock).mockReturnValue("tenant-a");
                const db = {
                  execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
                } as unknown as NodePgDatabase<Record<string, never>>;
                const engine = new DrizzleSearchEngine(db, createStrategy());

                await assertDrizzleProblem(() => engine.createIndex({ name: "documents" }), {
                  code: "SEARCH_CAPABILITY_UNAVAILABLE",
                  status: 501,
                });
              },
            },
          ],
        },
        retryableFailure: {
          supported: true,
          checks: [
            {
              name: "normalizes unavailable search strategy checks to a stable Problem code",
              run: async () => {
                (Context.getTenantId as Mock).mockReturnValue("tenant-a");
                const db = {
                  execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
                } as unknown as NodePgDatabase<Record<string, never>>;
                const engine = new DrizzleSearchEngine(
                  db,
                  createStrategy({
                    checkCapability: vi.fn().mockResolvedValue(false),
                  }),
                );

                await assertDrizzleProblem(() => engine.search("documents", { query: "croco" }), {
                  code: "STRATEGY_UNAVAILABLE",
                  status: 500,
                });
              },
            },
          ],
        },
      },
    }).cases,
  )("$name", async ({ run }) => {
    await run();
  });
});
