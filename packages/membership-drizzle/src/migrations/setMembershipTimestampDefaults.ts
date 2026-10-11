import { sql } from "drizzle-orm";
import type { MembershipMigrationClient } from "./membershipEventIntents";

/** Sets UTC timestamp defaults without changing existing membership rows or column types. */
export async function setMembershipTimestampDefaults(
  client: MembershipMigrationClient,
): Promise<void> {
  await client.execute(sql`
    alter table memberships
      alter column created_at set default (now() at time zone 'utc'),
      alter column updated_at set default (now() at time zone 'utc')
  `);
}
