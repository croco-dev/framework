import { CasingCache } from "drizzle-orm/casing";
import { describe, expect, it } from "vitest";
import type { SearchStrategy } from "../libs/types";

type RenderedQuery = {
  sql: string;
  params: unknown[];
};

function renderQuery(query: ReturnType<SearchStrategy["buildIndexQuery"]>): RenderedQuery {
  return query.toQuery({
    escapeName: (value: string) => `"${value.replace(/"/g, '""')}"`,
    escapeParam: (index: number) => `$${index + 1}`,
    escapeString: (value: string) => `'${value.replace(/'/g, "''")}'`,
    casing: new CasingCache(),
  });
}

export function registerStrategyIndexQueryTests(createStrategy: () => SearchStrategy): void {
  describe("buildIndexQuery upsert contract", () => {
    it("updates indexed fields on the tenant-scoped document identity", () => {
      const query = createStrategy().buildIndexQuery(
        "documents",
        { id: "doc-1", tenantId: "tenant-a", title: "Newest title" },
        "tenant-a",
      );

      const rendered = renderQuery(query);

      expect(rendered.sql).toMatch(/ON CONFLICT \("tenant_id", "id"\)\s+DO UPDATE SET/);
      expect(rendered.sql).toContain('"tenantId" = EXCLUDED."tenantId"');
      expect(rendered.sql).toContain('"title" = EXCLUDED."title"');
      expect(rendered.sql).not.toContain('"tenant_id" = EXCLUDED."tenant_id"');
      expect(rendered.sql).not.toContain('"id" = EXCLUDED."id"');
      expect(rendered.params).toEqual(["doc-1", "tenant-a", "Newest title", "tenant-a"]);
    });

    it("keeps identical document ids isolated by tenant", () => {
      const strategy = createStrategy();
      const tenantA = renderQuery(
        strategy.buildIndexQuery(
          "documents",
          { id: "shared-id", tenantId: "tenant-a" },
          "tenant-a",
        ),
      );
      const tenantB = renderQuery(
        strategy.buildIndexQuery(
          "documents",
          { id: "shared-id", tenantId: "tenant-b" },
          "tenant-b",
        ),
      );

      expect(tenantA.sql).toContain('ON CONFLICT ("tenant_id", "id")');
      expect(tenantB.sql).toContain('ON CONFLICT ("tenant_id", "id")');
      expect(tenantA.params).toEqual(["shared-id", "tenant-a", "tenant-a"]);
      expect(tenantB.params).toEqual(["shared-id", "tenant-b", "tenant-b"]);
    });

    it("uses the active tenant instead of a document-supplied tenant_id column", () => {
      const query = createStrategy().buildIndexQuery(
        "documents",
        { id: "doc-1", tenantId: "tenant-a", tenant_id: "tenant-b" },
        "tenant-a",
      );

      const rendered = renderQuery(query);

      expect(rendered.sql.match(/"tenant_id"/g)).toHaveLength(2);
      expect(rendered.params).toEqual(["doc-1", "tenant-a", "tenant-a"]);
      expect(rendered.params).not.toContain("tenant-b");
    });

    it("quotes identifiers and parameterizes document values", () => {
      const table = 'documents"; DROP TABLE audit; --';
      const field = 'title"; DROP TABLE users; --';
      const value = "newest'); DROP TABLE documents; --";
      const query = createStrategy().buildIndexQuery(
        table,
        { id: "doc-1", tenantId: "tenant-a", [field]: value },
        "tenant-a",
      );

      const rendered = renderQuery(query);

      expect(rendered.sql).toContain('INSERT INTO "documents""; DROP TABLE audit; --"');
      expect(rendered.sql).toContain('"title""; DROP TABLE users; --"');
      expect(rendered.sql).not.toContain(value);
      expect(rendered.params).toContain(value);
    });
  });

  describe("buildBulkIndexQueryPlans contract", () => {
    it("batches homogeneous documents with tenant-scoped parameterized values", () => {
      const strategy = createStrategy();
      const plans =
        strategy.buildBulkIndexQueryPlans?.(
          "documents",
          [
            {
              id: "doc-1",
              tenantId: "tenant-a",
              tenant_id: "untrusted-tenant",
              title: "First",
            },
            { id: "doc-2", tenantId: "tenant-a", title: "Second" },
          ],
          "tenant-a",
        ) ?? [];

      expect(plans).toHaveLength(1);
      const rendered = renderQuery(
        plans[0]?.query as ReturnType<SearchStrategy["buildIndexQuery"]>,
      );

      expect(rendered.sql).toMatch(/VALUES\s+\([^)]*\),\s*\([^)]*\)/);
      expect(rendered.sql).toContain('ON CONFLICT ("tenant_id", "id")');
      expect(rendered.params).toEqual([
        "doc-1",
        "tenant-a",
        "First",
        "tenant-a",
        "doc-2",
        "tenant-a",
        "Second",
        "tenant-a",
      ]);
      expect(rendered.params).not.toContain("untrusted-tenant");
      expect(plans[0]?.documentIndexes).toEqual([0, 1]);
    });

    it("preserves heterogeneous document fields in one database statement", () => {
      const strategy = createStrategy();
      const plans =
        strategy.buildBulkIndexQueryPlans?.(
          "documents",
          [
            { id: "doc-1", tenantId: "tenant-a", title: "Title" },
            { id: "doc-2", tenantId: "tenant-a", summary: "Summary" },
          ],
          "tenant-a",
        ) ?? [];

      expect(plans).toHaveLength(1);
      const rendered = renderQuery(
        plans[0]?.query as ReturnType<SearchStrategy["buildIndexQuery"]>,
      );

      expect(rendered.sql).toContain('WITH "bulk_index_0" AS');
      expect(rendered.sql).toContain('"bulk_index_1" AS');
      expect(rendered.sql).toContain('"title"');
      expect(rendered.sql).toContain('"summary"');
      expect(rendered.params).toEqual([
        "doc-1",
        "tenant-a",
        "Title",
        "tenant-a",
        "doc-2",
        "Summary",
        "tenant-a",
        "tenant-a",
      ]);
    });

    it("coalesces repeated document identities with last-write field semantics", () => {
      const strategy = createStrategy();
      const plans =
        strategy.buildBulkIndexQueryPlans?.(
          "documents",
          [
            {
              id: "shared",
              tenantId: "tenant-a",
              summary: "Preserved",
              title: "First",
            },
            { id: "shared", tenantId: "tenant-a", title: "Latest" },
          ],
          "tenant-a",
        ) ?? [];

      expect(plans).toHaveLength(1);
      const rendered = renderQuery(
        plans[0]?.query as ReturnType<SearchStrategy["buildIndexQuery"]>,
      );

      expect(rendered.params).toEqual(["shared", "Preserved", "tenant-a", "Latest", "tenant-a"]);
      expect(plans[0]?.documentIndexes).toEqual([0, 1]);
    });
  });
}
