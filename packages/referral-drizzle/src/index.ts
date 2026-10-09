/**
 * @packageDocumentation
 *
 * PostgreSQL persistence for referral programs, link hashes, attributions,
 * click counts, benefit intents, and audit entries. Reserves budgets with
 * atomic guarded updates, resolves the first valid attribution through a
 * unique recipient key, and moves attributions and benefit intents with
 * compare-and-set transitions inside caller transactions.
 */

export { PostgresReferralStore, ReferralPersistenceProblem } from "./libs/PostgresReferralStore";
export type { ReferralPgDatabase, ReferralPgExecutor } from "./libs/PostgresReferralStore";
