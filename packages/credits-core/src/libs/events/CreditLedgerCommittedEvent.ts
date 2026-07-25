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
  static eventName = "credits.ledger_committed";

  constructor(public readonly data: CreditLedgerCommittedEventData) {
    super();
  }
}
