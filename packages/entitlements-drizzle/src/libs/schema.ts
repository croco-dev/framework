import { sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * 발행된 플랜 버전별 entitlement set 식별자를 저장하는 PostgreSQL 스키마입니다.
 */
export const planEntitlementSets = pgTable(
  "plan_entitlement_sets",
  {
    planVersionRef: text("plan_version_ref").primaryKey(),
    planId: text("plan_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("plan_entitlement_sets_version_plan_unique").on(table.planVersionRef, table.planId),
  ],
);

/**
 * 플랜별 entitlement 규칙을 저장하는 PostgreSQL 스키마입니다.
 */
export const planEntitlements = pgTable(
  "plan_entitlements",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull(),
    planVersionRef: text("plan_version_ref"),
    featureKey: text("feature_key").notNull(),
    type: text("type", { enum: ["boolean", "metered", "static"] }).notNull(),
    value: integer("value"),
    meterId: text("meter_id"),
    meterBilling: text("meter_billing", { enum: ["local", "required"] }),
    quota: integer("quota"),
    overagePolicy: text("overage_policy", { enum: ["block", "warn", "allow"] }).default("block"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("plan_entitlements_legacy_plan_feature_unique")
      .on(table.planId, table.featureKey)
      .where(sql`plan_version_ref IS NULL`),
    uniqueIndex("plan_entitlements_version_feature_unique")
      .on(table.planVersionRef, table.featureKey)
      .where(sql`plan_version_ref IS NOT NULL`),
    foreignKey({
      columns: [table.planVersionRef, table.planId],
      foreignColumns: [planEntitlementSets.planVersionRef, planEntitlementSets.planId],
      name: "plan_entitlements_version_plan_fk",
    }),
  ],
);
