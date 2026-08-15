export {
  OUTBOX_CLAIM_CONFIGURATION_PROBLEM_CODE,
  OUTBOX_DISPATCH_PROBLEM_CODE,
  OUTBOX_FAILURE_METADATA_PROBLEM_CODE,
  OUTBOX_RECORD_ID_CONFLICT_PROBLEM_CODE,
  OUTBOX_UNIT_OF_WORK_CONTEXT_PROBLEM_CODE,
  OutboxClaimConfigurationProblem,
  OutboxDispatchProblem,
  OutboxFailureMetadataProblem,
  OutboxRecordIdConflictProblem,
  OutboxUnitOfWorkContextProblem,
  createOutboxFailureProblemExtensions,
  readOutboxFailureMetadata,
} from "./libs/problems/OutboxProblems";

export { InMemoryTransactionalOutboxStore } from "./libs/InMemoryTransactionalOutboxStore";

export { assertValidClaimBatchOptions } from "./libs/claimValidation";

export { createTransactionalOutboxStoreContractSuite } from "./libs/conformance";

export type {
  ClaimBatchOptions,
  ClaimedOutboxRecord,
  DispatchResult,
  OutboxClaim,
  OutboxDispatchResultMetadata,
  OutboxFailureMetadata,
  OutboxFailureRecord,
  OutboxIntent,
  OutboxRecord,
  OutboxRecordOptions,
  OutboxRecordStatus,
  OutboxRetryMetadata,
  OutboxRetryOptions,
  OutboxSourceReference,
  OutboxTenantBoundary,
  OutboxTraceContext,
  TransactionalOutboxStore,
  TransactionalOutboxStoreContext,
} from "./libs/types";

export type {
  OutboxDispatchProblemOptions,
  OutboxFailureProblemExtensions,
} from "./libs/problems/OutboxProblems";

export type {
  TransactionalOutboxStoreContractCase,
  TransactionalOutboxStoreContractOptions,
  TransactionalOutboxStoreContractSuite,
} from "./libs/conformance";
export type {
  InMemoryTransactionalOutboxStoreClient,
  InMemoryTransactionalOutboxStoreState,
} from "./libs/InMemoryTransactionalOutboxStore";
