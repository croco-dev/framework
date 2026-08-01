import { Problem, ProblemCategory } from "@croco/problems-core";

import type { AdminProblemContract } from "./types";
import type { TenantWorkspaceExtension } from "./TenantWorkspace";

export type CreditOperationsTransactionKind =
  | "grant"
  | "reserve"
  | "commit"
  | "release"
  | "consume"
  | "expire"
  | "refund"
  | "adjustment";

export type CreditOperationsReference = {
  readonly type: string;
  readonly value?: string;
  readonly maskedValue?: string;
  readonly visibility: "visible" | "masked" | "denied";
  readonly requiredPermissions?: readonly string[];
};

export type CreditOperationsAllocation = {
  readonly grantTransactionId: string;
  readonly amount: string;
};

export type CreditOperationsTransaction = {
  readonly id: string;
  readonly position: number;
  readonly kind: CreditOperationsTransactionKind;
  readonly amount: string;
  readonly occurredAt: Date;
  readonly reference: CreditOperationsReference;
  readonly allocations: readonly CreditOperationsAllocation[];
  readonly reservationId?: string;
  readonly relatedTransactionId?: string;
  readonly meterKey?: string;
  readonly adjustmentDirection?: "credit" | "debit";
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly refundableAmount?: string;
};

export type CreditOperationsGrantLot = {
  readonly transactionId: string;
  readonly amount: string;
  readonly remaining: string;
  readonly expiresAt?: Date;
  readonly source?: CreditOperationsReference;
  readonly meterKeys: readonly string[];
  readonly status: "available" | "reserved" | "consumed" | "expired";
};

export type CreditOperationsReservation = {
  readonly id: string;
  readonly amount: string;
  readonly status: "active" | "committed" | "released";
  readonly meterKey?: string;
  readonly allocations: readonly CreditOperationsAllocation[];
  readonly createdAt: Date;
  readonly settledAt?: Date;
  readonly release?: {
    readonly allowed: boolean;
    readonly reason: string;
  };
};

export type CreditOperationsBalance = {
  readonly accountId: string;
  readonly ledgerPosition: number;
  readonly available: string;
  readonly reserved: string;
  readonly consumed: string;
  readonly expired: string;
  readonly lifetimeGranted: string;
  readonly netAdjusted: string;
  readonly expiringSoon: string;
  readonly expiringSoonBefore: Date;
};

export type CreditOperationsHistoryCompleteness =
  | { readonly kind: "complete" }
  | {
      readonly kind: "partial";
      readonly earliestPosition: number;
      readonly reason: string;
    };

export type CreditOperationsSnapshot = {
  readonly tenantId: string;
  readonly accountId: string;
  readonly generatedAt: Date;
  readonly balance: CreditOperationsBalance;
  readonly grantLots: readonly CreditOperationsGrantLot[];
  readonly transactions: readonly CreditOperationsTransaction[];
  readonly reservations: readonly CreditOperationsReservation[];
  readonly history: CreditOperationsHistoryCompleteness;
};

export type CreditOperationsFilter = {
  readonly kinds?: readonly CreditOperationsTransactionKind[];
  readonly meterKey?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly semanticReference?: string;
  readonly reservationStatus?: CreditOperationsReservation["status"];
};

export type CreditOperationsSourceResult =
  | { readonly kind: "empty"; readonly message?: string }
  | { readonly kind: "ready"; readonly snapshot: CreditOperationsSnapshot }
  | {
      readonly kind: "stale";
      readonly snapshot: CreditOperationsSnapshot;
      readonly expectedPosition: number;
      readonly actualPosition: number;
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly problem: AdminProblemContract;
      readonly partial?: CreditOperationsSnapshot;
    };

export interface CreditOperationsSource {
  readonly requiredPermissions: readonly string[];
  load(input: {
    readonly tenantId: string;
    readonly accountId?: string;
    readonly signal?: AbortSignal;
  }): Promise<CreditOperationsSourceResult>;
}

export type CreditOperationsActionKind = "grant" | "refund" | "release-reservation" | "adjustment";

export type CreditOperationsAction = {
  readonly kind: CreditOperationsActionKind;
  readonly targetId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly ledgerPosition: number;
  readonly permission: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditEvent: string;
  readonly possibleProblems: readonly string[];
};

export type CreditOperationsReadyState = {
  readonly kind: "ready";
  readonly snapshot: CreditOperationsSnapshot;
  readonly grantedPermissions: readonly string[];
  readonly actions: readonly CreditOperationsAction[];
};

