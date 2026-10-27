import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { PostgresExperienceStore } from "../index";
import type { ExperiencePgDatabase } from "../index";

describe("PostgresExperienceStore", () => {
  it("bounds scoped configuration reads and rejects a truncated candidate set", async () => {
    const dialect = new PgDialect();
    let queryText = "";
    let queryParams: unknown[] = [];
    const database: ExperiencePgDatabase = {
      execute: async (statement) => {
        const query = dialect.sqlToQuery(statement);
        queryText = query.sql;
        queryParams = query.params;
        return { rows: Array.from({ length: 101 }, () => ({ config: {} })) };
      },
      transaction: async () => {
        throw new Error("Unexpected transaction");
      },
    };
    const store = new PostgresExperienceStore(database);
    await expect(
      store.listPublishedConfigs(
        { appId: "shop", environment: "test", tenantId: "tenant-a" },
        "checkout.assurance",
      ),
    ).rejects.toThrow("Placement exceeds the configuration limit");
    expect(queryText).toContain("ORDER BY current_config.config_id");
    expect(queryText).toContain("LIMIT");
    expect(queryText).toContain("current_config.status = 'published'");
    expect(queryParams).toContain(101);
    expect(queryParams).toContain('["shop","test","tenant-a"]');
  });
  it.each([0, 101, 1.5, Number.NaN])(
    "rejects invalid history page size %s before querying",
    async (limit) => {
      const database: ExperiencePgDatabase = {
        execute: async () => {
          throw new Error("Unexpected query");
        },
        transaction: async () => {
          throw new Error("Unexpected transaction");
        },
      };
      await expect(
        new PostgresExperienceStore(database).listConfigs(
          { appId: "shop", environment: "test", tenantId: "tenant-a" },
          "checkout.assurance",
          { limit },
        ),
      ).rejects.toThrow("page size");
    },
  );
});
