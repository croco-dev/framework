import { Component, Context, Inject } from '@croco/framework-context';
import {
  type IndexConfig,
  MissingTenantProblem,
  SearchCapabilityUnavailableProblem,
  type SearchDocument,
  SearchEngine,
  type SearchEngineCapabilities,
  type SearchQuery,
  type SearchResult,
  StrategyUnavailableProblem,
} from '@croco/search-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InvalidSearchRowProblem } from './problems/InvalidSearchRowProblem';
import { DRIZZLE_TOKEN, type SearchResultRow, type SearchStrategy } from './types';

function isSearchResultRow(value: unknown): value is SearchResultRow {
  return typeof value === 'object' && value !== null;
}

@Component()
export class DrizzleSearchEngine extends SearchEngine {
  private capabilityCheck: Promise<void> | null = null;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: NodePgDatabase<Record<string, never>>,
    private readonly strategy: SearchStrategy
  ) {
    super();
  }

  get capabilities(): SearchEngineCapabilities {
    return this.strategy.getCapabilities();
  }

  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    await this.ensureCapable();
    const tenantId = this.getTenantId('search');

    const sql = this.strategy.buildSearchQuery(index, query, tenantId);
    const result = await this.db.execute(sql);

    const hits = result.rows.map((row) => {
      if (!isSearchResultRow(row)) {
        throw new InvalidSearchRowProblem();
      }

      const mappedDocument = this.strategy.mapSearchRow?.<T>(row) ?? (row as unknown as T);
      const score = typeof row.score === 'number' ? row.score : 1;

      return {
        score,
        document: mappedDocument,
      };
    });

    return {
      hits,
      total: result.rowCount || 0,
      query,
      processingTimeMs: 0,
    };
  }

  async indexDocument(index: string, document: SearchDocument): Promise<void> {
    await this.ensureCapable();
    const tenantId = this.getTenantId('indexDocument');

    const sql = this.strategy.buildIndexQuery(index, document, tenantId);
    await this.db.execute(sql);
  }

  async deleteDocument(index: string, documentId: string): Promise<void> {
    await this.ensureCapable();
    const tenantId = this.getTenantId('deleteDocument');

    const sql = this.strategy.buildDeleteQuery(index, documentId, tenantId);
    await this.db.execute(sql);
  }

  async bulkIndex(index: string, documents: SearchDocument[]): Promise<void> {
    await this.ensureCapable();
    for (const doc of documents) {
      await this.indexDocument(index, doc);
    }
  }

  async createIndex(_config: IndexConfig): Promise<void> {
    await this.ensureCapable();
    throw new SearchCapabilityUnavailableProblem('createIndex', 'DrizzleSearchEngine');
  }

  async deleteIndex(_name: string): Promise<void> {
    await this.ensureCapable();
    throw new SearchCapabilityUnavailableProblem('deleteIndex', 'DrizzleSearchEngine');
  }

  private async checkStrategy(): Promise<void> {
    const isCapable = await this.strategy.checkCapability(this.db);
    if (!isCapable) {
      throw new StrategyUnavailableProblem(
        this.strategy.constructor.name,
        `Database does not support required extensions: ${this.strategy.getRequiredExtensions().join(', ')}`
      );
    }
  }

  private async ensureCapable(): Promise<void> {
    try {
      if (!this.capabilityCheck) {
        this.capabilityCheck = this.checkStrategy();
      }

      await this.capabilityCheck;
    } catch (error) {
      this.capabilityCheck = null;

      if (error instanceof StrategyUnavailableProblem) {
        throw error;
      }
      throw new StrategyUnavailableProblem(this.strategy.constructor.name, String(error));
    }
  }

  private getTenantId(operation: string): string {
    const tenantId = Context.getTenantId();
    if (!tenantId) {
      throw new MissingTenantProblem(operation);
    }
    return tenantId;
  }
}
