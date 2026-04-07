import type { AuditLogEntry, AuditQuery } from '@croco/audit-core';
import { AuditLogRepository } from '@croco/audit-core';
import { ProblemFactory } from '@croco/problems-core';
import type { TxManager } from '@croco/tx-core';
import { and, between, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

export type DrizzleDb = BetterSQLite3Database<Record<string, never>>;

export type AuditLogTable = {
  id: SQLiteColumn;
  tenantId: SQLiteColumn;
  actorId: SQLiteColumn;
  action: SQLiteColumn;
  resourceType: SQLiteColumn;
  resourceId: SQLiteColumn;
  payload: SQLiteColumn;
  diff: SQLiteColumn;
  metadata: SQLiteColumn;
  createdAt: SQLiteColumn;
};

export type DrizzleAuditLogRepositoryConfig = {
  table: unknown;
  schema: AuditLogTable;
  serializeJson?: (value: unknown) => string;
  deserializeJson?: (value: string) => unknown;
};

export class DrizzleAuditLogRepository extends AuditLogRepository {
  private readonly table: unknown;
  private readonly schema: AuditLogTable;
  private readonly serializeJson: (value: unknown) => string;
  private readonly deserializeJson: (value: string) => unknown;

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

  private getClient(): DrizzleDb {
    return this.txManager.getClient() ?? this.db;
  }

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

    const [inserted] = await (client as DrizzleDb)
      .insert(this.table as SQLiteTable)
      .values(values)
      .returning();

    if (!inserted) {
      throw ProblemFactory.internalServerError('audit/insert-failed', 'Failed to persist audit log entry');
    }

    return this.mapToEntry(inserted as Record<string, unknown>);
  }

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

    const results = await (client as DrizzleDb)
      .select()
      .from(this.table as SQLiteTable)
      .where(whereClause)
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();

    const results = await (client as DrizzleDb)
      .select()
      .from(this.table as SQLiteTable)
      .where(and(eq(this.schema.tenantId, tenantId), between(this.schema.createdAt, startDate, endDate)))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

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

    const results = await (client as DrizzleDb)
      .select()
      .from(this.table as SQLiteTable)
      .where(whereClause)
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0)
      .orderBy(desc(this.schema.createdAt));

    return (results as Record<string, unknown>[]).map((r) => this.mapToEntry(r));
  }

  async findByResource(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLogEntry[]> {
    const client = this.getClient();

    const results = await (client as DrizzleDb)
      .select()
      .from(this.table as SQLiteTable)
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
