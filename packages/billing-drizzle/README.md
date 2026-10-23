# @croco/billing-drizzle

PostgreSQL persistence for `BillingStore` and `CancellationStore`, using a caller-owned Drizzle node-postgres database.

Apply `migrations/0001_billing.up.sql` and then `migrations/0002_subscription_replacements.up.sql` through your migration runner before constructing either store. Existing installations apply only the new migration. Construction performs no DDL. The paired down migrations remove tables and their data; use them only under your application's reviewed migration policy.

Subscription replacements retain the previous external identity and both snapshots atomically with the current subscription. Webhook commits also retain the event ID and event intents in that transaction. Later observations of that retired identity cannot reclaim the account, even with a newer or missing provider timestamp. New identities and newer same-identity observations retain their existing behavior. History is scoped by application, environment and billing account and survives store restarts and current-subscription deletion. The new migration backfills applied replacements recorded in existing webhook transitions and excludes suppressed observations; it cannot reconstruct overwritten subscriptions that have no transition evidence or repair already incorrect current state. Direct `saveSubscription` calls remain authoritative and record replaced identities too; explicitly restoring an identity permits its same-identity observations again. Rolling back the new migration removes this protection and its history.

```ts typecheck
import { drizzle } from "drizzle-orm/node-postgres";
import { DrizzleBillingStore, DrizzleCancellationStore } from "@croco/billing-drizzle";
import type { Pool } from "pg";

declare const pool: Pool;

const database = drizzle(pool);
const billingStore = new DrizzleBillingStore(database, {
  appId: "shop",
  environment: "production",
});
const cancellationStore = new DrizzleCancellationStore(database);
```

The replacement table indexes fixed-size SHA-256 digests of the namespace and identity tuple, retaining the original namespace and snapshots in JSONB. The backfill uses [PostgreSQL's built-in binary-string functions](https://www.postgresql.org/docs/12/functions-binarystring.html); it requires no extension. A private projection marker distinguishes applied snapshots from suppressed receipts without changing public transition results.

`DrizzleBillingStore` requires an explicit app/environment namespace; tenant lookups and provider webhook IDs remain inside that namespace. Cancellation sessions, policies, and policy audit keys include application, environment, and tenant. Use a BillingService with the matching namespace when composing cancellation actions.

Accounts, subscriptions, orders, lifecycle commands, webhook reservations, event intents, cancellation sessions, and policies use separate tables. JSONB preserves the domain snapshots while generated columns enforce account and pending-command uniqueness. Date fields are restored on billing reads. All writes use a PostgreSQL transaction and a namespace-scoped advisory lock, including first writes where no row exists to lock. Thus concurrent adapters on separate connections serialize mutations within a namespace. This trades per-namespace write throughput for simple atomicity; do not bypass the adapter with direct table writes. Provider calls occur outside these transactions. Lease deadlines use PostgreSQL time.

Policy publication stores the policy and immutable idempotency audit in one transaction. Session decisions and their command reservation are one compare-and-swap update. Lifecycle retries reuse their stored provider idempotency key; providers must support that contract to reconcile an accepted request whose response was lost. Persistence does not infer provider or refund success.

Run the live PostgreSQL suite with `BILLING_TEST_DATABASE_URL` pointing to an isolated, disposable database:

```sh
BILLING_TEST_DATABASE_URL=postgres://... pnpm --filter @croco/billing-drizzle test:live
```

The tests apply and roll back the migration, use two independent connection pools, restart stores/services, and verify concurrency and recovery. Without that environment variable the live suite is skipped; that is not PostgreSQL verification evidence.
