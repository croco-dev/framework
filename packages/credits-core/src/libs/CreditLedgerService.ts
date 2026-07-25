import { randomUUID } from "node:crypto";
import {
  EventAfterCommitRequiresActiveTransactionProblem,
  type DomainEvent,
} from "@croco/events-core";
import type { CreditLedgerStore } from "./CreditLedgerStore";
import { CreditLedgerCommittedEvent } from "./events/CreditLedgerCommittedEvent";
import { creditAccountId, creditReservationId, creditTransactionId } from "./identifiers";
import { CreditEventPublicationProblem, InvalidCreditCommandProblem } from "./problems";
import type {
  CreditAccount,
  CreditAccountId,
  CreditAmount,
  CreditBalance,
  CreditCommandResult,
  CreditExpiryCursor,
  CreditGrantTerms,
  CreditHistoryPage,
  CreditReservation,
  CreditReservationId,
  CreditSemanticReference,
  CreditTransactionId,
} from "./types";

export interface CreditLedgerEventPublisher {
  publishNow(event: DomainEvent): Promise<void>;
  publishAfterCommit(event: DomainEvent): void;
}

export type CreditLedgerServiceOptions = {
  readonly store: CreditLedgerStore;
  readonly eventPublisher?: CreditLedgerEventPublisher;
  readonly clock?: () => Date;
  readonly idGenerator?: () => string;
};

type CommandMetadata = {
  readonly idempotencyKey: string;
  readonly reference: CreditSemanticReference;
  readonly expectedPosition?: number;
};

export type OpenCreditAccountInput = CommandMetadata & {
  readonly tenantId: string;
  readonly walletKey?: string;
};

export type GrantCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly amount: CreditAmount;
  readonly expiresAt?: Date;
  readonly source?: string;
  readonly meterKeys?: readonly string[];
};

export type ReserveCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly amount: CreditAmount;
  readonly meterKey?: string;
};

export type CommitCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly reservationId: CreditReservationId;
  readonly amount: CreditAmount;
};

export type ReleaseCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly reservationId: CreditReservationId;
};

export type ConsumeCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly amount: CreditAmount;
  readonly meterKey?: string;
};

export type RefundCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly consumptionTransactionId: CreditTransactionId;
  readonly amount: CreditAmount;
};

export type AdjustCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly amount: CreditAmount;
  readonly direction: "credit" | "debit";
  readonly expiresAt?: Date;
  readonly source?: string;
  readonly meterKeys?: readonly string[];
};

export type ExpireCreditsInput = CommandMetadata & {
  readonly accountId: CreditAccountId;
  readonly asOf?: Date;
  readonly limit?: number;
  readonly cursor?: CreditExpiryCursor;
};

export class CreditLedgerService {
  private readonly store: CreditLedgerStore;
  private readonly eventPublisher?: CreditLedgerEventPublisher;
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;
  private readonly pendingEvents = new Map<string, CreditLedgerCommittedEvent>();

