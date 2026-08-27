import { Context } from "@croco/framework-context";
import { MissingTenantProblem } from "./problems/SearchProblems";
import type {
  SearchIndexDocument,
  SearchIndexDocumentInput,
  SearchIndexQuery,
  SearchIndexQueryInput,
  SearchIndexRef,
} from "./SearchIndexRef";
import type { SearchEngine } from "./SearchEngine";
import { throwIfSearchOperationAborted } from "./SearchOperation";
import type {
  IndexConfig,
  SearchDocument,
  SearchOperationOptions,
  SearchQuery,
  SearchResult,
} from "./types";

export type SearchServiceDependencies = {
  engine: SearchEngine;
};

type DocumentInput = Omit<SearchDocument, "tenantId">;

export class SearchService {
  constructor(private readonly deps: SearchServiceDependencies) {}

  search<
    TReference extends SearchIndexRef,
    const TQuery extends SearchIndexQuery<NoInfer<TReference>>,
  >(
    index: TReference,
    query: TQuery & SearchIndexQueryInput<TReference, TQuery>,
    options?: SearchOperationOptions,
  ): Promise<SearchResult<SearchIndexDocument<TReference>>>;
  search<T>(
    index: string,
    query: SearchQuery,
    options?: SearchOperationOptions,
  ): Promise<SearchResult<T>>;
  async search<T>(
    index: string | SearchIndexRef,
    query: SearchQuery,
    options: SearchOperationOptions = {},
  ): Promise<SearchResult<T>> {
    throwIfSearchOperationAborted("search", options);
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("search");
    }

    const tenantQuery: SearchQuery = {
      ...query,
      filters: { ...query.filters, tenantId },
    };

    return this.deps.engine.search<T>(this.resolveIndexName(index), tenantQuery, options);
  }

  indexDocument<TReference extends SearchIndexRef>(
    index: TReference,
    document: SearchIndexDocumentInput<TReference>,
    options?: SearchOperationOptions,
  ): Promise<void>;
  indexDocument(
    index: string,
    document: DocumentInput,
    options?: SearchOperationOptions,
  ): Promise<void>;
  async indexDocument(
    index: string | SearchIndexRef,
    document: DocumentInput,
    options: SearchOperationOptions = {},
  ): Promise<void> {
    throwIfSearchOperationAborted("indexDocument", options);
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("indexing");
    }

    const tenantDocument = { ...document, tenantId } as SearchDocument;
    return this.deps.engine.indexDocument(this.resolveIndexName(index), tenantDocument, options);
  }

  deleteDocument(
    index: SearchIndexRef,
    documentId: string,
    options?: SearchOperationOptions,
  ): Promise<void>;
  deleteDocument(
    index: string,
    documentId: string,
    options?: SearchOperationOptions,
  ): Promise<void>;
  async deleteDocument(
    index: string | SearchIndexRef,
    documentId: string,
    options: SearchOperationOptions = {},
  ): Promise<void> {
    throwIfSearchOperationAborted("deleteDocument", options);
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("delete");
    }

    return this.deps.engine.deleteDocument(this.resolveIndexName(index), documentId, options);
  }

  bulkIndex<TReference extends SearchIndexRef>(
    index: TReference,
    documents: SearchIndexDocumentInput<TReference>[],
    options?: SearchOperationOptions,
  ): Promise<void>;
  bulkIndex(
    index: string,
    documents: DocumentInput[],
    options?: SearchOperationOptions,
  ): Promise<void>;
  async bulkIndex(
    index: string | SearchIndexRef,
    documents: DocumentInput[],
    options: SearchOperationOptions = {},
  ): Promise<void> {
    throwIfSearchOperationAborted("bulkIndex", options);
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("bulk indexing");
    }

    const tenantDocuments = documents.map((doc) => ({ ...doc, tenantId }) as SearchDocument);
    return this.deps.engine.bulkIndex(this.resolveIndexName(index), tenantDocuments, options);
  }

  async createIndex(config: IndexConfig, options: SearchOperationOptions = {}): Promise<void> {
    throwIfSearchOperationAborted("createIndex", options);
    return this.deps.engine.createIndex(config, options);
  }

  async deleteIndex(name: string, options: SearchOperationOptions = {}): Promise<void> {
    throwIfSearchOperationAborted("deleteIndex", options);
    return this.deps.engine.deleteIndex(name, options);
  }

  private resolveIndexName(index: string | SearchIndexRef): string {
    return typeof index === "string" ? index : index.name;
  }
}
