# @croco/warehouse-tooling

Compile data declarations into a deterministic manifest, fact descriptors, TypeScript schema modules, and PostgreSQL migration SQL. The compiler records source locations, semantic/documentation/physical hashes, dependency edges, and a topological order. Validation and generation do not connect to databases, read source partitions, or execute pipelines.

This package is alpha/WIP. Successful compilation verifies declarations and generated artifacts; it does not certify a provider deployment or publish data.

## Declare and generate

[The executable example](./examples/data.config.ts) imports the existing application-owned Drizzle `orders` table from [orders.ts](./examples/orders.ts), declares a distinct `paid_orders` fact, and passes an actual `definePipeline()` result to the compiler. Replace the example snapshot path and placeholder revision with an immutable source snapshot and its SHA-256 revision before executing a pipeline.

Run from the repository root after building the CLI and its workspace dependencies:

```sh
pnpm --filter @croco/warehouse-tooling example:build

node packages/cli/dist/bin/croco.js data validate \
  --config packages/warehouse-tooling/.turbo/data-example/data.config.js \
  --cwd .

node packages/cli/dist/bin/croco.js data generate \
  --config packages/warehouse-tooling/.turbo/data-example/data.config.js \
  --cwd . \
  --environment production \
  --output /tmp/croco-data-example \
  --migration-id 001_paid_orders
```

For an installed CLI, use `croco data validate` or `croco data generate` with the same arguments. In an application config, import facts from `@croco/warehouse-core` and pipeline declarations from `@croco/etl-core/pipeline`. The repository example build bundles workspace dependencies because their development exports select source files. Its local `.turbo/data-example` output is not committed. Config modules export a default `defineDataConfig()` value. The CLI uses the `@croco/warehouse-tooling/offline` entrypoint for its built compiler under Node's TypeScript stripping mode; local TypeScript imports need explicit extensions.

`connectionRef("primary", { env: "DATABASE_URL" })` records the environment variable name, never a resolved credential. An environment overlay can replace connection environment references and set positive integer budgets. Budgets are manifest declarations; compilation does not enforce execution limits. Model semantic and physical hashes exclude descriptions. Pipeline transform hashes retain the upstream projection artifact identity, which can change when projected descriptor documentation changes. Overlays cannot replace models, source tables, pipeline definitions, or backend choices.

The example supplies explicit project-relative file, line, and column locations. These are declaration metadata provided by the caller, rather than positions inferred by a TypeScript source scanner. Keep them aligned when declarations move.

## Supported scope

| Surface           | Current behavior                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OLTP sources      | References an existing Drizzle PostgreSQL table and maps logical fields to declared table columns. The application's migration owner retains that table.          |
| PostgreSQL models | One owned database connection per config; `public` schema; provider-derived `wh_fact_<hash>` tables and stable `c_<index>` columns. No physical naming overrides. |
| External models   | Records explicit schema/table references and descriptors. Generates no native DDL for those models.                                                               |
| Pipelines         | Validates actual `PipelineDefinition` source partitions, projections, target facts, and declared dependencies. Does not open partitions or execute transforms.    |
| Dependencies      | Rejects missing references, duplicate identifiers, ownership conflicts, and cycles before writing artifacts.                                                      |
| Backend support   | Native DDL is limited to the existing PostgreSQL fact provider. No BigQuery, ClickHouse, or DuckDB DDL, scheduler, IaC, or online inspection/apply command.       |

## Artifacts and migration ownership

Generation writes:

- `manifest.json`: declaration graph, hashes, connection environment references, budgets, and artifact digests.
- `descriptors/<model>.json`: canonical fact descriptors, including external models.
- `schema/<model>.ts` and `schema/index.ts`: owned PostgreSQL descriptor modules that call `generatePostgresFactSchema()`. The exported `schema` value is a promise for native SQL and the column mapping; it does not connect to a database.
- `migrations/<migration-id>.sql`: PostgreSQL metadata and owned fact-table DDL, sharing the runtime installer's physical lowering.
- `.croco-data-ownership.json`: digests identifying files owned by this generator.

Review and apply the saved SQL through your existing PostgreSQL migration owner, inside its explicitly owned migration transaction. Runtime constructors do not install schemas. Generated SQL explicitly targets `public`, independent of the migration connection's `search_path`, and checks model metadata bindings to reject conflicting descriptors. It is an installation artifact, not a schema-diff planner: changing a fact's semantic hash selects a new physical table. Data migration, cutover, retention, and publication remain explicit runtime/provider responsibilities.

Regeneration retains unowned files and historical migrations, removes obsolete owned non-migration files, and rejects edits to owned files or collisions with unowned paths. Reusing a migration ID with different SQL fails; choose a new reviewed migration ID for changed SQL. The writer stages a complete directory and swaps it into place under a generation lock. Keep the ownership file with generated artifacts and use a dedicated output directory.

## Offline execution boundary

The CLI evaluates trusted repository config code in a child Node process with an empty environment, filesystem read permissions, and guards for common Node network APIs. It limits execution time and returned output. These controls prevent accidental online work; they are not a hostile-JavaScript sandbox. Config modules should only import declarations and define metadata, without application bootstrap or database initialization.

The library-level `compileDataConfig()` function is a pure declaration compiler; the child-process evaluation boundary belongs to the CLI. Generated artifacts contain environment references rather than secrets. Raw credentials are not accepted as connection declarations.

Generation failures before the directory commit preserve the prior outputs. A failure removing the old backup after a successful commit is reported separately as `committed-cleanup-failed` with the committed manifest and a nonzero CLI exit. The current generated directory and its manual files remain intact, the lock is released, and the backup is retained for local inspection/cleanup. This is not a rollback of a completed directory commit.
