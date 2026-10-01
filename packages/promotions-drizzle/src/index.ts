/**
 * @packageDocumentation
 *
 * PostgreSQL persistence for promotion policies, quotes, claims, budget
 * reservations, and audit entries. Reserves budgets with atomic guarded
 * updates and moves claims with compare-and-set transitions inside caller
 * transactions.
 */

export { PostgresPromotionStore, PromotionPersistenceProblem } from "./libs/PostgresPromotionStore";
export type { PromotionPgDatabase, PromotionPgExecutor } from "./libs/PostgresPromotionStore";
