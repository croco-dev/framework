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
import { validateMeilisearchOptions } from "./MeilisearchConfig";
import {
  MeilisearchInvalidRequestProblem,
  normalizeMeilisearchError,
  TenantTokenNotConfiguredProblem,
} from "./problems/MeilisearchProblems";
import type { MeilisearchEngineOptions } from "./types";

@Component()
/**
 * 테넌트 격리와 테넌트 토큰 발급을 지원하는 Meilisearch 검색 엔진입니다.
 */
export class MeilisearchEngine extends SearchEngine {
  private readonly client: MeiliSearch;
  private static readonly FILTER_ESCAPE_REGEXP = /([\\"])/g;
  private static readonly FILTER_FIELD_REGEXP = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
  private readonly options: MeilisearchEngineOptions;

  readonly capabilities: SearchEngineCapabilities = {
    facetedSearch: true,
    vectorSearch: false,
    highlightSearch: true,
    fuzzySearch: true,
  };

  constructor(options: MeilisearchEngineOptions) {
    super();
    this.options = validateMeilisearchOptions(options);
    this.client = new MeiliSearch({
      host: this.options.host,
      apiKey: this.options.apiKey,
    });
  }

  async search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>> {
    this.validateIndexName(indexName, "search");
    const tenantId = this.getTenantId("search");

    const filterArray = this.transformFilters(query.filters, tenantId);
    filterArray.push(`_tenantId = "${this.escapeFilterValue(tenantId)}"`);

    const sortArray = this.transformSort(query.sort);

    const index = this.client.index(indexName);
    const result = await this.runOperation(
      "search",
      () =>
        index.search(query.query, {
          filter: filterArray,
          limit: query.limit,
          offset: query.offset,
          sort: sortArray,
        }),
      { indexName },
    );

    return {
      hits: result.hits.map((h) => ({ document: h as T })),
      total: result.estimatedTotalHits ?? 0,
      query,
      processingTimeMs: result.processingTimeMs || 0,
    };
  }

  async indexDocument(indexName: string, document: SearchDocument): Promise<void> {
    this.validateIndexName(indexName, "indexDocument");
    this.validateDocument(document, "indexDocument");
    const tenantId = this.getTenantId("indexDocument");
    const index = this.client.index(indexName);
    const task = await this.runOperation(
      "indexDocument",
      () => index.addDocuments([{ ...document, tenantId, _tenantId: tenantId }]),
      { documentId: document.id, indexName },
    );
    await this.waitForTask("indexDocument", task, { documentId: document.id, indexName });
  }

  async bulkIndex(indexName: string, documents: SearchDocument[]): Promise<void> {
    this.validateIndexName(indexName, "bulkIndex");
    for (const document of documents) {
      this.validateDocument(document, "bulkIndex");
    }

    if (documents.length === 0) {
      return;
    }

    const tenantId = this.getTenantId("bulkIndex");
    const index = this.client.index(indexName);
    const docsWithTenant = documents.map((doc) => ({ ...doc, tenantId, _tenantId: tenantId }));
    const task = await this.runOperation("bulkIndex", () => index.addDocuments(docsWithTenant), {
      indexName,
    });
    await this.waitForTask("bulkIndex", task, { indexName });
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    this.validateIndexName(indexName, "deleteDocument");
    this.validateDocumentId(documentId, "deleteDocument");
    const tenantId = this.getTenantId("deleteDocument");
    const index = this.client.index(indexName);

    const task = await this.runOperation(
      "deleteDocument",
      () =>
        index.deleteDocuments({
          filter: `_tenantId = "${this.escapeFilterValue(tenantId)}" AND id = "${this.escapeFilterValue(documentId)}"`,
        }),
      { documentId, indexName },
    );
    await this.waitForTask("deleteDocument", task, { documentId, indexName });
  }

  async createIndex(config: IndexConfig): Promise<void> {
    this.validateIndexName(config.name, "createIndex");
    this.validateAttributeNames(config.filterableFields, "createIndex");
    this.validateAttributeNames(config.searchableFields, "createIndex");
    this.validateAttributeNames(config.sortableFields, "createIndex");

    const createTask = await this.runOperation(
      "createIndex",
      () => this.client.createIndex(config.name, { primaryKey: config.primaryKey || "id" }),
      { indexName: config.name },
    );
    await this.waitForTask("createIndex", createTask, { indexName: config.name });

    const index = this.client.index(config.name);

    const filterable = ["_tenantId", "id", ...(config.filterableFields || [])].filter(
      (field, index, fields) => fields.indexOf(field) === index,
    );
    const sortable = config.sortableFields || [];
    const settings = {
      filterableAttributes: filterable,
      ...(config.searchableFields !== undefined && {
        searchableAttributes: config.searchableFields,
      }),
      sortableAttributes: sortable,
    };

    const settingsTask = await this.runOperation(
      "createIndex.updateSettings",
      () => index.updateSettings(settings),
      { indexName: config.name },
    );
    await this.waitForTask("createIndex.updateSettings", settingsTask, {
      indexName: config.name,
    });
  }

  async deleteIndex(name: string): Promise<void> {
    this.validateIndexName(name, "deleteIndex");
    const task = await this.runOperation("deleteIndex", () => this.client.deleteIndex(name), {
      indexName: name,
    });
    await this.waitForTask("deleteIndex", task, { indexName: name });
  }

  async generateTenantToken(tenantId: string, expiresAt?: Date): Promise<string> {
    const activeTenantId = this.getTenantId("generateTenantToken");

    if (!tenantId.trim()) {
      throw new MeilisearchInvalidRequestProblem(
        { operation: "generateTenantToken" },
        "Tenant id must be a non-empty string",
      );
    }

    if (tenantId !== activeTenantId) {
      throw new MeilisearchInvalidRequestProblem(
        { operation: "generateTenantToken", upstreamCode: "invalid-tenant-context" },
        "Meilisearch tenant token id must match the active tenant context",
      );
    }

    if (!this.options.tenantTokenOptions) {
      throw new TenantTokenNotConfiguredProblem();
    }

    const { apiKeyUid, expiresIn } = this.options.tenantTokenOptions;

    const searchRules = {
      "*": {
        filter: `_tenantId = "${this.escapeFilterValue(activeTenantId)}"`,
      },
    };

    return await this.runOperation(
      "generateTenantToken",
      () =>
        this.client.generateTenantToken(apiKeyUid, searchRules, {
          expiresAt:
            expiresAt ??
            (expiresIn !== undefined ? new Date(Date.now() + expiresIn * 1000) : undefined),
        }),
      {},
    );
  }

  private getTenantId(operation: string): string {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem(operation);
    }
    return tenantId;
  }

  private transformFilters(
    filters: Record<string, unknown> | undefined,
    tenantId: string,
  ): string[] {
    if (!filters) return [];
    return Object.entries(filters).flatMap(([key, value]) => {
      if (key === "tenantId") {
        if (value !== tenantId) {
          throw new MeilisearchInvalidRequestProblem(
            { operation: "search", upstreamCode: "invalid-tenant-filter" },
            "Meilisearch tenantId filter must match the active tenant context",
          );
        }
        return [];
      }

      if (key === "_tenantId") {
        throw new MeilisearchInvalidRequestProblem(
          { operation: "search", upstreamCode: "invalid-tenant-filter" },
          "Meilisearch _tenantId filter is provider-owned and cannot be supplied by callers",
        );
      }

      this.validateAttributeName(key, "search");
      return [`${key} = ${this.formatFilterValue(value, "search")}`];
    });
  }

  private formatFilterValue(value: unknown, operation: string): string {
    if (typeof value === "string") {
      return `"${this.escapeFilterValue(value)}"`;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return String(value);
    }

    throw new MeilisearchInvalidRequestProblem(
      { operation },
      "Meilisearch filters support only string, finite number, and boolean values",
    );
  }

  private escapeFilterValue(value: string): string {
    return value.replace(MeilisearchEngine.FILTER_ESCAPE_REGEXP, "\\$1");
  }

  private transformSort(sort?: { field: string; order: "asc" | "desc" }[]): string[] | undefined {
    if (!sort) return undefined;
    return sort.map((s) => {
      this.validateAttributeName(s.field, "search");
      return `${s.field}:${s.order}`;
    });
  }

  private validateIndexName(indexName: string, operation: string): void {
    if (!indexName.trim()) {
      throw new MeilisearchInvalidRequestProblem(
        { operation },
        "Meilisearch index name must be a non-empty string",
      );
    }
  }

  private validateDocument(document: SearchDocument, operation: string): void {
    this.validateDocumentId(document.id, operation);
  }

  private validateDocumentId(documentId: string, operation: string): void {
    if (!documentId.trim()) {
      throw new MeilisearchInvalidRequestProblem(
        { operation },
        "Search document id must be a non-empty string",
      );
    }
  }

  private validateAttributeNames(fields: readonly string[] | undefined, operation: string): void {
    for (const field of fields ?? []) {
      this.validateAttributeName(field, operation);
    }
  }

  private validateAttributeName(field: string, operation: string): void {
    if (!MeilisearchEngine.FILTER_FIELD_REGEXP.test(field)) {
      throw new MeilisearchInvalidRequestProblem(
        { operation, upstreamCode: "invalid-filter-field" },
        `Meilisearch field '${field}' is not safe for filter or sort construction`,
      );
    }
  }

  private async runOperation<T>(
    operation: string,
    action: () => Promise<T> | T,
    context: { indexName?: string; documentId?: string },
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeMeilisearchError(error, { operation, ...context });
    }
  }

