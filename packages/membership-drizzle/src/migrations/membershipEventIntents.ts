import { sql } from "drizzle-orm";

export type MembershipMigrationClient = {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
};

/** Adds durable idempotency and event-intent storage to an existing membership schema. */
export async function addMembershipEventIntents(client: MembershipMigrationClient): Promise<void> {
  await client.execute(sql`
    create table if not exists membership_idempotency_records (
      tenant_id text not null,
      key text not null,
      fingerprint text not null,
      result jsonb not null,
      committed_at timestamptz not null default now(),
      primary key (tenant_id, key)
    )
  `);
  await client.execute(sql`
    create table if not exists membership_event_intents (
      intent_id text primary key,
      tenant_id text not null,
      idempotency_key text not null,
      events jsonb not null,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      constraint membership_event_intents_tenant_idempotency_unique unique (tenant_id, idempotency_key),
      constraint membership_event_intents_tenant_command_fk foreign key (tenant_id, idempotency_key)
        references membership_idempotency_records(tenant_id, key)
    )
  `);
  await client.execute(sql`
    create index if not exists membership_event_intents_pending_idx
      on membership_event_intents(created_at, intent_id)
      where published_at is null
  `);
}
