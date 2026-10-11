import type {
  BadgeOwnership,
  PointEntry,
  PublishedRewardPolicy,
  RewardGrant,
} from "@croco/gamification-core";
import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const rewardFamilies = pgTable(
  "reward_families",
  {
    id: text("id").primaryKey(),
    publication: jsonb("publication").$type<PublishedRewardPolicy>(),
    consumed: bigint("consumed", { mode: "number" }).notNull().default(0),
    fallbackConsumed: bigint("fallback_consumed", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    check("reward_families_consumed_check", sql`${table.consumed} >= 0`),
    check("reward_families_fallback_consumed_check", sql`${table.fallbackConsumed} >= 0`),
  ],
);
export const rewardPublications = pgTable("reward_publications", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => rewardFamilies.id),
  fingerprint: text("fingerprint").notNull(),
  publication: jsonb("publication").$type<PublishedRewardPolicy>().notNull(),
});
export const rewardGrants = pgTable(
  "reward_grants",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => rewardFamilies.id),
    accountId: text("account_id").notNull(),
    grant: jsonb("grant").$type<RewardGrant>().notNull(),
  },
  (table) => [index("reward_grants_account_idx").on(table.accountId)],
);
export const rewardPoints = pgTable(
  "reward_points",
  {
    grantId: text("grant_id")
      .primaryKey()
      .references(() => rewardGrants.id),
    accountId: text("account_id").notNull(),
    entry: jsonb("entry").$type<PointEntry>().notNull(),
  },
  (table) => [index("reward_points_account_idx").on(table.accountId)],
);
export const rewardBadges = pgTable(
  "reward_badges",
  {
    id: text("id").primaryKey(),
    grantId: text("grant_id")
      .notNull()
      .references(() => rewardGrants.id),
    accountId: text("account_id").notNull(),
    ownership: jsonb("ownership").$type<BadgeOwnership>().notNull(),
  },
  (table) => [index("reward_badges_account_idx").on(table.accountId)],
);
export const rewardSchema = {
  rewardFamilies,
  rewardPublications,
  rewardGrants,
  rewardPoints,
  rewardBadges,
};
