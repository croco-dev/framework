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

export abstract class CreditLedgerStore {
  abstract execute(command: CreditLedgerCommand): Promise<CreditCommandResult>;
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
