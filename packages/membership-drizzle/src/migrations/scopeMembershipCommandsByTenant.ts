import { sql } from "drizzle-orm";
import type { MembershipMigrationClient } from "./membershipEventIntents";

/** Scopes existing commands and intents without changing recorded results or event identities. */
export async function scopeMembershipCommandsByTenant(
  client: MembershipMigrationClient,
): Promise<void> {
  // One statement keeps backfill and constraint replacement atomic, including standalone clients.
  await client.execute(sql`
    do $$
    declare
      legacy_constraint text;
    begin
      lock table membership_idempotency_records, membership_event_intents in access exclusive mode;
      alter table membership_idempotency_records add column if not exists tenant_id text;
      alter table membership_event_intents add column if not exists tenant_id text;

      if exists (
        select 1 from membership_idempotency_records
        where jsonb_typeof(case when result->>'operation' = 'transfer_ownership'
          then result->'fromMembership'->'tenantId' else result->'membership'->'tenantId' end)
          is distinct from 'string'
          or (result->>'operation' = 'transfer_ownership' and
            result->'fromMembership'->'tenantId' is distinct from result->'toMembership'->'tenantId')
      ) then
        raise exception 'Membership command migration requires a consistent tenant in every stored result';
      end if;

      update membership_idempotency_records
      set tenant_id = case when result->>'operation' = 'transfer_ownership'
        then result->'fromMembership'->>'tenantId' else result->'membership'->>'tenantId' end
      where tenant_id is null;

      if exists (
        select 1 from membership_idempotency_records
        where tenant_id is distinct from (case when result->>'operation' = 'transfer_ownership'
          then result->'fromMembership'->>'tenantId' else result->'membership'->>'tenantId' end)
      ) then
        raise exception 'Membership command tenant disagrees with its stored result';
      end if;

      update membership_event_intents as intent
      set tenant_id = command.tenant_id
      from membership_idempotency_records as command
      where intent.tenant_id is null and intent.idempotency_key = command.key;

      if exists (
        select 1 from membership_event_intents as intent
        where intent.tenant_id is null
          or jsonb_typeof(intent.events) is distinct from 'array'
          or jsonb_array_length(intent.events) = 0
          or exists (
            select 1 from jsonb_array_elements(intent.events) as event
            where event->'data'->'tenantId' is distinct from to_jsonb(intent.tenant_id)
          )
      ) then
        raise exception 'Membership intent tenant disagrees with its recorded events';
      end if;

      alter table membership_idempotency_records alter column tenant_id set not null;
      alter table membership_event_intents alter column tenant_id set not null;
      for legacy_constraint in
        select conname from pg_constraint
        where conrelid = 'membership_event_intents'::regclass
          and confrelid = 'membership_idempotency_records'::regclass
          and contype = 'f' and cardinality(conkey) = 1
      loop
        execute format('alter table membership_event_intents drop constraint %I', legacy_constraint);
      end loop;
      alter table membership_event_intents
        drop constraint if exists membership_event_intents_idempotency_unique;
      drop index if exists membership_event_intents_idempotency_unique;

      for legacy_constraint in
        select conname from pg_constraint
        where conrelid = 'membership_idempotency_records'::regclass
          and contype = 'p' and cardinality(conkey) = 1
      loop
        execute format('alter table membership_idempotency_records drop constraint %I', legacy_constraint);
      end loop;
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'membership_idempotency_records'::regclass and contype = 'p'
      ) then
        alter table membership_idempotency_records
          add primary key (tenant_id, key);
      end if;
      create unique index if not exists membership_event_intents_tenant_idempotency_unique
        on membership_event_intents(tenant_id, idempotency_key);
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'membership_event_intents'::regclass
          and conname = 'membership_event_intents_tenant_command_fk'
      ) then
        alter table membership_event_intents
          add constraint membership_event_intents_tenant_command_fk
          foreign key (tenant_id, idempotency_key)
          references membership_idempotency_records(tenant_id, key);
      end if;
    end $$
  `);
}
