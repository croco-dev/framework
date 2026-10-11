/**
 * @packageDocumentation
 *
 * HTTP, webhook, task, and event consumer flows share one typed idempotency contract.
 */

export {
  createIdempotencyCoordinator,
  createIdempotentHandler,
  IdempotencyCoordinator,
  isRetryableHandlerFailure,
} from "./libs/IdempotencyCoordinator";
export type { IdempotencyCoordinatorOptions } from "./libs/IdempotencyCoordinator";
export { assertProcessingLeaseStore } from "./libs/assertProcessingLeaseStore";
export { InMemoryIdempotencyStore } from "./libs/InMemoryIdempotencyStore";
export type { InMemoryIdempotencyStoreOptions } from "./libs/InMemoryIdempotencyStore";
export {
  createIdempotencyTelemetryAttributes,
  deriveEventConsumerIdempotencyKey,
  deriveHttpIdempotencyKey,
  deriveIdempotencyKey,
  deriveTaskIdempotencyKey,
  deriveWebhookIdempotencyKey,
} from "./libs/deriveIdempotencyKey";
export {
  createIdempotencyStoreConformanceSuite,
  type IdempotencyStoreConformanceCase,
  type IdempotencyStoreConformanceOptions,
  type IdempotencyStoreConformanceSuite,
} from "./libs/conformance";
export {
  IDEMPOTENCY_DIAGNOSTIC_CODES,
  IdempotencyConflictProblem,
  IdempotencyExecutionIndeterminateProblem,
  IdempotencyProcessingLeaseUnsupportedProblem,
  IdempotencyReservationExpiredProblem,
  IdempotencyReservationNotFoundProblem,
  IdempotencyReservationStateProblem,
  InvalidIdempotencyKeyProblem,
  InvalidIdempotencySnapshotProblem,
  InvalidIdempotencyTtlProblem,
} from "./libs/problems/IdempotencyProblems";
export type {
  IdempotencyDiagnosticCode,
  IdempotencySnapshotField,
  InvalidIdempotencySnapshotProblemOptions,
  IdempotencyTtlConstraint,
  InvalidIdempotencyTtlProblemOptions,
} from "./libs/problems/IdempotencyProblems";
export type {
  DerivedIdempotencyKey,
  DeriveIdempotencyKeyOptions,
  ExplicitIdempotencyKeySource,
  IdempotencyAuditEvent,
  IdempotencyAuditSink,
  IdempotencyCommitOptions,
  IdempotencyCompletedRecord,
  IdempotencyExecutionRequest,
  IdempotencyExecutionResult,
  IdempotencyExpireOptions,
  IdempotencyFailedRecord,
  IdempotencyFailOptions,
  IdempotencyHandler,
  IdempotencyInFlightRecord,
  IdempotencyKeySource,
  IdempotencyKeySourceKind,
  IdempotencyRecord,
  IdempotencyRecordBase,
  IdempotencyRecordStatus,
  IdempotencyReservation,
  IdempotencyReserveOptions,
  IdempotencyReserveResult,
  IdempotencyScope,
  IdempotencyStore,
  IdempotencyTelemetryAttributes,
  LeaseAwareIdempotencyStore,
  ProviderEventIdempotencyKeySource,
  RequestFingerprintIdempotencyKeySource,
  TenantScopedIdempotencyKeySource,
} from "./libs/types";
