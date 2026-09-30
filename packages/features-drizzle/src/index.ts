/**
 * @packageDocumentation
 *
 * PostgreSQL/Drizzle persistence and trigger bridge for policy releases.
 */

export {
  DrizzlePolicyReleaseStore,
  type DrizzlePolicyReleaseStoreOptions,
  type FeaturePolicyPgDatabase,
  type FeaturePolicyPgExecutor,
} from "./libs/DrizzlePolicyReleaseStore";
export {
  ScheduledPolicyPublisher,
  type PolicyScheduleDeliveryPayload,
  type PolicyTriggerDispatcher,
  type RecoverDueSchedulesResult,
  type ScheduledPolicyPublisherOptions,
} from "./libs/ScheduledPolicyPublisher";
export {
  FeaturePolicyPersistenceProblem,
  PolicyIdempotencyConflictProblem,
  PolicyRevisionConflictProblem,
  PolicyScheduleProblem,
} from "./libs/problems";
export {
  createFeaturesSchema,
  dropFeaturesSchema,
  FeaturePolicyMigrationProblem,
  type FeaturePolicyMigrationClient,
} from "./migrations/createFeaturesSchema";
export {
  featurePolicyActivations,
  featurePolicyCommandReceipts,
  featurePolicyDecisions,
  featurePolicyDefinitions,
  featurePolicyHeads,
  featurePolicyReviews,
  featurePolicyRevisions,
  featurePolicySchedules,
} from "./libs/schema";
export type {
  FeaturePolicyCommandReceiptRow,
  FeaturePolicyDefinitionRow,
  FeaturePolicyRevisionRow,
  FeaturePolicyScheduleRow,
} from "./libs/schema";
export type {
  PolicyActor,
  PolicyAuditEntry,
  PolicyCommandReceipt,
  PolicyDecisionInput,
  PolicyDecisionReference,
  PolicyDefinitionRecord,
  PolicyPublication,
  PolicyPublicationInput,
  PolicyPauseInput,
  PolicyPublishCommand,
  PolicyReleaseStore,
  PolicyScheduleLookup,
  PolicyResolution,
  PolicyRevision,
  PolicyRevisionState,
  PolicyScheduleDelivery,
  PolicyScheduleInput,
  PolicyScheduleRecord,
  PolicyScheduleState,
  PolicyScope,
  PolicyTransitionRecord,
} from "./libs/contracts";
export {
  normalizePolicyScope,
  policyCommandFingerprint,
  policyScheduleId,
  policyScopeKey,
  stableStringify,
} from "./libs/contracts";
