# @croco/migration-runner

Migration scanning and execution utilities for Croco packages.

`@croco/migration-runner` discovers migration files, records applied migrations, and
executes forward or rollback migration steps against a database client. It is designed
for packages that need explicit migration evidence instead of hidden startup work.

## Public API

- `MigrationScanner` - reads migration files from a configured directory.
- `MigrationStore` - tracks migration execution records.
- `MigrationRunner` - applies pending migrations and validates counts.
- `InvalidMigrationCountProblem` - Problem emitted for invalid migration requests.

## Usage

```typescript
import { MigrationRunner, MigrationScanner, MigrationStore } from "@croco/migration-runner";

const scanner = new MigrationScanner({ directory: "./migrations" });
const store = new MigrationStore(database);
const runner = new MigrationRunner({ scanner, store, database });

await runner.up();
```

## Verification

```bash
pnpm --filter @croco/migration-runner test
pnpm --filter @croco/migration-runner typecheck
```
