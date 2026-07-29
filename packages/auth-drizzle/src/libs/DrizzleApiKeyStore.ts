import type { ApiKey, ApiKeyRotation, ApiKeyRotationInput } from "@croco/auth-core";
import {
  ApiKeyCreationFailedProblem,
  ApiKeyRotationConflictProblem,
  ApiKeyStore,
} from "@croco/auth-core";
import type { SQLWrapper } from "drizzle-orm";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { apiKeyRotations as apiKeyRotationsSchema, apiKeys as apiKeysSchema } from "../schema";
import { apiKeyRotations as defaultApiKeyRotations } from "../schema";

interface ReturningQuery {
  returning: () => Promise<unknown[]>;
}

interface InsertValuesQuery extends ReturningQuery {
  onConflictDoNothing: (config?: { target?: unknown }) => ReturningQuery;
}

interface SelectWhereQuery {
  limit: (limit: number) => Promise<unknown[]>;
  for: (strength: "update") => Promise<unknown[]>;
}

interface DrizzleClient {
  select: () => {
    from: (table: unknown) => {
      where: (condition: SQLWrapper) => SelectWhereQuery;
    };
  };
  insert: (table: unknown) => {
    values: (data: unknown) => InsertValuesQuery;
  };
  update: (table: unknown) => {
    set: (data: unknown) => {
      where: (condition: SQLWrapper) => ReturningQuery & PromiseLike<unknown>;
    };
  };
  delete: (table: unknown) => {
    where: (condition: SQLWrapper) => Promise<unknown>;
  };
}

