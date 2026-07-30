import {
  CreditOperationsValidationProblem,
  createCreditOperationsActions,
  executeCreditOperationsAction,
  type CreditOperationsAction,
  type CreditOperationsActionRequest,
  type CreditOperationsActionResult,
  type CreditOperationsMutationExecutor,
  type CreditOperationsSnapshot,
  type CreditOperationsTransaction,
} from "@croco/admin-core";
import {
  addCreditAmounts,
  compareCreditAmounts,
  CreditLedgerService,
  creditAmount,
  creditReservationId,
  creditTransactionId,
  InMemoryCreditLedgerStore,
  subtractCreditAmounts,
  ZERO_CREDIT_AMOUNT,
  type CreditAccountId,
  type CreditAllocation,
  type CreditAmount,
  type CreditReservation,
  type CreditTransaction,
} from "@croco/credits-core";
import { Problem } from "@croco/problems-core";

import { creditOperationsActionCommandSchema } from "./controllers/adminSchemas";
import type {
  CreditOperationsActionCommand,
  CreditOperationsWireActionResult,
  CreditOperationsWireSnapshot,
} from "./controllers/adminSchemas";

const grantedPermissions = [
  "credits:read",
  "credits:write",
  "credits:refund",
  "credits:release",
] as const;

export class CreditOperationsService {
  private readonly ledger = new CreditLedgerService({ store: new InMemoryCreditLedgerStore() });
  private readonly fixtureDates = new Map<string, Date>();

  async snapshot(tenantId: string): Promise<CreditOperationsSnapshot> {
    const fixtureAt = this.fixtureDates.get(tenantId) ?? new Date();
    this.fixtureDates.set(tenantId, fixtureAt);
    return await createFixtureSnapshot(this.ledger, tenantId, fixtureAt);
  }

  async execute(
    selector: Pick<CreditOperationsAction, "kind" | "targetId">,
    request: CreditOperationsActionRequest,
  ): Promise<CreditOperationsActionResult> {
    const snapshot = await this.snapshot(request.tenantId);
    const derivedAction = createCreditOperationsActions(snapshot, grantedPermissions).find(
      (candidate) => candidate.kind === selector.kind && candidate.targetId === selector.targetId,
    );
    if (derivedAction === undefined) {
      throw new CreditOperationsValidationProblem(
        "action",
        "the current tenant ledger does not expose the requested action",
      );
    }
    return await executeCreditOperationsAction({
      action: { ...derivedAction, ledgerPosition: request.expectedPosition },
      executor: createExecutor(this.ledger),
      grantedPermissions,
      request,
    });
  }
}

let runtime = new CreditOperationsService();

export function getCreditOperationsService(): CreditOperationsService {
  return runtime;
}

export function resetCreditOperationsServiceForTests(): void {
  runtime = new CreditOperationsService();
}

export function toCreditOperationsWireSnapshot(
  snapshot: CreditOperationsSnapshot,
): CreditOperationsWireSnapshot {
  return {
    ...snapshot,
    generatedAt: snapshot.generatedAt.toISOString(),
    balance: {
      ...snapshot.balance,
      expiringSoonBefore: snapshot.balance.expiringSoonBefore.toISOString(),
    },
    grantLots: snapshot.grantLots.map((lot) => ({
      ...lot,
      expiresAt: lot.expiresAt?.toISOString(),
      meterKeys: [...lot.meterKeys],
      source: lot.source
        ? {
            ...lot.source,
            requiredPermissions: lot.source.requiredPermissions
              ? [...lot.source.requiredPermissions]
              : undefined,
          }
        : undefined,
    })),
    reservations: snapshot.reservations.map((reservation) => ({
      ...reservation,
      allocations: reservation.allocations.map((allocation) => ({ ...allocation })),
      createdAt: reservation.createdAt.toISOString(),
      settledAt: reservation.settledAt?.toISOString(),
    })),
    transactions: snapshot.transactions.map((transaction) => ({
      ...transaction,
      allocations: transaction.allocations.map((allocation) => ({ ...allocation })),
      occurredAt: transaction.occurredAt.toISOString(),
      reference: {
        ...transaction.reference,
        requiredPermissions: transaction.reference.requiredPermissions
          ? [...transaction.reference.requiredPermissions]
          : undefined,
      },
    })),
  };
}

