import { CasingCache } from "drizzle-orm/casing";
import { describe, expect, it } from "vitest";
import { InvalidSearchQueryProblem } from "../libs/problems/InvalidSearchQueryProblem";

import type { SearchQuery } from "@croco/search-core";
import type { SQL } from "drizzle-orm";
import type { SearchStrategy } from "../libs/types";

function render(statement: SQL): { sql: string; params: unknown[] } {
  return statement.toQuery({
    escapeName: (value) => `"${value}"`,
    escapeParam: (index) => `$${index + 1}`,
    escapeString: (value) => `'${value}'`,
    casing: new CasingCache(),
  });
}

export function registerSearchQueryOptionTests(createStrategy: () => SearchStrategy): void {
  describe("search query options", () => {
    it("applies equality filters, requested sort, and parameterized pagination", () => {
      const filterValue = "active' OR TRUE --";
      const plan = createStrategy().buildSearchQuery(
        "documents",
        {
          query: "croco",
          filters: {
            status: filterValue,
            priority: 3,
            visible: true,
            tenantId: "tenant-123",
          },
          sort: [{ field: "published_at", order: "desc" }],
          limit: 10,
          offset: 20,
        },
        "tenant-123",
      );

      const rows = render(plan.rows);
      expect(rows.sql).toContain('"tenant_id" = $');
      expect(rows.sql).toContain('"status" = $');
      expect(rows.sql).toContain('"priority" = $');
      expect(rows.sql).toContain('"visible" = $');
      expect(rows.sql).toContain('ORDER BY "published_at" DESC');
      expect(rows.sql).toContain(', "id" ASC');
      expect(rows.sql).toContain("LIMIT $");
      expect(rows.sql).toContain("OFFSET $");
      expect(rows.sql).not.toContain(filterValue);
      expect(rows.params).toEqual(
        expect.arrayContaining(["tenant-123", filterValue, 3, true, 10, 20]),
      );

      const total = render(plan.total);
      expect(total.sql).toContain('"tenant_id" = $');
      expect(total.sql).toContain('"status" = $');
      expect(total.sql).toContain('"priority" = $');
      expect(total.sql).toContain('"visible" = $');
      expect(total.sql).not.toContain("ORDER BY");
      expect(total.sql).not.toContain("LIMIT");
      expect(total.sql).not.toContain("OFFSET");
      expect(total.sql).not.toContain(filterValue);
      expect(total.params).toEqual(expect.arrayContaining(["tenant-123", filterValue, 3, true]));
    });

    it("keeps default relevance ordering deterministic", () => {
      const rows = render(
        createStrategy().buildSearchQuery("documents", { query: "croco" }, "tenant-123").rows,
      );

      expect(rows.sql).toMatch(/ORDER BY .* DESC, "id" ASC/);
    });

    it.each([
      ["table", "documents; DROP TABLE documents", { query: "croco" }],
      [
        "filters.status; DROP TABLE documents",
        "documents",
        { query: "croco", filters: { "status; DROP TABLE documents": "active" } },
      ],
      [
        "sort.0.field",
        "documents",
        { query: "croco", sort: [{ field: "priority DESC; DROP TABLE documents", order: "asc" }] },
      ],
    ])("rejects unsafe %s identifiers", (option, table, query) => {
      expect(() =>
        createStrategy().buildSearchQuery(table, query as SearchQuery, "tenant-123"),
      ).toThrowError(
        expect.objectContaining({
          code: InvalidSearchQueryProblem.CODE,
          extensions: expect.objectContaining({ option, retryable: false }),
        }),
      );
    });

    it.each([
      ["sort.0.order", { query: "croco", sort: [{ field: "priority", order: "sideways" }] }],
      ["limit", { query: "croco", limit: -1 }],
      ["limit", { query: "croco", limit: 1.5 }],
      ["offset", { query: "croco", offset: Number.MAX_SAFE_INTEGER + 1 }],
      ["filters.status", { query: "croco", filters: { status: undefined } }],
      ["filters.status", { query: "croco", filters: { status: null } }],
      ["filters.price", { query: "croco", filters: { price: Number.NaN } }],
      ["filters.price", { query: "croco", filters: { price: { gt: 10 } } }],
      ["filters.tenantId", { query: "croco", filters: { tenantId: "tenant-456" } }],
    ])("rejects unsupported %s values explicitly", (option, query) => {
      expect(() =>
        createStrategy().buildSearchQuery("documents", query as SearchQuery, "tenant-123"),
      ).toThrowError(
        expect.objectContaining({
          code: InvalidSearchQueryProblem.CODE,
          extensions: expect.objectContaining({ option, retryable: false }),
        }),
      );
    });
  });
}