export type CreditOperationsState =
  | {
      readonly kind: "loading";
      readonly tenantId: string;
      readonly accountId?: string;
    }
  | {
      readonly kind: "empty";
      readonly tenantId: string;
      readonly message?: string;
    }
  | {
      readonly kind: "permission-denied";
      readonly tenantId: string;
      readonly requiredPermissions: readonly string[];
      readonly grantedPermissions: readonly string[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly tenantId: string;
      readonly problem: AdminProblemContract;
      readonly partial?: CreditOperationsReadyState;
    }
  | {
      readonly kind: "stale";
      readonly tenantId: string;
      readonly expectedPosition: number;
      readonly actualPosition: number;
      readonly problem: AdminProblemContract;
      readonly snapshot: CreditOperationsSnapshot;
      readonly grantedPermissions: readonly string[];
    }
  | CreditOperationsReadyState;

export type CreditOperationsWriteEvidence = {
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly reference: {
    readonly type: string;
    readonly id: string;
  };
  readonly expectedPosition: number;
};

type CreditGrantOrAdjustmentTerms = {
  readonly amount: string;
  readonly expiresAt?: Date;
  readonly source?: string;
  readonly meterKeys?: readonly string[];
};

export type CreditOperationsActionRequest = CreditOperationsWriteEvidence & {
  readonly tenantId: string;
  readonly accountId: string;
  readonly action: CreditOperationsActionKind;
  readonly targetId: string;
  readonly input:
    | ({ readonly kind: "grant" } & CreditGrantOrAdjustmentTerms)
    | {
        readonly kind: "refund";
        readonly consumptionTransactionId: string;
        readonly amount: string;
      }
    | {
        readonly kind: "release-reservation";
        readonly reservationId: string;
      }
    | ({
        readonly kind: "adjustment";
        readonly direction: "credit" | "debit";
      } & CreditGrantOrAdjustmentTerms);
};

export type CreditOperationsActionResult =
  | {
      readonly kind: "succeeded";
      readonly replayed: boolean;
      readonly ledgerPosition: number;
      readonly transactionIds: readonly string[];
    }
  | {
      readonly kind: "problem";
      readonly problem: AdminProblemContract;
      readonly recovery:
        | "change-input"
        | "refresh-ledger"
        | "reuse-idempotency-result"
        | "retry-event-publication";
      readonly ledgerCommitted?: boolean;
    };

export type CreditOperationsMutationExecutor = {
  /**
   * Implementations must append the ledger transaction, idempotency claim, and audit evidence
   * atomically. They must never rewrite a prior transaction or set a mutable balance.
   */
  execute(input: {
    readonly request: CreditOperationsActionRequest;
    readonly action: CreditOperationsAction;
  }): Promise<CreditOperationsActionResult>;
};

export type LoadCreditOperationsInput = {
  readonly source: CreditOperationsSource;
  readonly tenantId: string;
  readonly accountId?: string;
  readonly grantedPermissions: readonly string[];
  readonly signal?: AbortSignal;
};

const READ_PERMISSION = "credits:read";
const WRITE_PERMISSION = "credits:write";
const REFUND_PERMISSION = "credits:refund";
const RELEASE_PERMISSION = "credits:release";
const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/;
const SIGNED_DECIMAL_PATTERN = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,18}))?$/;

const COMMON_PROBLEMS = [
  "credits-core/duplicate-conflict",
  "credits-core/stale-ledger-position",
  "credits-core/event-publication-failed",
] as const;

/** Reports an RFC 7807 validation failure in a tenant credit operations contract. */
export class CreditOperationsValidationProblem extends Problem {
  constructor(field: string, reason: string, evidence: Readonly<Record<string, unknown>> = {}) {
    super(
      "admin-core/credit-operations-validation-failed",
      ProblemCategory.ValidationError,
      `Credit operation ${field} is invalid: ${reason}.`,
      { extensions: { field, ...evidence } },
    );
  }
}

export function createCreditOperationsLoadingState(input: {
  readonly tenantId: string;
  readonly accountId?: string;
}): CreditOperationsState {
  return { kind: "loading", ...input };
}

export async function loadCreditOperations(
  input: LoadCreditOperationsInput,
): Promise<CreditOperationsState> {
  const missing = input.source.requiredPermissions.filter(
    (permission) => !input.grantedPermissions.includes(permission),
  );
  if (missing.length > 0) {
    return {
      kind: "permission-denied",
      tenantId: input.tenantId,
      requiredPermissions: input.source.requiredPermissions,
      grantedPermissions: input.grantedPermissions,
      problem: {
        code: "admin-core/credit-operations-permission-denied",
        status: 403,
        title: "Credit operations permission denied",
        detail: `Missing permissions: ${missing.join(", ")}`,
      },
    };
  }

  let result: CreditOperationsSourceResult;
  try {
    result = await input.source.load({
      tenantId: input.tenantId,
      accountId: input.accountId,
      signal: input.signal,
    });
  } catch (caught) {
    if (input.signal?.aborted) {
      throw input.signal.reason ?? caught;
    }
    return {
      kind: "problem",
      tenantId: input.tenantId,
      problem: {
        code: "admin-core/credit-operations-source-failed",
        status: 503,
        title: "Credit ledger unavailable",
        detail: "The credit operations source failed. Inspect server-side provider evidence.",
        retryable: true,
        metadata: { cause: caught },
      },
    };
  }

  if (result.kind === "empty") {
    return { kind: "empty", tenantId: input.tenantId, message: result.message };
  }

  if (result.kind === "problem") {
    const resolved = resolveValidatedPartial(result, input);
    return {
      kind: "problem",
      tenantId: input.tenantId,
      problem: resolved.problem,
      partial: resolved.partial,
    };
  }

  const snapshot = assertCreditOperationsSnapshot(result.snapshot, input);
  if (result.kind === "stale") {
    if (
      !Number.isInteger(result.expectedPosition) ||
      result.expectedPosition < 0 ||
      !Number.isInteger(result.actualPosition) ||
      result.actualPosition <= result.expectedPosition ||
      result.actualPosition !== snapshot.balance.ledgerPosition
    ) {
      throw new CreditOperationsValidationProblem(
        "stalePosition",
        "expected and actual positions must describe the validated ledger snapshot",
      );
    }
    return {
      kind: "stale",
      tenantId: input.tenantId,
      expectedPosition: result.expectedPosition,
      actualPosition: result.actualPosition,
      problem: result.problem,
      snapshot,
      grantedPermissions: input.grantedPermissions,
    };
  }
  return createReadyState(snapshot, input.grantedPermissions);
}

