# Customer Explorer

A standalone workspace for reading synthetic customer behavior, communication and payment outcomes. It uses `CustomerExplorerService` from `@croco/admin-core` and the normalized SQL reader and PostgreSQL sample/note repository from `@croco/admin-postgres`. No event catalog, Fact History or Cohort Builder is required.

Run an isolated PostgreSQL database, then:

```bash
CUSTOMER_EXPLORER_DATABASE_URL=postgres://postgres:local-synthetic@127.0.0.1:55484/postgres pnpm --dir examples/customer-explorer setup
CUSTOMER_EXPLORER_DATABASE_URL=postgres://postgres:local-synthetic@127.0.0.1:55484/postgres pnpm --dir examples/customer-explorer dev
```

Open `http://127.0.0.1:4320`. The explicit `setup` command applies `packages/admin-postgres/migrations/0001_customer_explorer.up.sql` to the `customer_explorer_example` synthetic schema. It fails if that schema already exists; use a disposable database. Startup only reads existing state. The published provider ships that migration under `dist/migrations/0001_customer_explorer.up.sql`. Applications apply it through their existing deployment owner; the adapter does not run DDL on boot. Only synthetic data is inserted. The example's local operator is a fixed synthetic identity; production hosts must bind server authentication and authorization to the service.

The achiever and comparison populations use a fixed population snapshot and seed. The first customer has over 1,000 events, while subsequent customers remain independently readable. Notes persist through rereads and compare expected revisions atomically; stale edits fail. A typed observation definition can be downloaded without a Cohort destination. Raw export is not enabled.

Sample and note retention is explicit. Deleting original source events leaves unavailable note references; note text is an operator observation, not a cached source payload. No emotion, intent or unobserved churn reason is inferred.
