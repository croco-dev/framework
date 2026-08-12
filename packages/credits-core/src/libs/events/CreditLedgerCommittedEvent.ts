import { DomainEvent } from "@croco/events-core";
import type {
  CreditAccountId,
  CreditSemanticReference,
  CreditTransactionId,
  CreditTransactionKind,
} from "../types";

export type CreditLedgerCommittedEventData = {
  readonly accountId: CreditAccountId;
  readonly position: number;
  readonly transactionIds: readonly CreditTransactionId[];
  readonly kinds: readonly CreditTransactionKind[];
  readonly reference: CreditSemanticReference;
};

export class CreditLedgerCommittedEvent extends DomainEvent {
  static readonly eventName = "credits.ledger_committed";

  constructor(
    public readonly data: CreditLedgerCommittedEventData,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(eventId);
    if (occurredAt) {
      const event = this as unknown as { timestamp: Date };
      event.timestamp = new Date(occurredAt);
    }
  }
}