export function createCreditOperationsActions(
  snapshot: CreditOperationsSnapshot,
  grantedPermissions: readonly string[],
): readonly CreditOperationsAction[] {
  const actions: CreditOperationsAction[] = [
    createAction(
      "grant",
      snapshot.accountId,
      snapshot,
      WRITE_PERMISSION,
      grantedPermissions.includes(WRITE_PERMISSION),
      "Append a new grant lot without changing prior ledger history",
      [...COMMON_PROBLEMS, "credits-core/invalid-amount", "credits-core/invalid-command"],
    ),
    createAction(
      "adjustment",
      snapshot.accountId,
      snapshot,
      WRITE_PERMISSION,
      grantedPermissions.includes(WRITE_PERMISSION),
      "Append a compensating credit or debit without rewriting prior transactions",
      [
        ...COMMON_PROBLEMS,
        "credits-core/invalid-amount",
        "credits-core/invalid-command",
        "credits-core/insufficient-credits",
        "credits-core/expired-grant",
      ],
    ),
  ];

  for (const transaction of snapshot.transactions) {
    if (
      (transaction.kind === "consume" || transaction.kind === "commit") &&
      transaction.refundableAmount !== undefined &&
      transaction.refundableAmount !== "0"
    ) {
      actions.push(
        createAction(
          "refund",
          transaction.id,
          snapshot,
          REFUND_PERMISSION,
          grantedPermissions.includes(REFUND_PERMISSION),
          "The ledger reports remaining refundable consumption",
          [
            ...COMMON_PROBLEMS,
            "credits-core/invalid-amount",
            "credits-core/refund-mismatch",
            "credits-core/transaction-not-found",
            "credits-core/account-mismatch",
          ],
        ),
      );
    }
  }

  for (const reservation of snapshot.reservations) {
    if (reservation.status === "active" && reservation.release?.allowed === true) {
      actions.push(
        createAction(
          "release-reservation",
          reservation.id,
          snapshot,
          RELEASE_PERMISSION,
          grantedPermissions.includes(RELEASE_PERMISSION),
          reservation.release.reason,
          [
            ...COMMON_PROBLEMS,
            "credits-core/reservation-mismatch",
            "credits-core/account-mismatch",
          ],
        ),
      );
    }
  }
  return actions;
}

export function filterCreditOperationsTransactions(
  transactions: readonly CreditOperationsTransaction[],
  filter: CreditOperationsFilter,
  grantedPermissions: readonly string[],
): readonly CreditOperationsTransaction[] {
  const semanticReference = filter.semanticReference?.trim().toLocaleLowerCase();
  return transactions.filter((transaction) => {
    const reference = resolveCreditOperationsReference(transaction.reference, grantedPermissions);
    return (
      (filter.kinds === undefined || filter.kinds.includes(transaction.kind)) &&
      (filter.meterKey === undefined || transaction.meterKey === filter.meterKey) &&
      (filter.from === undefined || transaction.occurredAt >= filter.from) &&
      (filter.to === undefined || transaction.occurredAt <= filter.to) &&
      (semanticReference === undefined ||
        (reference !== undefined && reference.toLocaleLowerCase().includes(semanticReference)))
    );
  });
}

export function resolveCreditOperationsReference(
  reference: CreditOperationsReference,
  grantedPermissions: readonly string[],
): string | undefined {
  const hasPermissions =
    reference.requiredPermissions === undefined ||
    reference.requiredPermissions.every((permission) => grantedPermissions.includes(permission));
  if (reference.visibility === "visible" && hasPermissions) {
    return reference.value;
  }
  if (reference.visibility === "masked") {
    return reference.maskedValue;
  }
  return undefined;
}

/** Builds the canonical audited request used by generated credit operation consoles. */
export function createCreditOperationsActionRequest(
  action: CreditOperationsAction,
  evidence: {
    readonly actorId: string;
    readonly reason: string;
    readonly idempotencyKey: string;
  },
): CreditOperationsActionRequest {
  const common = {
    ...evidence,
    accountId: action.accountId,
    action: action.kind,
    expectedPosition: action.ledgerPosition,
    reference: {
      id: new URLSearchParams({
        actorId: evidence.actorId,
        idempotencyKey: evidence.idempotencyKey,
        reason: evidence.reason,
      }).toString(),
      type: "admin-credit-operation",
    },
    targetId: action.targetId,
    tenantId: action.tenantId,
  };
  switch (action.kind) {
    case "grant":
      return { ...common, input: { amount: "5", kind: "grant", source: "operator-grant" } };
    case "adjustment":
      return {
        ...common,
        input: {
          amount: "1",
          direction: "credit",
          kind: "adjustment",
          source: "operator-adjustment",
        },
      };
    case "refund":
      return {
        ...common,
        input: {
          amount: "1",
          consumptionTransactionId: action.targetId,
          kind: "refund",
        },
      };
    case "release-reservation":
      return {
        ...common,
        input: { kind: "release-reservation", reservationId: action.targetId },
      };
  }
}

export function assertCreditOperationsActionRequest(
  request: CreditOperationsActionRequest,
  now: Date = new Date(),
): CreditOperationsActionRequest {
  for (const [field, value] of [
    ["actorId", request.actorId],
    ["reason", request.reason],
    ["idempotencyKey", request.idempotencyKey],
    ["reference.type", request.reference.type],
    ["reference.id", request.reference.id],
  ] as const) {
    if (value.trim() === "") {
      throw new CreditOperationsValidationProblem(field, "a non-empty value is required");
    }
  }
  if (!Number.isInteger(request.expectedPosition) || request.expectedPosition < 0) {
    throw new CreditOperationsValidationProblem(
      "expectedPosition",
      "a non-negative integer is required",
    );
  }
  if (request.action !== request.input.kind) {
    throw new CreditOperationsValidationProblem("input.kind", "it must match the requested action");
  }
  if (request.input.kind !== "release-reservation") {
    assertAmount(request.input.amount);
  }
  if (request.input.kind === "grant" || request.input.kind === "adjustment") {
    assertGrantTerms(request.input, now);
  }
  if (
    request.input.kind === "refund" &&
    request.input.consumptionTransactionId !== request.targetId
  ) {
    throw new CreditOperationsValidationProblem(
      "consumptionTransactionId",
      "it must match the action target",
    );
  }
  if (
    request.input.kind === "release-reservation" &&
    request.input.reservationId !== request.targetId
  ) {
    throw new CreditOperationsValidationProblem("reservationId", "it must match the action target");
  }
  return request;
}

