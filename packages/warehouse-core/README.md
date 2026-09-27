# @croco/warehouse-core

Declare analytical facts as a portable contract. The root entry validates declarations and rows, encodes logical identity and payload, and compiles versioned JSON descriptors. Importing it does not connect to a database, create tables, or start a worker. PostgreSQL storage and DDL are separate provider work.

## Transaction fact

The grain key must identify a server-confirmed capture within the trusted tenant scope. If an ID comes from an external provider, include its provider and account namespace in the grain.

```typescript typecheck
import {
  c,
  compileFact,
  defineFact,
  serializeDescriptor,
  validateRow,
} from "@croco/warehouse-core";

const captures = defineFact("payment_captures", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One confirmed capture in a tenant", key: ["captureId"] },
  columns: {
    captureId: c.id(),
    orderId: c.id(),
    customerId: c.subjectId("customer", { sensitivity: "sensitive" }),
    capturedAt: c.instant({ precision: "millisecond" }),
    currency: c.currencyCode(),
    amountMinor: c.moneyMinor({ currency: "currency", min: 0n }),
  },
  time: { event: "capturedAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

async function compileCaptureExample() {
  const descriptor = await compileFact(captures);
  const row = validateRow(descriptor, {
    captureId: "capture-1",
    orderId: "order-1",
    customerId: "customer-1",
    capturedAt: "2026-09-27T12:00:00.000Z",
    currency: "USD",
    amountMinor: 9223372036854775807n,
  });
  return { descriptorJson: serializeDescriptor(descriptor), amountMinor: row.amountMinor };
}

void compileCaptureExample;
```

Int64 and minor-unit money accept `bigint` or a canonical base-10 integer string and serialize as a decimal string. JavaScript numbers are rejected. Instants must be UTC strings with the declared precision. Client rows cannot supply runtime provenance or scope fields.

## Sparse aggregate and fixture import

An aggregate declares its original calendar date and IANA zone, series and dimension tuple, and each measure's unit and reaggregation rule. A nullable measure remains `null` when the source did not provide it; the importer does not invent zero.

```typescript typecheck
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import { FixtureImporter } from "@croco/warehouse-core/runtime";

const searchDaily = defineFact("search_daily", {
  version: 1,
  kind: "aggregate",
  scope: "tenant",
  grain: { description: "One local day, index, and query", key: ["day", "indexId", "queryId"] },
  columns: {
    day: c.date({ zone: "Asia/Seoul" }),
    indexId: c.id(),
    queryId: c.id({ sensitivity: "sensitive" }),
    searches: c.int64({ min: 0n }),
    clicks: c.nullable(c.int64({ min: 0n })),
  },
  time: { event: "day" },
  write: { mode: "replace-range", duplicate: "ignore-identical", conflict: "reject" },
  aggregate: {
    date: "day",
    series: ["indexId"],
    dimensions: ["queryId"],
    measures: {
      searches: { unit: "search", reaggregate: "sum" },
      clicks: { unit: "click", reaggregate: "sum" },
    },
  },
});

async function importSearchFixture() {
  const descriptor = await compileFact(searchDaily);
  const resolveScope = () => ({
    application: "storefront",
    environment: "test",
    tenant: "tenant-1",
  });
  const fixture = new FixtureImporter(descriptor, resolveScope, 100);
  fixture.replaceRange(
    { from: "2026-09-27", through: "2026-09-27", series: { indexId: "products" } },
    [{ day: "2026-09-27", indexId: "products", queryId: "coats", searches: 12n, clicks: null }],
    { executionId: "fixture-run-1" },
  );
  return fixture.snapshot();
}

void importSearchFixture;
```

The application must supply `resolveScope` from its authenticated runtime context. Row data cannot choose a tenant. The importer stores a bounded in-memory fixture, validates the whole batch before changing it, ignores identical append duplicates, rejects changed transaction payloads for an existing identity, and replaces only the selected aggregate date and series range. An empty replacement removes stale rows in that range. Runtime execution metadata is separate from logical identity and business payload.

The v1 compiler supports transaction facts, including factless events, and aggregates. Periodic and accumulating facts, SQL DDL, durable snapshot storage, ETL scheduling, and correction policies are outside this package. The compiler validates declared structure and references; the application remains responsible for choosing a true business grain and authorized source facts.
