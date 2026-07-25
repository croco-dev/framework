/**
 * @packageDocumentation
 *
 * Provider-neutral append-only credit ledger for grants, reservations, usage settlement,
 * expiry, refunds, and compensating adjustments.
 */

export {
  ZERO_CREDIT_AMOUNT,
  ZERO_CREDIT_SIGNED_AMOUNT,
  addCreditAmounts,
  compareCreditAmounts,
  creditAmount,
  subtractCreditAmounts,
} from "./libs/amount";
export {
  CreditLedgerService,
  type AdjustCreditsInput,
  type CommitCreditsInput,
  type ConsumeCreditsInput,
  type CreditLedgerEventPublisher,
  type CreditLedgerServiceOptions,
  type ExpireCreditsInput,
  type GrantCreditsInput,
  type OpenCreditAccountInput,
  type RefundCreditsInput,
  type ReleaseCreditsInput,
  type ReserveCreditsInput,
} from "./libs/CreditLedgerService";
export { CreditLedgerStore } from "./libs/CreditLedgerStore";
export {
  createCreditLedgerStoreConformanceSuite,
  type CreditLedgerStoreConformanceCase,
  type CreditLedgerStoreConformanceOptions,
  type CreditLedgerStoreConformanceSuite,
} from "./libs/conformance";
export {
  CreditLedgerCommittedEvent,
  type CreditLedgerCommittedEventData,
} from "./libs/events/CreditLedgerCommittedEvent";
export { creditAccountId, creditReservationId, creditTransactionId } from "./libs/identifiers";
export { InMemoryCreditLedgerStore } from "./libs/InMemoryCreditLedgerStore";
export {
  CreditAccountMismatchProblem,
  CreditAccountNotFoundProblem,
  CreditDuplicateConflictProblem,
  CreditEventPublicationProblem,
  CreditRefundMismatchProblem,
  CreditReservationMismatchProblem,
  CreditTransactionNotFoundProblem,
  ExpiredGrantProblem,
  InsufficientCreditsProblem,
  InvalidCreditAmountProblem,
  InvalidCreditCommandProblem,
  StaleLedgerPositionProblem,
} from "./libs/problems";
export type {
  AdjustCreditsCommand,
  CommitCreditsCommand,
  ConsumeCreditsCommand,
  CreditAccount,
  CreditAccountId,
  CreditAllocation,
  CreditAmount,
  CreditBalance,
  CreditCommandBase,
  CreditCommandResult,
  CreditExpiryCursor,
  CreditGrantTerms,
  CreditHistoryPage,
  CreditLedgerCommand,
  CreditReservation,
  CreditReservationId,
  CreditSemanticReference,
  CreditSignedAmount,
  CreditTransaction,
  CreditTransactionId,
  CreditTransactionKind,
  ExpireCreditsCommand,
  GrantCreditsCommand,
  OpenCreditAccountCommand,
  RefundCreditsCommand,
  ReleaseCreditsCommand,
  ReserveCreditsCommand,
} from "./libs/types";
