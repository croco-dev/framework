# @croco/credits-core

Provider-neutral append-only credit ledger for SaaS usage credits. Balances are projections of
immutable transactions and allocations rather than mutable fields.

## Install

```bash
pnpm add @croco/credits-core
```

## Amounts and identifiers

Credit amounts are canonical base-10 strings with at most 18 fractional digits. Construct command
amounts with `creditAmount()`; JavaScript numbers and exponent notation are intentionally rejected so
binary floating-point conversion cannot enter the ledger.

```ts
import { creditAmount } from "@croco/credits-core";

const tokens = creditAmount("1250.500000000000000001");
```

`CreditAccountId`, `CreditTransactionId`, and `CreditReservationId` are branded strings. Adapters may
restore persisted identifiers with `creditAccountId()`, `creditTransactionId()`, and
`creditReservationId()`.

## Usage

```ts
import { CreditLedgerService, InMemoryCreditLedgerStore, creditAmount } from "@croco/credits-core";

const credits = new CreditLedgerService({
  store: new InMemoryCreditLedgerStore(),
  eventPublisher,
});

const opened = await credits.openAccount({
  tenantId: "tenant-123",
  walletKey: "ai-usage",
  idempotencyKey: "account:tenant-123:ai-usage",
  reference: { type: "tenant-wallet", id: "tenant-123:ai-usage" },
});

await credits.grantCredits({
  accountId: opened.account.id,
  amount: creditAmount("1000"),
  expiresAt: new Date("2027-01-01T00:00:00.000Z"),
  source: "promotion-2026",
  meterKeys: ["llm.tokens"],
  idempotencyKey: "grant:promotion-2026:tenant-123",
  reference: { type: "promotion-grant", id: "promotion-2026:tenant-123" },
});

const reservation = await credits.reserveCredits({
  accountId: opened.account.id,
  amount: creditAmount("100"),
  meterKey: "llm.tokens",
  idempotencyKey: "request:req-123:reserve",
  reference: { type: "usage-request", id: "req-123" },
});

if (reservation.reservation) {
  await credits.commitCredits({
    accountId: opened.account.id,
    reservationId: reservation.reservation.id,
    amount: creditAmount("72.5"),
    idempotencyKey: "request:req-123:commit",
    reference: { type: "usage-request", id: "req-123" },
  });
}
```

A partial commit appends a `commit` transaction for actual usage and a `release` transaction for the
remainder in one atomic command. Direct consumption, full release, linked refunds, compensating
credit/debit adjustments, and bounded expiry batches use the same command contract.

## Ledger invariants

- Transactions and allocation records are append-only. There is no balance setter.
- Every command requires an idempotency key and immutable semantic reference.
- Replaying the same semantic command returns its original identifiers and result without another
  balance movement. Reusing the key for different input raises
  `CreditDuplicateConflictProblem`.
- Store implementations serialize commands per account, check `expectedPosition` when provided, and
  atomically persist all transactions produced by one command.
- Grant allocation order is earliest expiry, then ledger position, then transaction ID. Restricted or
  expired lots cannot fund ineligible usage.
- Refunds append a new credit lot linked to the original `consume` or `commit` transaction. The
  refunded lot keeps the earliest expiry among the original allocations it restores, so a refund
  cannot extend promotional credit lifetime. Original history is never rewritten.
- `getBalance(accountId, position)` and `getHistory(accountId, { atPosition })` read the same immutable
  prefix. A future or invalid position raises `StaleLedgerPositionProblem`.

`available` is the transaction projection at a ledger position. A grant whose wall-clock expiry has
passed remains in that projection until `expireCredits()` appends its expiry transaction, but it is
immediately ineligible for reserve or consume allocation.

## Expiry pagination

`expireCredits()` handles at most 100 eligible lots per call and returns an opaque `nextCursor` when
more work remains. Each page needs a new idempotency key; replaying a page returns the same page
result.

```ts
let cursor;
do {
  const page = await credits.expireCredits({
    accountId,
    asOf: new Date(),
    limit: 50,
    cursor,
    idempotencyKey: `expiry:2026-07-26:${cursor ?? "first"}`,
    reference: { type: "expiry-run", id: "2026-07-26" },
  });
  cursor = page.nextCursor;
} while (cursor);
```

## Events and adapter contract

`CreditLedgerService` publishes `CreditLedgerCommittedEvent` for transaction-producing commands
through `publishAfterCommit()`. When no transaction context exists, it publishes immediately after
the in-memory command has committed. If immediate publication fails,
`CreditEventPublicationProblem` reports that the ledger command already committed; retrying the same
command on the same service instance republishes the pending event without moving the balance again.
Persistent adapters should execute `CreditLedgerStore.execute()` inside the application transaction
or a durable outbox boundary so pending delivery survives process restarts.

Adapters must pass the exported conformance suite:

```ts
import { createCreditLedgerStoreConformanceSuite } from "@croco/credits-core";

const suite = createCreditLedgerStoreConformanceSuite({
  storeName: "my-credit-store",
  createStore: () => createStore(),
});

for (const testCase of suite.cases) {
  test(testCase.name, testCase.run);
}
```

The suite covers a semantic idempotency conflict matrix, concurrent overdraw and competing settlement
prevention, atomic partial settlement and failure paths, restricted allocation, historical
projections, deterministic bounded expiry, linked expiry-preserving refunds, and projection evidence.

## Verification

```bash
pnpm --filter @croco/credits-core test
pnpm --filter @croco/credits-core typecheck
pnpm --filter @croco/credits-core build
pnpm public-api:check
pnpm problem-registry:check
pnpm docs:api:check
pnpm docs:catalog:check
```
