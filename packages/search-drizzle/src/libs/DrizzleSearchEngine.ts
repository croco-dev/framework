import { Component, Context, Inject } from '@croco/framework-context';
import {
  type IndexConfig,
  MissingTenantProblem,
  type SearchDocument,
  SearchEngine,
  type SearchEngineCapabilities,
  type SearchQuery,
  type SearchResult,
  StrategyUnavailableProblem,
} from '@croco/search-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_TOKEN, type SearchStrategy } from './types';

@Component()
export class DrizzleSearchEngine extends SearchEngine {
  private readonly capabilityCheck: Promise<void>;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: NodePgDatabase<Record<string, never>>,
    private readonly strategy: SearchStrategy
  ) {
    super();
    this.capabilityCheck = this.checkStrategy();
  }

  get capabilities(): SearchEngineCapabilities {
    return this.strategy.getCapabilities();
  }

  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    await this.ensureCapable();
    const tenantId = this.getTenantId('search');

    const sql = this.strategy.buildSearchQuery(index, query, tenantId);
    const result = await this.db.execute(sql);

    return {
      hits: result.rows.map((row: any) => ({
        score: row.score ?? 1,
        document: row as T,
      })),
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
  }

  async deleteIndex(_name: string): Promise<void> {
    await this.ensureCapable();
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
      await this.capabilityCheck;
    } catch (error) {
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
