import { sql } from "drizzle-orm";

export type OnboardingMigrationClient = {
  execute(query: unknown): Promise<unknown>;
};

export async function addCompletionStepIdentity(db: OnboardingMigrationClient): Promise<void> {
  await db.execute(sql`
    ALTER TABLE onboarding_states
      ADD COLUMN IF NOT EXISTS completion_step_id text
  `);
}

export async function removeCompletionStepIdentity(db: OnboardingMigrationClient): Promise<void> {
  await db.execute(sql`
    ALTER TABLE onboarding_states
      DROP COLUMN IF EXISTS completion_step_id
  `);
}
