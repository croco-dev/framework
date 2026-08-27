import { Context } from "@croco/framework-context";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { SearchEngine } from "../libs/SearchEngine";
import { defineSearchIndex } from "../libs/SearchIndexRef";
import { SearchService } from "../libs/SearchService";
import type {
  SearchIndexDocument,
  SearchIndexDocumentInput,
  SearchIndexQuery,
} from "../libs/SearchIndexRef";
import type { IndexConfig, SearchDocument, SearchQuery, SearchResult } from "../libs/types";

interface ProductDocument {
  id: string;
  tenantId: string;
  name: string;
  status: "active" | "archived";
  price: number;
}

const SEARCHABLE_FIELDS = ["name"] as const;
const FILTERABLE_FIELDS = ["status"] as const;
const SORTABLE_FIELDS = ["price"] as const;

const PRODUCT_INDEX = defineSearchIndex<ProductDocument>()({
  name: "products",
  primaryKey: "id",
  searchableFields: SEARCHABLE_FIELDS,
  filterableFields: FILTERABLE_FIELDS,
  sortableFields: SORTABLE_FIELDS,
});

describe("SearchIndexRef", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves the document and declared field contracts", () => {
    expectTypeOf(PRODUCT_INDEX.name).toEqualTypeOf<"products">();
    expectTypeOf<SearchIndexDocument<typeof PRODUCT_INDEX>>().toEqualTypeOf<ProductDocument>();
    expectTypeOf<SearchIndexDocumentInput<typeof PRODUCT_INDEX>>().toEqualTypeOf<
      Omit<ProductDocument, "tenantId">
    >();
    expectTypeOf<SearchIndexQuery<typeof PRODUCT_INDEX>["filters"]>().toEqualTypeOf<
      { status?: "active" | "archived" } | undefined
    >();
    expectTypeOf<
      NonNullable<SearchIndexQuery<typeof PRODUCT_INDEX>["sort"]>[number]["field"]
    >().toEqualTypeOf<"price">();
  });

  it("creates an immutable serializable IndexConfig", () => {
    expect(PRODUCT_INDEX).toEqual({
      name: "products",
      primaryKey: "id",
      searchableFields: ["name"],
      filterableFields: ["status"],
      sortableFields: ["price"],
    });
    expect(Object.isFrozen(PRODUCT_INDEX)).toBe(true);
    expect(Object.isFrozen(PRODUCT_INDEX.searchableFields)).toBe(true);
    expectTypeOf(PRODUCT_INDEX.filterableFields).toEqualTypeOf<
      typeof FILTERABLE_FIELDS | undefined
    >();
    expectTypeOf(PRODUCT_INDEX).toMatchTypeOf<IndexConfig>();
  });

  it("passes the existing serializable name and query to the runtime engine", async () => {
    const search = vi.fn().mockResolvedValue({
      hits: [],
      total: 0,
      query: { query: "croco" },
      processingTimeMs: 1,
    });
    const engine = {
      capabilities: {
        facetedSearch: false,
        vectorSearch: false,
        highlightSearch: false,
        fuzzySearch: false,
      },
      search,
      indexDocument: vi.fn(),
      deleteDocument: vi.fn(),
      bulkIndex: vi.fn(),
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
    } as unknown as SearchEngine;
    vi.spyOn(Context, "getTenantId").mockReturnValue("tenant-1");

    const service = new SearchService({ engine });
    const result = await service.search(PRODUCT_INDEX, {
      query: "croco",
      filters: { status: "active" },
      sort: [{ field: "price", order: "asc" }],
    });

    expect(search).toHaveBeenCalledWith("products", {
      query: "croco",
      filters: { status: "active", tenantId: "tenant-1" },
      sort: [{ field: "price", order: "asc" }],
    });
    expectTypeOf(result.hits).toEqualTypeOf<
      { document: ProductDocument; score?: number; highlights?: Record<string, string[]> }[]
    >();
  });

  it("infers indexed documents while preserving the string adapter boundary", async () => {
    const indexDocument = vi.fn();
    const bulkIndex = vi.fn();
    const engine = {
      capabilities: {
        facetedSearch: false,
        vectorSearch: false,
        highlightSearch: false,
        fuzzySearch: false,
      },
      search: vi.fn(),
      indexDocument,
      deleteDocument: vi.fn(),
      bulkIndex,
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
    } as unknown as SearchEngine;
    vi.spyOn(Context, "getTenantId").mockReturnValue("tenant-1");

    const service = new SearchService({ engine });
    await service.indexDocument(PRODUCT_INDEX, {
      id: "product-1",
      name: "Croco",
      status: "active",
      price: 100,
    });
    await service.bulkIndex(PRODUCT_INDEX, [
      {
        id: "product-2",
        name: "Croco Plus",
        status: "archived",
        price: 200,
      },
    ]);

    expect(indexDocument).toHaveBeenCalledWith("products", {
      id: "product-1",
      tenantId: "tenant-1",
      name: "Croco",
      status: "active",
      price: 100,
    });
    expect(bulkIndex).toHaveBeenCalledWith("products", [
      {
        id: "product-2",
        tenantId: "tenant-1",
        name: "Croco Plus",
        status: "archived",
        price: 200,
      },
    ]);
  });

  it("lets engines use typed references without changing adapter primitives", async () => {
    const search = vi.fn();
    const indexDocument = vi.fn();
    const bulkIndex = vi.fn();
    const createIndex = vi.fn();

    class MockSearchEngine extends SearchEngine {
      readonly capabilities = {
        facetedSearch: false,
        vectorSearch: false,
        highlightSearch: false,
        fuzzySearch: false,
      };

      async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
        search(index, query);
        return {
          hits: [] as { document: T }[],
          total: 0,
          query,
          processingTimeMs: 0,
        };
      }

      async indexDocument(index: string, document: SearchDocument): Promise<void> {
        indexDocument(index, document);
      }
      async deleteDocument(_index: string, _documentId: string): Promise<void> {}
      async bulkIndex(index: string, documents: SearchDocument[]): Promise<void> {
        bulkIndex(index, documents);
      }
      async createIndex(config: IndexConfig): Promise<void> {
        createIndex(config);
      }
      async deleteIndex(_name: string): Promise<void> {}
    }

    const engine = new MockSearchEngine();
    const result = await engine.searchIndex(PRODUCT_INDEX, {
      query: "croco",
      filters: { status: "active" },
    });
    await engine.indexDocumentAt(PRODUCT_INDEX, {
      id: "product-1",
      tenantId: "tenant-1",
      name: "Croco",
      status: "active",
      price: 100,
    });
    await engine.bulkIndexAt(PRODUCT_INDEX, [
      {
        id: "product-2",
        tenantId: "tenant-1",
        name: "Croco Plus",
        status: "archived",
        price: 200,
      },
    ]);
    await engine.createIndex(PRODUCT_INDEX);

    expect(search).toHaveBeenCalledWith("products", {
      query: "croco",
      filters: { status: "active" },
    });
    expect(indexDocument).toHaveBeenCalledWith("products", {
      id: "product-1",
      tenantId: "tenant-1",
      name: "Croco",
      status: "active",
      price: 100,
    });
    expect(bulkIndex).toHaveBeenCalledWith("products", [
      {
        id: "product-2",
        tenantId: "tenant-1",
        name: "Croco Plus",
        status: "archived",
        price: 200,
      },
    ]);
    expect(createIndex).toHaveBeenCalledWith(PRODUCT_INDEX);
    expectTypeOf(result).toEqualTypeOf<SearchResult<ProductDocument>>();
  });
});

