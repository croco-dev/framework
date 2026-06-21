import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { integer, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";

/**
 * PostgreSQL용 감사 로그 스키마입니다.
 */
export const auditLogsPg = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  payload: jsonb("payload").notNull().default({}),
  diff: jsonb("diff"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * SQLite용 감사 로그 스키마입니다.
 */
export const auditLogsSqlite = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: sqliteText("tenant_id").notNull(),
  actorId: sqliteText("actor_id").notNull(),
  action: sqliteText("action").notNull(),
  resourceType: sqliteText("resource_type").notNull(),
  resourceId: sqliteText("resource_id").notNull(),
  payload: sqliteText("payload").notNull().default("{}"),
  diff: sqliteText("diff"),
  metadata: sqliteText("metadata").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * 감사 로그 한 행의 공통 구조입니다.
 */
export interface AuditLogsTable {
  id: string | number;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: unknown;
  diff: Record<string, unknown> | null;
  metadata: unknown;
  createdAt: Date;
}

/**
 * 저장 시 입력받는 감사 로그 필드입니다.
 */
export type AuditLogInsert = Omit<AuditLogsTable, "id" | "createdAt">;

/**
 * 감사 로그 조회 필터입니다.
 */
export type AuditLogFilter = {
  tenantId: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
};

/**
 * 감사 로그 조회 옵션입니다.
 */
export type AuditLogQueryOptions = {
  limit?: number;
  offset?: number;
  orderBy?: "asc" | "desc";
};
