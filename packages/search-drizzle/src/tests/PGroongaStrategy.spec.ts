import { CasingCache } from "drizzle-orm/casing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PGroongaStrategy } from "../libs/strategies/PGroongaStrategy";

const mockDb = {
  execute: vi.fn(),
} as unknown as NodePgDatabase<Record<string, never>>;

describe("PGroongaStrategy", () => {
  let strategy!: PGroongaStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new PGroongaStrategy();
  });

  describe("buildSearchQuery", () => {
    it("should build correct search query", () => {
      const query = { query: "test query" };
      const plan = strategy.buildSearchQuery("users", query, "tenant-123");
      const sqlString = plan.rows.toQuery({
        escapeName: (x: string) => `"${x}"`,
        escapeParam: () => "$1",
        escapeString: (x: string) => `'${x}'`,
        casing: new CasingCache(),
      }).sql;

      expect(sqlString).toContain(
        'SELECT *, pgroonga_score(tableoid, ctid) AS "__croco_search_score"',
      );
      expect(sqlString).toContain('FROM "users"');
      expect(sqlString).toContain('"search_vector" &@~ $1');
      expect(sqlString).toContain('"tenant_id" = $1');
      expect(sqlString).toContain("ORDER BY pgroonga_score(tableoid, ctid) DESC");
      expect(sqlString).not.toContain("ORDER BY score DESC");

      const totalSqlString = plan.total.toQuery({
        escapeName: (x: string) => `"${x}"`,
        escapeParam: () => "$1",
        escapeString: (x: string) => `'${x}'`,
        casing: new CasingCache(),
      }).sql;

      expect(totalSqlString).toContain("SELECT COUNT(*)::double precision AS total");
      expect(totalSqlString).toContain('FROM "users"');
      expect(totalSqlString).toContain('"search_vector" &@~ $1');
      expect(totalSqlString).toContain('"tenant_id" = $1');
      expect(totalSqlString).not.toContain("ORDER BY");
    });
  });

  describe("buildIndexQuery", () => {
    it("should build correct index query", () => {
      const document = { id: "doc-1", title: "Hello World", tenantId: "tenant-123" };
      const sqlObj = strategy.buildIndexQuery("users", document, "tenant-123");

      const sqlString = sqlObj.toQuery({
        escapeName: (x: string) => `"${x}"`,
        escapeParam: () => "$1",
        escapeString: (x: string) => `'${x}'`,
        casing: new CasingCache(),
      }).sql;

      expect(sqlString).toContain('INSERT INTO "users"');
      expect(sqlString).toContain('"id"');
      expect(sqlString).toContain('"title"');
      expect(sqlString).toContain('"tenant_id"');
    });
  });

  describe("buildDeleteQuery", () => {
    it("should build correct delete query", () => {
      const sqlObj = strategy.buildDeleteQuery("users", "doc-1", "tenant-123");
      const sqlString = sqlObj.toQuery({
        escapeName: (x: string) => `"${x}"`,
        escapeParam: () => "$1",
        escapeString: (x: string) => `'${x}'`,
        casing: new CasingCache(),
      }).sql;

      expect(sqlString).toContain('DELETE FROM "users"');
      expect(sqlString).toContain('"id" = $1');
      expect(sqlString).toContain('"tenant_id" = $1');
    });
  });

  describe("getRequiredExtensions", () => {
    it("should return pgroonga", () => {
      expect(strategy.getRequiredExtensions()).toEqual(["pgroonga"]);
    });
  });

  describe("checkCapability", () => {
    it("should return true if extension exists", async () => {
      (mockDb.execute as Mock).mockResolvedValue({ rows: [{ 1: 1 }] });

      const result = await strategy.checkCapability(mockDb);
      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it("should return false if extension does not exist", async () => {
      (mockDb.execute as Mock).mockResolvedValue({ rows: [] });

      const result = await strategy.checkCapability(mockDb);
      expect(result).toBe(false);
    });
  });

  describe("getCapabilities", () => {
    it("should return correct capabilities", () => {
      const capabilities = strategy.getCapabilities();
      expect(capabilities).toEqual({
        facetedSearch: false,
        highlightSearch: true,
        vectorSearch: false,
        fuzzySearch: true,
      });
    });
  });
});
