import type {
  AccessProvider,
  CheckRequest,
  CheckResult,
  GrantRequest,
  ListRequest,
  RelationTuple,
  RevokeRequest,
} from "@croco/access-core";
import { sql } from "drizzle-orm";

interface DrizzleDb {
  execute: (query: SQLWrapper) => Promise<{ rows: unknown[] }>;
}

interface SQLWrapper {
  getSQL: () => unknown;
}

interface RelationTupleRow {
  object: string;
  relation: string;
  subject: string;
}

interface AllowedRow {
  allowed: unknown;
}

function isResourceObject(value: string): value is `${string}:${string}` {
  return /^[^:]+:[^:]+$/.test(value);
}

function isSubject(
  value: string,
): value is `user:${string}` | `role:${string}` | `group:${string}` {
  return /^(user|role|group):[^:]+$/.test(value);
}

function normalizeAllowedValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "1" || normalized === "true" || normalized === "t") {
      return true;
    }

    if (normalized === "0" || normalized === "false" || normalized === "f") {
      return false;
    }
  }

  return false;
}

function assertRelationTupleRow(row: unknown): row is RelationTupleRow & {
  object: `${string}:${string}`;
  subject: `user:${string}` | `role:${string}` | `group:${string}`;
} {
  if (!row || typeof row !== "object") {
    return false;
  }

  const record = row as Record<string, unknown>;
  const isObjectString = typeof record.object === "string";
  const isRelationString = typeof record.relation === "string";
  const isSubjectString = typeof record.subject === "string";

  if (!isObjectString || !isRelationString || !isSubjectString) {
    return false;
  }

  return isResourceObject(record.object as string) && isSubject(record.subject as string);
}

const MAX_TRAVERSAL_DEPTH = 10;

/**
 * 관계 튜플 테이블을 사용하는 AccessProvider 구현체입니다.
 */
export class DrizzleAccessProvider implements AccessProvider {
  /**
   * Drizzle 실행 클라이언트를 주입해 접근 제어 저장소를 초기화합니다.
   */
  constructor(private readonly db: DrizzleDb) {}

  /**
   * 요청한 관계가 직접 또는 재귀 관계를 통해 허용되는지 확인합니다.
   */
  async check(request: CheckRequest): Promise<CheckResult> {
    const result = await this.db.execute(
      sql`
        WITH RECURSIVE reachable(object, relation, subject, depth) AS (
          SELECT object, relation, subject, 1 as depth
          FROM relation_tuples
          WHERE tenant_id = ${request.tenantId}
            AND subject = ${request.subject}
            AND (
              (object = ${request.object} AND relation = ${request.relation})
              OR (relation = 'member' AND (object LIKE 'group:%' OR object LIKE 'role:%'))
            )
          
          UNION
          
          SELECT rt.object, rt.relation, rt.subject, r.depth + 1
          FROM relation_tuples rt
          JOIN reachable r ON rt.subject = r.object
          WHERE rt.tenant_id = ${request.tenantId}
            AND r.depth < ${MAX_TRAVERSAL_DEPTH}
            AND (
              (rt.object = ${request.object} AND rt.relation = ${request.relation})
              OR (rt.relation = 'member' AND (rt.object LIKE 'group:%' OR rt.object LIKE 'role:%'))
            )
        )
        SELECT EXISTS(
          SELECT 1
          FROM reachable
          WHERE object = ${request.object}
            AND relation = ${request.relation}
        ) as allowed
      `,
    );

    const firstRow = result.rows[0] as AllowedRow | undefined;
    return { allowed: normalizeAllowedValue(firstRow?.allowed) };
  }

  /**
   * 관계 튜플을 추가합니다. 중복 튜플은 무시합니다.
   */
  async grant(request: GrantRequest): Promise<void> {
    await this.db.execute(
      sql`
        INSERT INTO relation_tuples (tenant_id, object, relation, subject)
        VALUES (${request.tenantId}, ${request.tuple.object}, ${request.tuple.relation}, ${request.tuple.subject})
        ON CONFLICT (tenant_id, object, relation, subject) DO NOTHING
      `,
    );
  }

  /**
   * 관계 튜플을 삭제합니다.
   */
  async revoke(request: RevokeRequest): Promise<void> {
    await this.db.execute(
      sql`
        DELETE FROM relation_tuples
        WHERE tenant_id = ${request.tenantId}
          AND object = ${request.tuple.object}
          AND relation = ${request.tuple.relation}
          AND subject = ${request.tuple.subject}
      `,
    );
  }

  /**
   * 조건에 맞는 관계 튜플 목록을 조회합니다.
   */
  async list(request: ListRequest): Promise<RelationTuple[]> {
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
      `,
    );

    const tuples: RelationTuple[] = [];

    for (const row of result.rows) {
      if (assertRelationTupleRow(row)) {
        tuples.push({
          object: row.object,
          relation: row.relation,
          subject: row.subject,
        });
      }
    }

    return tuples;
  }
}
