import type { OnboardingState, OnboardingStatus } from "@croco/onboarding-core";
import { boolean, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 온보딩 상태를 저장하는 PostgreSQL 스키마입니다.
 */
export const onboardingStates = pgTable(
  "onboarding_states",
  {
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    onboardingId: text("onboarding_id").notNull(),

    steps: jsonb("steps").$type<OnboardingState["steps"]>().notNull().default({}),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at"),
    status: text("status").$type<OnboardingStatus>(),
    startedAt: timestamp("started_at"),
    currentStepId: text("current_step_id"),
    completionStepId: text("completion_step_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.onboardingId] })],
);
