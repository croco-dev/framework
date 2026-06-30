/**
 * Provider-neutral transactional outbox storage contract.
 */
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

/**
 * Croco Problem types and helpers for outbox dispatch failures.
 */
export {
  OUTBOX_DISPATCH_PROBLEM_CODE,
  OUTBOX_FAILURE_METADATA_PROBLEM_CODE,
  OUTBOX_UNIT_OF_WORK_CONTEXT_PROBLEM_CODE,
  OutboxDispatchProblem,
  OutboxFailureMetadataProblem,
  OutboxUnitOfWorkContextProblem,
  createOutboxFailureProblemExtensions,
  readOutboxFailureMetadata,
} from "./libs/problems/OutboxProblems";
export type {
  OutboxDispatchProblemOptions,
  OutboxFailureProblemExtensions,
} from "./libs/problems/OutboxProblems";

/**
 * Conformance helpers and an in-memory fixture for provider contract tests.
 */
export { createTransactionalOutboxStoreContractSuite } from "./libs/conformance";
export type {
  TransactionalOutboxStoreContractCase,
  TransactionalOutboxStoreContractOptions,
  TransactionalOutboxStoreContractSuite,
} from "./libs/conformance";
export {
  InMemoryTransactionalOutboxStore,
  type InMemoryTransactionalOutboxStoreClient,
  type InMemoryTransactionalOutboxStoreState,
} from "./libs/InMemoryTransactionalOutboxStore";
