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
import type { SearchDocument, SearchQuery, SearchResult } from "./types";

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
  ): Promise<SearchResult<SearchIndexDocument<TReference>>>;
  search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>>;
  async search<T>(index: string | SearchIndexRef, query: SearchQuery): Promise<SearchResult<T>> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("search");
    }

    const tenantQuery: SearchQuery = {
      ...query,
      filters: { ...query.filters, tenantId },
    };

    return this.deps.engine.search<T>(this.resolveIndexName(index), tenantQuery);
  }

  indexDocument<TReference extends SearchIndexRef>(
    index: TReference,
    document: SearchIndexDocumentInput<TReference>,
  ): Promise<void>;
  indexDocument(index: string, document: DocumentInput): Promise<void>;
  async indexDocument(index: string | SearchIndexRef, document: DocumentInput): Promise<void> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("indexing");
    }

    const tenantDocument = { ...document, tenantId } as SearchDocument;
    return this.deps.engine.indexDocument(this.resolveIndexName(index), tenantDocument);
  }

  deleteDocument(index: SearchIndexRef, documentId: string): Promise<void>;
  deleteDocument(index: string, documentId: string): Promise<void>;
  async deleteDocument(index: string | SearchIndexRef, documentId: string): Promise<void> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("delete");
    }

    return this.deps.engine.deleteDocument(this.resolveIndexName(index), documentId);
  }

  bulkIndex<TReference extends SearchIndexRef>(
    index: TReference,
    documents: SearchIndexDocumentInput<TReference>[],
  ): Promise<void>;
  bulkIndex(index: string, documents: DocumentInput[]): Promise<void>;
  async bulkIndex(index: string | SearchIndexRef, documents: DocumentInput[]): Promise<void> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem("bulk indexing");
    }

    const tenantDocuments = documents.map((doc) => ({ ...doc, tenantId }) as SearchDocument);
    return this.deps.engine.bulkIndex(this.resolveIndexName(index), tenantDocuments);
  }

  private resolveIndexName(index: string | SearchIndexRef): string {
    return typeof index === "string" ? index : index.name;
  }
}
