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

/**
 * PostgreSQL 검색 전략을 사용해 문서 검색을 수행하는 Drizzle 검색 엔진입니다.
 */
@Component()
export class DrizzleSearchEngine extends SearchEngine {
  private capabilityCheck: Promise<void> | null = null;

  /**
   * Drizzle DB와 검색 전략을 받아 검색 엔진을 초기화합니다.
   */
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: NodePgDatabase<Record<string, never>>,
    private readonly strategy: SearchStrategy
  ) {
    super();
  }

  /**
   * 현재 전략이 제공하는 검색 기능을 반환합니다.
   */
  get capabilities(): SearchEngineCapabilities {
    return this.strategy.getCapabilities();
  }

  /**
   * 인덱스와 쿼리를 받아 검색 결과를 반환합니다.
   */
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

  /**
   * 단일 문서를 인덱스에 저장합니다.
   */
  async indexDocument(index: string, document: SearchDocument): Promise<void> {
    await this.ensureCapable();
    const tenantId = this.getTenantId('indexDocument');

    const sql = this.strategy.buildIndexQuery(index, document, tenantId);
    await this.db.execute(sql);
  }

  /**
   * 문서 ID로 인덱스에서 문서를 삭제합니다.
   */
  async deleteDocument(index: string, documentId: string): Promise<void> {
    await this.ensureCapable();
    const tenantId = this.getTenantId('deleteDocument');

    const sql = this.strategy.buildDeleteQuery(index, documentId, tenantId);
    await this.db.execute(sql);
  }

  /**
   * 여러 문서를 순차적으로 인덱싱합니다.
   */
  async bulkIndex(index: string, documents: SearchDocument[]): Promise<void> {
    await this.ensureCapable();
    for (const doc of documents) {
      await this.indexDocument(index, doc);
    }
  }

  /**
   * Drizzle 검색 엔진에서 지원하지 않는 인덱스 생성 API입니다.
   */
  async createIndex(_config: IndexConfig): Promise<void> {
    await this.ensureCapable();
    throw new SearchCapabilityUnavailableProblem('createIndex', 'DrizzleSearchEngine');
  }

  /**
   * Drizzle 검색 엔진에서 지원하지 않는 인덱스 삭제 API입니다.
   */
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
