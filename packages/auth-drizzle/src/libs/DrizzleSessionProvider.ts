import type {
  Session,
  SessionListOptions,
  SessionListResult,
  SessionProvider,
} from "@croco/auth-core";
import type { SQL } from "drizzle-orm";
import { and, eq, or } from "drizzle-orm";
import type { sessions as sessionsSchema } from "../schema";

interface DrizzleDb {
  update: (table: unknown) => {
    set: (data: unknown) => {
      where: (condition: SQL<unknown>) => Promise<unknown>;
    };
  };
  query: {
    sessions: {
      findFirst: (args: { where: SQL<unknown> }) => Promise<unknown>;
      findMany: (args: {
        where?: SQL<unknown>;
        limit?: number;
        offset?: number;
      }) => Promise<unknown[]>;
    };
  };
}

interface SessionRow {
  id: string;
  userId: string;
  clientId: string;
  status:
    | "abandoned"
    | "active"
    | "pending"
    | "ended"
    | "expired"
    | "removed"
    | "replaced"
    | "revoked";
  createdAt: Date;
  updatedAt: Date;
  expireAt: Date | null;
  abandonedAt: Date | null;
  lastActiveAt: Date | null;
}

function assertSessionRow(row: unknown): row is SessionRow {
  if (!row || typeof row !== "object") {
    return false;
  }
  const record = row as Record<string, unknown>;
  const validStatuses = [
    "abandoned",
    "active",
    "pending",
    "ended",
    "expired",
    "removed",
    "replaced",
    "revoked",
  ];
  return (
    typeof record.id === "string" &&
    typeof record.userId === "string" &&
    typeof record.clientId === "string" &&
    typeof record.status === "string" &&
    validStatuses.includes(record.status) &&
    record.createdAt instanceof Date &&
    record.updatedAt instanceof Date
  );
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expireAt: row.expireAt ?? undefined,
    abandonedAt: row.abandonedAt ?? undefined,
    lastActiveAt: row.lastActiveAt ?? undefined,
  };
}

/**
 * 세션 저장소와 회수 기능을 Drizzle로 구현한 제공자입니다.
 */
export class DrizzleSessionProvider implements SessionProvider {
  /**
   * Drizzle DB와 세션 스키마를 받아 제공자를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleDb,
    private readonly schema: { sessions: typeof sessionsSchema },
  ) {}

  /**
   * 세션 ID로 단일 세션을 조회합니다.
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const row = await this.db.query.sessions.findFirst({
      where: eq(this.schema.sessions.id, sessionId),
    });

    if (!assertSessionRow(row)) {
      return null;
    }

    return mapRowToSession(row);
  }

  /**
   * 사용자, 클라이언트, 상태 조건으로 세션 목록을 조회합니다.
   */
  async listSessions(options: SessionListOptions): Promise<SessionListResult> {
    const conditions: SQL<unknown>[] = [];

    if (options.userId) {
      conditions.push(eq(this.schema.sessions.userId, options.userId));
    }

    if (options.clientId) {
      conditions.push(eq(this.schema.sessions.clientId, options.clientId));
    }

    if (options.status) {
      conditions.push(eq(this.schema.sessions.status, options.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db.query.sessions.findMany({
      where: whereClause,
      limit: options.limit,
      offset: options.offset,
    });

    const sessions: Session[] = [];
    for (const row of rows) {
      if (assertSessionRow(row)) {
        sessions.push(mapRowToSession(row));
      }
    }

    return {
      sessions,
      totalCount: sessions.length,
    };
  }

  /**
   * 단일 세션을 revoked 상태로 전환합니다.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(this.schema.sessions)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(this.schema.sessions.id, sessionId));
  }

  /**
   * 사용자의 활성 또는 대기 세션을 모두 revoked 상태로 전환합니다.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    const condition = and(
      eq(this.schema.sessions.userId, userId),
      or(eq(this.schema.sessions.status, "active"), eq(this.schema.sessions.status, "pending")),
    );

    if (condition) {
      await this.db
        .update(this.schema.sessions)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(condition);
    }
  }
}
