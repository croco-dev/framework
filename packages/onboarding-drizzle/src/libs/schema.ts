import type { OnboardingState } from '@croco/onboarding-core';
import { boolean, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const onboardingStates = pgTable(
  'onboarding_states',
  {
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    onboardingId: text('onboarding_id').notNull(),

    steps: jsonb('steps').$type<OnboardingState['steps']>().notNull().default({}),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.onboardingId] })]
);
