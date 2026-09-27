# Cohort builder with a normalized PostgreSQL source

This example mounts `@croco/admin-react`'s `CohortBuilder` and connects its preview and publication callbacks to `PostgresCohortStore`. Preview saves the definition, starts a run, and materializes the normalized source in checkpointed pages. Publish stores an immutable snapshot and reads its audience through `PublishedCohortReader` and `CohortAudienceSource`.

The source contains three synthetic trial customers: one report creator, one fully observed non-creator, and one customer without event coverage. The default definition matches only the fully observed non-creator; missing coverage remains unknown.

## Browser example

Start a disposable PostgreSQL database and set its connection URL:

```bash
export COHORT_EXAMPLE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
pnpm --filter @croco-example/cohort-builder dev
```

Open **http://127.0.0.1:4319/**. Preview the default definition, inspect its match and unknown explanations, enter a publication reason, and publish. The published audience appears below the builder. Edit conditions and preview again to create a new definition version. The server checks scope, registered fields, sample bounds, run completion, and publication revision before accepting callbacks.

The server listens only on loopback and rejects cross-origin browser callbacks. It is a local example with a fixed demo operator and permissive privacy provider. Production applications must supply authentication, permission lookup, privacy/suppression checks, durable history queries, migration ownership, and expiry policy.

## Verification and CLI smoke

With the browser server running, exercise the actual HTTP callbacks, including unauthorized scope, invalid sample size, missing coverage, publication, audience reads, and stale revision rejection:

```bash
pnpm --filter @croco-example/cohort-builder smoke:browser
```

The independent CLI path completes the same default source-to-audience flow and asserts that only `inactive-trial` is published:

```bash
pnpm --filter @croco-example/cohort-builder start
pnpm --filter @croco-example/cohort-builder typecheck
pnpm --filter @croco-example/cohort-builder build:browser
```

Each server or CLI invocation creates a unique `cohort_example_*` PostgreSQL schema, applies `packages/cohort-drizzle/migrations/0001_cohort.up.sql`, and seeds its source table. These schemas persist for inspection; discard the database after use. Browser reload retains publication history for the current server process; restarting creates a fresh example. The HTTP smoke publishes a revision and therefore also changes that process's history.

No warehouse, CSV, or customer data service is simulated; those integrations depend on #2845, #2862, and #2857. The browser build uses the repository's existing React and tsup dependencies; the TypeScript source paths follow `admin-react`'s workspace configuration.
