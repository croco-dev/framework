import {
  createCreditLedgerStoreConformanceSuite,
  CreditAccountMismatchProblem,
  creditAmount,
  CreditLedgerService,
  CreditReservationMismatchProblem,
} from "@croco/credits-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCreditsSchema,
  creditAccounts,
  creditAllocations,
  creditGrantLots,
  creditIdempotencyRecords,
  creditReservationAllocations,
  creditReservations,
  creditTransactions,
  type DrizzleCreditTxManager,
  DrizzleCreditLedgerStore,
  dropCreditsSchema,
} from "../index";

const connectionString = process.env.CREDITS_POSTGRES_URL ?? "";
const describePostgres = connectionString ? describe : describe.skip;
type DrizzleCreditTransaction = NonNullable<ReturnType<DrizzleCreditTxManager["getClient"]>>;

const schema = {
  creditAccounts,
  creditAllocations,
  creditGrantLots,
  creditIdempotencyRecords,
  creditReservationAllocations,
  creditReservations,
  creditTransactions,
};

describePostgres("DrizzleCreditLedgerStore PostgreSQL conformance", () => {
  const pool = new Pool({ connectionString, max: 12 });
  const db = drizzle(pool, { schema });
  const txManager = new TxManager(
    createDrizzleTxAdapter(db as unknown as Parameters<typeof createDrizzleTxAdapter>[0]),
  ) as unknown as TxManager<DrizzleCreditTransaction>;

  beforeAll(async () => {
    await dropCreditsSchema(db);
    await createCreditsSchema(db);
  });

  afterAll(async () => {
    await dropCreditsSchema(db);
    await pool.end();
  });

  async function reset(): Promise<void> {
    await db.execute(sql`
      truncate table
        credit_idempotency_records,
        credit_reservation_allocations,
        credit_allocations,
        credit_reservations,
        credit_grant_lots,
        credit_transactions,
        credit_accounts
      restart identity cascade
    `);
  }

  const suite = createCreditLedgerStoreConformanceSuite({
    storeName: "drizzle-postgres",
    createStore: () => new DrizzleCreditLedgerStore(db, txManager),
  });

  for (const testCase of suite.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, async () => {
      await reset();
      await testCase.run();
    });
  }

  it("rolls back allocation changes and ledger appends when settlement validation fails", async () => {
    await reset();
    let sequence = 0;
    let publishedEvents = 0;
    const service = new CreditLedgerService({
      store: new DrizzleCreditLedgerStore(db, txManager),
      clock: () => new Date("2026-07-30T00:00:00.000Z"),
      idGenerator: () => `rollback-${++sequence}`,
      eventPublisher: {
        publishAfterCommit(_event, onPublished) {
          publishedEvents += 1;
          onPublished?.();
        },
        async publishNow() {
          publishedEvents += 1;
        },
      },
    });
    const opened = await service.openAccount({
      tenantId: "tenant-rollback",
      idempotencyKey: "open-rollback",
      reference: { type: "test", id: "open-rollback" },
    });
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("10"),
      idempotencyKey: "grant-rollback",
      reference: { type: "test", id: "grant-rollback" },
    });
    const reserved = await service.reserveCredits({
      accountId: opened.account.id,
      amount: creditAmount("8"),
      idempotencyKey: "reserve-rollback",
      reference: { type: "test", id: "reserve-rollback" },
    });
    expect(reserved.reservation).toBeDefined();
    publishedEvents = 0;

    await expect(
      service.commitCredits({
        accountId: opened.account.id,
        reservationId: reserved.reservation!.id,
        amount: creditAmount("9"),
        idempotencyKey: "commit-invalid",
        reference: { type: "test", id: "commit-invalid" },
      }),
    ).rejects.toBeInstanceOf(CreditReservationMismatchProblem);

    expect(await service.getBalance(opened.account.id)).toEqual({
      accountId: opened.account.id,
      position: 2,
      available: "2",
      reserved: "8",
      consumed: "0",
      expired: "0",
      lifetimeGranted: "10",
      netAdjusted: "0",
    });
    expect((await service.getHistory(opened.account.id)).transactions).toHaveLength(2);
    expect(publishedEvents).toBe(0);
  });

  it("joins an ambient transaction so ledger writes and events disappear on rollback", async () => {
    await reset();
    let sequence = 0;
    const store = new DrizzleCreditLedgerStore(db, txManager);
    const setupService = new CreditLedgerService({
      store,
      idGenerator: () => `ambient-${++sequence}`,
    });
    const opened = await setupService.openAccount({
      tenantId: "tenant-ambient",
      idempotencyKey: "open-ambient",
      reference: { type: "test", id: "open-ambient" },
    });
    const publishedEvents: unknown[] = [];
    const service = new CreditLedgerService({
      store,
      idGenerator: () => `ambient-${++sequence}`,
      eventPublisher: {
        publishAfterCommit(event, onPublished) {
          txManager.onAfterCommit(() => {
            publishedEvents.push(event);
            onPublished?.();
          });
        },
        async publishNow(event) {
          publishedEvents.push(event);
        },
      },
    });

    await expect(
      txManager.runWithOutcome(async () => {
        await service.grantCredits({
          accountId: opened.account.id,
          amount: creditAmount("4"),
          idempotencyKey: "grant-ambient-rollback",
          reference: { type: "test", id: "grant-ambient-rollback" },
        });
        throw new Error("force outer rollback");
      }),
    ).rejects.toThrow("force outer rollback");

    expect(publishedEvents).toHaveLength(0);
    expect(await setupService.getBalance(opened.account.id)).toMatchObject({
      position: 0,
      available: "0",
      lifetimeGranted: "0",
    });
    expect((await setupService.getHistory(opened.account.id)).transactions).toHaveLength(0);
  });

  it("rejects reservation references that cross account boundaries", async () => {
    await reset();
    let sequence = 0;
    const service = new CreditLedgerService({
      store: new DrizzleCreditLedgerStore(db, txManager),
      idGenerator: () => `tenant-boundary-${++sequence}`,
    });
    const first = await service.openAccount({
      tenantId: "tenant-boundary-a",
      idempotencyKey: "open-boundary-a",
      reference: { type: "test", id: "open-boundary-a" },
    });
    const second = await service.openAccount({
      tenantId: "tenant-boundary-b",
      idempotencyKey: "open-boundary-b",
      reference: { type: "test", id: "open-boundary-b" },
    });
    const firstGrant = await service.grantCredits({
      accountId: first.account.id,
      amount: creditAmount("5"),
      idempotencyKey: "grant-boundary",
      reference: { type: "test", id: "grant-boundary" },
    });
    const secondGrant = await service.grantCredits({
      accountId: second.account.id,
      amount: creditAmount("5"),
      idempotencyKey: "grant-boundary-second",
      reference: { type: "test", id: "grant-boundary-second" },
    });
    const reserved = await service.reserveCredits({
      accountId: first.account.id,
      amount: creditAmount("2"),
      idempotencyKey: "reserve-boundary",
      reference: { type: "test", id: "reserve-boundary" },
    });
    expect(reserved.reservation).toBeDefined();

    await expect(
      service.getReservation(second.account.id, reserved.reservation!.id),
    ).rejects.toBeInstanceOf(CreditAccountMismatchProblem);
    await expect(
      db.execute(sql`
        insert into credit_reservation_allocations (
          reservation_id,
          grant_transaction_id,
          account_id,
          amount,
          ordinal
        ) values (
          ${reserved.reservation!.id},
          ${secondGrant.transactions[0]!.id},
          ${first.account.id},
          1,
          99
        )
      `),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`
        insert into credit_transactions (
          id,
          account_id,
          position,
          kind,
          amount,
          occurred_at,
          idempotency_key,
          reference_type,
          reference_id,
          reservation_id
        ) values (
          'cross-account-reservation',
          ${second.account.id},
          2,
          'commit',
          1,
          now(),
          'cross-account-reservation',
          'test',
          'cross-account-reservation',
          ${reserved.reservation!.id}
        )
      `),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`
        insert into credit_transactions (
          id,
          account_id,
          position,
          kind,
          amount,
          occurred_at,
          idempotency_key,
          reference_type,
          reference_id,
          related_transaction_id
        ) values (
          'cross-account-related',
          ${second.account.id},
          2,
          'refund',
          1,
          now(),
          'cross-account-related',
          'test',
          'cross-account-related',
          ${firstGrant.transactions[0]!.id}
        )
      `),
    ).rejects.toThrow();
  });
});
