import { InvalidCreditCommandProblem } from "./problems";
import type { CreditAccountId, CreditReservationId, CreditTransactionId } from "./types";

function assertIdentifier(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new InvalidCreditCommandProblem(`${label} must not be blank`);
  }
}

export function creditAccountId(value: string): CreditAccountId {
  assertIdentifier(value, "account ID");
  return value as CreditAccountId;
}

export function creditTransactionId(value: string): CreditTransactionId {
  assertIdentifier(value, "transaction ID");
  return value as CreditTransactionId;
}

export function creditReservationId(value: string): CreditReservationId {
  assertIdentifier(value, "reservation ID");
  return value as CreditReservationId;
}
