# @croco/etl-core source decoder

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
