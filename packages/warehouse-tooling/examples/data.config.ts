import { c, defineFact } from "@croco/warehouse-core";
import { definePipeline, defineProjection } from "@croco/etl-core/pipeline";
import {
  connectionRef,
  defineDataConfig,
  oltpSourceRef,
  postgresModel,
} from "@croco/warehouse-tooling";
import { orders } from "./orders.ts";

const paidOrders = defineFact("paid_orders", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One paid order", key: ["id"] },
  columns: { id: c.id(), paidAt: c.instant({ precision: "millisecond" }) },
  time: { event: "paidAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
  sourceRefs: ["orders"],
});

const sourceSchema = {
  format: "jsonl",
  encoding: "utf-8",
  fields: [
    { name: "id", type: "string" },
    { name: "paidAt", type: "date" },
  ],
  limits: { maxBytes: 1048576, maxRecords: 1000, maxRowBytes: 1024 },
} as const;

const pipeline = definePipeline({
  id: "load_paid_orders",
  version: 1,
  source: {
    id: "orders",
    partitions: [
      {
        id: "paid-orders-2026-10-01",
        path: "snapshots/paid-orders-2026-10-01.jsonl",
        schema: sourceSchema,
        revision: "a".repeat(64),
        replayability: "snapshot-stable",
      },
    ],
    coverage: {
      sourceRef: "orders",
      from: "2026-10-01",
      through: "2026-10-01",
      state: "complete",
      gaps: [],
      late: false,
    },
  },
  project: defineProjection({
    source: sourceSchema,
    target: paidOrders,
    columns: {
      id: { kind: "column", field: "id" },
      paidAt: { kind: "column", field: "paidAt", cast: "instant" },
    },
  }),
  load: "strict",
  resume: "checkpoint",
});

export default defineDataConfig({
  connections: [connectionRef("primary", { env: "DATABASE_URL" })],
  sources: [
    oltpSourceRef("orders", orders, {
      connection: "primary",
      columns: { id: "id", paidAt: "paidAt" },
      location: { file: "packages/warehouse-tooling/examples/orders.ts", line: 3, column: 1 },
    }),
  ],
  models: [
    postgresModel(paidOrders, {
      connection: "primary",
      location: { file: "packages/warehouse-tooling/examples/data.config.ts", line: 11, column: 1 },
    }),
  ],
  pipelines: [
    {
      definition: pipeline,
      location: { file: "packages/warehouse-tooling/examples/data.config.ts", line: 32, column: 1 },
    },
  ],
  overlays: {
    production: {
      connections: { primary: { env: "PRODUCTION_DATABASE_URL" } },
      budgets: { rows: 1000 },
    },
  },
});
