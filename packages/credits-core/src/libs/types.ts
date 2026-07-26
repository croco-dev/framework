declare const CREDIT_ACCOUNT_ID: unique symbol;
declare const CREDIT_TRANSACTION_ID: unique symbol;
declare const CREDIT_RESERVATION_ID: unique symbol;
declare const CREDIT_AMOUNT: unique symbol;
declare const CREDIT_SIGNED_AMOUNT: unique symbol;
declare const CREDIT_EXPIRY_CURSOR: unique symbol;

export type CreditAccountId = string & { readonly [CREDIT_ACCOUNT_ID]: true };
export type CreditTransactionId = string & { readonly [CREDIT_TRANSACTION_ID]: true };
export type CreditReservationId = string & { readonly [CREDIT_RESERVATION_ID]: true };
export type CreditAmount = string & { readonly [CREDIT_AMOUNT]: true };
export type CreditSignedAmount = string & { readonly [CREDIT_SIGNED_AMOUNT]: true };
export type CreditExpiryCursor = string & { readonly [CREDIT_EXPIRY_CURSOR]: true };

export type CreditSemanticReference = {
  readonly type: string;
  readonly id: string;
};

export type CreditTransactionKind =
  | "grant"
  | "reserve"
  | "commit"
  | "release"
  | "consume"
  | "expire"
  | "refund"
  | "adjustment";

export type CreditAllocation = {
  readonly grantTransactionId: CreditTransactionId;
  readonly amount: CreditAmount;
};

export type CreditGrantTerms = {
  readonly expiresAt?: Date;
  readonly source?: string;
  readonly meterKeys?: readonly string[];
};

export type CreditTransaction = {
  readonly id: CreditTransactionId;
  readonly accountId: CreditAccountId;
  readonly position: number;
  readonly kind: CreditTransactionKind;
  readonly amount: CreditAmount;
  readonly occurredAt: Date;
  readonly idempotencyKey: string;
  readonly reference: CreditSemanticReference;
  readonly allocations: readonly CreditAllocation[];
  readonly reservationId?: CreditReservationId;
  readonly relatedTransactionId?: CreditTransactionId;
  readonly meterKey?: string;
  readonly adjustmentDirection?: "credit" | "debit";
  readonly grant?: CreditGrantTerms;
};

export type CreditAccount = {
  readonly id: CreditAccountId;
  readonly tenantId: string;
  readonly walletKey?: string;
  readonly openedAt: Date;
  readonly position: number;
};

export type CreditBalance = {
  readonly accountId: CreditAccountId;
  readonly position: number;
  readonly available: CreditAmount;
  readonly reserved: CreditAmount;
  readonly consumed: CreditAmount;
  readonly expired: CreditAmount;
  readonly lifetimeGranted: CreditAmount;
  readonly netAdjusted: CreditSignedAmount;
};

export type CreditReservation = {
  readonly id: CreditReservationId;
  readonly accountId: CreditAccountId;
  readonly amount: CreditAmount;
  readonly meterKey?: string;
  readonly status: "active" | "committed" | "released";
  readonly allocations: readonly CreditAllocation[];
  readonly createdAt: Date;
  readonly settledAt?: Date;
};

export type CreditHistoryPage = {
  readonly accountId: CreditAccountId;
  readonly position: number;
  readonly transactions: readonly CreditTransaction[];
};

export type CreditCommandBase = {
  readonly idempotencyKey: string;
  readonly reference: CreditSemanticReference;
  readonly occurredAt: Date;
  readonly expectedPosition?: number;
};

export type OpenCreditAccountCommand = CreditCommandBase & {
  readonly operation: "open";
  readonly accountId: CreditAccountId;
  readonly tenantId: string;
  readonly walletKey?: string;
};

export type GrantCreditsCommand = CreditCommandBase & {
  readonly operation: "grant";
  readonly accountId: CreditAccountId;
  readonly transactionId: CreditTransactionId;
  readonly amount: CreditAmount;
  readonly grant: CreditGrantTerms;
};

export type ReserveCreditsCommand = CreditCommandBase & {
  readonly operation: "reserve";
  readonly accountId: CreditAccountId;
  readonly transactionId: CreditTransactionId;
  readonly reservationId: CreditReservationId;
  readonly amount: CreditAmount;
  readonly meterKey?: string;
};

export type CommitCreditsCommand = CreditCommandBase & {
  readonly operation: "commit";
  readonly accountId: CreditAccountId;
  readonly reservationId: CreditReservationId;
  readonly commitTransactionId: CreditTransactionId;
  readonly releaseTransactionId: CreditTransactionId;
  readonly amount: CreditAmount;
};

export type ReleaseCreditsCommand = CreditCommandBase & {
  readonly operation: "release";
  readonly accountId: CreditAccountId;
  readonly reservationId: CreditReservationId;
  readonly transactionId: CreditTransactionId;
};

export type ConsumeCreditsCommand = CreditCommandBase & {
  readonly operation: "consume";
  readonly accountId: CreditAccountId;
  readonly transactionId: CreditTransactionId;
  readonly amount: CreditAmount;
  readonly meterKey?: string;
};

export type RefundCreditsCommand = CreditCommandBase & {
  readonly operation: "refund";
  readonly accountId: CreditAccountId;
  readonly transactionId: CreditTransactionId;
  readonly consumptionTransactionId: CreditTransactionId;
  readonly amount: CreditAmount;
};

export type AdjustCreditsCommand = CreditCommandBase & {
  readonly operation: "adjust";
  readonly accountId: CreditAccountId;
  readonly transactionId: CreditTransactionId;
  readonly amount: CreditAmount;
  readonly direction: "credit" | "debit";
  readonly grant?: CreditGrantTerms;
};

export type ExpireCreditsCommand = CreditCommandBase & {
  readonly operation: "expire";
  readonly accountId: CreditAccountId;
  readonly transactionIds: readonly CreditTransactionId[];
  readonly asOf: Date;
  readonly limit: number;
  readonly cursor?: CreditExpiryCursor;
};

export type CreditLedgerCommand =
  | OpenCreditAccountCommand
  | GrantCreditsCommand
  | ReserveCreditsCommand
  | CommitCreditsCommand
  | ReleaseCreditsCommand
  | ConsumeCreditsCommand
  | RefundCreditsCommand
  | AdjustCreditsCommand
  | ExpireCreditsCommand;

export type CreditCommandResult = {
  readonly operation: CreditLedgerCommand["operation"];
  readonly account: CreditAccount;
  readonly transactions: readonly CreditTransaction[];
  readonly reservation?: CreditReservation;
  readonly replayed: boolean;
  readonly nextCursor?: CreditExpiryCursor;
};
