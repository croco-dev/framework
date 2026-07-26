import {
  type DomainEvent,
  EventAfterCommitRequiresActiveTransactionProblem,
} from "@croco/events-core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addCreditAmounts,
  CreditAccountMismatchProblem,
  CreditDuplicateConflictProblem,
  CreditEventPublicationProblem,
  type CreditLedgerCommand,
  CreditLedgerCommittedEvent,
  CreditLedgerService,
  compareCreditAmounts,
  createCreditLedgerStoreConformanceSuite,
  creditAmount,
  ExpiredGrantProblem,
  InMemoryCreditLedgerStore,
  InsufficientCreditsProblem,
  InvalidCreditAmountProblem,
  InvalidCreditCommandProblem,
  StaleLedgerPositionProblem,
  subtractCreditAmounts,
} from "../index";

describe("InMemoryCreditLedgerStore conformance", () => {
  const suite = createCreditLedgerStoreConformanceSuite({
    storeName: "in-memory",
    createStore: () => new InMemoryCreditLedgerStore(),
  });

  for (const testCase of suite.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, testCase.run);
  }
});

describe("CreditAmount", () => {
  it("normalizes exact base-10 values without floating-point conversion", () => {
    expect(creditAmount("1.2300")).toBe("1.23");
  });

  it("keeps exact arithmetic across different scales and large integers", () => {
    const sum = addCreditAmounts(
      creditAmount("9007199254740993.000000000000000001"),
      creditAmount("0.999999999999999999"),
    );

    expect(sum).toBe("9007199254740994");
    expect(subtractCreditAmounts(sum, creditAmount("0.000000000000000001"))).toBe(
      "9007199254740993.999999999999999999",
    );
    expect(compareCreditAmounts(creditAmount("1.20"), creditAmount("1.2"))).toBe(0);
  });

  it.each(["0", "-1", "NaN", "Infinity", "1e3", "1.0000000000000000001"])(
    "rejects invalid or non-positive command amount %s",
    (value) => {
      expect(() => creditAmount(value)).toThrow(InvalidCreditAmountProblem);
    },
  );

  it("rejects JavaScript numbers at runtime before floating-point artifacts enter the ledger", () => {
    expect(() => creditAmount((0.1 + 0.2) as never)).toThrow(InvalidCreditAmountProblem);
  });
});