export function fromCreditOperationsActionCommand(input: unknown): {
  readonly selector: Pick<CreditOperationsAction, "kind" | "targetId">;
  readonly request: CreditOperationsActionRequest;
} {
  const command = creditOperationsActionCommandSchema.parse(input) as Required<
    Pick<CreditOperationsActionCommand, keyof CreditOperationsActionCommand>
  >;
  const selector = {
    kind: command.actionKind,
    targetId: command.targetId,
  } as const;
  const common = {
    accountId: command.accountId,
    action: command.actionKind,
    actorId: command.actorId,
    expectedPosition: command.expectedPosition,
    idempotencyKey: command.idempotencyKey,
    reason: command.auditReason,
    reference: { id: command.referenceId, type: command.referenceType },
    targetId: command.targetId,
    tenantId: command.tenantId,
  };
  let request: CreditOperationsActionRequest;
  switch (command.inputKind) {
    case "grant":
      request = {
        ...common,
        input: {
          amount: requireCommandField(command.amount, "amount"),
          expiresAt: command.expiresAt ? new Date(command.expiresAt) : undefined,
          kind: "grant",
          meterKeys: command.meterKeys,
          source: command.source,
        },
      };
      break;
    case "adjustment":
      request = {
        ...common,
        input: {
          amount: requireCommandField(command.amount, "amount"),
          direction: requireCommandField(command.direction, "direction"),
          expiresAt: command.expiresAt ? new Date(command.expiresAt) : undefined,
          kind: "adjustment",
          meterKeys: command.meterKeys,
          source: command.source,
        },
      };
      break;
    case "refund":
      request = {
        ...common,
        input: {
          amount: requireCommandField(command.amount, "amount"),
          consumptionTransactionId: requireCommandField(
            command.consumptionTransactionId,
            "consumptionTransactionId",
          ),
          kind: "refund",
        },
      };
      break;
    case "release-reservation":
      request = {
        ...common,
        input: {
          kind: "release-reservation",
          reservationId: requireCommandField(command.reservationId, "reservationId"),
        },
      };
      break;
  }
  return { request, selector };
}

export function toCreditOperationsWireActionResult(
  result: CreditOperationsActionResult,
): CreditOperationsWireActionResult {
  return result.kind === "succeeded"
    ? { ...result, transactionIds: [...result.transactionIds] }
    : { ...result, problem: { ...result.problem } };
}

function requireCommandField<T extends string>(value: T | undefined, field: string): T {
  if (value === undefined || value.trim() === "") {
    throw new CreditOperationsValidationProblem(field, "a non-empty value is required");
  }
  return value;
}

