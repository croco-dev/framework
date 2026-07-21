/**
 * 트랜잭션 상태가 유효하지 않을 때 발생하는 Problem 하위 타입입니다.
 */
export {
  InboxClaimConflictProblem,
  InvalidTransactionalEventConfigurationProblem,
  OutboxPublishExhaustedProblem,
  OutboxStorageProblem,
  OutboxTransactionRequiredProblem,
  TransactionStateProblem,
} from "./libs/problems/EventsTxProblems";

export type {
  InvalidTransactionalEventConfigurationProblemOptions,
  TransactionalEventConfigurationConstraint,
  TransactionalEventConfigurationField,
} from "./libs/problems/EventsTxProblems";

/**
 * Drizzle query-client 기반 transactional outbox/inbox 저장소입니다.
 */
export { DrizzleTransactionalEventStore } from "./libs/DrizzleTransactionalEventStore";

/**
 * 테스트와 로컬 fixture에서 사용하는 transactional outbox/inbox 저장소입니다.
 */
export { InMemoryTransactionalEventStore } from "./libs/InMemoryTransactionalEventStore";

/**
 * Outbox append, relay, inbox idempotency를 제공하는 런타임 서비스입니다.
 */
export {
  createEventBusOutboxPublisher,
  createTransactionalEventDiagnostic,
  normalizeTransactionalEventError,
  TransactionalInboxConsumer,
  TransactionalOutbox,
  TransactionalOutboxRelay,
} from "./libs/TransactionalEvents";

/**
 * Drizzle PostgreSQL outbox/inbox table definitions입니다.
 */
export { transactionalInboxRecords, transactionalOutboxMessages } from "./libs/schema";

export type {
  DrizzleTransactionalEventStoreConfig,
  DrizzleTransactionalEventStoreDb,
  DrizzleTransactionalEventStoreTables,
} from "./libs/DrizzleTransactionalEventStore";

export type {
  InMemoryTransactionalEventStoreClient,
  InMemoryTransactionalEventStoreState,
} from "./libs/InMemoryTransactionalEventStore";

export type {
  AppendOutboxMessageInput,
  InboxCompletionInput,
  InboxConsumerResult,
  InboxFailureInput,
  InboxStartInput,
  InboxStartResult,
  ListInboxRecordsOptions,
  ListOutboxMessagesOptions,
  OutboxAppendOptions,
  OutboxClaimOptions,
  OutboxCompletionInput,
  OutboxDeadLetterInput,
  OutboxFailureInput,
  OutboxRelayBatchResult,
  OutboxRelayConfig,
  OutboxRelayMessageResult,
  OutboxRelayRetryPolicy,
  TransactionalEventDiagnostic,
  TransactionalEventError,
  TransactionalEventStore,
  TransactionalEventStoreContext,
  TransactionalInboxConsumerConfig,
  TransactionalInboxRecord,
  TransactionalOutboxConfig,
  TransactionalOutboxMessage,
} from "./libs/TransactionalEvents";

export type { InboxMessageStatus, OutboxMessageStatus } from "./libs/TransactionalEventTypes";

export type {
  NewTransactionalInboxRecordRow,
  NewTransactionalOutboxMessageRow,
  TransactionalInboxRecordRow,
  TransactionalOutboxMessageRow,
} from "./libs/schema";
