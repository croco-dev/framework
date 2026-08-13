import type {
  CreditAccount,
  CreditAccountId,
  CreditBalance,
  CreditCommandResult,
  CreditHistoryPage,
  CreditLedgerCommand,
  CreditReservation,
  CreditReservationId,
} from "./types";
import type { CreditLedgerEventIntent } from "./eventIntent";

export abstract class CreditLedgerStore {
  abstract readonly eventIntentDurability: "persistent" | "volatile";
  abstract execute(command: CreditLedgerCommand): Promise<CreditCommandResult>;
  abstract getPendingEventIntent(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CreditLedgerEventIntent | null>;
  abstract listPendingEventIntents(limit?: number): Promise<readonly CreditLedgerEventIntent[]>;
  abstract markEventIntentPublished(eventId: string): Promise<void>;
  abstract getAccount(accountId: CreditAccountId): Promise<CreditAccount | null>;
  abstract getBalance(accountId: CreditAccountId, atPosition?: number): Promise<CreditBalance>;
  abstract getReservation(
    accountId: CreditAccountId,
    reservationId: CreditReservationId,
  ): Promise<CreditReservation | null>;
  abstract getHistory(
    accountId: CreditAccountId,
    options?: {
      readonly afterPosition?: number;
      readonly limit?: number;
      readonly atPosition?: number;
    },
  ): Promise<CreditHistoryPage>;
}