export async function createFixtureSnapshot(
  service: CreditLedgerService,
  tenantId: string,
  now: Date,
): Promise<CreditOperationsSnapshot> {
  const expiringSoonBefore = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const opened = await service.openAccount({
    idempotencyKey: `${tenantId}:credit-account`,
    reference: { id: tenantId, type: "tenant-credit-account" },
    tenantId,
    walletKey: "usage",
  });
  const accountId = opened.account.id;
  const existingHistory = await service.getHistory(accountId, { limit: 1 });
  if (existingHistory.position === 0) {
    await service.grantCredits({
      accountId,
      amount: creditAmount("100"),
      expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1_000),
      idempotencyKey: `${tenantId}:grant:expiring`,
      meterKeys: ["llm.tokens"],
      reference: { id: "support-case-42", type: "support-case" },
      source: "generated-service-recovery",
    });
    await service.grantCredits({
      accountId,
      amount: creditAmount("10"),
      expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      idempotencyKey: `${tenantId}:grant:expired`,
      reference: { id: "promotion-expired", type: "promotion" },
      source: "generated-expired-promotion",
    });
    const reserved = await service.reserveCredits({
      accountId,
      amount: creditAmount("40"),
      idempotencyKey: `${tenantId}:reserve:partial`,
      meterKey: "llm.tokens",
      reference: { id: "request-partial", type: "usage-request" },
    });
    if (reserved.reservation) {
      await service.commitCredits({
        accountId,
        amount: creditAmount("25"),
        idempotencyKey: `${tenantId}:commit:partial`,
        reference: { id: "request-partial", type: "usage-request" },
        reservationId: reserved.reservation.id,
      });
    }
    await service.expireCredits({
      accountId,
      asOf: now,
      idempotencyKey: `${tenantId}:expiry`,
      reference: { id: now.toISOString().slice(0, 10), type: "expiry-run" },
    });
    const consumed = await service.consumeCredits({
      accountId,
      amount: creditAmount("10"),
      idempotencyKey: `${tenantId}:consume`,
      meterKey: "llm.tokens",
      reference: { id: "request-direct", type: "usage-request" },
    });
    const consumption = consumed.transactions[0];
    if (consumption) {
      await service.refundCredits({
        accountId,
        amount: creditAmount("4"),
        consumptionTransactionId: consumption.id,
        idempotencyKey: `${tenantId}:refund`,
        reference: { id: "support-case-refund", type: "support-case" },
      });
    }
    await service.reserveCredits({
      accountId,
      amount: creditAmount("8"),
      idempotencyKey: `${tenantId}:reserve:active`,
      meterKey: "llm.tokens",
      reference: { id: "request-active", type: "usage-request" },
    });
  }

  const history = await service.getHistory(accountId, { limit: 1_000 });
  const balance = await service.getBalance(accountId, history.position);
  const reservations = await loadReservations(service, accountId, history.transactions);
  const lotAmounts = projectLotAmounts(history.transactions);
  const grantLots = history.transactions.filter(isGrantLot).map((transaction) => {
    const remaining = lotAmounts.get(transaction.id) ?? ZERO_CREDIT_AMOUNT;
    return {
      amount: transaction.amount,
      expiresAt: transaction.grant?.expiresAt,
      meterKeys: transaction.grant?.meterKeys ?? [],
      remaining,
      source: transaction.grant?.source
        ? {
            maskedValue: `${transaction.grant.source.slice(0, 12)}***`,
            requiredPermissions: ["credits:references:read"],
            type: "grant-source",
            value: transaction.grant.source,
            visibility: "masked" as const,
          }
        : undefined,
      status: lotStatus(transaction, remaining, now),
      transactionId: transaction.id,
    };
  });
  const expiringSoon = grantLots
    .filter(
      (lot) =>
        lot.expiresAt !== undefined && lot.expiresAt > now && lot.expiresAt <= expiringSoonBefore,
    )
    .reduce<CreditAmount>(
      (total, lot) => addCreditAmounts(total, lot.remaining),
      ZERO_CREDIT_AMOUNT,
    );

  return {
    accountId,
    balance: {
      accountId,
      available: balance.available,
      consumed: balance.consumed,
      expired: balance.expired,
      expiringSoon,
      expiringSoonBefore,
      ledgerPosition: balance.position,
      lifetimeGranted: balance.lifetimeGranted,
      netAdjusted: balance.netAdjusted,
      reserved: balance.reserved,
    },
    generatedAt: now,
    grantLots,
    history: { kind: "complete" },
    reservations: reservations.map((reservation) => ({
      allocations: reservation.allocations,
      amount: reservation.amount,
      createdAt: reservation.createdAt,
      id: reservation.id,
      meterKey: reservation.meterKey,
      release:
        reservation.status === "active"
          ? { allowed: true, reason: "credits-core reports the reservation as active" }
          : undefined,
      settledAt: reservation.settledAt,
      status: reservation.status,
    })),
    tenantId,
    transactions: history.transactions.map((transaction) =>
      toOperationsTransaction(transaction, history.transactions),
    ),
  };
}

