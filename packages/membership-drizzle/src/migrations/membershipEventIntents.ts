import { sql } from "drizzle-orm";

export type MembershipMigrationClient = {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
};

/** Adds durable idempotency and event-intent storage to an existing membership schema. */
export async function addMembershipEventIntents(client: MembershipMigrationClient): Promise<void> {
  await client.execute(sql`
    create table if not exists membership_idempotency_records (
      key text primary key,
      fingerprint text not null,
      result jsonb not null,
      committed_at timestamptz not null default now()
    )
  `);
  await client.execute(sql`
    create table if not exists membership_event_intents (
      intent_id text primary key,
      idempotency_key text not null references membership_idempotency_records(key),
      events jsonb not null,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      constraint membership_event_intents_idempotency_unique unique (idempotency_key)
    )
  `);
  await client.execute(sql`
    create index if not exists membership_event_intents_pending_idx
      on membership_event_intents(created_at, intent_id)
      where published_at is null
  `);
}