interface DrizzleDb extends DrizzleClient {
  transaction: <T>(callback: (tx: DrizzleClient) => Promise<T>) => Promise<T>;
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

interface ApiKeyRotationRow {
  oldKeyId: string;
  newKeyId: string;
  tenantId: string;
  idempotencyKey: string;
  recoveryCiphertext: string;
  eventStatus: "pending" | "processing" | "completed";
  eventClaimId: string | null;
  eventClaimExpiresAt: Date | null;
  eventId: string;
  eventOccurredAt: Date;
  createdAt: Date;
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

function assertApiKeyRotationRow(row: unknown): row is ApiKeyRotationRow {
  if (!row || typeof row !== "object") {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.oldKeyId === "string" &&
    typeof record.newKeyId === "string" &&
    typeof record.tenantId === "string" &&
    typeof record.idempotencyKey === "string" &&
    typeof record.recoveryCiphertext === "string" &&
    (record.eventStatus === "pending" ||
      record.eventStatus === "processing" ||
      record.eventStatus === "completed") &&
    typeof record.eventId === "string" &&
    record.eventOccurredAt instanceof Date &&
    record.createdAt instanceof Date
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

function requireCondition(condition: SQLWrapper | undefined): SQLWrapper {
  if (!condition) {
    throw new ApiKeyCreationFailedProblem("Failed to build API key persistence condition");
  }
  return condition;
}

/**
 * API 키 저장소를 Drizzle 쿼리로 구현한 클래스입니다.
 */
export class DrizzleApiKeyStore extends ApiKeyStore {
  private readonly schema: {
    apiKeys: typeof apiKeysSchema;
    apiKeyRotations: typeof apiKeyRotationsSchema;
  };

  /**
   * Drizzle DB와 API 키 스키마를 받아 저장소를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleDb,
    schema: {
      apiKeys: typeof apiKeysSchema;
      apiKeyRotations?: typeof apiKeyRotationsSchema;
    },
  ) {
    super();
    this.schema = {
      apiKeys: schema.apiKeys,
      apiKeyRotations: schema.apiKeyRotations ?? defaultApiKeyRotations,
    };
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
   * 새 키 저장, 기존 키 폐기, 회전 복구 의도 기록을 한 트랜잭션으로 처리합니다.
   */
  async rotate(input: ApiKeyRotationInput): Promise<ApiKeyRotation> {
    return this.db.transaction(async (tx) => {
      const [oldKeyRow] = await tx
        .select()
        .from(this.schema.apiKeys)
        .where(eq(this.schema.apiKeys.id, input.oldKeyId))
        .for("update");
      if (!assertApiKeyRow(oldKeyRow)) {
        throw new ApiKeyRotationConflictProblem("API key is not active or cannot be rotated");
      }

      const existing = await this.findRotationWithClient(
        tx,
        input.oldKeyId,
        input.tenantId,
        input.idempotencyKey,
      );
      if (existing) {
        return existing;
      }

      const oldKey = mapRowToApiKey(oldKeyRow);
      if (!oldKey || oldKey.tenantId !== input.tenantId || oldKey.revokedAt) {
        throw new ApiKeyRotationConflictProblem("API key is not active or cannot be rotated");
      }

      const [replacementRow] = await tx
        .insert(this.schema.apiKeys)
        .values({
          id: input.replacement.id,
          prefix: oldKey.prefix,
          shortToken: input.replacement.shortToken,
          hash: input.replacement.hash,
          permissions: oldKey.permissions,
          name: oldKey.name,
          tenantId: oldKey.tenantId,
          createdBy: oldKey.createdBy,
          expiresAt: oldKey.expiresAt,
          revokedAt: null,
          lastUsedAt: null,
          rateLimit: oldKey.rateLimit ?? null,
          allowedIps: oldKey.allowedIps ?? null,
        })
        .returning();

      if (!assertApiKeyRow(replacementRow)) {
        throw new ApiKeyCreationFailedProblem();
      }

      const [insertedIntent] = await tx
        .insert(this.schema.apiKeyRotations)
        .values({
          oldKeyId: input.oldKeyId,
          newKeyId: input.replacement.id,
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
          recoveryCiphertext: input.recoveryCiphertext,
          eventStatus: input.eventStatus,
          eventClaimId: input.eventClaimId,
          eventClaimExpiresAt: input.eventClaimExpiresAt,
          eventId: input.eventId,
          eventOccurredAt: input.eventOccurredAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!assertApiKeyRotationRow(insertedIntent)) {
        throw new ApiKeyRotationConflictProblem();
      }

      const revokedRows = await tx
        .update(this.schema.apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          requireCondition(
            and(eq(this.schema.apiKeys.id, input.oldKeyId), isNull(this.schema.apiKeys.revokedAt)),
          ),
        )
        .returning();
      if (revokedRows.length !== 1) {
        throw new ApiKeyRotationConflictProblem("API key was revoked concurrently");
      }

      return this.mapToRotation(insertedIntent, mapRowToApiKey(replacementRow));
    });
  }

  async claimRotationEvent(
    oldKeyId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
  ): Promise<ApiKeyRotation | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(this.schema.apiKeyRotations)
        .set({
          eventStatus: "processing",
          eventClaimId: claimId,
          eventClaimExpiresAt: claimExpiresAt,
        })
        .where(
          requireCondition(
            and(
              eq(this.schema.apiKeyRotations.oldKeyId, oldKeyId),
              eq(this.schema.apiKeyRotations.idempotencyKey, idempotencyKey),
              or(
                eq(this.schema.apiKeyRotations.eventStatus, "pending"),
                and(
                  eq(this.schema.apiKeyRotations.eventStatus, "processing"),
                  or(
                    isNull(this.schema.apiKeyRotations.eventClaimExpiresAt),
                    lt(this.schema.apiKeyRotations.eventClaimExpiresAt, new Date()),
                  ),
                ),
              ),
            ),
          ),
        )
        .returning();

      if (!assertApiKeyRotationRow(row)) {
        return null;
      }
      const replacement = await this.findKeyWithClient(tx, row.newKeyId);
      if (!replacement) {
        throw new ApiKeyCreationFailedProblem("Rotation replacement key is missing");
      }
      return this.mapToRotation(row, replacement);
    });
  }

  async completeRotationEvent(
    oldKeyId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<ApiKeyRotation | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(this.schema.apiKeyRotations)
        .set({
          eventStatus: "completed",
          eventClaimId: null,
          eventClaimExpiresAt: null,
        })
        .where(
          requireCondition(
            and(
              eq(this.schema.apiKeyRotations.oldKeyId, oldKeyId),
              eq(this.schema.apiKeyRotations.idempotencyKey, idempotencyKey),
              eq(this.schema.apiKeyRotations.eventStatus, "processing"),
              eq(this.schema.apiKeyRotations.eventClaimId, claimId),
            ),
          ),
        )
        .returning();

      if (!assertApiKeyRotationRow(row)) {
        return null;
      }
      const replacement = await this.findKeyWithClient(tx, row.newKeyId);
      if (!replacement) {
        throw new ApiKeyCreationFailedProblem("Rotation replacement key is missing");
      }
      return this.mapToRotation(row, replacement);
    });
  }

