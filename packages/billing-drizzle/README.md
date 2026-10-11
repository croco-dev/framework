# @croco/billing-drizzle

PostgreSQL persistence for `BillingStore` and `CancellationStore`, using a caller-owned Drizzle node-postgres database.

Apply `migrations/0001_billing.up.sql` through your migration runner before constructing either store. Construction performs no DDL. The paired down migration removes the tables and their data; use it only under your application's reviewed migration policy.

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

`DrizzleBillingStore` requires an explicit app/environment namespace; tenant lookups and provider webhook IDs remain inside that namespace. Cancellation sessions, policies, and policy audit keys include application, environment, and tenant. Use a BillingService with the matching namespace when composing cancellation actions.

Accounts, subscriptions, orders, lifecycle commands, webhook reservations, event intents, cancellation sessions, and policies use separate tables. JSONB preserves the domain snapshots while generated columns enforce account and pending-command uniqueness. Date fields are restored on billing reads. All writes use a PostgreSQL transaction and a namespace-scoped advisory lock, including first writes where no row exists to lock. Thus concurrent adapters on separate connections serialize mutations within a namespace. This trades per-namespace write throughput for simple atomicity; do not bypass the adapter with direct table writes. Provider calls occur outside these transactions. Lease deadlines use PostgreSQL time.

Policy publication stores the policy and immutable idempotency audit in one transaction. Session decisions and their command reservation are one compare-and-swap update. Lifecycle retries reuse their stored provider idempotency key; providers must support that contract to reconcile an accepted request whose response was lost. Persistence does not infer provider or refund success.

Run the live PostgreSQL suite with `BILLING_TEST_DATABASE_URL` pointing to an isolated, disposable database:

```sh
BILLING_TEST_DATABASE_URL=postgres://... pnpm --filter @croco/billing-drizzle test:live
```

The tests apply and roll back the migration, use two independent connection pools, restart stores/services, and verify concurrency and recovery. Without that environment variable the live suite is skipped; that is not PostgreSQL verification evidence.
