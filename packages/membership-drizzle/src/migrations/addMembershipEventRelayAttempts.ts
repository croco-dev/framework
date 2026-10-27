import { sql } from "drizzle-orm";
import type { MembershipMigrationClient } from "./membershipEventIntents";

/** Preserves pending intents while adding durable relay rotation and tenant-head lookup. */
export async function addMembershipEventRelayAttempts(
  client: MembershipMigrationClient,
): Promise<void> {
  await client.execute(sql`
    alter table membership_event_intents
      add column if not exists last_attempted_at timestamptz
  `);
  await client.execute(sql`
    alter table membership_event_intents alter column created_at set default clock_timestamp()
  `);
  await client.execute(sql`
    create index if not exists membership_event_intents_tenant_pending_idx
      on membership_event_intents ((events->0->'data'->>'tenantId'), created_at, intent_id)
      where published_at is null
  `);
}