  constructor(options: CreditLedgerServiceOptions) {
    this.store = options.store;
    this.eventPublisher = options.eventPublisher;
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  async openAccount(input: OpenCreditAccountInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "open",
      accountId: creditAccountId(this.idGenerator()),
      tenantId: input.tenantId,
      walletKey: input.walletKey,
      ...this.metadata(input),
    });
  }

  async grantCredits(input: GrantCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "grant",
      accountId: input.accountId,
      transactionId: creditTransactionId(this.idGenerator()),
      amount: input.amount,
      grant: this.grantTerms(input),
      ...this.metadata(input),
    });
  }

  async reserveCredits(input: ReserveCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "reserve",
      accountId: input.accountId,
      transactionId: creditTransactionId(this.idGenerator()),
      reservationId: creditReservationId(this.idGenerator()),
      amount: input.amount,
      meterKey: input.meterKey,
      ...this.metadata(input),
    });
  }

  async commitCredits(input: CommitCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "commit",
      accountId: input.accountId,
      reservationId: input.reservationId,
      commitTransactionId: creditTransactionId(this.idGenerator()),
      releaseTransactionId: creditTransactionId(this.idGenerator()),
      amount: input.amount,
      ...this.metadata(input),
    });
  }

  async releaseCredits(input: ReleaseCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "release",
      accountId: input.accountId,
      reservationId: input.reservationId,
      transactionId: creditTransactionId(this.idGenerator()),
      ...this.metadata(input),
    });
  }

  async consumeCredits(input: ConsumeCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "consume",
      accountId: input.accountId,
      transactionId: creditTransactionId(this.idGenerator()),
      amount: input.amount,
      meterKey: input.meterKey,
      ...this.metadata(input),
    });
  }

  async refundCredits(input: RefundCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "refund",
      accountId: input.accountId,
      transactionId: creditTransactionId(this.idGenerator()),
      consumptionTransactionId: input.consumptionTransactionId,
      amount: input.amount,
      ...this.metadata(input),
    });
  }

  async adjustCredits(input: AdjustCreditsInput): Promise<CreditCommandResult> {
    return this.execute({
      operation: "adjust",
      accountId: input.accountId,
      transactionId: creditTransactionId(this.idGenerator()),
      amount: input.amount,
      direction: input.direction,
      grant: input.direction === "credit" ? this.grantTerms(input) : undefined,
      ...this.metadata(input),
    });
  }

  async expireCredits(input: ExpireCreditsInput): Promise<CreditCommandResult> {
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new InvalidCreditCommandProblem("expiry limit must be an integer between 1 and 100");
    }
    return this.execute({
      operation: "expire",
      accountId: input.accountId,
      transactionIds: Array.from({ length: limit }, () => creditTransactionId(this.idGenerator())),
      asOf: input.asOf ? new Date(input.asOf) : this.now(),
      limit,
      cursor: input.cursor,
      ...this.metadata(input),
    });
  }

  async getAccount(accountId: CreditAccountId): Promise<CreditAccount | null> {
    return this.store.getAccount(accountId);
  }

  async getBalance(accountId: CreditAccountId, atPosition?: number): Promise<CreditBalance> {
    return this.store.getBalance(accountId, atPosition);
  }

  async getReservation(
    accountId: CreditAccountId,
    reservationId: CreditReservationId,
  ): Promise<CreditReservation | null> {
    return this.store.getReservation(accountId, reservationId);
  }

  async getHistory(
    accountId: CreditAccountId,
    options?: {
      readonly afterPosition?: number;
      readonly limit?: number;
      readonly atPosition?: number;
    },
  ): Promise<CreditHistoryPage> {
    return this.store.getHistory(accountId, options);
  }

  private metadata(input: CommandMetadata): CommandMetadata & { readonly occurredAt: Date } {
    return {
      idempotencyKey: input.idempotencyKey,
      reference: { ...input.reference },
      expectedPosition: input.expectedPosition,
      occurredAt: this.now(),
    };
  }

  private grantTerms(input: {
    readonly expiresAt?: Date;
    readonly source?: string;
    readonly meterKeys?: readonly string[];
  }): CreditGrantTerms {
    return {
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      source: input.source,
      meterKeys: input.meterKeys ? [...input.meterKeys].sort() : undefined,
    };
  }

  private now(): Date {
    const now = this.clock();
    if (Number.isNaN(now.getTime())) {
      throw new InvalidCreditCommandProblem("clock returned an invalid date");
    }
    return new Date(now);
  }

  private async execute(
    command: Parameters<CreditLedgerStore["execute"]>[0],
  ): Promise<CreditCommandResult> {
    const result = await this.store.execute(command);
    if (result.operation !== command.operation) {
      throw new InvalidCreditCommandProblem(
        `store returned '${result.operation}' for '${command.operation}'`,
      );
    }
    const pendingEvent = this.pendingEvents.get(command.idempotencyKey);
    if (pendingEvent) {
      await this.publishAfterCommitOrNow(command.idempotencyKey, pendingEvent);
    } else if (!result.replayed && result.transactions.length > 0) {
      await this.publishAfterCommitOrNow(
        command.idempotencyKey,
        new CreditLedgerCommittedEvent({
          accountId: result.account.id,
          position: result.account.position,
          transactionIds: result.transactions.map((transaction) => transaction.id),
          kinds: result.transactions.map((transaction) => transaction.kind),
          reference: command.reference,
        }),
      );
    }
    return result;
  }

  private async publishAfterCommitOrNow(
    idempotencyKey: string,
    event: CreditLedgerCommittedEvent,
  ): Promise<void> {
    if (!this.eventPublisher) return;
    try {
      this.eventPublisher.publishAfterCommit(event);
      this.pendingEvents.delete(idempotencyKey);
    } catch (error) {
      if (!(error instanceof EventAfterCommitRequiresActiveTransactionProblem)) {
        this.pendingEvents.set(idempotencyKey, event);
        const cause = error instanceof Error ? error : new Error(String(error));
        throw new CreditEventPublicationProblem(idempotencyKey, cause);
      }
      this.pendingEvents.set(idempotencyKey, event);
      await this.publishPendingImmediate(idempotencyKey, event);
    }
  }

  private async publishPendingImmediate(
    idempotencyKey: string,
    event: CreditLedgerCommittedEvent,
  ): Promise<void> {
    if (!this.eventPublisher) return;
    try {
      await this.eventPublisher.publishNow(event);
      this.pendingEvents.delete(idempotencyKey);
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new CreditEventPublicationProblem(idempotencyKey, cause);
    }
  }
}
