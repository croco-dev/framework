# @croco/etl-core

Source decoding and explicit file-to-warehouse pipeline execution.

## Decode a source without a database

`@croco/etl-core/source` reads CSV or JSONL from an `AsyncIterable<Uint8Array>` without a database, worker, or warehouse package. It yields one normalized row at a time. Importing it does not start a job.

```typescript no-check
import { createReadStream } from "node:fs";
import { decodeSource } from "@croco/etl-core/source";

const rows = decodeSource(createReadStream("input.csv"), {
  format: "csv",
  encoding: "utf-8",
  delimiter: ",",
  header: true,
  fields: [
    { name: "id", type: "number" },
    { name: "createdAt", type: "date", nullable: true, nullValues: [""] },
  ],
  limits: { maxBytes: 10_000_000, maxRecords: 100_000, maxRowBytes: 64_000 },
});

for await (const row of rows) {
  // Apply the product's semantic validator before using the row.
}
```

Fields are exact: CSV headers must contain each declared name once, and JSONL objects must contain each declared key once. Without a CSV header, values follow field order. Numbers use strict decimal syntax, finite JavaScript numbers, and safe integers. Dates accept `YYYY-MM-DD` or timestamps with an explicit `Z` or `±HH:MM` offset and up to three fractional-second digits; values become UTC `Date` objects. Only UTF-8 is supported; malformed input, invalid values, and limits raise `SourceDecodeProblem` with a reason and line, column, and zero-based byte offset. The record limit includes a CSV header. Empty CSV fields remain empty strings unless listed in `nullValues`.

The decoder handles source syntax and primitive normalization only. Product-specific row meaning and warehouse writes belong to their owning packages.

## Compose a Node.js pipeline

`@croco/etl-core/pipeline` provides `defineProjection`, `definePipeline`, and
`createPipelineOperations`. The application supplies an existing execution manager with attempt
fencing, warehouse catalog/writer, a publication coordinator, and a current trusted access resolver. No scheduler or separate
pipeline state database is created. Importing declarations does not execute a pipeline.

Pipeline consumers install the optional peers `@croco/batch-core`, `@croco/execution-core`, and
`@croco/warehouse-core`, plus their chosen provider. The PostgreSQL publication coordinator also
requires `@croco/execution-drizzle`, `drizzle-orm`, and `pg` alongside `@croco/warehouse-postgres`.
Source-only consumers do not need those packages.