export async function executeCreditOperationsAction(input: {
  readonly request: CreditOperationsActionRequest;
  readonly action: CreditOperationsAction;
  readonly grantedPermissions: readonly string[];
  readonly executor: CreditOperationsMutationExecutor;
  readonly now?: Date;
}): Promise<CreditOperationsActionResult> {
  const request = assertCreditOperationsActionRequest(input.request, input.now);
  if (
    request.tenantId !== input.action.tenantId ||
    request.accountId !== input.action.accountId ||
    request.action !== input.action.kind ||
    request.targetId !== input.action.targetId ||
    request.expectedPosition !== input.action.ledgerPosition ||
    !input.action.allowed ||
    !input.grantedPermissions.includes(input.action.permission)
  ) {
    throw new CreditOperationsValidationProblem(
      "action",
      "tenant, account, target, position, and permission evidence must match",
    );
  }
  const result = await input.executor.execute({ request, action: input.action });
  if (result.kind === "problem" && !input.action.possibleProblems.includes(result.problem.code)) {
    throw new CreditOperationsValidationProblem(
      "problem",
      `undeclared Problem code '${result.problem.code}' was returned`,
      {
        ledgerCommitted: result.ledgerCommitted ?? false,
        recovery: result.recovery,
        returnedProblemCode: result.problem.code,
      },
    );
  }
  return result;
}

export function createCreditOperationsTenantExtension(
  state: CreditOperationsState,
): TenantWorkspaceExtension {
  return {
    kind: "extension",
    extensionId: "credit-operations",
    slot: "tab",
    label: "Credits",
    contractId: "credits/tenant-operations",
    state,
  };
}

function assertCreditOperationsSnapshot(
  snapshot: CreditOperationsSnapshot,
  input: Pick<LoadCreditOperationsInput, "tenantId" | "accountId">,
): CreditOperationsSnapshot {
  if (snapshot.tenantId !== input.tenantId) {
    throw new CreditOperationsValidationProblem("tenantId", "source returned another tenant");
  }
  if (input.accountId !== undefined && snapshot.accountId !== input.accountId) {
    throw new CreditOperationsValidationProblem("accountId", "source returned another account");
  }
  if (
    snapshot.balance.accountId !== snapshot.accountId ||
    !Number.isInteger(snapshot.balance.ledgerPosition) ||
    snapshot.balance.ledgerPosition < 0
  ) {
    throw new CreditOperationsValidationProblem(
      "balance",
      "account and ledger position must match the snapshot",
    );
  }
  const firstPosition =
    snapshot.history.kind === "complete" ? 1 : snapshot.history.earliestPosition;
  if (
    firstPosition < 1 ||
    firstPosition > snapshot.balance.ledgerPosition + 1 ||
    snapshot.transactions.length !== snapshot.balance.ledgerPosition - firstPosition + 1 ||
    snapshot.transactions.some(
      (transaction, index) =>
        !Number.isInteger(transaction.position) || transaction.position !== firstPosition + index,
    )
  ) {
    throw new CreditOperationsValidationProblem(
      "transactions",
      "history must be ordered, unique, contiguous, and end at the displayed ledger position",
    );
  }
  assertUnique(
    snapshot.transactions.map((transaction) => transaction.id),
    "transactions",
  );
  assertUnique(
    snapshot.grantLots.map((lot) => lot.transactionId),
    "grantLots",
  );
  assertUnique(
    snapshot.reservations.map((reservation) => reservation.id),
    "reservations",
  );
  assertBalanceReconciles(snapshot);

  const grantIds = new Set(snapshot.grantLots.map((lot) => lot.transactionId));
  const reservationIds = new Set(snapshot.reservations.map((reservation) => reservation.id));
  for (const lot of snapshot.grantLots) {
    assertStoredAmount(lot.amount, "grantLots.amount", false);
    assertStoredAmount(lot.remaining, "grantLots.remaining", true);
    if (compareDecimals(lot.remaining, lot.amount) > 0) {
      throw new CreditOperationsValidationProblem(
        "grantLots.remaining",
        "remaining credit cannot exceed the original grant amount",
      );
    }
  }
  if (snapshot.history.kind === "complete") {
    const transactionGrantIds = snapshot.transactions
      .filter(
        (transaction) =>
          transaction.kind === "grant" ||
          transaction.kind === "refund" ||
          (transaction.kind === "adjustment" && transaction.adjustmentDirection === "credit"),
      )
      .map((transaction) => transaction.id);
    if (
      transactionGrantIds.length !== grantIds.size ||
      transactionGrantIds.some((transactionId) => !grantIds.has(transactionId))
    ) {
      throw new CreditOperationsValidationProblem(
        "grantLots",
        "complete history must expose exactly one lot for every grant transaction",
      );
    }
  }
  for (const transaction of snapshot.transactions) {
    assertStoredAmount(transaction.amount, "transactions.amount", false);
    assertRefundableAmount(transaction, snapshot);
    assertRefundTarget(transaction, snapshot);
    assertAllocations(transaction.allocations, grantIds, "transactions.allocations");
    if (
      [
        "reserve",
        "commit",
        "release",
        "consume",
        "expire",
        "refund",
        ...(transaction.adjustmentDirection === "debit" ? ["adjustment"] : []),
      ].includes(transaction.kind) &&
      !decimalSumsEqual(
        transaction.allocations.map((allocation) => allocation.amount),
        [transaction.amount],
      )
    ) {
      throw new CreditOperationsValidationProblem(
        "transactions.allocations",
        "allocated grant amounts must equal the transaction amount",
      );
    }
    if (transaction.reservationId !== undefined && !reservationIds.has(transaction.reservationId)) {
      throw new CreditOperationsValidationProblem(
        "transactions.reservationId",
        "reservation-linked transactions must reference a visible reservation",
      );
    }
  }
  for (const reservation of snapshot.reservations) {
    assertStoredAmount(reservation.amount, "reservations.amount", false);
    assertAllocations(reservation.allocations, grantIds, "reservations.allocations");
    if (
      !decimalSumsEqual(
        reservation.allocations.map((allocation) => allocation.amount),
        [reservation.amount],
      )
    ) {
      throw new CreditOperationsValidationProblem(
        "reservations.allocations",
        "reservation allocations must equal the reserved amount",
      );
    }
  }
  if (snapshot.history.kind === "complete") {
    assertCompleteLedgerProjection(snapshot);
  }
  return snapshot;
}

function createReadyState(
  snapshot: CreditOperationsSnapshot,
  grantedPermissions: readonly string[],
): CreditOperationsReadyState {
  return {
    kind: "ready",
    snapshot,
    grantedPermissions,
    actions:
      snapshot.history.kind === "complete"
        ? createCreditOperationsActions(snapshot, grantedPermissions)
        : [],
  };
}

