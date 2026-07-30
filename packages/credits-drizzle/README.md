# @croco/credits-drizzle

PostgreSQL/Drizzle persistence for the append-only `@croco/credits-core` ledger.

```bash
pnpm add @croco/credits-core @croco/credits-drizzle @croco/tx-core @croco/tx-drizzle drizzle-orm pg
```

## Setup

Run the exported migration once, then construct the store with the same Drizzle client used by the
application:

```ts
import { CreditLedgerService } from "@croco/credits-core";
import { createCreditsSchema, DrizzleCreditLedgerStore } from "@croco/credits-drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

await createCreditsSchema(db);
const txManager = new TxManager(createDrizzleTxAdapter(db));

const credits = new CreditLedgerService({
  store: new DrizzleCreditLedgerStore(db, txManager),
});
```

`createCreditsSchema` is an idempotent bootstrap for the current schema and `dropCreditsSchema` exists for
test teardown. Production deployments should invoke versioned migrations through the application's normal
migration runner.

## Transaction and concurrency contract

Each command joins the injected `TxManager` transaction or opens one when no transaction is active. The
adapter:

- takes a transaction-scoped advisory lock for the idempotency key;
- locks the account row before reading balances, grant lots, or reservations;
- appends ledger transactions and allocations before atomically updating the account projection;
- stores the committed command result with its semantic fingerprint;
- lets `CreditLedgerService` register its event against the same outer transaction, or returns only after
  its own transaction commits.

The supported isolation level is PostgreSQL `READ COMMITTED` plus explicit account/lot/reservation row
locking. Writes to one account are serialized, so concurrent reservations cannot spend the same grant
availability. Account IDs, transaction IDs, reservation IDs, tenant/wallet identities, ledger positions,
and idempotency keys have database uniqueness constraints. Composite foreign keys reject cross-account
reservation, refund, lot, and allocation references.

## Amounts and ordering

Amounts use arbitrary-precision PostgreSQL `numeric` values and are mapped to the canonical decimal-string
contract from `credits-core` (up to 18 fractional digits, no JavaScript floating point). Ledger positions
are monotonically assigned while the account row is locked; timestamps never determine history order.

Expiry uses an indexed `(account, expiresAt, position, grantTransactionId)` keyset cursor and retrieves at
most `limit + 1` lots. Batches are bounded to 100 and resumable without loading the whole lot table.
Consumption also locks eligible lots in bounded pages of 100 until the requested amount is satisfied.

## Diagnostics

Domain failures preserve the typed Problems from `credits-core`. Unexpected driver or SQL failures become
`CreditLedgerPersistenceProblem`; its public detail contains only the operation name and never SQL,
connection strings, or credentials.

## Verification

```bash
pnpm --filter @croco/credits-drizzle test
CREDITS_POSTGRES_URL=postgresql://... pnpm --filter @croco/credits-drizzle test:postgres
pnpm --filter @croco/credits-drizzle typecheck
pnpm --filter @croco/credits-drizzle build
```

The PostgreSQL suite runs every exported `credits-core` conformance case, including reservation races,
idempotency conflicts, deterministic expiry, historical balance reads, rollback, and tenant isolation.
