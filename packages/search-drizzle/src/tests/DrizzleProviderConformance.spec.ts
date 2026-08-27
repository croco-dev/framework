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
import { PgSearchStrategy } from "../libs/strategies/PgSearchStrategy";
import type { SearchStrategy } from "../libs/types";

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
          supported: false,
          reason: "DrizzleSearchEngine accepts a direct Drizzle client and no TxManager.",
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
          supported: false,
          reason: "Document duplicate semantics are owned by the caller-managed search table.",
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
