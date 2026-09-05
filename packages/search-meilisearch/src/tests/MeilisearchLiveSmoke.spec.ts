import { Context } from "@croco/framework-context";
import type { SearchHit } from "@croco/search-core";
import { describe, expect, it, vi } from "vitest";
import { MeilisearchDiagnosticsProvider } from "../libs/MeilisearchDiagnosticsProvider";
import { MeilisearchEngine } from "../libs/MeilisearchEngine";
import type { MeilisearchEngineOptions } from "../libs/types";

const MEILISEARCH_LIVE_ENV = ["MEILISEARCH_HOST", "MEILISEARCH_API_KEY"] as const;

const missingLiveSmokeEnv = MEILISEARCH_LIVE_ENV.filter((name) => !process.env[name]);

const liveConfig: MeilisearchEngineOptions = {
  apiKey: process.env.MEILISEARCH_API_KEY ?? "",
  host: process.env.MEILISEARCH_HOST ?? "",
  taskWait: {
    timeoutMs: 10_000,
  },
};

describe("Meilisearch live smoke", () => {
  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "requires MEILISEARCH_HOST and MEILISEARCH_API_KEY for live Meilisearch readiness and search smoke",
    async () => {
      const diagnostics = new MeilisearchDiagnosticsProvider(liveConfig, {
        readinessCheck: async ({ client }) => {
          await client.health();
          return {
            details: {
              reachable: true,
            },
          };
        },
      });
      const health = await diagnostics.getHealth();
      expect(health).toMatchObject({
        component: "search-meilisearch",
        details: expect.objectContaining({
          liveCheck: "passed",
        }),
        status: "healthy",
      });

      const tenantId = `tenant-${Date.now()}`;
      const indexName = `croco_live_smoke_${Date.now()}`;
      const tenantContext = vi.spyOn(Context, "getTenantId").mockReturnValue(tenantId);

      const engine = new MeilisearchEngine(liveConfig);

      try {
        await engine.createIndex({
          filterableFields: ["kind"],
          name: indexName,
          searchableFields: ["title"],
        });
        await engine.indexDocument(indexName, {
          id: "doc-1",
          kind: "smoke",
          tenantId,
          title: "Croco Meilisearch live smoke",
        });

        const result = await engine.search<{ id: string; title: string }>(indexName, {
          filters: { kind: "smoke" },
          query: "Croco",
        });

        expect(
          result.hits.some(
            (hit: SearchHit<{ id: string; title: string }>) => hit.document.id === "doc-1",
          ),
        ).toBe(true);
      } finally {
        tenantContext.mockRestore();
        await engine.deleteIndex(indexName, { allowGlobalDrop: true });
      }
    },
  );
});