export function createActionRequest(
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

export function createExecutor(service: CreditLedgerService): CreditOperationsMutationExecutor {
  return {
    async execute({ action, request }) {
      try {
        const common = {
          accountId: creditAccountIdFrom(request.accountId),
          expectedPosition: request.expectedPosition,
          idempotencyKey: request.idempotencyKey,
          reference: request.reference,
        };
        const result =
          request.input.kind === "grant"
            ? await service.grantCredits({
                ...common,
                amount: creditAmount(request.input.amount),
                expiresAt: request.input.expiresAt,
                meterKeys: request.input.meterKeys,
                source: request.input.source,
              })
            : request.input.kind === "refund"
              ? await service.refundCredits({
                  ...common,
                  amount: creditAmount(request.input.amount),
                  consumptionTransactionId: creditTransactionId(
                    request.input.consumptionTransactionId,
                  ),
                })
              : request.input.kind === "release-reservation"
                ? await service.releaseCredits({
                    ...common,
                    reservationId: creditReservationId(request.input.reservationId),
                  })
                : await service.adjustCredits({
                    ...common,
                    amount: creditAmount(request.input.amount),
                    direction: request.input.direction,
                    expiresAt: request.input.expiresAt,
                    meterKeys: request.input.meterKeys,
                    source: request.input.source,
                  });
        return {
          kind: "succeeded",
          ledgerPosition: result.account.position,
          replayed: result.replayed,
          transactionIds: result.transactions.map((transaction) => transaction.id),
        };
      } catch (caught) {
        if (!(caught instanceof Problem) || !action.possibleProblems.includes(caught.code)) {
          throw caught;
        }
        const eventPublicationFailed = caught.code === "credits-core/event-publication-failed";
        return {
          kind: "problem",
          problem: caught.toJSON(),
          recovery:
            caught.code === "credits-core/stale-ledger-position"
              ? "refresh-ledger"
              : eventPublicationFailed
                ? "retry-event-publication"
                : "change-input",
          ledgerCommitted: eventPublicationFailed,
        };
      }
    },
  };
}

async function loadReservations(
  service: CreditLedgerService,
  accountId: CreditAccountId,
  transactions: readonly CreditTransaction[],
): Promise<readonly CreditReservation[]> {
  const reservationIds = [
    ...new Set(
      transactions.flatMap((transaction) =>
        transaction.reservationId ? [transaction.reservationId] : [],
      ),
    ),
  ];
  const reservations = await Promise.all(
    reservationIds.map((reservationId) => service.getReservation(accountId, reservationId)),
  );
  return reservations.filter(
    (reservation): reservation is CreditReservation => reservation !== null,
  );
}

function projectLotAmounts(
  transactions: readonly CreditTransaction[],
): ReadonlyMap<string, CreditAmount> {
  const lots = new Map<string, CreditAmount>();
  for (const transaction of transactions) {
    if (isGrantLot(transaction)) {
      lots.set(transaction.id, transaction.amount);
    }
    if (
      transaction.kind === "reserve" ||
      transaction.kind === "consume" ||
      transaction.kind === "expire" ||
      (transaction.kind === "adjustment" && transaction.adjustmentDirection === "debit")
    ) {
      applyAllocations(lots, transaction.allocations, "subtract");
    }
    if (transaction.kind === "release") {
      applyAllocations(lots, transaction.allocations, "add");
    }
  }
  return lots;
}

function applyAllocations(
  lots: Map<string, CreditAmount>,
  allocations: readonly CreditAllocation[],
  operation: "add" | "subtract",
): void {
  for (const allocation of allocations) {
    const current = lots.get(allocation.grantTransactionId) ?? ZERO_CREDIT_AMOUNT;
    lots.set(
      allocation.grantTransactionId,
      operation === "add"
        ? addCreditAmounts(current, allocation.amount)
        : subtractCreditAmounts(current, allocation.amount),
    );
  }
}

function isGrantLot(
  transaction: CreditTransaction,
): transaction is CreditTransaction & { readonly grant: NonNullable<CreditTransaction["grant"]> } {
  return transaction.grant !== undefined;
}

function lotStatus(
  transaction: CreditTransaction,
  remaining: CreditAmount,
  now: Date,
): "available" | "reserved" | "consumed" | "expired" {
  if (transaction.grant?.expiresAt && transaction.grant.expiresAt <= now) return "expired";
  if (compareCreditAmounts(remaining, ZERO_CREDIT_AMOUNT) > 0) return "available";
  return "consumed";
}

function toOperationsTransaction(
  transaction: CreditTransaction,
  history: readonly CreditTransaction[],
): CreditOperationsTransaction {
  const refunded = history
    .filter(
      (candidate) =>
        candidate.kind === "refund" && candidate.relatedTransactionId === transaction.id,
    )
    .reduce<CreditAmount>(
      (total, candidate) => addCreditAmounts(total, candidate.amount),
      ZERO_CREDIT_AMOUNT,
    );
  const refundableAmount =
    transaction.kind === "consume" || transaction.kind === "commit"
      ? subtractCreditAmounts(transaction.amount, refunded)
      : undefined;
  return {
    actorId:
      transaction.reference.type === "admin-credit-operation"
        ? (new URLSearchParams(transaction.reference.id).get("actorId") ?? undefined)
        : undefined,
    adjustmentDirection: transaction.adjustmentDirection,
    allocations: transaction.allocations,
    amount: transaction.amount,
    correlationId: `ledger:${transaction.position}`,
    id: transaction.id,
    kind: transaction.kind,
    meterKey: transaction.meterKey,
    occurredAt: transaction.occurredAt,
    position: transaction.position,
    reference: {
      maskedValue: `${transaction.reference.type}:***`,
      requiredPermissions: ["credits:references:read"],
      type: transaction.reference.type,
      value: transaction.reference.id,
      visibility: "masked",
    },
    refundableAmount,
    relatedTransactionId: transaction.relatedTransactionId,
    reservationId: transaction.reservationId,
  };
}

function creditAccountIdFrom(value: string): CreditAccountId {
  return value as CreditAccountId;
}