defineSearchIndex<ProductDocument>()({
  name: "invalid-products",
  searchableFields: [
    // @ts-expect-error unknown document fields cannot be searchable
    "description",
  ],
});

const invalidFilter: SearchIndexQuery<typeof PRODUCT_INDEX> = {
  query: "croco",
  filters: {
    // @ts-expect-error only declared filterable fields are accepted
    price: 100,
  },
};

const invalidSort: SearchIndexQuery<typeof PRODUCT_INDEX> = {
  query: "croco",
  sort: [
    {
      // @ts-expect-error only declared sortable fields are accepted
      field: "name",
      order: "asc",
    },
  ],
};

const invalidDocument: SearchIndexDocumentInput<typeof PRODUCT_INDEX> = {
  id: "product-1",
  name: "Croco",
  // @ts-expect-error indexed documents retain the declared field types
  status: "deleted",
  price: 100,
};

void invalidFilter;
void invalidSort;
void invalidDocument;

type DynamicProductDocument = SearchDocument & {
  status: "active" | "archived";
};

const defineDynamicProductIndex = defineSearchIndex<DynamicProductDocument>();

// @ts-expect-error typed indexes require a closed document contract
defineDynamicProductIndex({
  name: "dynamic-products",
  filterableFields: ["statsu"],
});

const mixedFilters = {
  status: "active" as const,
  price: 100,
};

function assertExactQueryInputs(service: SearchService, engine: SearchEngine): void {
  // @ts-expect-error predeclared filters cannot include undeclared fields
  void service.search(PRODUCT_INDEX, { query: "croco", filters: mixedFilters });
  // @ts-expect-error engine queries enforce the same exact filter contract
  void engine.searchIndex(PRODUCT_INDEX, { query: "croco", filters: mixedFilters });
}

function assertEngineDocumentInputs(engine: SearchEngine): void {
  void engine.indexDocumentAt(PRODUCT_INDEX, {
    id: "product-1",
    tenantId: "tenant-1",
    name: "Croco",
    // @ts-expect-error engine indexing retains the declared document field types
    status: "deleted",
    price: 100,
  });
}

function assertReadonlyIndexFields(): void {
  // @ts-expect-error index field declarations are immutable
  PRODUCT_INDEX.filterableFields.push("status");
}

void assertExactQueryInputs;
void assertEngineDocumentInputs;
void assertReadonlyIndexFields;