  async releaseRotationEvent(
    oldKeyId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void> {
    await this.db
      .update(this.schema.apiKeyRotations)
      .set({
        eventStatus: "pending",
        eventClaimId: null,
        eventClaimExpiresAt: null,
      })
      .where(
        requireCondition(
          and(
            eq(this.schema.apiKeyRotations.oldKeyId, oldKeyId),
            eq(this.schema.apiKeyRotations.idempotencyKey, idempotencyKey),
            eq(this.schema.apiKeyRotations.eventStatus, "processing"),
            eq(this.schema.apiKeyRotations.eventClaimId, claimId),
          ),
        ),
      );
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
    await this.db.transaction(async (tx) => {
      await tx
        .delete(this.schema.apiKeyRotations)
        .where(
          requireCondition(
            or(
              eq(this.schema.apiKeyRotations.oldKeyId, id),
              eq(this.schema.apiKeyRotations.newKeyId, id),
            ),
          ),
        );
      await tx.delete(this.schema.apiKeys).where(eq(this.schema.apiKeys.id, id));
    });
  }

  private async findKeyWithClient(client: DrizzleClient, id: string): Promise<ApiKey | null> {
    const [row] = await client
      .select()
      .from(this.schema.apiKeys)
      .where(eq(this.schema.apiKeys.id, id))
      .limit(1);
    return assertApiKeyRow(row) ? mapRowToApiKey(row) : null;
  }

  private async findRotationWithClient(
    client: DrizzleClient,
    oldKeyId: string,
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ApiKeyRotation | null> {
    const [row] = await client
      .select()
      .from(this.schema.apiKeyRotations)
      .where(
        requireCondition(
          or(
            eq(this.schema.apiKeyRotations.oldKeyId, oldKeyId),
            and(
              eq(this.schema.apiKeyRotations.tenantId, tenantId),
              eq(this.schema.apiKeyRotations.idempotencyKey, idempotencyKey),
            ),
          ),
        ),
      )
      .limit(1);

    if (!assertApiKeyRotationRow(row)) {
      return null;
    }
    if (
      row.oldKeyId !== oldKeyId ||
      row.tenantId !== tenantId ||
      row.idempotencyKey !== idempotencyKey
    ) {
      throw new ApiKeyRotationConflictProblem();
    }

    const replacement = await this.findKeyWithClient(client, row.newKeyId);
    if (!replacement) {
      throw new ApiKeyCreationFailedProblem("API key rotation replacement is missing");
    }
    return this.mapToRotation(row, replacement);
  }

  private mapToRotation(row: ApiKeyRotationRow, replacement: ApiKey): ApiKeyRotation {
    return {
      oldKeyId: row.oldKeyId,
      replacement,
      tenantId: row.tenantId,
      idempotencyKey: row.idempotencyKey,
      recoveryCiphertext: row.recoveryCiphertext,
      eventStatus: row.eventStatus,
      eventClaimId: row.eventClaimId,
      eventClaimExpiresAt: row.eventClaimExpiresAt,
      eventId: row.eventId,
      eventOccurredAt: row.eventOccurredAt,
      createdAt: row.createdAt,
    };
  }
}
