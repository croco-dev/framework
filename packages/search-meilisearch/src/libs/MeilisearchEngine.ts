import { Component, Context } from "@croco/framework-context";
import type {
  IndexConfig,
  SearchDocument,
  SearchEngineCapabilities,
  SearchQuery,
  SearchResult,
} from "@croco/search-core";
import { MissingTenantProblem, SearchEngine } from "@croco/search-core";
import { MeiliSearch } from "meilisearch";
import { TenantTokenNotConfiguredProblem } from "./problems/MeilisearchProblems";
import type { MeilisearchEngineOptions } from "./types";

@Component()
/**
 * 테넌트 격리와 테넌트 토큰 발급을 지원하는 Meilisearch 검색 엔진입니다.
 */
export class MeilisearchEngine extends SearchEngine {
  private readonly client: MeiliSearch;
  private static readonly FILTER_ESCAPE_REGEXP = /([\\"])/g;

  readonly capabilities: SearchEngineCapabilities = {
    facetedSearch: true,
    vectorSearch: false,
    highlightSearch: true,
    fuzzySearch: true,
  };

  constructor(private readonly options: MeilisearchEngineOptions) {
    super();
    this.client = new MeiliSearch({
      host: options.host,
      apiKey: options.apiKey,
    });
  }

  async search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>> {
    const tenantId = this.getTenantId("search");

    const filterArray = this.transformFilters(query.filters);
    filterArray.push(`_tenantId = "${this.escapeFilterValue(tenantId)}"`);

    const sortArray = this.transformSort(query.sort);

    const index = this.client.index(indexName);
    const result = await index.search(query.query, {
      filter: filterArray,
      limit: query.limit,
      offset: query.offset,
      sort: sortArray,
    });

    return {
      hits: result.hits.map((h) => ({ document: h as T })),
      total: result.estimatedTotalHits ?? 0,
      query,
      processingTimeMs: result.processingTimeMs || 0,
    };
  }

  async indexDocument(indexName: string, document: SearchDocument): Promise<void> {
    const tenantId = this.getTenantId("indexDocument");
    const index = this.client.index(indexName);
    await index.addDocuments([{ ...document, _tenantId: tenantId }]);
  }

  async bulkIndex(indexName: string, documents: SearchDocument[]): Promise<void> {
    const tenantId = this.getTenantId("bulkIndex");
    const index = this.client.index(indexName);
    const docsWithTenant = documents.map((doc) => ({ ...doc, _tenantId: tenantId }));
    await index.addDocuments(docsWithTenant);
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    const tenantId = this.getTenantId("deleteDocument");
    const index = this.client.index(indexName);

    await index.deleteDocuments({
      filter: `_tenantId = "${this.escapeFilterValue(tenantId)}" AND id = "${this.escapeFilterValue(documentId)}"`,
    });
  }

  async createIndex(config: IndexConfig): Promise<void> {
    await this.client.createIndex(config.name, { primaryKey: config.primaryKey || "id" });

    const index = this.client.index(config.name);

    const filterable = ["_tenantId", ...(config.filterableFields || [])];
    const sortable = config.sortableFields || [];

    await index.updateSettings({
      filterableAttributes: filterable,
      sortableAttributes: sortable,
    });
  }

  async deleteIndex(name: string): Promise<void> {
    await this.client.deleteIndex(name);
  }

  async generateTenantToken(tenantId: string, expiresAt?: Date): Promise<string> {
    if (!this.options.tenantTokenOptions) {
      throw new TenantTokenNotConfiguredProblem();
    }

    const { apiKeyUid, expiresIn } = this.options.tenantTokenOptions;

    const searchRules = {
      "*": {
        filter: `_tenantId = "${this.escapeFilterValue(tenantId)}"`,
      },
    };

    return await this.client.generateTenantToken(apiKeyUid, searchRules, {
      expiresAt:
        expiresAt ??
        (expiresIn !== undefined ? new Date(Date.now() + expiresIn * 1000) : undefined),
    });
  }

  private getTenantId(operation: string): string {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem(operation);
    }
    return tenantId;
  }

  private transformFilters(filters?: Record<string, unknown>): string[] {
    if (!filters) return [];
    return Object.entries(filters).map(([key, value]) => {
      if (typeof value === "string") return `${key} = "${this.escapeFilterValue(value)}"`;
      return `${key} = ${value}`;
    });
  }

  private escapeFilterValue(value: string): string {
    return value.replace(MeilisearchEngine.FILTER_ESCAPE_REGEXP, "\\$1");
  }

  private transformSort(sort?: { field: string; order: "asc" | "desc" }[]): string[] | undefined {
    if (!sort) return undefined;
    return sort.map((s) => `${s.field}:${s.order}`);
  }
}
