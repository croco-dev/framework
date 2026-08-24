import { sql } from "drizzle-orm";
import type { OnboardingMigrationClient } from "./addCompletionStepIdentity";

export async function addOnboardingLifecycleFields(db: OnboardingMigrationClient): Promise<void> {
  await db.execute(sql`
    ALTER TABLE onboarding_states
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS started_at timestamp,
      ADD COLUMN IF NOT EXISTS current_step_id text
  `);
}

export async function removeOnboardingLifecycleFields(
  db: OnboardingMigrationClient,
): Promise<void> {
  await db.execute(sql`
    ALTER TABLE onboarding_states
      DROP COLUMN IF EXISTS current_step_id,
      DROP COLUMN IF EXISTS started_at,
      DROP COLUMN IF EXISTS status
  `);
}
