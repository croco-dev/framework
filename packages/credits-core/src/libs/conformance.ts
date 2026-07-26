import * as assert from "node:assert/strict";
import { addCreditAmounts, creditAmount } from "./amount";
import { CreditLedgerService } from "./CreditLedgerService";
import type { CreditLedgerStore } from "./CreditLedgerStore";
import {
  CreditDuplicateConflictProblem,
  CreditReservationMismatchProblem,
  ExpiredGrantProblem,
  InsufficientCreditsProblem,
} from "./problems";
import type { CreditExpiryCursor } from "./types";

export type CreditLedgerStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type CreditLedgerStoreConformanceOptions = {
  readonly createStore: () => CreditLedgerStore | Promise<CreditLedgerStore>;
  readonly storeName: string;
};

export type CreditLedgerStoreConformanceSuite = {
  readonly cases: readonly CreditLedgerStoreConformanceCase[];
};

function reference(id: string) {
  return { type: "conformance", id };
}

export function createCreditLedgerStoreConformanceSuite(
  options: CreditLedgerStoreConformanceOptions,
): CreditLedgerStoreConformanceSuite {
  let sequence = 0;
  const createService = async (): Promise<CreditLedgerService> => {
    const store = await options.createStore();
    return new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T00:00:00.000Z"),
      idGenerator: () => `${options.storeName}-${++sequence}`,
    });
  };

  return {
    cases: [
      {
        name: "replays semantic commands without duplicate balance movement and rejects conflicts",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-replay",
            idempotencyKey: "open-replay",
            reference: reference("open-replay"),
          });
          const input = {
            accountId: opened.account.id,
            amount: creditAmount("10.25"),
            idempotencyKey: "grant-replay",
            reference: reference("grant-replay"),
          };
          const original = await service.grantCredits(input);
          const replay = await service.grantCredits(input);

          assert.equal(replay.replayed, true);
          assert.equal(replay.transactions[0]?.id, original.transactions[0]?.id);
          assert.equal((await service.getBalance(opened.account.id)).available, "10.25");
          await assert.rejects(
            () =>
              service.grantCredits({
                ...input,
                amount: creditAmount("11"),
              }),
            CreditDuplicateConflictProblem,
          );
        },
      },
      {
        name: "rejects an idempotency conflict matrix across semantic command fields",
        run: async () => {
          const service = await createService();
          const first = await service.openAccount({
            tenantId: "tenant-matrix-a",
            idempotencyKey: "open-matrix-a",
            reference: reference("open-matrix-a"),
          });
          const second = await service.openAccount({
            tenantId: "tenant-matrix-b",
            idempotencyKey: "open-matrix-b",
            reference: reference("open-matrix-b"),
          });
          const original = {
            accountId: first.account.id,
            amount: creditAmount("10"),
            expiresAt: new Date("2026-08-01T00:00:00.000Z"),
            source: "promotion",
            meterKeys: ["tokens"],
            expectedPosition: 0,
            idempotencyKey: "grant-matrix",
            reference: reference("grant-matrix"),
          };
          await service.grantCredits(original);

          for (const conflicting of [
            { ...original, accountId: second.account.id },
            { ...original, amount: creditAmount("11") },
            { ...original, expiresAt: new Date("2026-08-02T00:00:00.000Z") },
            { ...original, source: "recovery" },
            { ...original, meterKeys: ["requests"] },
            { ...original, expectedPosition: 1 },
            { ...original, reference: reference("grant-matrix-changed") },
          ]) {
            await assert.rejects(
              () => service.grantCredits(conflicting),
              CreditDuplicateConflictProblem,
            );
          }

          await service.expireCredits({
            accountId: first.account.id,
            asOf: new Date("2026-08-03T00:00:00.000Z"),
            limit: 1,
            idempotencyKey: "expire-matrix",
            reference: reference("expire-matrix"),
          });
          await assert.rejects(
            () =>
              service.expireCredits({
                accountId: first.account.id,
                asOf: new Date("2026-08-03T00:00:00.000Z"),
                limit: 1,
                cursor: "changed-cursor" as CreditExpiryCursor,
                idempotencyKey: "expire-matrix",
                reference: reference("expire-matrix"),
              }),
            CreditDuplicateConflictProblem,
          );
        },
      },
      {
        name: "serializes concurrent reservations without overdrawing an account",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-concurrent",
            idempotencyKey: "open-concurrent",
            reference: reference("open-concurrent"),
          });
          await service.grantCredits({
            accountId: opened.account.id,
            amount: creditAmount("100"),
            idempotencyKey: "grant-concurrent",
            reference: reference("grant-concurrent"),
          });

          const attempts = await Promise.allSettled([
            service.reserveCredits({
              accountId: opened.account.id,
              amount: creditAmount("80"),
              idempotencyKey: "reserve-concurrent-a",
              reference: reference("reserve-concurrent-a"),
            }),
            service.reserveCredits({
              accountId: opened.account.id,
              amount: creditAmount("80"),
              idempotencyKey: "reserve-concurrent-b",
              reference: reference("reserve-concurrent-b"),
            }),
          ]);
          assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
          const rejected = attempts.find((attempt) => attempt.status === "rejected");
          assert.ok(rejected?.status === "rejected");
          assert.ok(rejected.reason instanceof InsufficientCreditsProblem);
          assert.deepEqual(await service.getBalance(opened.account.id), {
            accountId: opened.account.id,
            position: 2,
            available: "20",
            reserved: "80",
            consumed: "0",
            expired: "0",
            lifetimeGranted: "100",
            netAdjusted: "0",
          });
        },
      },
      {
        name: "commits actual usage and releases the reservation remainder atomically",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-commit",
            idempotencyKey: "open-commit",
            reference: reference("open-commit"),
          });
          await service.grantCredits({
            accountId: opened.account.id,
            amount: creditAmount("100"),
            idempotencyKey: "grant-commit",
            reference: reference("grant-commit"),
          });
          const reserved = await service.reserveCredits({
            accountId: opened.account.id,
            amount: creditAmount("80"),
            idempotencyKey: "reserve-commit",
            reference: reference("reserve-commit"),
          });
          assert.ok(reserved.reservation);
          const committed = await service.commitCredits({
            accountId: opened.account.id,
            reservationId: reserved.reservation.id,
            amount: creditAmount("30"),
            idempotencyKey: "commit-partial",
            reference: reference("commit-partial"),
          });

          assert.deepEqual(
            committed.transactions.map((transaction) => [transaction.kind, transaction.amount]),
            [
              ["commit", "30"],
              ["release", "50"],
            ],
          );
          assert.equal(committed.reservation?.status, "committed");
          assert.deepEqual(await service.getBalance(opened.account.id), {
            accountId: opened.account.id,
            position: 4,
            available: "70",
            reserved: "0",
            consumed: "30",
            expired: "0",
            lifetimeGranted: "100",
            netAdjusted: "0",
          });
        },
      },
      {
        name: "settles a reservation once under competing commit and release commands",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-settlement-race",
            idempotencyKey: "open-settlement-race",
            reference: reference("open-settlement-race"),
          });
          await service.grantCredits({
            accountId: opened.account.id,
            amount: creditAmount("20"),
            idempotencyKey: "grant-settlement-race",
            reference: reference("grant-settlement-race"),
          });
          const reserved = await service.reserveCredits({
            accountId: opened.account.id,
            amount: creditAmount("12"),
            idempotencyKey: "reserve-settlement-race",
            reference: reference("reserve-settlement-race"),
          });
          assert.ok(reserved.reservation);

          const attempts = await Promise.allSettled([
            service.commitCredits({
              accountId: opened.account.id,
              reservationId: reserved.reservation.id,
              amount: creditAmount("7"),
              idempotencyKey: "commit-settlement-race",
              reference: reference("commit-settlement-race"),
            }),
            service.releaseCredits({
              accountId: opened.account.id,
              reservationId: reserved.reservation.id,
              idempotencyKey: "release-settlement-race",
              reference: reference("release-settlement-race"),
            }),
          ]);
          assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
          const rejected = attempts.find((attempt) => attempt.status === "rejected");
          assert.ok(rejected?.status === "rejected");
          assert.ok(rejected.reason instanceof CreditReservationMismatchProblem);

          const balance = await service.getBalance(opened.account.id);
          assert.equal(balance.reserved, "0");
          assert.equal(
            addCreditAmounts(balance.available, balance.consumed),
            balance.lifetimeGranted,
          );
        },
      },
      {
        name: "keeps restricted and expired allocation failures atomic at a pinned position",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-restrictions",
            idempotencyKey: "open-restrictions",
            reference: reference("open-restrictions"),
          });
          await service.grantCredits({
            accountId: opened.account.id,
            amount: creditAmount("9"),
            expiresAt: new Date("2026-07-25T00:00:00.000Z"),
            meterKeys: ["tokens"],
            idempotencyKey: "grant-restrictions",
            reference: reference("grant-restrictions"),
          });

          await assert.rejects(
            () =>
              service.consumeCredits({
                accountId: opened.account.id,
                amount: creditAmount("1"),
                meterKey: "tokens",
                idempotencyKey: "consume-expired",
                reference: reference("consume-expired"),
              }),
            ExpiredGrantProblem,
          );
          await assert.rejects(
            () =>
              service.consumeCredits({
                accountId: opened.account.id,
                amount: creditAmount("1"),
                meterKey: "requests",
                idempotencyKey: "consume-restricted",
                reference: reference("consume-restricted"),
              }),
            InsufficientCreditsProblem,
          );
          assert.deepEqual(await service.getBalance(opened.account.id), {
            accountId: opened.account.id,
            position: 1,
            available: "9",
            reserved: "0",
            consumed: "0",
            expired: "0",
            lifetimeGranted: "9",
            netAdjusted: "0",
          });
          assert.deepEqual(await service.getBalance(opened.account.id, 1), {
            accountId: opened.account.id,
            position: 1,
            available: "9",
            reserved: "0",
            consumed: "0",
            expired: "0",
            lifetimeGranted: "9",
            netAdjusted: "0",
          });
          assert.equal(
            (await service.getHistory(opened.account.id, { atPosition: 1 })).transactions.length,
            1,
          );
        },
      },
      {
        name: "applies compensating adjustments exactly once in both directions",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-adjustments",
            idempotencyKey: "open-adjustments",
            reference: reference("open-adjustments"),
          });
          const creditInput = {
            accountId: opened.account.id,
            amount: creditAmount("8"),
            direction: "credit" as const,
            idempotencyKey: "adjust-credit",
            reference: reference("adjust-credit"),
          };
          const credited = await service.adjustCredits(creditInput);
          const replayedCredit = await service.adjustCredits(creditInput);
          assert.equal(replayedCredit.replayed, true);
          assert.equal(replayedCredit.transactions[0]?.id, credited.transactions[0]?.id);

          const debitInput = {
            accountId: opened.account.id,
            amount: creditAmount("3"),
            direction: "debit" as const,
            idempotencyKey: "adjust-debit",
            reference: reference("adjust-debit"),
          };
          const debited = await service.adjustCredits(debitInput);
          const replayedDebit = await service.adjustCredits(debitInput);
          assert.equal(replayedDebit.replayed, true);
          assert.equal(replayedDebit.transactions[0]?.id, debited.transactions[0]?.id);
          assert.deepEqual(await service.getBalance(opened.account.id), {
            accountId: opened.account.id,
            position: 2,
            available: "5",
            reserved: "0",
            consumed: "0",
            expired: "0",
            lifetimeGranted: "0",
            netAdjusted: "5",
          });
        },
      },
      {
        name: "expires lots in deterministic bounded pages",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-expiry",
            idempotencyKey: "open-expiry",
            reference: reference("open-expiry"),
          });
          const grantIds = new Map<string, string>();
          for (const [id, expiresAt] of [
            ["later", "2026-07-03T00:00:00.000Z"],
            ["first", "2026-07-01T00:00:00.000Z"],
            ["second", "2026-07-02T00:00:00.000Z"],
          ] as const) {
            const granted = await service.grantCredits({
              accountId: opened.account.id,
              amount: creditAmount("5"),
              expiresAt: new Date(expiresAt),
              idempotencyKey: `grant-expiry-${id}`,
              reference: reference(`grant-expiry-${id}`),
            });
            const grantTransaction = granted.transactions[0];
            assert.ok(grantTransaction);
            grantIds.set(id, grantTransaction.id);
          }

          const first = await service.expireCredits({
            accountId: opened.account.id,
            asOf: new Date("2026-07-26T00:00:00.000Z"),
            limit: 1,
            idempotencyKey: "expire-page-1",
            reference: reference("expire-page-1"),
          });
          assert.equal(first.transactions.length, 1);
          assert.ok(first.nextCursor);
          assert.equal(
            first.transactions[0]?.allocations[0]?.grantTransactionId,
            grantIds.get("first"),
          );

          const second = await service.expireCredits({
            accountId: opened.account.id,
            asOf: new Date("2026-07-26T00:00:00.000Z"),
            limit: 1,
            cursor: first.nextCursor,
            idempotencyKey: "expire-page-2",
            reference: reference("expire-page-2"),
          });
          assert.equal(second.transactions.length, 1);
          assert.ok(second.nextCursor);
          const third = await service.expireCredits({
            accountId: opened.account.id,
            asOf: new Date("2026-07-26T00:00:00.000Z"),
            limit: 1,
            cursor: second.nextCursor,
            idempotencyKey: "expire-page-3",
            reference: reference("expire-page-3"),
          });
          assert.equal(third.transactions.length, 1);
          assert.equal(third.nextCursor, undefined);
          assert.equal((await service.getBalance(opened.account.id)).expired, "15");
        },
      },
      {
        name: "refunds consumption through a linked compensating transaction",
        run: async () => {
          const service = await createService();
          const opened = await service.openAccount({
            tenantId: "tenant-refund",
            idempotencyKey: "open-refund",
            reference: reference("open-refund"),
          });
          await service.grantCredits({
            accountId: opened.account.id,
            amount: creditAmount("12"),
            expiresAt: new Date("2026-07-27T00:00:00.000Z"),
            idempotencyKey: "grant-refund",
            reference: reference("grant-refund"),
          });
          const consumed = await service.consumeCredits({
            accountId: opened.account.id,
            amount: creditAmount("7"),
            idempotencyKey: "consume-refund",
            reference: reference("consume-refund"),
          });
          const consumptionTransaction = consumed.transactions[0];
          assert.ok(consumptionTransaction);
          const refunded = await service.refundCredits({
            accountId: opened.account.id,
            consumptionTransactionId: consumptionTransaction.id,
            amount: creditAmount("3"),
            idempotencyKey: "refund-consumption",
            reference: reference("refund-consumption"),
          });

          assert.equal(refunded.transactions[0]?.relatedTransactionId, consumptionTransaction.id);
          assert.equal(
            refunded.transactions[0]?.grant?.expiresAt?.toISOString(),
            "2026-07-27T00:00:00.000Z",
          );
          assert.deepEqual(await service.getBalance(opened.account.id), {
            accountId: opened.account.id,
            position: 3,
            available: "8",
            reserved: "0",
            consumed: "4",
            expired: "0",
            lifetimeGranted: "12",
            netAdjusted: "0",
          });
          await service.expireCredits({
            accountId: opened.account.id,
            asOf: new Date("2026-07-28T00:00:00.000Z"),
            idempotencyKey: "expire-refund",
            reference: reference("expire-refund"),
          });
          assert.deepEqual(await service.getBalance(opened.account.id), {
            accountId: opened.account.id,
            position: 5,
            available: "0",
            reserved: "0",
            consumed: "4",
            expired: "8",
            lifetimeGranted: "12",
            netAdjusted: "0",
          });
        },
      },
    ],
  };
}
