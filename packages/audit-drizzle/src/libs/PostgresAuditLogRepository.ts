import { type AuditLogEntry, AuditLogRepository } from '@croco/audit-core';
import { Component, Inject } from '@croco/framework-context';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLogs } from './schema';

export const DRIZZLE_TOKEN = 'DRIZZLE_TOKEN';

@Component()
export class PostgresAuditLogRepository extends AuditLogRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: NodePgDatabase<Record<string, never>>) {
    super();
  }

  async create(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const [inserted] = await this.db
      .insert(auditLogs)
      .values({
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        payload: entry.payload,
        diff: entry.diff,
        metadata: entry.metadata,
      })
      .returning();

    return this.mapToEntry(inserted);
  }

  async find(query: { tenantId: string; limit?: number; offset?: number }): Promise<AuditLogEntry[]> {
    const results = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, query.tenantId))
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0)
      .orderBy(desc(auditLogs.createdAt));

    return results.map(this.mapToEntry);
  }

  private mapToEntry(raw: typeof auditLogs.$inferSelect): AuditLogEntry {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      actorId: raw.actorId,
      action: raw.action,
      resourceType: raw.resourceType,
      resourceId: raw.resourceId,
      payload: raw.payload as Record<string, unknown>,
      diff: raw.diff as Record<string, unknown> | null,
      metadata: raw.metadata as Record<string, unknown>,
      createdAt: raw.createdAt,
    };
  }
}
