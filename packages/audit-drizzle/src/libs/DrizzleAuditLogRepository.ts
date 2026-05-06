import type { AuditLogEntry, AuditQuery } from '@croco/audit-core';
import { AuditLogRepository } from '@croco/audit-core';
import { ProblemFactory } from '@croco/problems-core';
import type { TxManager } from '@croco/tx-core';
import { and, between, desc, eq, gte, lte, type AnyColumn, type SQL, type Table } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type InsertReturningQuery = {
  returning(): Promise<unknown[]>;
};

type InsertValuesQuery = {
  values(values: Record<string, unknown>): InsertReturningQuery;
};

type SelectOrderQuery = {
  orderBy(order: SQL<unknown>): Promise<unknown[]>;
};

type SelectOffsetQuery = {
  offset(offset: number): SelectOrderQuery;
};

type SelectLimitQuery = {
  limit(limit: number): SelectOffsetQuery;
};

type SelectWhereQuery = {
  where(condition: SQL<unknown> | undefined): SelectLimitQuery;
};

type SelectFromQuery = {
  from(table: Table): SelectWhereQuery;
};

type DrizzleQueryClient = {
  insert(table: Table): InsertValuesQuery;
  select(): SelectFromQuery;
};

/**
 * 감사 로그 저장소에서 사용하는 기본 Drizzle 클라이언트 타입입니다.
 */
export type DrizzleDb = DrizzleQueryClient &
  (BetterSQLite3Database<Record<string, never>> | NodePgDatabase<Record<string, never>>);

/**
 * 감사 로그 테이블 컬럼 매핑 정의입니다.
 */
export type AuditLogTable = {
  id: AnyColumn;
  tenantId: AnyColumn;
  actorId: AnyColumn;
  action: AnyColumn;
  resourceType: AnyColumn;
  resourceId: AnyColumn;
  payload: AnyColumn;
  diff: AnyColumn;
  metadata: AnyColumn;
  createdAt: AnyColumn;
};

/**
 * 감사 로그 저장소 초기화에 필요한 설정입니다.
 */
export type DrizzleAuditLogRepositoryConfig = {
  table: unknown;
  schema: AuditLogTable;
  serializeJson?: (value: unknown) => string;
  deserializeJson?: (value: string) => unknown;
};

/**
 * 감사 로그 리포지토리를 Drizzle 기반으로 구현한 클래스입니다.
 */
export class DrizzleAuditLogRepository extends AuditLogRepository {
  private readonly table: unknown;
  private readonly schema: AuditLogTable;
  private readonly serializeJson: (value: unknown) => string;
  private readonly deserializeJson: (value: string) => unknown;

  /**
   * DB, 트랜잭션 매니저, 스키마 설정을 받아 저장소를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleDb,
    private readonly txManager: TxManager<DrizzleDb>,
    config: DrizzleAuditLogRepositoryConfig
  ) {
    super();
    this.table = config.table;
    this.schema = config.schema;
    this.serializeJson = config.serializeJson ?? JSON.stringify;
    this.deserializeJson = config.deserializeJson ?? JSON.parse;
  }

  private getClient(): DrizzleQueryClient {
    return this.txManager.getClient() ?? this.db;
  }

  /**
   * 감사 로그 항목을 생성하고 저장된 결과를 반환합니다.
   */
  async create(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const client = this.getClient();
    const now = new Date();

    const values = {
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      payload: this.serializeJson(entry.payload),
      diff: entry.diff ? this.serializeJson(entry.diff) : null,
      metadata: this.serializeJson(entry.metadata),
      createdAt: now,
    };

    const [inserted] = await client.insert(this.table as Table).values(values).returning();

    if (!inserted) {
      throw ProblemFactory.internalServerError('audit/insert-failed', 'Failed to persist audit log entry');
    }

    return this.mapToEntry(inserted as Record<string, unknown>);
  }

  /**
   * 테넌트 기준으로 감사 로그를 조회합니다.
   */
  async find(
    query: AuditQuery & { actorId?: string; resourceType?: string; resourceId?: string }
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();
    const conditions: SQL<unknown>[] = [eq(this.schema.tenantId, query.tenantId)];

    if (query.actorId) {
      conditions.push(eq(this.schema.actorId, query.actorId));
    }
    if (query.resourceType) {
      conditions.push(eq(this.schema.resourceType, query.resourceType));
    }
    if (query.resourceId) {
      conditions.push(eq(this.schema.resourceId, query.resourceId));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const results = await client
      .select()
      .from(this.table as Table)
      .where(whereClause)
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  /**
   * 기간 범위로 감사 로그를 조회합니다.
   */
  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();

    const results = await client
      .select()
      .from(this.table as Table)
      .where(and(eq(this.schema.tenantId, tenantId), between(this.schema.createdAt, startDate, endDate)))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  /**
   * 액터 기준으로 감사 로그를 조회합니다.
   */
  async findByActor(
    tenantId: string,
    actorId: string,
    options?: { limit?: number; offset?: number; startDate?: Date; endDate?: Date }
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();
    const conditions: SQL<unknown>[] = [eq(this.schema.tenantId, tenantId), eq(this.schema.actorId, actorId)];

    if (options?.startDate && options?.endDate) {
      conditions.push(between(this.schema.createdAt, options.startDate, options.endDate));
    } else if (options?.startDate) {
      conditions.push(gte(this.schema.createdAt, options.startDate));
    } else if (options?.endDate) {
      conditions.push(lte(this.schema.createdAt, options.endDate));
    }

    const whereClause = and(...conditions);

    const results = await client
      .select()
      .from(this.table as Table)
      .where(whereClause)
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  /**
   * 리소스 기준으로 감사 로그를 조회합니다.
   */
  async findByResource(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();

    const results = await client
      .select()
      .from(this.table as Table)
      .where(
        and(
          eq(this.schema.tenantId, tenantId),
          eq(this.schema.resourceType, resourceType),
          eq(this.schema.resourceId, resourceId)
        )
      )
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  private mapToEntry(raw: Record<string, unknown>): AuditLogEntry {
    return {
      id: String(raw.id),
      tenantId: String(raw.tenantId),
      actorId: String(raw.actorId),
      action: String(raw.action),
      resourceType: String(raw.resourceType),
      resourceId: String(raw.resourceId),
      payload: this.deserializeJson(String(raw.payload)) as Record<string, unknown>,
      diff: raw.diff ? (this.deserializeJson(String(raw.diff)) as Record<string, unknown>) : null,
      metadata: this.deserializeJson(String(raw.metadata)) as Record<string, unknown>,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt)),
    };
  }
}
