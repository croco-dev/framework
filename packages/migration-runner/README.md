# @croco/migration-runner

Migration scanning, checkpoint storage, and CLI execution utilities for Croco packages.

`@croco/migration-runner` is for packages that need explicit migration evidence instead of hidden startup
work. It discovers timestamped migration files, records applied migrations in a checkpoint table, and runs
forward or rollback steps through a transaction-capable database client.

## Install

```bash
pnpm add @croco/migration-runner
```

The published package exposes the `migrate` binary and includes the Postgres driver used by the CLI.

```bash
pnpm exec migrate --help
```

## CLI Configuration

The CLI currently supports Postgres connections.

| Option                | Default        | Description                                                                                 |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `--connection <url>`  | `DATABASE_URL` | Postgres connection string. Required for `up`, `down`, and `status`.                        |
| `--dir <path>`        | `./migrations` | Directory containing migration files.                                                       |
| `--table <name>`      | `_migrations`  | Checkpoint table used to record executed migrations.                                        |
| `--dialect <dialect>` | `postgres`     | Supported value: `postgres`. Other values fail with `migration-runner/unsupported-dialect`. |
| `--target <id>`       | none           | Run or roll back through a specific timestamp id.                                           |
| `--count <number>`    | `1`            | `down` only. Must be a positive integer when no target is supplied.                         |
| `--dry-run`           | `false`        | `up` and `down` only. Print the selected migrations without committing changes.             |

## Migration Files

Migration files must be `.ts` or `.js` files named with a 14-digit timestamp and a descriptive suffix.

```text
migrations/
  20260615000001_create_accounts.ts
  20260615000500_add_account_status.ts
```

Each file exports async `up` and `down` functions.

```typescript
import type { DatabaseClient } from "@croco/migration-runner";

export async function up(db: DatabaseClient): Promise<void> {
  await db.execute("CREATE TABLE accounts (id text primary key)");
}

export async function down(db: DatabaseClient): Promise<void> {
  await db.execute("DROP TABLE accounts");
}
```

Missing `up` or `down` functions fail as Croco Problems:

- `migration-runner/missing-up-function`
- `migration-runner/missing-down-function`

## Commands

Run all pending migrations:

```bash
pnpm exec migrate up --connection "$DATABASE_URL" --dir ./migrations
```

Run pending migrations through a target id:

```bash
pnpm exec migrate up --target 20260615000500 --connection "$DATABASE_URL"
```

Preview pending migrations without changing the checkpoint table or running migration bodies:

```bash
pnpm exec migrate up --dry-run --connection "$DATABASE_URL"
```

Show database status before operating:

```bash
pnpm exec migrate status --connection "$DATABASE_URL"
```

Roll back the latest migration:

```bash
pnpm exec migrate down --connection "$DATABASE_URL"
```

Roll back a bounded number of migrations:

```bash
pnpm exec migrate down --count 2 --connection "$DATABASE_URL"
```

Roll back to a target id:

```bash
pnpm exec migrate down --target 20260615000001 --connection "$DATABASE_URL"
```

Preview the rollback selection without changing checkpoint or migration state:

```bash
pnpm exec migrate down --count 2 --dry-run --connection "$DATABASE_URL"
```

Dry-run uses the same target and count selection as execution. On a fresh database it initializes and reads the
checkpoint table inside a rollback-only transaction, so neither that table nor migration state is committed. This
guarantee depends on the supported Postgres transactional-DDL boundary; the package does not claim cross-dialect dry-run
support. Continue to keep database backups or point-in-time restore available for production rollbacks.

## Destructive Command Safety

Rollback count validation happens before the CLI opens a database connection and before the runner scans or
executes migration bodies.

Rejected examples:

```bash
pnpm exec migrate down --count 0
pnpm exec migrate down --count -1
pnpm exec migrate down --count 1.5
pnpm exec migrate down --count abc
```

Those inputs fail with `migration-runner/invalid-count`. Direct API calls such as
`runner.down(undefined, 0)` and `runner.down(undefined, Number.NaN)` fail the same way and cannot fall back to
the default one-migration rollback path.

The default `migrate down` behavior still means `--count 1`. Omit `--count` only when rolling back exactly the
latest migration is the intended operation.

## Failure Semantics

CLI failures print a deterministic diagnostic shape:

```text
Migration failed: migration-runner/invalid-count (400 Bad Request): Migration rollback count must be a positive integer greater than 0: abc
```

Common operator failures:

| Code                                        | When it happens                                                           | Recovery                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| `migration-runner/database-url-required`    | No `--connection` and no `DATABASE_URL`.                                  | Provide a Postgres URL for the target environment.     |
| `migration-runner/unsupported-dialect`      | `--dialect` is not `postgres`.                                            | Use Postgres or provide a direct API `DatabaseClient`. |
| `migration-runner/invalid-count`            | `down --count` is zero, negative, fractional, non-numeric, or unsafe.     | Choose a positive integer or use `--target`.           |
| `migration-runner/transaction-required`     | Direct API client has no `transaction` function for execution or preview. | Wrap the adapter with transaction support.             |
| `migration-runner/unsupported-query-result` | Adapter returns neither an array nor a `{ rows: [...] }` result.          | Normalize the adapter result shape.                    |
| `migration-runner/missing-up-function`      | A migration file lacks `up`.                                              | Add the forward migration body.                        |
| `migration-runner/missing-down-function`    | A migration file lacks `down`.                                            | Add a rollback body or do not select it for rollback.  |

Database connection and query failures are not hidden as success. They make the command exit nonzero after the pool
cleanup attempt. If cleanup itself fails, the CLI adds a `Cleanup failed: ...` diagnostic and exits nonzero without
discarding earlier command output or failure diagnostics.

When an `up` or `down` command fails after opening the database, the CLI prints conservative direction-specific recovery
guidance: inspect `migrate status` and the database state, correct the reported failure, then rerun the same command. The
CLI does not infer checkpoint or commit state from an undifferentiated adapter or driver error.

For a migration-body failure with a database that honors the required transaction contract, transactions remain scoped
per migration: the failing body and its checkpoint change roll back together, while migrations completed earlier in the
same command remain committed. This narrower guarantee does not cover uncertain driver commit outcomes, whole-command
rollback, or dialects whose DDL is not transactional.

## Programmatic API

```typescript
import type { DatabaseClient } from "@croco/migration-runner";
import { MigrationRunner } from "@croco/migration-runner";

const db: DatabaseClient = {
  execute: async (query) => adapter.execute(query),
  transaction: async (fn) => adapter.transaction((tx) => fn(tx)),
};

const runner = new MigrationRunner(db, "./migrations", "_migrations");

const pending = await runner.previewUp();
await runner.up();
const status = await runner.status();
const rollbackPlan = await runner.previewDown(undefined, 1);
await runner.down(undefined, 1);
```

`previewUp` and `previewDown` return planned ids without presenting them as executed results. They require transaction
support for rollback-only checkpoint initialization. `up` and `down` also require transaction support so checkpoint changes
and migration body side effects commit or roll back together. Concurrent runners reserve or claim checkpoint rows atomically
through the checkpoint table and skip migrations already claimed by another transaction.

## Verification

```bash
pnpm --filter @croco/migration-runner test
pnpm --filter @croco/migration-runner typecheck
pnpm package-bins:smoke
pnpm docs:catalog:check
pnpm public-api:check
```