  private async waitForTask(
    operation: string,
    task: unknown,
    context: { indexName?: string; documentId?: string },
  ): Promise<void> {
    if (this.options.taskWait?.enabled === false) {
      return;
    }

    const taskUid = this.getTaskUid(task);
    if (taskUid === undefined) {
      throw new MeilisearchInvalidRequestProblem(
        { operation, ...context, upstreamCode: "missing-task-uid" },
        "Meilisearch task response is missing taskUid",
      );
    }

    const result = await this.runOperation(
      `${operation}.waitForTask`,
      () =>
        this.client.waitForTask(taskUid, {
          ...(this.options.taskWait?.timeoutMs !== undefined && {
            timeOutMs: this.options.taskWait.timeoutMs,
          }),
          ...(this.options.taskWait?.intervalMs !== undefined && {
            intervalMs: this.options.taskWait.intervalMs,
          }),
        }),
      context,
    );

    if (this.isFailedTask(result)) {
      throw normalizeMeilisearchError(result.error, { operation, ...context });
    }
  }

  private getTaskUid(task: unknown): number | undefined {
    if (typeof task !== "object" || task === null || !("taskUid" in task)) {
      return undefined;
    }

    const taskUid = task.taskUid;
    return typeof taskUid === "number" && Number.isInteger(taskUid) ? taskUid : undefined;
  }

  private isFailedTask(task: unknown): task is { readonly error: unknown } {
    return (
      typeof task === "object" &&
      task !== null &&
      "status" in task &&
      task.status === "failed" &&
      "error" in task
    );
  }
}
