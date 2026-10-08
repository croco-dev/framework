export { DrizzleChallengeStore, type DrizzleChallengeClient } from "./libs/DrizzleChallengeStore";
export { ChallengePersistenceProblem } from "./libs/ChallengePersistenceProblem";
export * as challengeSchema from "./libs/schema";
export * from "./libs/schema";
export {
  createChallengeSchema,
  dropChallengeSchema,
  type GamificationMigrationClient,
} from "./migrations/gamificationSchema";