The following application config uses the PostgreSQL fact provider. Before running it, apply the
warehouse and fact schema installers in the deployment migration, as described in the
[provider guide](../warehouse-postgres/README.md#fact-warehouse), and migrate the execution store.
The application-owned `application.js` module supplies the PostgreSQL `pool`,
`resolveAccess`, and an inspected `sourceManifest` containing the absolute file path, lowercase
SHA-256 revision, and verified coverage dates. It must not start jobs or apply migrations on import.

```typescript no-check
// pipelines.ts — compile to pipelines.mjs for the CLI configuration module.
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import { PostgresWarehouseCatalog, PostgresWarehouseWriter } from "@croco/warehouse-postgres/facts";
import { PostgresPipelinePublication } from "@croco/warehouse-postgres/pipeline";
import {
  createPipelineOperations,
  definePipeline,
  defineProjection,
} from "@croco/etl-core/pipeline";
import { pool, resolveAccess, sourceManifest } from "./application.js";

const payments = defineFact("payments", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One imported payment", key: ["id"] },
  columns: {
    id: c.id(),
    amount: c.int64(),
    occurredAt: c.instant({ precision: "millisecond" }),
  },
  time: { event: "occurredAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});
const schema = {
  format: "jsonl",
  encoding: "utf-8",
  fields: [
    { name: "id", type: "string" },
    { name: "amount", type: "string" },
    { name: "occurredAt", type: "string" },
  ],
  limits: { maxBytes: 10_000_000, maxRowBytes: 64_000, maxRecords: 100_000 },
} as const;
const project = defineProjection({
  source: schema,
  target: payments,
  columns: {
    id: { kind: "column", field: "id" },
    amount: { kind: "column", field: "amount" },
    occurredAt: { kind: "column", field: "occurredAt" },
  },
});
const definition = definePipeline({
  id: "payments",
  version: 1,
  source: {
    id: "payments-file",
    partitions: [
      {
        id: "payments-partition",
        path: sourceManifest.path,
        revision: sourceManifest.sha256,
        replayability: "snapshot-stable",
        schema,
      },
    ],
    coverage: {
      sourceRef: "payments-file",
      from: sourceManifest.from,
      through: sourceManifest.through,
      state: "complete",
      gaps: [],
      late: false,
    },
  },
  project,
  load: "strict",
  resume: "checkpoint",
});
const descriptor = await compileFact(payments);
const publication = new PostgresPipelinePublication(pool, descriptor, resolveAccess);
export const pipelines = {
  payments: createPipelineOperations(definition, {
    executions: publication.executions,
    publication,
    catalog: new PostgresWarehouseCatalog(pool, descriptor, resolveAccess),
    writer: new PostgresWarehouseWriter(pool, descriptor, resolveAccess),
    resolveAccess,
    chunkSize: 100,
    maxAttempts: 3,
    previewLimit: 10,
    maxInputRecords: 100_000,
    clock: () => new Date(),
  }),
};
```

Supply JSONL integer values as exact decimal strings, such as `"9223372036854775807"`,
when they exceed JavaScript's safe integer range. Projection declarations validate source fields,
required target columns, nullability, and supported casts before execution. Available expressions
are columns with optional casts/defaults and constants. A custom `processor` declares its
`artifactHash` and `dependencies`; its input is the projected target row, its output is validated
against that target, and returning `null` explicitly filters a row. The framework does not derive
lineage from function text. Custom processors run during preview and execution, so they must not perform external writes.
`validate()` checks the declarative projection only; it does not invoke custom processor code.

`resolveAccess` derives tenant, actor, roles, columns, and policy epochs from trusted application
state. Source rows and processors cannot select the execution's tenant. Current permission/privacy
changes invalidate replay rather than silently reusing an earlier authorization decision.

The [PostgreSQL integration test](../warehouse-postgres/src/tests/Pipeline.integration.spec.ts)
contains the executable temporary-database composition, using the existing Drizzle execution store
and PostgreSQL catalog, writer, and reader. It verifies actual provider behavior; the example above
is an application composition template, not a provider certification or release claim.

## Validate, preview, run, and inspect

The management API is the `pipelines.payments` operations object. `validate()` scans the input and validates
the declarative projection; `preview()` projects at most `previewLimit` input records. Neither invokes warehouse
writes or creates execution records. File capture still reads and hashes the entire bounded source
into a private temporary snapshot, validates its decoding, and removes it on close. Preview output
contains projected rows and should be handled as source data.

The CLI loads the application's named `pipelines` export. Options follow the action:

```bash
croco pipeline validate --config ./pipelines.mjs --pipeline payments
croco pipeline preview --config ./pipelines.mjs --pipeline payments
croco pipeline run --config ./pipelines.mjs --pipeline payments
croco pipeline status --config ./pipelines.mjs --pipeline payments --run EXECUTION_ID
croco pipeline retry --config ./pipelines.mjs --pipeline payments --run EXECUTION_ID
```

These commands call the same methods and emit their JSON reports. `status(executionId)` reads the
existing execution manager, including checkpoints and failure state. `retry(executionId)` uses its
attempt lifecycle. A returned report is not by itself evidence of publication: inspect `state`,
`snapshotId`, rejection counts, and the execution status. Use `preview` for inspection; `run` and
`retry` do not accept a dry-run flag. The application owns connection shutdown and host lifecycle.

`PostgresPipelinePublication` coordinates snapshot publication and execution completion in the
same PostgreSQL transaction. Use its `executions` instance in the runtime, and keep the execution
store and warehouse in the same database. This final publication boundary does not make earlier
chunk writes and checkpoints atomic.

## Replay, failure, and publication

- Each file's SHA-256 revision is checked against the bytes actually read. Snapshot-stable sources
  can restore only checkpoints identifying that source revision and a valid record boundary.
- Mutable sources require `resume: "restart-partition"`. They restart the failed partition rather
  than treating an offset as reproducible; completed partitions retain their checkpoints. Changed
  bytes require a new revision and a new run. Non-replayable sources cannot retry an earlier attempt.
- Run bindings include the pipeline version, source/input identity, target model, transform hash,
  expected warehouse head/revision, and trusted access. A changed binding fails explicitly instead
  of resuming an old run with new code or authority.
- `Step` and `ChunkExecutor` write before recording a checkpoint. Delivery is at least once;
  warehouse writes and execution checkpoints are not one transaction. Stable batch identities and
  the target fact's grain/duplicate policy handle replay. Fully filtered chunks still advance input
  checkpoints; zero output does not establish complete source coverage.
- Strict mode fails on invalid rows. Quarantine handles projection/processor validation failures and
  records source/record position, reason codes, sensitivity, and counts without storing raw rejected
  rows. Malformed files and decoding errors still fail explicitly. Rejections or incomplete coverage
  produce a partial result, fail the candidate/execution, and do not publish a snapshot.
- Cancellation, attempt fencing, input budgets, changed access, and unresolved writer receipts stop
  execution. An indeterminate receipt must reconcile to a durable receipt before publication can
  proceed. Unpublished failures leave the previously published head available.

## Migration and boundaries

Existing `@croco/etl-core/source` consumers keep their imports and DB-free decoder behavior. Opt into
`/pipeline` only where the Node.js application owns file access, execution persistence, and warehouse
services. Product-specific validators, payment meaning, metric formulas, and business policy remain
with their existing owners. This addition does not reload warehouse data, migrate product semantics,
or replace the provider's explicit migration and recovery contracts.
