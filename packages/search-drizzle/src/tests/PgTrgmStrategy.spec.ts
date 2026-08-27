import { CasingCache } from "drizzle-orm/casing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PgTrgmStrategy } from "../libs/strategies/PgTrgmStrategy";

type PgTrgmStrategyPrivate = {
  similarityThreshold: number;
};

const mockDb = {
  execute: vi.fn(),
} as unknown as NodePgDatabase<Record<string, never>>;

describe("PgTrgmStrategy", () => {
  let strategy!: PgTrgmStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new PgTrgmStrategy();
  });

  it("should initialize with default threshold", () => {
    expect((strategy as unknown as PgTrgmStrategyPrivate).similarityThreshold).toBe(0.3);
  });

  it("should initialize with custom threshold", () => {
    strategy = new PgTrgmStrategy({ threshold: 0.5 });
    expect((strategy as unknown as PgTrgmStrategyPrivate).similarityThreshold).toBe(0.5);
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

      expect(sqlString).toContain('similarity("search_vector", $1) > $1');
      expect(sqlString).toContain('"tenant_id" = $1');
      expect(sqlString).toContain(
        'SELECT *, similarity("search_vector", $1) AS "__croco_search_score"',
      );
      expect(sqlString).toContain('ORDER BY similarity("search_vector", $1) DESC');
      expect(sqlString).not.toContain("ORDER BY score DESC");
      expect(sqlString.match(/similarity\("search_vector", \$1\)/g)).toHaveLength(3);

      const totalSqlString = plan.total.toQuery({
        escapeName: (x: string) => `"${x}"`,
        escapeParam: () => "$1",
        escapeString: (x: string) => `'${x}'`,
        casing: new CasingCache(),
      }).sql;

      expect(totalSqlString).toContain("SELECT COUNT(*)::double precision AS total");
      expect(totalSqlString).toContain('FROM "users"');
      expect(totalSqlString).toContain('"tenant_id" = $1');
      expect(totalSqlString).toContain('similarity("search_vector", $1) > $1');
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
    it("should return pg_trgm", () => {
      expect(strategy.getRequiredExtensions()).toEqual(["pg_trgm"]);
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
        highlightSearch: false,
        vectorSearch: false,
        fuzzySearch: true,
      });
    });
  });
});