function createAction(
  kind: CreditOperationsActionKind,
  targetId: string,
  snapshot: CreditOperationsSnapshot,
  permission: string,
  allowed: boolean,
  reason: string,
  possibleProblems: readonly string[],
): CreditOperationsAction {
  return {
    kind,
    targetId,
    accountId: snapshot.accountId,
    tenantId: snapshot.tenantId,
    ledgerPosition: snapshot.balance.ledgerPosition,
    permission,
    allowed,
    reason: allowed ? reason : `Missing ${permission} permission`,
    auditEvent: `credits.admin.${kind}`,
    possibleProblems,
  };
}

function assertAmount(amount: string): void {
  try {
    assertStoredAmount(amount, "amount", false);
  } catch {
    throw new CreditOperationsValidationProblem(
      "amount",
      "use a positive canonical base-10 string with at most 18 fractional digits",
    );
  }
}

function resolveValidatedPartial(
  result: Extract<CreditOperationsSourceResult, { readonly kind: "problem" }>,
  input: LoadCreditOperationsInput,
): {
  readonly problem: AdminProblemContract;
  readonly partial?: CreditOperationsReadyState;
} {
  if (result.partial === undefined) {
    return { problem: result.problem };
  }
  try {
    return {
      partial: createReadyState(
        assertCreditOperationsSnapshot(result.partial, input),
        input.grantedPermissions,
      ),
      problem: result.problem,
    };
  } catch (caught) {
    return {
      problem: {
        ...result.problem,
        metadata: {
          ...result.problem.metadata,
          partialValidationCause: caught,
        },
      },
    };
  }
}

function assertGrantTerms(input: CreditGrantOrAdjustmentTerms, now: Date): void {
  if (input.expiresAt !== undefined) {
    if (Number.isNaN(input.expiresAt.getTime()) || input.expiresAt <= now) {
      throw new CreditOperationsValidationProblem("expiresAt", "expiry must be a future date");
    }
  }
  if (input.source !== undefined && input.source.trim() === "") {
    throw new CreditOperationsValidationProblem("source", "source must not be blank");
  }
  if (input.meterKeys !== undefined) {
    if (input.meterKeys.some((meterKey) => meterKey.trim() === "")) {
      throw new CreditOperationsValidationProblem(
        "meterKeys",
        "meter restrictions must not be blank",
      );
    }
    if (new Set(input.meterKeys).size !== input.meterKeys.length) {
      throw new CreditOperationsValidationProblem("meterKeys", "meter restrictions must be unique");
    }
  }
}

type ParsedDecimal = {
  readonly coefficient: bigint;
  readonly scale: number;
};

function assertBalanceReconciles(snapshot: CreditOperationsSnapshot): void {
  const { balance } = snapshot;
  for (const [field, value] of [
    ["available", balance.available],
    ["reserved", balance.reserved],
    ["consumed", balance.consumed],
    ["expired", balance.expired],
    ["lifetimeGranted", balance.lifetimeGranted],
    ["expiringSoon", balance.expiringSoon],
  ] as const) {
    assertStoredAmount(value, `balance.${field}`, true);
  }
  assertStoredAmount(balance.netAdjusted, "balance.netAdjusted", true, true);
  if (compareDecimals(balance.expiringSoon, balance.available) > 0) {
    throw new CreditOperationsValidationProblem(
      "balance.expiringSoon",
      "expiring-soon credit cannot exceed available credit",
    );
  }
  if (
    !decimalSumsEqual(
      [balance.available, balance.reserved, balance.consumed, balance.expired],
      [balance.lifetimeGranted, balance.netAdjusted],
    )
  ) {
    throw new CreditOperationsValidationProblem(
      "balance",
      "available + reserved + consumed + expired must equal lifetimeGranted + netAdjusted",
    );
  }
}