describe("CreditLedgerService", () => {
  let sequence!: number;
  let store!: InMemoryCreditLedgerStore;
  let service!: CreditLedgerService;

  const ref = (id: string) => ({ type: "test", id });

  beforeEach(() => {
    sequence = 0;
    store = new InMemoryCreditLedgerStore();
    service = new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => `id-${++sequence}`,
    });
  });

  it("publishes a stable ledger event only after the store command commits", async () => {
    let commandCommitted = false;
    class ObservedStore extends InMemoryCreditLedgerStore {
      override async execute(command: CreditLedgerCommand) {
        const result = await super.execute(command);
        commandCommitted = true;
        return result;
      }
    }

    const events: DomainEvent[] = [];
    service = new CreditLedgerService({
      store: new ObservedStore(),
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => `event-id-${++sequence}`,
      eventPublisher: {
        publishAfterCommit(event, onPublished) {
          expect(commandCommitted).toBe(true);
          events.push(event);
          onPublished?.();
        },
        async publishNow() {
          throw new InvalidCreditAmountProblem("unexpected immediate publication");
        },
      },
    });

    const opened = await service.openAccount({
      tenantId: "tenant-event",
      idempotencyKey: "event-open",
      reference: ref("event-open"),
    });
    commandCommitted = false;
    const granted = await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("10"),
      idempotencyKey: "event-grant",
      reference: ref("event-grant"),
    });
    commandCommitted = false;
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("10"),
      idempotencyKey: "event-grant",
      reference: ref("event-grant"),
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CreditLedgerCommittedEvent);
    expect((events[0] as CreditLedgerCommittedEvent).data).toEqual({
      accountId: opened.account.id,
      position: 1,
      transactionIds: [granted.transactions[0]?.id],
      kinds: ["grant"],
      reference: ref("event-grant"),
    });
  });

  it("publishes immediately only when no active transaction exists", async () => {
    const immediate: DomainEvent[] = [];
    service = new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => `fallback-id-${++sequence}`,
      eventPublisher: {
        publishAfterCommit() {
          throw new EventAfterCommitRequiresActiveTransactionProblem();
        },
        async publishNow(event) {
          immediate.push(event);
        },
      },
    });

    await service.openAccount({
      tenantId: "tenant-fallback",
      idempotencyKey: "fallback-open",
      reference: ref("fallback-open"),
    });
    const account = await service.openAccount({
      tenantId: "tenant-fallback",
      idempotencyKey: "fallback-open-again",
      reference: ref("fallback-open-again"),
    });
    await service.grantCredits({
      accountId: account.account.id,
      amount: creditAmount("1"),
      idempotencyKey: "fallback-grant",
      reference: ref("fallback-grant"),
    });

    expect(immediate).toHaveLength(1);
  });

  it("retries a failed post-commit publication without moving the balance twice", async () => {
    const published: DomainEvent[] = [];
    let publicationAttempts = 0;
    service = new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => `retry-event-id-${++sequence}`,
      eventPublisher: {
        publishAfterCommit() {
          throw new EventAfterCommitRequiresActiveTransactionProblem();
        },
        async publishNow(event) {
          publicationAttempts++;
          if (publicationAttempts === 1) {
            throw new InvalidCreditAmountProblem("simulated event transport failure");
          }
          published.push(event);
        },
      },
    });
    const opened = await service.openAccount({
      tenantId: "tenant-event-retry",
      idempotencyKey: "event-retry-open",
      reference: ref("event-retry-open"),
    });
    const grantInput = {
      accountId: opened.account.id,
      amount: creditAmount("5"),
      idempotencyKey: "event-retry-grant",
      reference: ref("event-retry-grant"),
    };

    await expect(service.grantCredits(grantInput)).rejects.toThrow(CreditEventPublicationProblem);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 1,
      available: "5",
    });
    await expect(service.grantCredits(grantInput)).resolves.toMatchObject({
      replayed: true,
    });

    expect(publicationAttempts).toBe(2);
    expect(published).toHaveLength(1);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 1,
      available: "5",
    });
  });

  it("keeps a scheduled event pending until post-commit publication is acknowledged", async () => {
    const acknowledgements: Array<() => void> = [];
    service = new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => `scheduled-event-id-${++sequence}`,
      eventPublisher: {
        publishAfterCommit(_event, onPublished) {
          if (onPublished) acknowledgements.push(onPublished);
        },
        async publishNow() {
          throw new InvalidCreditAmountProblem("unexpected immediate publication");
        },
      },
    });
    const opened = await service.openAccount({
      tenantId: "tenant-scheduled-event",
      idempotencyKey: "scheduled-event-open",
      reference: ref("scheduled-event-open"),
    });
    const input = {
      accountId: opened.account.id,
      amount: creditAmount("2"),
      idempotencyKey: "scheduled-event-grant",
      reference: ref("scheduled-event-grant"),
    };

    await service.grantCredits(input);
    await service.grantCredits(input);
    expect(acknowledgements).toHaveLength(2);

    acknowledgements[1]?.();
    await service.grantCredits(input);
    expect(acknowledgements).toHaveLength(2);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 1,
      available: "2",
    });
  });

  it("bounds pending event retries and reports eviction", async () => {
    const evicted: string[] = [];
    service = new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => `bounded-event-id-${++sequence}`,
      pendingEventLimit: 1,
      onPendingEventEvicted: (idempotencyKey) => evicted.push(idempotencyKey),
      eventPublisher: {
        publishAfterCommit() {
          throw new InvalidCreditAmountProblem("simulated scheduling failure");
        },
        async publishNow() {},
      },
    });
    const opened = await service.openAccount({
      tenantId: "tenant-bounded-event",
      idempotencyKey: "bounded-event-open",
      reference: ref("bounded-event-open"),
    });

    for (const id of ["first", "second"]) {
      await expect(
        service.grantCredits({
          accountId: opened.account.id,
          amount: creditAmount("1"),
          idempotencyKey: `bounded-event-${id}`,
          reference: ref(`bounded-event-${id}`),
        }),
      ).rejects.toThrow(CreditEventPublicationProblem);
    }

    expect(evicted).toEqual(["bounded-event-first"]);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 2,
      available: "2",
    });
  });

  it("rejects expired and meter-restricted grants before balance movement", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-restricted",
      idempotencyKey: "restricted-open",
      reference: ref("restricted-open"),
    });
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("10"),
      expiresAt: new Date("2026-07-25T00:00:00.000Z"),
      meterKeys: ["tokens"],
      idempotencyKey: "restricted-grant",
      reference: ref("restricted-grant"),
    });

    await expect(
      service.consumeCredits({
        accountId: opened.account.id,
        amount: creditAmount("1"),
        meterKey: "tokens",
        idempotencyKey: "restricted-consume-expired",
        reference: ref("restricted-consume-expired"),
      }),
    ).rejects.toThrow(ExpiredGrantProblem);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 1,
      available: "10",
      consumed: "0",
    });
  });

  it("reports insufficient credits when expired lots still cannot fund the request", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-expired-shortfall",
      idempotencyKey: "expired-shortfall-open",
      reference: ref("expired-shortfall-open"),
    });
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("1"),
      expiresAt: new Date("2026-07-25T00:00:00.000Z"),
      idempotencyKey: "expired-shortfall-grant",
      reference: ref("expired-shortfall-grant"),
    });

    await expect(
      service.consumeCredits({
        accountId: opened.account.id,
        amount: creditAmount("1000"),
        idempotencyKey: "expired-shortfall-consume",
        reference: ref("expired-shortfall-consume"),
      }),
    ).rejects.toThrow(InsufficientCreditsProblem);
  });

  it("enforces expected position when reopening an existing tenant wallet", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-reopen",
      walletKey: "primary",
      idempotencyKey: "reopen-first",
      reference: ref("reopen-first"),
    });
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("1"),
      idempotencyKey: "reopen-grant",
      reference: ref("reopen-grant"),
    });

    await expect(
      service.openAccount({
        tenantId: "tenant-reopen",
        walletKey: "primary",
        expectedPosition: 0,
        idempotencyKey: "reopen-stale",
        reference: ref("reopen-stale"),
      }),
    ).rejects.toThrow(StaleLedgerPositionProblem);
    await expect(
      service.openAccount({
        tenantId: "tenant-reopen",
        walletKey: "primary",
        expectedPosition: 1,
        idempotencyKey: "reopen-current",
        reference: ref("reopen-current"),
      }),
    ).resolves.toMatchObject({
      account: { id: opened.account.id, position: 1 },
      replayed: true,
    });
  });

  it("reports cross-account reservation and transaction references explicitly", async () => {
    const first = await service.openAccount({
      tenantId: "tenant-a",
      idempotencyKey: "account-a",
      reference: ref("account-a"),
    });
    const second = await service.openAccount({
      tenantId: "tenant-b",
      idempotencyKey: "account-b",
      reference: ref("account-b"),
    });
    await service.grantCredits({
      accountId: first.account.id,
      amount: creditAmount("10"),
      idempotencyKey: "account-a-grant",
      reference: ref("account-a-grant"),
    });
    const reserved = await service.reserveCredits({
      accountId: first.account.id,
      amount: creditAmount("4"),
      idempotencyKey: "account-a-reserve",
      reference: ref("account-a-reserve"),
    });
    const reservation = reserved.reservation;
    expect(reservation).toBeDefined();
    if (!reservation) {
      throw new InvalidCreditAmountProblem("test reservation was not returned");
    }

    await expect(
      service.releaseCredits({
        accountId: second.account.id,
        reservationId: reservation.id,
        idempotencyKey: "cross-account-release",
        reference: ref("cross-account-release"),
      }),
    ).rejects.toThrow(CreditAccountMismatchProblem);
  });

  it("keeps historical queries pinned to an explicit ledger position", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-history",
      idempotencyKey: "history-open",
      reference: ref("history-open"),
    });
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("10"),
      idempotencyKey: "history-grant",
      reference: ref("history-grant"),
    });
    await service.consumeCredits({
      accountId: opened.account.id,
      amount: creditAmount("3"),
      idempotencyKey: "history-consume",
      reference: ref("history-consume"),
    });

    expect(await service.getBalance(opened.account.id, 1)).toMatchObject({
      position: 1,
      available: "10",
      consumed: "0",
    });
    expect(await service.getHistory(opened.account.id, { atPosition: 1 })).toMatchObject({
      position: 1,
      transactions: [{ kind: "grant", position: 1 }],
    });
    await expect(service.getBalance(opened.account.id, 3)).rejects.toThrow(
      StaleLedgerPositionProblem,
    );
  });

  it("rejects colliding generated IDs before any allocation mutates", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-id-collision",
      idempotencyKey: "collision-open",
      reference: ref("collision-open"),
    });
    await service.grantCredits({
      accountId: opened.account.id,
      amount: creditAmount("10"),
      idempotencyKey: "collision-grant",
      reference: ref("collision-grant"),
    });
    const collidingService = new CreditLedgerService({
      store,
      clock: () => new Date("2026-07-26T12:00:00.000Z"),
      idGenerator: () => "id-2",
    });

    await expect(
      collidingService.reserveCredits({
        accountId: opened.account.id,
        amount: creditAmount("5"),
        idempotencyKey: "collision-reserve",
        reference: ref("collision-reserve"),
      }),
    ).rejects.toThrow(InvalidCreditCommandProblem);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 1,
      available: "10",
      reserved: "0",
    });
  });

  it("enforces canonical decimal strings again at the command boundary", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-unsafe-amount",
      idempotencyKey: "unsafe-amount-open",
      reference: ref("unsafe-amount-open"),
    });
    const baseInput = {
      accountId: opened.account.id,
      idempotencyKey: "unsafe-amount-grant",
      reference: ref("unsafe-amount-grant"),
    };

    await expect(
      service.grantCredits({
        ...baseInput,
        amount: (0.1 + 0.2) as never,
      }),
    ).rejects.toThrow(InvalidCreditAmountProblem);
    await expect(
      service.grantCredits({
        ...baseInput,
        amount: "1.00" as never,
      }),
    ).rejects.toThrow(InvalidCreditAmountProblem);
    expect(await service.getBalance(opened.account.id)).toMatchObject({
      position: 0,
      available: "0",
    });
  });

  it("preserves projection conservation across a deterministic hostile sequence", async () => {
    const opened = await service.openAccount({
      tenantId: "tenant-property",
      idempotencyKey: "property-open",
      reference: ref("property-open"),
    });

    for (let index = 1; index <= 25; index++) {
      await service.grantCredits({
        accountId: opened.account.id,
        amount: creditAmount("10"),
        idempotencyKey: `property-grant-${index}`,
        reference: ref(`property-grant-${index}`),
      });
      const reserved = await service.reserveCredits({
        accountId: opened.account.id,
        amount: creditAmount("6"),
        idempotencyKey: `property-reserve-${index}`,
        reference: ref(`property-reserve-${index}`),
      });
      const reservation = reserved.reservation;
      expect(reservation).toBeDefined();
      if (!reservation) {
        throw new InvalidCreditAmountProblem("test reservation was not returned");
      }
      await service.commitCredits({
        accountId: opened.account.id,
        reservationId: reservation.id,
        amount: creditAmount("4"),
        idempotencyKey: `property-commit-${index}`,
        reference: ref(`property-commit-${index}`),
      });

      const balance = await service.getBalance(opened.account.id);
      expect(
        addCreditAmounts(
          addCreditAmounts(balance.available, balance.reserved),
          addCreditAmounts(balance.consumed, balance.expired),
        ),
      ).toBe(balance.lifetimeGranted);
      expect(balance.position).toBe(index * 4);
    }

    expect(await service.getBalance(opened.account.id)).toMatchObject({
      available: "150",
      reserved: "0",
      consumed: "100",
      expired: "0",
      lifetimeGranted: "250",
    });
  });

  it("keeps idempotency conflicts stable after time advances", async () => {
    let now = new Date("2026-07-26T00:00:00.000Z");
    service = new CreditLedgerService({
      store,
      clock: () => now,
      idGenerator: () => `replay-id-${++sequence}`,
    });
    const opened = await service.openAccount({
      tenantId: "tenant-time-replay",
      idempotencyKey: "time-open",
      reference: ref("time-open"),
    });
    const input = {
      accountId: opened.account.id,
      amount: creditAmount("1"),
      idempotencyKey: "time-grant",
      reference: ref("time-grant"),
    };
    await service.grantCredits(input);
    now = new Date("2026-07-27T00:00:00.000Z");

    await expect(service.grantCredits(input)).resolves.toMatchObject({
      replayed: true,
    });
    await expect(service.grantCredits({ ...input, amount: creditAmount("2") })).rejects.toThrow(
      CreditDuplicateConflictProblem,
    );
  });
});
