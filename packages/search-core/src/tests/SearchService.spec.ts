import { Context } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MissingTenantProblem,
  SearchOperationAbortedProblem,
} from "../libs/problems/SearchProblems";
import type { SearchEngine } from "../libs/SearchEngine";
import { SearchService } from "../libs/SearchService";
import type { SearchDocument, SearchQuery, SearchResult } from "../libs/types";

describe("SearchService", () => {
  let mockEngine!: SearchEngine;
  let searchService!: SearchService;

  beforeEach(() => {
    // Mock SearchEngine 구현
    mockEngine = {
      capabilities: {
        facetedSearch: false,
        vectorSearch: false,
        highlightSearch: false,
        fuzzySearch: true,
      },
      search: vi.fn(),
      indexDocument: vi.fn(),
      deleteDocument: vi.fn(),
      bulkIndex: vi.fn(),
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
    } as unknown as SearchEngine;

    searchService = new SearchService({ engine: mockEngine });
  });

  describe("search", () => {
    it("should throw error when tenantId is missing", async () => {
      vi.spyOn(Context, "getTenantId").mockReturnValue(null);

      await expect(searchService.search("test-index", { query: "test" })).rejects.toThrow(
        MissingTenantProblem,
      );
    });

    it("should add tenantId filter and call engine.search when tenantId exists", async () => {
      const tenantId = "tenant-123";
      vi.spyOn(Context, "getTenantId").mockReturnValue(tenantId);

      const query: SearchQuery = { query: "test", filters: { status: "active" } };
      const expectedQuery: SearchQuery = { query: "test", filters: { status: "active", tenantId } };
      const mockResult: SearchResult<unknown> = {
        hits: [],
        total: 0,
        query: expectedQuery,
        processingTimeMs: 10,
      };
      vi.mocked(mockEngine.search).mockResolvedValue(mockResult);
      const options = { signal: new AbortController().signal };

      const result = await searchService.search("test-index", query, options);

      expect(mockEngine.search).toHaveBeenCalledWith("test-index", expectedQuery, options);
      expect(result).toEqual(mockResult);
    });
  });

  describe("indexDocument", () => {
    it("should throw error when tenantId is missing", async () => {
      vi.spyOn(Context, "getTenantId").mockReturnValue(null);

      await expect(
        searchService.indexDocument("test-index", { id: "doc-1", data: "test" }),
      ).rejects.toThrow(MissingTenantProblem);
    });

    it("should add tenantId and call engine.indexDocument when tenantId exists", async () => {
      const tenantId = "tenant-123";
      vi.spyOn(Context, "getTenantId").mockReturnValue(tenantId);

      const document = { id: "doc-1", data: "test" };
      vi.mocked(mockEngine.indexDocument).mockResolvedValue(undefined);
      const options = { signal: new AbortController().signal };

      await searchService.indexDocument("test-index", document, options);

      const expectedDoc: SearchDocument = { ...document, tenantId };
      expect(mockEngine.indexDocument).toHaveBeenCalledWith("test-index", expectedDoc, options);
    });
  });

  describe("deleteDocument", () => {
    it("should throw error when tenantId is missing", async () => {
      vi.spyOn(Context, "getTenantId").mockReturnValue(null);

      await expect(searchService.deleteDocument("test-index", "doc-1")).rejects.toThrow(
        MissingTenantProblem,
      );
    });

    it("should call engine.deleteDocument when tenantId exists", async () => {
      const tenantId = "tenant-123";
      vi.spyOn(Context, "getTenantId").mockReturnValue(tenantId);

      vi.mocked(mockEngine.deleteDocument).mockResolvedValue(undefined);
      const options = { signal: new AbortController().signal };

      await searchService.deleteDocument("test-index", "doc-1", options);

      expect(mockEngine.deleteDocument).toHaveBeenCalledWith("test-index", "doc-1", options);
    });
  });

  describe("bulkIndex", () => {
    it("should throw error when tenantId is missing", async () => {
      vi.spyOn(Context, "getTenantId").mockReturnValue(null);

      await expect(
        searchService.bulkIndex("test-index", [{ id: "doc-1", data: "test" }]),
      ).rejects.toThrow(MissingTenantProblem);
    });

    it("should add tenantId to all documents and call engine.bulkIndex when tenantId exists", async () => {
      const tenantId = "tenant-123";
      vi.spyOn(Context, "getTenantId").mockReturnValue(tenantId);

      const documents = [
        { id: "doc-1", data: "test1" },
        { id: "doc-2", data: "test2" },
      ];
      vi.mocked(mockEngine.bulkIndex).mockResolvedValue(undefined);
      const options = { signal: new AbortController().signal };

      await searchService.bulkIndex("test-index", documents, options);

      const expectedDocs: SearchDocument[] = documents.map((doc) => ({ ...doc, tenantId }));
      expect(mockEngine.bulkIndex).toHaveBeenCalledWith("test-index", expectedDocs, options);
    });
  });

  describe("index management", () => {
    it("should forward create and delete index options without requiring tenant context", async () => {
      vi.spyOn(Context, "getTenantId").mockReturnValue(null);
      const options = { signal: new AbortController().signal };
      const config = { name: "products", primaryKey: "id" };

      await searchService.createIndex(config, options);
      await searchService.deleteIndex("products", options);

      expect(mockEngine.createIndex).toHaveBeenCalledWith(config, options);
      expect(mockEngine.deleteIndex).toHaveBeenCalledWith("products", options);
    });
  });

  it("should reject every pre-aborted operation before calling the engine", async () => {
    vi.spyOn(Context, "getTenantId").mockReturnValue("tenant-123");
    const controller = new AbortController();
    controller.abort(new Error("request closed"));
    const options = { signal: controller.signal };
    const operations = [
      () => searchService.search("test-index", { query: "test" }, options),
      () => searchService.indexDocument("test-index", { id: "doc-1" }, options),
      () => searchService.deleteDocument("test-index", "doc-1", options),
      () => searchService.bulkIndex("test-index", [{ id: "doc-1" }], options),
      () => searchService.createIndex({ name: "test-index" }, options),
      () => searchService.deleteIndex("test-index", options),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toBeInstanceOf(SearchOperationAbortedProblem);
    }

    expect(mockEngine.search).not.toHaveBeenCalled();
    expect(mockEngine.indexDocument).not.toHaveBeenCalled();
    expect(mockEngine.deleteDocument).not.toHaveBeenCalled();
    expect(mockEngine.bulkIndex).not.toHaveBeenCalled();
    expect(mockEngine.createIndex).not.toHaveBeenCalled();
    expect(mockEngine.deleteIndex).not.toHaveBeenCalled();
  });
});
