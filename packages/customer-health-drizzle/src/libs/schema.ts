import type { HealthStatus, HealthTrend, SignalCategory } from "@croco/customer-health-core";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 테넌트 건강 점수 이력을 저장하는 PostgreSQL 스키마입니다.
 */
export const tenantHealthScores = pgTable("tenant_health_scores", {
  tenantId: text("tenant_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  status: text("status").notNull().$type<HealthStatus>(),
  categoryScores: jsonb("category_scores").$type<Record<SignalCategory, number>>().notNull(),
  signals: jsonb("signals").notNull(),
  trend: text("trend").notNull().$type<HealthTrend>(),
  previousScore: integer("previous_score"),
  calculatedAt: timestamp("calculated_at").notNull(),
});
