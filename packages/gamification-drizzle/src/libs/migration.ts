import { sql } from "drizzle-orm";
import type { DrizzleRewardClient } from "./DrizzleRewardStore";
import { RewardPersistenceProblem } from "./problems";

/** Explicit deployment migration; the store never runs DDL. */
export async function createRewardSchema(db: DrizzleRewardClient): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`create table reward_families (id text primary key, publication jsonb,
        consumed bigint not null default 0 check(consumed >= 0),
        fallback_consumed bigint not null default 0 check(fallback_consumed >= 0))`);
      await tx.execute(sql`create table reward_publications (id text primary key,
        family_id text not null references reward_families(id), fingerprint text not null, publication jsonb not null)`);
      await tx.execute(sql`create table reward_grants (id text primary key,
        family_id text not null references reward_families(id), account_id text not null, "grant" jsonb not null)`);
      await tx.execute(sql`create index reward_grants_account_idx on reward_grants(account_id)`);
      await tx.execute(sql`create table reward_points (grant_id text primary key references reward_grants(id),
        account_id text not null, entry jsonb not null)`);
      await tx.execute(sql`create index reward_points_account_idx on reward_points(account_id)`);
      await tx.execute(sql`create table reward_badges (id text primary key,
        grant_id text not null references reward_grants(id), account_id text not null, ownership jsonb not null)`);
      await tx.execute(sql`create index reward_badges_account_idx on reward_badges(account_id)`);
    });
  } catch (cause) {
    throw new RewardPersistenceProblem("migration", cause instanceof Error ? cause : undefined);
  }
}