function assertCompleteLedgerProjection(snapshot: CreditOperationsSnapshot): void {
  const projectedLots = new Map<string, ParsedDecimal>();
  let projected = {
    available: parseDecimal("0", false, "balance"),
    consumed: parseDecimal("0", false, "balance"),
    expired: parseDecimal("0", false, "balance"),
    lifetimeGranted: parseDecimal("0", false, "balance"),
    netAdjusted: parseDecimal("0", true, "balance"),
    reserved: parseDecimal("0", false, "balance"),
  };
  for (const transaction of snapshot.transactions) {
    const amount = parseDecimal(transaction.amount, false, "transactions.amount");
    if (
      transaction.kind === "grant" ||
      transaction.kind === "refund" ||
      (transaction.kind === "adjustment" && transaction.adjustmentDirection === "credit")
    ) {
      projectedLots.set(transaction.id, amount);
    }
    switch (transaction.kind) {
      case "grant":
        projected = {
          ...projected,
          available: addDecimals(projected.available, amount),
          lifetimeGranted: addDecimals(projected.lifetimeGranted, amount),
        };
        break;
      case "reserve":
        applyProjectedAllocations(projectedLots, transaction.allocations, "subtract");
        projected = {
          ...projected,
          available: subtractDecimals(projected.available, amount, "balance.available"),
          reserved: addDecimals(projected.reserved, amount),
        };
        break;
      case "commit":
        projected = {
          ...projected,
          consumed: addDecimals(projected.consumed, amount),
          reserved: subtractDecimals(projected.reserved, amount, "balance.reserved"),
        };
        break;
      case "release":
        applyProjectedAllocations(projectedLots, transaction.allocations, "add");
        projected = {
          ...projected,
          available: addDecimals(projected.available, amount),
          reserved: subtractDecimals(projected.reserved, amount, "balance.reserved"),
        };
        break;
      case "consume":
        applyProjectedAllocations(projectedLots, transaction.allocations, "subtract");
        projected = {
          ...projected,
          available: subtractDecimals(projected.available, amount, "balance.available"),
          consumed: addDecimals(projected.consumed, amount),
        };
        break;
      case "expire":
        applyProjectedAllocations(projectedLots, transaction.allocations, "subtract");
        projected = {
          ...projected,
          available: subtractDecimals(projected.available, amount, "balance.available"),
          expired: addDecimals(projected.expired, amount),
        };
        break;
      case "refund":
        projected = {
          ...projected,
          available: addDecimals(projected.available, amount),
          consumed: subtractDecimals(projected.consumed, amount, "balance.consumed"),
        };
        break;
      case "adjustment":
        if (transaction.adjustmentDirection === undefined) {
          throw new CreditOperationsValidationProblem(
            "transactions.adjustmentDirection",
            "adjustment transactions must declare credit or debit",
          );
        }
        if (transaction.adjustmentDirection === "debit") {
          applyProjectedAllocations(projectedLots, transaction.allocations, "subtract");
        }
        projected = {
          ...projected,
          available:
            transaction.adjustmentDirection === "credit"
              ? addDecimals(projected.available, amount)
              : subtractDecimals(projected.available, amount, "balance.available"),
          netAdjusted:
            transaction.adjustmentDirection === "credit"
              ? addDecimals(projected.netAdjusted, amount)
              : subtractSignedDecimals(projected.netAdjusted, amount),
        };
        break;
    }
  }
  assertCompleteLotProjection(snapshot, projectedLots);
  assertCompleteReservationProjection(snapshot);
  assertCompleteRefundAllocations(snapshot);
  for (const field of [
    "available",
    "reserved",
    "consumed",
    "expired",
    "lifetimeGranted",
    "netAdjusted",
  ] as const) {
    if (normalizeDecimal(projected[field]) !== snapshot.balance[field]) {
      throw new CreditOperationsValidationProblem(
        `balance.${field}`,
        "complete history replay must equal the displayed balance",
      );
    }
  }
  const expiringSoon = snapshot.grantLots
    .filter(
      (lot) =>
        lot.expiresAt !== undefined &&
        lot.expiresAt > snapshot.generatedAt &&
        lot.expiresAt <= snapshot.balance.expiringSoonBefore,
    )
    .map((lot) => lot.remaining);
  if (!decimalSumsEqual(expiringSoon, [snapshot.balance.expiringSoon])) {
    throw new CreditOperationsValidationProblem(
      "balance.expiringSoon",
      "expiring-soon credit must equal eligible current grant lots",
    );
  }
}

function assertCompleteLotProjection(
  snapshot: CreditOperationsSnapshot,
  projectedLots: ReadonlyMap<string, ParsedDecimal>,
): void {
  for (const lot of snapshot.grantLots) {
    const projected = projectedLots.get(lot.transactionId);
    if (
      projected === undefined ||
      normalizeDecimal(projected) !== lot.remaining ||
      snapshot.transactions.find((transaction) => transaction.id === lot.transactionId)?.amount !==
        lot.amount
    ) {
      throw new CreditOperationsValidationProblem(
        "grantLots",
        "each complete grant lot must match its ledger projection",
      );
    }
    const activeReserved = snapshot.reservations
      .filter((reservation) => reservation.status === "active")
      .flatMap((reservation) => reservation.allocations)
      .filter((allocation) => allocation.grantTransactionId === lot.transactionId)
      .map((allocation) => allocation.amount);
    const expectedStatus =
      lot.expiresAt !== undefined && lot.expiresAt <= snapshot.generatedAt
        ? "expired"
        : lot.remaining !== "0"
          ? "available"
          : !decimalSumsEqual(activeReserved, ["0"])
            ? "reserved"
            : "consumed";
    if (lot.status !== expectedStatus) {
      throw new CreditOperationsValidationProblem(
        "grantLots.status",
        "grant lot status must match its projected availability",
      );
    }
  }
  if (
    projectedLots.size !== snapshot.grantLots.length ||
    !decimalSumsEqual([...projectedLots.values()].map(normalizeDecimal), [
      snapshot.balance.available,
    ])
  ) {
    throw new CreditOperationsValidationProblem(
      "grantLots.remaining",
      "complete lot projection must equal available credit",
    );
  }
}

type ProjectedReservation = {
  readonly amount: string;
  readonly allocations: readonly CreditOperationsAllocation[];
  readonly createdAt: Date;
  committed: ParsedDecimal;
  released: ParsedDecimal;
  settlementKind?: "commit" | "release";
  settledAt?: Date;
};

