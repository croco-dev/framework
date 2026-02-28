import type {
  AccessProvider,
  CheckRequest,
  CheckResult,
  GrantRequest,
  ListRequest,
  RevokeRequest,
} from '@croco/access-core';
import { sql } from 'drizzle-orm';

type DrizzleDb = {
  execute: (query: SQLWrapper) => Promise<{ rows: unknown[] }>;
};

type SQLWrapper = { getSQL: () => unknown };

function normalizeAllowedValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === '1' || normalized === 'true' || normalized === 't') {
      return true;
    }

    if (normalized === '0' || normalized === 'false' || normalized === 'f') {
      return false;
    }
  }

  return false;
}

const MAX_TRAVERSAL_DEPTH = 10;

export class DrizzleAccessProvider implements AccessProvider {
  constructor(private readonly db: DrizzleDb) {}

  async check(request: CheckRequest): Promise<CheckResult> {
    const result = await this.db.execute(
      sql`
        WITH RECURSIVE reachable(object, relation, subject, depth) AS (
          SELECT object, relation, subject, 1 as depth
          FROM relation_tuples
          WHERE tenant_id = ${request.tenantId}
            AND subject = ${request.subject}
            AND object = ${request.object}
            AND relation = ${request.relation}
          
          UNION
          
          SELECT rt.object, rt.relation, rt.subject, r.depth + 1
          FROM relation_tuples rt
          JOIN reachable r ON rt.subject = r.object
          WHERE rt.tenant_id = ${request.tenantId}
            AND r.depth < ${MAX_TRAVERSAL_DEPTH}
        )
        SELECT EXISTS(
          SELECT 1 FROM reachable WHERE object = ${request.object}
        ) as allowed
      `
    );

    const firstRow = result.rows[0] as { allowed?: unknown } | undefined;
    return { allowed: normalizeAllowedValue(firstRow?.allowed) };
  }

  async grant(request: GrantRequest): Promise<void> {
    await this.db.execute(
      sql`
        INSERT INTO relation_tuples (tenant_id, object, relation, subject)
        VALUES (${request.tenantId}, ${request.tuple.object}, ${request.tuple.relation}, ${request.tuple.subject})
        ON CONFLICT (tenant_id, object, relation, subject) DO NOTHING
      `
    );
  }

  async revoke(request: RevokeRequest): Promise<void> {
    await this.db.execute(
      sql`
        DELETE FROM relation_tuples
        WHERE tenant_id = ${request.tenantId}
          AND object = ${request.tuple.object}
          AND relation = ${request.tuple.relation}
          AND subject = ${request.tuple.subject}
      `
    );
  }

  async list(request: ListRequest) {
    const conditions = [sql`tenant_id = ${request.tenantId}`];

    if (request.object) {
      conditions.push(sql`object = ${request.object}`);
    }
    if (request.subject) {
      conditions.push(sql`subject = ${request.subject}`);
    }
    if (request.relation) {
      conditions.push(sql`relation = ${request.relation}`);
    }

    const whereClause = conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);

    const result = await this.db.execute(
      sql`
        SELECT object, relation, subject
        FROM relation_tuples
        WHERE ${whereClause}
      `
    );

    return result.rows as { object: string; relation: string; subject: string }[];
  }
}
