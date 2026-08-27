import { CasingCache } from "drizzle-orm/casing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PgSearchStrategy } from "../libs/strategies/PgSearchStrategy";

type PgSearchStrategyPrivate = {
  indexName: string;
};

type SQLRenderable = {
  toQuery: (config: {
    escapeName: (value: string) => string;
    escapeParam: () => string;
    escapeString: (value: string) => string;
    casing: CasingCache;
  }) => { sql: string };
};

const mockDb = {
  execute: vi.fn(),
} as unknown as NodePgDatabase<Record<string, never>>;

describe("PgSearchStrategy", () => {
  let strategy!: PgSearchStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new PgSearchStrategy();
  });

  it("should initialize with default options", () => {
    expect(strategy).toBeInstanceOf(PgSearchStrategy);
  });

  it("should initialize with index name", () => {
    strategy = new PgSearchStrategy({ indexName: "custom_index" });
    expect((strategy as unknown as PgSearchStrategyPrivate).indexName).toBe("custom_index");
  });

  describe("buildSearchQuery", () => {
    it("should build correct search query with BM25 operator", () => {
      const query = { query: "test query" };
      const sqlObj = strategy.buildSearchQuery("users", query, "tenant-123");

      const sqlString = sqlObj.toQuery({
        escapeName: (x: string) => `"${x}"`,
        escapeParam: () => "$1",
        escapeString: (x: string) => `'${x}'`,
        casing: new CasingCache(),
      }).sql;

      // Expecting ParadeDB BM25 syntax: table @@@ 'query'
      expect(sqlString).toContain('"users" @@@ $1');
      expect(sqlString).toContain('"tenant_id" = $1');
      expect(sqlString).toContain('SELECT *, paradedb.score("id") AS score');
      expect(sqlString).toContain('ORDER BY paradedb.score("id") DESC');
      expect(sqlString).not.toContain("ORDER BY score DESC");
      expect(sqlString.match(/paradedb\.score\("id"\)/g)).toHaveLength(2);
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
    it("should return pg_search", () => {
      expect(strategy.getRequiredExtensions()).toEqual(["pg_search"]);
    });
  });

  describe("checkCapability", () => {
    it("should return true if extension exists", async () => {
      (mockDb.execute as Mock).mockResolvedValue({ rows: [{ 1: 1 }] });

      const result = await strategy.checkCapability(mockDb);
      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
      const callArgs = (mockDb.execute as Mock).mock.calls[0];
      expect(
        (callArgs[0] as SQLRenderable).toQuery({
          escapeName: (x: string) => `"${x}"`,
          escapeParam: () => "$1",
          escapeString: (x: string) => `'${x}'`,
          casing: new CasingCache(),
        }).sql,
      ).toContain("FROM pg_extension WHERE extname = 'pg_search'");
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
        facetedSearch: true,
        highlightSearch: true,
        vectorSearch: false,
        fuzzySearch: true,
      });
    });
  });
});