function assertCompleteReservationProjection(snapshot: CreditOperationsSnapshot): void {
  const projected = new Map<string, ProjectedReservation>();
  for (const transaction of snapshot.transactions) {
    if (transaction.kind === "reserve") {
      if (transaction.reservationId === undefined || projected.has(transaction.reservationId)) {
        throw new CreditOperationsValidationProblem(
          "transactions.reservationId",
          "each reservation must have exactly one reserve transaction",
        );
      }
      projected.set(transaction.reservationId, {
        allocations: transaction.allocations,
        amount: transaction.amount,
        committed: parseDecimal("0", false, "reservations"),
        createdAt: transaction.occurredAt,
        released: parseDecimal("0", false, "reservations"),
      });
      continue;
    }
    if (transaction.kind !== "commit" && transaction.kind !== "release") continue;
    const reservation =
      transaction.reservationId === undefined
        ? undefined
        : projected.get(transaction.reservationId);
    if (reservation === undefined) {
      throw new CreditOperationsValidationProblem(
        "transactions.reservationId",
        "settlement transactions must follow their reservation",
      );
    }
    if (
      reservation.settledAt !== undefined &&
      (reservation.settledAt.getTime() !== transaction.occurredAt.getTime() ||
        reservation.settlementKind !== "commit" ||
        transaction.kind !== "release")
    ) {
      throw new CreditOperationsValidationProblem(
        "transactions.reservationId",
        "reservation settlement must be one commit, one release, or a same-command commit then release",
      );
    }
    reservation.settledAt = transaction.occurredAt;
    reservation.settlementKind = transaction.kind;
    if (transaction.kind === "commit") {
      reservation.committed = addDecimals(
        reservation.committed,
        parseDecimal(transaction.amount, false, "reservations"),
      );
    } else {
      reservation.released = addDecimals(
        reservation.released,
        parseDecimal(transaction.amount, false, "reservations"),
      );
    }
  }

  if (projected.size !== snapshot.reservations.length) {
    throw new CreditOperationsValidationProblem(
      "reservations",
      "complete history must expose every reserved credit operation",
    );
  }
  for (const reservation of snapshot.reservations) {
    const evidence = projected.get(reservation.id);
    if (
      evidence === undefined ||
      evidence.amount !== reservation.amount ||
      evidence.createdAt.getTime() !== reservation.createdAt.getTime() ||
      !allocationMapsEqual(evidence.allocations, reservation.allocations)
    ) {
      throw new CreditOperationsValidationProblem(
        "reservations",
        "reservation details must match their reserve transaction",
      );
    }
    const settled = addDecimals(evidence.committed, evidence.released);
    const expectedStatus =
      settled.coefficient === BigInt(0)
        ? "active"
        : evidence.committed.coefficient === BigInt(0)
          ? "released"
          : "committed";
    if (
      reservation.status !== expectedStatus ||
      (expectedStatus === "active" && reservation.settledAt !== undefined) ||
      (expectedStatus !== "active" &&
        (reservation.settledAt === undefined ||
          reservation.settledAt.getTime() !== evidence.settledAt?.getTime())) ||
      (expectedStatus !== "active" && normalizeDecimal(settled) !== reservation.amount)
    ) {
      throw new CreditOperationsValidationProblem(
        "reservations.status",
        "reservation status and settlement evidence must match the ledger",
      );
    }
    const settlementAllocations = snapshot.transactions
      .filter(
        (transaction) =>
          (transaction.kind === "commit" || transaction.kind === "release") &&
          transaction.reservationId === reservation.id,
      )
      .flatMap((transaction) => transaction.allocations);
    if (
      expectedStatus !== "active" &&
      !allocationMapsEqual(settlementAllocations, evidence.allocations)
    ) {
      throw new CreditOperationsValidationProblem(
        "reservations.allocations",
        "settlement allocations must exhaust the original reservation",
      );
    }
  }
}

function assertCompleteRefundAllocations(snapshot: CreditOperationsSnapshot): void {
  const remainingByTransaction = new Map<string, Map<string, ParsedDecimal>>();
  for (const transaction of snapshot.transactions) {
    if (transaction.kind === "consume" || transaction.kind === "commit") {
      remainingByTransaction.set(transaction.id, allocationMap(transaction.allocations));
      continue;
    }
    if (transaction.kind !== "refund" || transaction.relatedTransactionId === undefined) continue;
    const remaining = remainingByTransaction.get(transaction.relatedTransactionId);
    if (remaining === undefined) {
      throw new CreditOperationsValidationProblem(
        "transactions.relatedTransactionId",
        "refund transactions must follow the original consumption",
      );
    }
    for (const allocation of transaction.allocations) {
      const available = remaining.get(allocation.grantTransactionId);
      if (available === undefined) {
        throw new CreditOperationsValidationProblem(
          "transactions.allocations",
          "refund allocations must come from the original consumption",
        );
      }
      remaining.set(
        allocation.grantTransactionId,
        subtractDecimals(
          available,
          parseDecimal(allocation.amount, false, "transactions.allocations"),
          "transactions.allocations",
        ),
      );
    }
  }
}

function applyProjectedAllocations(
  lots: Map<string, ParsedDecimal>,
  allocations: readonly CreditOperationsAllocation[],
  operation: "add" | "subtract",
): void {
  for (const allocation of allocations) {
    const current = lots.get(allocation.grantTransactionId);
    if (current === undefined) {
      throw new CreditOperationsValidationProblem(
        "transactions.allocations",
        "allocation must follow its grant transaction",
      );
    }
    const amount = parseDecimal(allocation.amount, false, "transactions.allocations");
    lots.set(
      allocation.grantTransactionId,
      operation === "add"
        ? addDecimals(current, amount)
        : subtractDecimals(current, amount, "grantLots.remaining"),
    );
  }
}

function allocationMapsEqual(
  left: readonly CreditOperationsAllocation[],
  right: readonly CreditOperationsAllocation[],
): boolean {
  const leftMap = allocationMap(left);
  const rightMap = allocationMap(right);
  if (leftMap.size !== rightMap.size) return false;
  return [...leftMap].every(
    ([grantId, amount]) =>
      normalizeDecimal(amount) ===
      normalizeDecimal(
        rightMap.get(grantId) ?? {
          coefficient: BigInt(-1),
          scale: 0,
        },
      ),
  );
}

function allocationMap(
  allocations: readonly CreditOperationsAllocation[],
): Map<string, ParsedDecimal> {
  const result = new Map<string, ParsedDecimal>();
  for (const allocation of allocations) {
    const amount = parseDecimal(allocation.amount, false, "allocations");
    result.set(
      allocation.grantTransactionId,
      addDecimals(
        result.get(allocation.grantTransactionId) ?? parseDecimal("0", false, "allocations"),
        amount,
      ),
    );
  }
  return result;
}

function assertRefundTarget(
  transaction: CreditOperationsTransaction,
  snapshot: CreditOperationsSnapshot,
): void {
  if (transaction.kind !== "refund") return;
  if (transaction.relatedTransactionId === undefined) {
    throw new CreditOperationsValidationProblem(
      "transactions.relatedTransactionId",
      "refund transactions must reference the original consumption",
    );
  }
  if (snapshot.history.kind !== "complete") return;
  const original = snapshot.transactions.find(
    (candidate) => candidate.id === transaction.relatedTransactionId,
  );
  if (
    original === undefined ||
    (original.kind !== "consume" && original.kind !== "commit") ||
    original.position >= transaction.position
  ) {
    throw new CreditOperationsValidationProblem(
      "transactions.relatedTransactionId",
      "refund transactions must reference an earlier visible consumption or commit transaction",
    );
  }
}

