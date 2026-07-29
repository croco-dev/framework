import {
  index,
  json,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * API 키를 저장하는 Drizzle 스키마입니다.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prefix: text("prefix").notNull(),
    shortToken: text("short_token").notNull(),
    hash: text("hash").notNull(),
    permissions: text("permissions").array().notNull().default([]),
    name: text("name").notNull(),
    tenantId: text("tenant_id").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    rateLimit: json("rate_limit").$type<{ limit: number; duration: number }>(),
    allowedIps: text("allowed_ips").array(),
  },
  (table) => ({
    shortTokenIdx: index().on(table.shortToken),
    tenantIdx: index().on(table.tenantId),
    uniqueShortToken: unique().on(table.shortToken),
  }),
);

/**
 * API 키 회전의 멱등성, 복구 자료, 이벤트 전달 상태를 저장합니다.
 */
export const apiKeyRotations = pgTable(
  "api_key_rotations",
  {
    oldKeyId: uuid("old_key_id")
      .notNull()
      .primaryKey()
      .references(() => apiKeys.id, { onDelete: "restrict" }),
    newKeyId: uuid("new_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "restrict" }),
    tenantId: text("tenant_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    recoveryCiphertext: text("recovery_ciphertext").notNull(),
    eventStatus: text("event_status", { enum: ["pending", "processing", "completed"] })
      .notNull()
      .default("pending"),
    eventClaimId: text("event_claim_id"),
    eventClaimExpiresAt: timestamp("event_claim_expires_at"),
    eventId: text("event_id").notNull(),
    eventOccurredAt: timestamp("event_occurred_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("api_key_rotations_new_key_unique").on(table.newKeyId),
    uniqueIndex("api_key_rotations_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("api_key_rotations_event_status_idx").on(table.eventStatus, table.eventClaimExpiresAt),
  ],
);

/**
 * 세션 상태를 저장하는 Drizzle 스키마입니다.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    status: text("status", {
      enum: [
        "abandoned",
        "active",
        "pending",
        "ended",
        "expired",
        "removed",
        "replaced",
        "revoked",
      ],
    })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expireAt: timestamp("expire_at"),
    abandonedAt: timestamp("abandoned_at"),
    lastActiveAt: timestamp("last_active_at"),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    clientIdIdx: index().on(table.clientId),
    statusIdx: index().on(table.status),
  }),
);

/**
 * 외부 조직과 내부 테넌트 매핑을 저장하는 Drizzle 스키마입니다.
 */
export const tenantMappings = pgTable(
  "tenant_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalOrgId: text("external_org_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    externalOrgIdx: index().on(table.externalOrgId),
    tenantIdx: index().on(table.tenantId),
    uniqueExternalOrg: unique().on(table.externalOrgId),
  }),
);

/**
 * 사용자 역할 할당을 저장하는 Drizzle 스키마입니다.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    tenantIdx: index().on(table.tenantId),
    uniqueUserTenantRole: unique().on(table.userId, table.tenantId, table.role),
  }),
);
