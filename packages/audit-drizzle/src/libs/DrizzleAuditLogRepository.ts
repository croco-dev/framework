import type { AuditLogEntry, AuditQuery } from "@croco/audit-core";
import { AuditLogRepository } from "@croco/audit-core";
import { ProblemFactory } from "@croco/problems-core";
import type { TxManager } from "@croco/tx-core";
import type { DrizzleInsertCapability, DrizzleSelectCapability } from "@croco/tx-drizzle";
import {
  type AnyColumn,
  and,
  between,
  desc,
  eq,
  gte,
  lte,
  type SQL,
  type Table,
} from "drizzle-orm";

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

type DrizzleAuditQueryClient = DrizzleInsertCapability<(table: Table) => InsertValuesQuery> &
  DrizzleSelectCapability<() => SelectFromQuery>;

/**
 * 감사 로그 저장소에서 사용하는 최소 Drizzle 데이터베이스 계약입니다.
 */
export type DrizzleAuditDatabase = DrizzleAuditQueryClient;

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
    private readonly db: DrizzleAuditDatabase,
    private readonly txManager: TxManager<DrizzleAuditDatabase>,
    config: DrizzleAuditLogRepositoryConfig,
  ) {
    super();
    this.table = config.table;
    this.schema = config.schema;
    this.serializeJson = config.serializeJson ?? JSON.stringify;
    this.deserializeJson = config.deserializeJson ?? JSON.parse;
  }

  private getClient(): DrizzleAuditQueryClient {
    return this.txManager.getClient() ?? this.db;
  }

  /**
   * 감사 로그 항목을 생성하고 저장된 결과를 반환합니다.
   */
  async create(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<AuditLogEntry> {
    const client = this.getClient();
    const now = new Date();

    const values = {
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      payload: this.encodeJsonColumn(entry.payload, this.schema.payload),
      diff: entry.diff === null ? null : this.encodeJsonColumn(entry.diff, this.schema.diff),
      metadata: this.encodeJsonColumn(entry.metadata, this.schema.metadata),
      createdAt: now,
    };

    const [inserted] = await client
      .insert(this.table as Table)
      .values(values)
      .returning();

    if (!inserted) {
      throw ProblemFactory.internalServerError(
        "audit/insert-failed",
        "Failed to persist audit log entry",
      );
    }

    return this.mapToEntry(inserted as Record<string, unknown>);
  }

  /**
   * 테넌트 기준으로 감사 로그를 조회합니다.
   */
  async find(
    query: AuditQuery & { actorId?: string; resourceType?: string; resourceId?: string },
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
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();

    const results = await client
      .select()
      .from(this.table as Table)
      .where(
        and(eq(this.schema.tenantId, tenantId), between(this.schema.createdAt, startDate, endDate)),
      )
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
    options?: { limit?: number; offset?: number; startDate?: Date; endDate?: Date },
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();
    const conditions: SQL<unknown>[] = [
      eq(this.schema.tenantId, tenantId),
      eq(this.schema.actorId, actorId),
    ];

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
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();

    const results = await client
      .select()
      .from(this.table as Table)
      .where(
        and(
          eq(this.schema.tenantId, tenantId),
          eq(this.schema.resourceType, resourceType),
          eq(this.schema.resourceId, resourceId),
        ),
      )
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  private encodeJsonColumn(value: unknown, column: AnyColumn): unknown {
    return DRIZZLE_JSON_COLUMN_TYPES.has(column.columnType) ? value : this.serializeJson(value);
  }

  private decodeJsonColumn(value: unknown): unknown {
    return typeof value === "string" ? this.deserializeJson(value) : value;
  }

  private mapToEntry(raw: Record<string, unknown>): AuditLogEntry {
    return {
      id: String(raw.id),
      tenantId: String(raw.tenantId),
      actorId: String(raw.actorId),
      action: String(raw.action),
      resourceType: String(raw.resourceType),
      resourceId: String(raw.resourceId),
      payload: this.decodeJsonColumn(raw.payload) as Record<string, unknown>,
      diff:
        raw.diff === null || raw.diff === undefined
          ? null
          : (this.decodeJsonColumn(raw.diff) as Record<string, unknown>),
      metadata: this.decodeJsonColumn(raw.metadata) as Record<string, unknown>,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt)),
    };
  }
}

const DRIZZLE_JSON_COLUMN_TYPES = new Set([
  "GelJson",
  "MySqlJson",
  "PgJson",
  "PgJsonb",
  "SingleStoreJson",
  "SQLiteBlobJson",
  "SQLiteTextJson",
]);
