import { Problem } from "@croco/problems-core";
import { sql } from "drizzle-orm";
import { CreditLedgerPersistenceProblem } from "../libs/problems";

type MigrationClient = {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
};

async function runMigration(operation: string, migrate: () => Promise<void>): Promise<void> {
  try {
    await migrate();
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new CreditLedgerPersistenceProblem(
      operation,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/** Creates the PostgreSQL tables and constraints required by the credit ledger adapter. */
export async function createCreditsSchema(client: MigrationClient): Promise<void> {
  return runMigration("create schema", async () => {
    await client.execute(sql`
      create table if not exists credit_accounts (
        id text primary key,
        tenant_id text not null,
        wallet_key text,
        wallet_identity text not null,
        opened_at timestamptz not null,
        position bigint not null default 0,
        available numeric not null default 0,
        reserved numeric not null default 0,
        consumed numeric not null default 0,
        expired numeric not null default 0,
        lifetime_granted numeric not null default 0,
        net_adjusted numeric not null default 0,
        constraint credit_accounts_position_nonnegative check (position >= 0),
        constraint credit_accounts_balances_nonnegative check (
          available >= 0 and reserved >= 0 and consumed >= 0 and expired >= 0
          and lifetime_granted >= 0
        ),
        constraint credit_accounts_tenant_wallet_unique unique (tenant_id, wallet_identity)
      )
    `);
    await client.execute(sql`
      create table if not exists credit_reservations (
        id text primary key,
        account_id text not null references credit_accounts(id),
        amount numeric not null check (amount > 0),
        meter_key text,
        status text not null check (status in ('active', 'committed', 'released')),
        created_at timestamptz not null,
        settled_at timestamptz,
        constraint credit_reservations_id_account_unique unique (id, account_id)
      )
    `);
    await client.execute(sql`
      create index if not exists credit_reservations_account_idx
        on credit_reservations(account_id)
    `);
    await client.execute(sql`
      create table if not exists credit_transactions (
        id text primary key,
        account_id text not null references credit_accounts(id),
        position bigint not null,
        kind text not null check (
          kind in ('grant', 'reserve', 'commit', 'release', 'consume', 'expire', 'refund', 'adjustment')
        ),
        amount numeric not null check (amount > 0),
        occurred_at timestamptz not null,
        idempotency_key text not null,
        reference_type text not null,
        reference_id text not null,
        reservation_id text,
        related_transaction_id text,
        meter_key text,
        adjustment_direction text check (adjustment_direction in ('credit', 'debit')),
        grant_expires_at timestamptz,
        grant_source text,
        grant_meter_keys jsonb,
        constraint credit_transactions_id_account_unique unique (id, account_id),
        constraint credit_transactions_account_position_unique unique (account_id, position),
        constraint credit_transactions_reservation_account_fk
          foreign key (reservation_id, account_id)
          references credit_reservations(id, account_id),
        constraint credit_transactions_related_account_fk
          foreign key (related_transaction_id, account_id)
          references credit_transactions(id, account_id)
      )
    `);
    await client.execute(sql`
      create index if not exists credit_transactions_account_history_idx
        on credit_transactions(account_id, position)
    `);
    await client.execute(sql`
      create index if not exists credit_transactions_related_idx
        on credit_transactions(related_transaction_id)
    `);
    await client.execute(sql`
      create table if not exists credit_grant_lots (
        grant_transaction_id text primary key,
        account_id text not null references credit_accounts(id),
        position bigint not null,
        created_at timestamptz not null,
        expires_at timestamptz,
        source text,
        meter_keys jsonb,
        available numeric not null check (available >= 0),
        constraint credit_grant_lots_id_account_unique unique (grant_transaction_id, account_id),
        constraint credit_grant_lots_transaction_account_fk
          foreign key (grant_transaction_id, account_id)
          references credit_transactions(id, account_id)
      )
    `);
    await client.execute(sql`
      create index if not exists credit_grant_lots_allocation_idx
        on credit_grant_lots(account_id, expires_at, position, grant_transaction_id)
    `);
    await client.execute(sql`
      create table if not exists credit_allocations (
        transaction_id text not null,
        grant_transaction_id text not null,
        account_id text not null references credit_accounts(id),
        amount numeric not null check (amount > 0),
        ordinal bigint not null,
        constraint credit_allocations_primary primary key (transaction_id, ordinal),
        constraint credit_allocations_transaction_account_fk
          foreign key (transaction_id, account_id)
          references credit_transactions(id, account_id),
        constraint credit_allocations_grant_account_fk
          foreign key (grant_transaction_id, account_id)
          references credit_grant_lots(grant_transaction_id, account_id)
      )
    `);
    await client.execute(sql`
      create table if not exists credit_reservation_allocations (
        reservation_id text not null,
        grant_transaction_id text not null,
        account_id text not null references credit_accounts(id),
        amount numeric not null check (amount > 0),
        ordinal bigint not null,
        constraint credit_reservation_allocations_primary primary key (reservation_id, ordinal),
        constraint credit_reservation_allocations_reservation_account_fk
          foreign key (reservation_id, account_id)
          references credit_reservations(id, account_id),
        constraint credit_reservation_allocations_grant_account_fk
          foreign key (grant_transaction_id, account_id)
          references credit_grant_lots(grant_transaction_id, account_id)
      )
    `);
    await client.execute(sql`
      create table if not exists credit_idempotency_records (
        key text primary key,
        account_id text references credit_accounts(id),
        fingerprint text not null,
        result jsonb not null,
        committed_at timestamptz not null default now()
      )
    `);
    await client.execute(sql`
      create table if not exists credit_ledger_event_intents (
        event_id text primary key,
        idempotency_key text not null references credit_idempotency_records(key),
        occurred_at timestamptz not null,
        data jsonb not null,
        published_at timestamptz,
        created_at timestamptz not null default now(),
        constraint credit_ledger_event_intents_idempotency_unique unique (idempotency_key)
      )
    `);
    await client.execute(sql`
      create index if not exists credit_ledger_event_intents_pending_idx
        on credit_ledger_event_intents(created_at, event_id)
        where published_at is null
    `);
    await client.execute(sql`
      insert into credit_ledger_event_intents (
        event_id,
        idempotency_key,
        occurred_at,
        data
      )
      select
        encode(
          sha256(convert_to('credits.ledger_committed:' || records.key, 'UTF8')),
          'hex'
        ),
        records.key,
        coalesce((records.result -> 'transactions' -> 0 ->> 'occurredAt')::timestamptz, records.committed_at),
        jsonb_build_object(
          'accountId', records.result -> 'account' ->> 'id',
          'position', (records.result -> 'account' ->> 'position')::bigint,
          'transactionIds', coalesce(
            (
              select jsonb_agg(transaction ->> 'id' order by ordinal)
              from jsonb_array_elements(records.result -> 'transactions') with ordinality as entries(transaction, ordinal)
            ),
            '[]'::jsonb
          ),
          'kinds', coalesce(
            (
              select jsonb_agg(transaction ->> 'kind' order by ordinal)
              from jsonb_array_elements(records.result -> 'transactions') with ordinality as entries(transaction, ordinal)
            ),
            '[]'::jsonb
          ),
          'reference', records.result -> 'transactions' -> 0 -> 'reference'
        )
      from credit_idempotency_records records
      where jsonb_array_length(records.result -> 'transactions') > 0
      on conflict (idempotency_key) do nothing
    `);
  });
}

/** Drops the credit ledger schema in reverse dependency order. */
export async function dropCreditsSchema(client: MigrationClient): Promise<void> {
  return runMigration("drop schema", async () => {
    await client.execute(sql`drop table if exists credit_ledger_event_intents`);
    await client.execute(sql`drop table if exists credit_idempotency_records`);
    await client.execute(sql`drop table if exists credit_reservation_allocations`);
    await client.execute(sql`drop table if exists credit_allocations`);
    await client.execute(sql`drop table if exists credit_grant_lots`);
    await client.execute(sql`drop table if exists credit_transactions`);
    await client.execute(sql`drop table if exists credit_reservations`);
    await client.execute(sql`drop table if exists credit_accounts`);
  });
}
