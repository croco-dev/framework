import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type BillingDatabase = NodePgDatabase;
type Transaction = Parameters<Parameters<BillingDatabase["transaction"]>[0]>[0];
export type BillingTable =
  | "accounts"
  | "subscriptions"
  | "commands"
  | "orders"
  | "webhooks"
  | "transitions";
export type CancellationTable = "sessions" | "policies" | "policy_audits";
export type Table = `croco_billing_${BillingTable}` | `croco_cancellation_${CancellationTable}`;

/** All adapter writes participate in one transaction lock, including absent-row creation. */
export async function atomic<T>(
  db: BillingDatabase,
  namespace: string,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(2814, hashtext(${namespace}))`);
    return run(tx);
  });
}

export async function read<T>(
  db: Pick<BillingDatabase, "execute">,
  table: Table,
  namespace: string,
  id: string,
): Promise<T | undefined> {
  const result = await db.execute<{ data: T }>(
    sql`select data from ${sql.identifier(table)} where namespace = ${namespace} and id = ${id}`,
  );
  return result.rows[0]?.data;
}

export async function write(
  db: Pick<BillingDatabase, "execute">,
  table: Table,
  namespace: string,
  id: string,
  value: unknown,
): Promise<void> {
  await db.execute(sql`insert into ${sql.identifier(table)} (namespace, id, data) values (${namespace}, ${id}, ${JSON.stringify(value)}::jsonb)
    on conflict (namespace, id) do update set data = excluded.data`);
}

export async function remove(
  db: Pick<BillingDatabase, "execute">,
  table: Table,
  namespace: string,
  id: string,
): Promise<void> {
  await db.execute(
    sql`delete from ${sql.identifier(table)} where namespace = ${namespace} and id = ${id}`,
  );
}

export async function now(db: Pick<BillingDatabase, "execute">): Promise<Date> {
  const result = await db.execute<{ now: Date }>(sql`select clock_timestamp() as now`);
  return new Date(result.rows[0].now);
}
