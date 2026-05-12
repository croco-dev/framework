import type { ApiKey } from "@croco/auth-core";
import { ApiKeyCreationFailedProblem, ApiKeyStore } from "@croco/auth-core";
import type { SQLWrapper } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { apiKeys as apiKeysSchema } from "../schema";

interface DrizzleDb {
  insert: (table: unknown) => {
    values: (data: unknown) => {
      returning: () => Promise<unknown[]>;
    };
  };
  update: (table: unknown) => {
    set: (data: unknown) => {
      where: (condition: SQLWrapper) => {
        returning: () => Promise<unknown[]>;
      };
    };
  };
  delete: (table: unknown) => {
    where: (condition: SQLWrapper) => Promise<unknown>;
  };
  query: {
    apiKeys: {
      findFirst: (args: { where: SQLWrapper }) => Promise<unknown>;
      findMany: (args: { where: SQLWrapper }) => Promise<unknown[]>;
    };
  };
}

interface ApiKeyRow {
  id: string;
  prefix: string;
  shortToken: string;
  hash: string;
  permissions: string[];
  name: string;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  rateLimit: { limit: number; duration: number } | null;
  allowedIps: string[] | null;
}

function assertApiKeyRow(row: unknown): row is ApiKeyRow {
  if (!row || typeof row !== "object") {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.prefix === "string" &&
    typeof record.shortToken === "string" &&
    typeof record.hash === "string" &&
    Array.isArray(record.permissions) &&
    typeof record.name === "string" &&
    typeof record.tenantId === "string" &&
    typeof record.createdBy === "string"
  );
}

function mapRowToApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    prefix: row.prefix,
    shortToken: row.shortToken,
    hash: row.hash,
    permissions: row.permissions,
    name: row.name,
    tenantId: row.tenantId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    rateLimit: row.rateLimit ?? undefined,
    allowedIps: row.allowedIps ?? undefined,
  };
}

/**
 * API 키 저장소를 Drizzle 쿼리로 구현한 클래스입니다.
 */
export class DrizzleApiKeyStore extends ApiKeyStore {
  /**
   * Drizzle DB와 API 키 스키마를 받아 저장소를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleDb,
    private readonly schema: { apiKeys: typeof apiKeysSchema },
  ) {
    super();
  }

  /**
   * ID로 API 키를 조회합니다.
   */
  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.db.query.apiKeys.findFirst({
      where: eq(this.schema.apiKeys.id, id),
    });

    if (!assertApiKeyRow(row)) {
      return null;
    }

    return mapRowToApiKey(row);
  }

  /**
   * 짧은 토큰 값으로 API 키를 조회합니다.
   */
  async findByShortToken(shortToken: string): Promise<ApiKey | null> {
    const row = await this.db.query.apiKeys.findFirst({
      where: eq(this.schema.apiKeys.shortToken, shortToken),
    });

    if (!assertApiKeyRow(row)) {
      return null;
    }

    return mapRowToApiKey(row);
  }

  /**
   * 새 API 키를 저장하고 저장된 값을 반환합니다.
   */
  async save(key: Omit<ApiKey, "id" | "createdAt">): Promise<ApiKey> {
    const [row] = await this.db
      .insert(this.schema.apiKeys)
      .values({
        prefix: key.prefix,
        shortToken: key.shortToken,
        hash: key.hash,
        permissions: key.permissions,
        name: key.name,
        tenantId: key.tenantId,
        createdBy: key.createdBy,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt,
        rateLimit: key.rateLimit ?? null,
        allowedIps: key.allowedIps ?? null,
      })
      .returning();

    if (!assertApiKeyRow(row)) {
      throw new ApiKeyCreationFailedProblem();
    }

    return mapRowToApiKey(row);
  }

  /**
   * 마지막 사용 시각을 현재 시각으로 갱신합니다.
   */
  async updateLastUsed(id: string): Promise<void> {
    await this.db
      .update(this.schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(this.schema.apiKeys.id, id));
  }

  /**
   * API 키를 폐기 처리합니다.
   */
  async revoke(id: string): Promise<void> {
    await this.db
      .update(this.schema.apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(this.schema.apiKeys.id, id));
  }

  /**
   * 테넌트에 속한 API 키 목록을 조회합니다.
   */
  async listByTenant(tenantId: string): Promise<ApiKey[]> {
    const rows = await this.db.query.apiKeys.findMany({
      where: eq(this.schema.apiKeys.tenantId, tenantId),
    });

    const apiKeys: ApiKey[] = [];
    for (const row of rows) {
      if (assertApiKeyRow(row)) {
        apiKeys.push(mapRowToApiKey(row));
      }
    }

    return apiKeys;
  }

  /**
   * API 키를 영구 삭제합니다.
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(this.schema.apiKeys).where(eq(this.schema.apiKeys.id, id));
  }
}
