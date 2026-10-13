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

## Standalone learning workspace

The learning entry point uses only `LearningRegistry`, `PostgresLearningRepository` and
`LearningWorkspace`; it does not construct the Customer Explorer or Experiment services. It accepts
manual observations, HTTP(S) report references and bounded aggregate result imports.

Use a disposable loopback PostgreSQL database. `LEARNING_EXAMPLE_DATABASE_URL` is validated to name
localhost; production credentials and customer content do not belong in this synthetic example.

```bash
export LEARNING_EXAMPLE_DATABASE_URL=postgresql://postgres:synthetic@127.0.0.1:55425/learning
pnpm --filter @croco-example/customer-explorer setup:learning
pnpm --filter @croco-example/customer-explorer dev:learning
```

The explicit setup creates the `learning_example` schema and applies only the Learning Registry
migration. Run it once for a fresh database. Open http://127.0.0.1:4325. Records, audit history and
retry receipts remain after restarting the server. The server accepts its exact browser origin,
bounds requests and uses a fixed synthetic server identity rather than request-supplied authority.

For an available synthetic aggregate, import this JSON into the draft and save with a change reason:

```json
{
  "source": "synthetic-report",
  "id": "checkout",
  "version": "v1",
  "observedWindow": { "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T00:00:00Z" },
  "snapshot": {
    "schemaVersion": 1,
    "metrics": [{ "metricId": "conversion", "value": 0.17, "sampleSize": 81 }]
  }
}
```

A different version displays version mismatch and hides the retained aggregate. Other identities are
deleted, and unregistered sources remain explicit. This example's policy rejects email text and
unapproved aggregate metric identities. Production hosts must replace the synthetic identity and
limited safety checks with their actual authorization and privacy policy. No LLM, experiment launch,
external publication, production data or provider certification is part of this demonstration.