function assertRefundableAmount(
  transaction: CreditOperationsTransaction,
  snapshot: CreditOperationsSnapshot,
): void {
  if (transaction.kind !== "consume" && transaction.kind !== "commit") {
    if (transaction.refundableAmount !== undefined) {
      throw new CreditOperationsValidationProblem(
        "transactions.refundableAmount",
        "only consumption or commit transactions can be refundable",
      );
    }
    return;
  }
  if (transaction.refundableAmount === undefined) {
    if (snapshot.history.kind === "complete") {
      throw new CreditOperationsValidationProblem(
        "transactions.refundableAmount",
        "complete history must declare derived refund eligibility",
      );
    }
    return;
  }
  assertStoredAmount(transaction.refundableAmount, "transactions.refundableAmount", true);
  if (compareDecimals(transaction.refundableAmount, transaction.amount) > 0) {
    throw new CreditOperationsValidationProblem(
      "transactions.refundableAmount",
      "refundable credit cannot exceed consumed credit",
    );
  }
  if (snapshot.history.kind === "complete") {
    const refunded = snapshot.transactions
      .filter(
        (candidate) =>
          candidate.kind === "refund" && candidate.relatedTransactionId === transaction.id,
      )
      .map((candidate) => candidate.amount);
    const expected = subtractDecimals(
      parseDecimal(transaction.amount, false, "transactions.amount"),
      sumDecimals(refunded),
      "transactions.refundableAmount",
    );
    if (normalizeDecimal(expected) !== transaction.refundableAmount) {
      throw new CreditOperationsValidationProblem(
        "transactions.refundableAmount",
        "complete history must derive refund eligibility from refund transactions",
      );
    }
  }
}

function assertAllocations(
  allocations: readonly CreditOperationsAllocation[],
  grantIds: ReadonlySet<string>,
  field: string,
): void {
  assertUnique(
    allocations.map((allocation) => allocation.grantTransactionId),
    field,
  );
  for (const allocation of allocations) {
    assertStoredAmount(allocation.amount, `${field}.amount`, false);
    if (!grantIds.has(allocation.grantTransactionId)) {
      throw new CreditOperationsValidationProblem(
        field,
        "every allocation must reference a visible grant lot",
      );
    }
  }
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new CreditOperationsValidationProblem(field, "identifiers must be unique");
  }
}

function assertStoredAmount(
  value: string,
  field: string,
  allowZero: boolean,
  signed = false,
): void {
  const parsed = parseDecimal(value, signed, field);
  if (normalizeDecimal(parsed) !== value || (!allowZero && parsed.coefficient === BigInt(0))) {
    throw new CreditOperationsValidationProblem(
      field,
      `use a ${allowZero ? "non-negative" : "positive"} canonical decimal string`,
    );
  }
}

function decimalSumsEqual(left: readonly string[], right: readonly string[]): boolean {
  const leftSum = sumDecimals(left);
  const rightSum = sumDecimals(right);
  const [leftCoefficient, rightCoefficient] = alignDecimals(leftSum, rightSum);
  return leftCoefficient === rightCoefficient;
}

function sumDecimals(values: readonly string[]): ParsedDecimal {
  return values.reduce<ParsedDecimal>(
    (sum, value) => addDecimals(sum, parseDecimal(value, true, "decimal")),
    { coefficient: BigInt(0), scale: 0 },
  );
}

function compareDecimals(left: string, right: string): number {
  const [leftCoefficient, rightCoefficient] = alignDecimals(
    parseDecimal(left, false, "decimal"),
    parseDecimal(right, false, "decimal"),
  );
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0;
}

function parseDecimal(value: string, signed: boolean, field: string): ParsedDecimal {
  const match = (signed ? SIGNED_DECIMAL_PATTERN : DECIMAL_PATTERN).exec(value);
  if (match === null) {
    throw new CreditOperationsValidationProblem(
      field,
      "use a canonical base-10 string with at most 18 fractional digits",
    );
  }
  const sign = signed && match[1] === "-" ? BigInt(-1) : BigInt(1);
  const integerIndex = signed ? 2 : 1;
  const fractionIndex = signed ? 3 : 2;
  const integer = match[integerIndex];
  const fraction = match[fractionIndex] ?? "";
  return {
    coefficient: sign * BigInt(`${integer}${fraction}`),
    scale: fraction.length,
  };
}

function addDecimals(left: ParsedDecimal, right: ParsedDecimal): ParsedDecimal {
  const [leftCoefficient, rightCoefficient, scale] = alignDecimals(left, right);
  return { coefficient: leftCoefficient + rightCoefficient, scale };
}

function subtractDecimals(left: ParsedDecimal, right: ParsedDecimal, field: string): ParsedDecimal {
  const [leftCoefficient, rightCoefficient, scale] = alignDecimals(left, right);
  const coefficient = leftCoefficient - rightCoefficient;
  if (coefficient < BigInt(0)) {
    throw new CreditOperationsValidationProblem(field, "ledger projection cannot be negative");
  }
  return { coefficient, scale };
}

function subtractSignedDecimals(left: ParsedDecimal, right: ParsedDecimal): ParsedDecimal {
  const [leftCoefficient, rightCoefficient, scale] = alignDecimals(left, right);
  return { coefficient: leftCoefficient - rightCoefficient, scale };
}

function alignDecimals(
  left: ParsedDecimal,
  right: ParsedDecimal,
): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * BigInt(10) ** BigInt(scale - left.scale),
    right.coefficient * BigInt(10) ** BigInt(scale - right.scale),
    scale,
  ];
}

function normalizeDecimal(decimal: ParsedDecimal): string {
  if (decimal.coefficient === BigInt(0)) return "0";
  const negative = decimal.coefficient < BigInt(0);
  const digits = (negative ? -decimal.coefficient : decimal.coefficient).toString();
  if (decimal.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(decimal.scale + 1, "0");
  const integer = padded.slice(0, -decimal.scale);
  const fraction = padded.slice(-decimal.scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${fraction.length > 0 ? `.${fraction}` : ""}`;
}

export const CREDIT_OPERATIONS_READ_PERMISSION = READ_PERMISSION;
