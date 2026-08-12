import { createHash } from "node:crypto";
import type { CreditLedgerCommittedEventData } from "./events/CreditLedgerCommittedEvent";
import type { CreditCommandResult, CreditLedgerCommand } from "./types";

export type CreditLedgerEventIntent = {
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly occurredAt: Date;
  readonly data: CreditLedgerCommittedEventData;
};

export function createCreditLedgerEventIntent(
  command: CreditLedgerCommand,
  result: CreditCommandResult,
): CreditLedgerEventIntent | null {
  if (result.transactions.length === 0) return null;
  return {
    eventId: createHash("sha256")
      .update(`credits.ledger_committed:${command.idempotencyKey}`)
      .digest("hex"),
    idempotencyKey: command.idempotencyKey,
    occurredAt: new Date(result.transactions[0]?.occurredAt ?? command.occurredAt),
    data: {
      accountId: result.account.id,
      position: result.account.position,
      transactionIds: result.transactions.map((transaction) => transaction.id),
      kinds: result.transactions.map((transaction) => transaction.kind),
      reference: { ...command.reference },
    },
  };
}

export function cloneCreditLedgerEventIntent(
  intent: CreditLedgerEventIntent,
): CreditLedgerEventIntent {
  return {
    ...intent,
    occurredAt: new Date(intent.occurredAt),
    data: {
      ...intent.data,
      transactionIds: [...intent.data.transactionIds],
      kinds: [...intent.data.kinds],
      reference: { ...intent.data.reference },
    },
  };
}
