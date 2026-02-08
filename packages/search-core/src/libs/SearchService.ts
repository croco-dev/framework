import { Context } from '@croco/framework-context';
import { MissingTenantProblem } from './problems/SearchProblems';
import type { SearchEngine } from './SearchEngine';
import type { SearchDocument, SearchQuery, SearchResult } from './types';

export type SearchServiceDependencies = {
  engine: SearchEngine;
};

type DocumentInput = Omit<SearchDocument, 'tenantId'>;

export class SearchService {
  constructor(private readonly deps: SearchServiceDependencies) {}

  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem('search');
    }

    const tenantQuery: SearchQuery = {
      ...query,
      filters: { ...query.filters, tenantId },
    };

    return this.deps.engine.search<T>(index, tenantQuery);
  }

  async indexDocument(index: string, document: DocumentInput): Promise<void> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem('indexing');
    }

    const tenantDocument = { ...document, tenantId } as SearchDocument;
    return this.deps.engine.indexDocument(index, tenantDocument);
  }

  async deleteDocument(index: string, documentId: string): Promise<void> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem('delete');
    }

    return this.deps.engine.deleteDocument(index, documentId);
  }

  async bulkIndex(index: string, documents: DocumentInput[]): Promise<void> {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem('bulk indexing');
    }

    const tenantDocuments = documents.map((doc) => ({ ...doc, tenantId }) as SearchDocument);
    return this.deps.engine.bulkIndex(index, tenantDocuments);
  }
}
