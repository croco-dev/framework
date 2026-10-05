import assert from "node:assert/strict";

import { decodeSource } from "@croco/etl-core/source";
import { EXPERIMENT_REVIEW_READ_PERMISSION, loadExperimentReviewConsole } from "@croco/admin-core";
import { summarizeExperiment } from "@croco/metrics-core";
import { MetricReadService } from "@croco/metrics-core/runtime";

import type { SourceSchema } from "@croco/etl-core/source";
import type { ExperimentReviewSource } from "@croco/admin-core";
import type { ExperimentDatasetInput } from "@croco/metrics-core";
import type {
  MetricReadAuthority,
  MetricReadContext,
  MetricReadQuality,
  MetricReadResult,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
} from "@croco/metrics-core/runtime";
import type {
  WarehousePage,
  WarehouseReader,
  WarehouseReadRequest,
} from "@croco/warehouse-core/runtime";
import type { CanonicalRow } from "@croco/warehouse-core";

const encoder = new TextEncoder();
const limits = { maxBytes: 65_536, maxRecords: 1_000, maxRowBytes: 4_096 };
const assignmentSchema: SourceSchema = {
  format: "csv",
  encoding: "utf-8",
  header: true,
  fields: [
    { name: "unitId", type: "string" },
    { name: "variantId", type: "string" },
    { name: "tier", type: "string" },
  ],
  limits,
};
const outcomeSchema: SourceSchema = {
  format: "csv",
  encoding: "utf-8",
  header: true,
  fields: [
    { name: "unitId", type: "string" },
    { name: "value", type: "number" },
  ],
  limits,
};

const assignmentCsv = `unitId,variantId,tier
control-0,control,free
control-1,control,free
treatment-0,treatment,free
treatment-1,treatment,free
`;
const outcomeCsv = `unitId,value
control-0,1
control-1,0
treatment-0,1
treatment-1,1
`;

async function* bytes(value: string): AsyncGenerator<Uint8Array> {
  yield encoder.encode(value);
}

function toText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

async function decodeRows(csv: string, schema: SourceSchema): Promise<CanonicalRow[]> {
  const rows: CanonicalRow[] = [];
  for await (const row of decodeSource(bytes(csv), schema)) {
    rows.push(
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value === null ? null : toText(value)]),
      ),
    );
  }
  return rows;
}

class InMemoryExperimentReader implements WarehouseReader {
  constructor(private readonly rows: readonly CanonicalRow[]) {}

  read(_request: WarehouseReadRequest): Promise<WarehousePage> {
    return Promise.resolve({
      snapshotId: "experiment-snapshot-1",
      rows: [...this.rows],
      nextCursor: null,
      permissionEpoch: 1,
      privacyEpoch: 1,
      exactness: "exact",
    });
  }
}

function toDataset(
  assignments: readonly CanonicalRow[],
  outcomes: readonly CanonicalRow[],
): ExperimentDatasetInput {
  return {
    plan: {
      experimentId: "exp-normalized-parity",
      revision: "r1",
      primaryMetricId: "signup",
      randomizationUnit: "unit",
      outcomeKind: "binary",
      observedWindow: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-08T00:00:00.000Z" },
      variants: [
        { id: "control", plannedShare: 0.5 },
        { id: "treatment", plannedShare: 0.5 },
      ],
      srmWarningThreshold: 0.001,
      preTreatmentAttributes: ["tier"],
    },
    assignments: assignments.map((row) => ({
      unitId: String(row["unitId"] ?? ""),
      variantId: String(row["variantId"] ?? ""),
      attributes: { tier: row["tier"] },
    })),
    exposures: [],
    preTreatmentFacts: {},
    outcomes: outcomes.map((row) => ({
      unitId: String(row["unitId"] ?? ""),
      value: row["value"] === null ? null : Number(row["value"]),
      complete: true,
    })),
    completeThrough: "2026-09-08T00:00:00.000Z",
  };
}

async function loadNormalizedDataset(): Promise<ExperimentDatasetInput> {
  const assignments = await decodeRows(assignmentCsv, assignmentSchema);
  const outcomes = await decodeRows(outcomeCsv, outcomeSchema);
  const joined: CanonicalRow[] = assignments.map((assignment) => {
    const outcome = outcomes.find((candidate) => candidate["unitId"] === assignment["unitId"]);
    return { ...assignment, outcomeValue: outcome?.["value"] ?? null };
  });
  const reader: WarehouseReader = new InMemoryExperimentReader(joined);
  const page = await reader.read({
    access: {
      scope: { application: "experiment-review", environment: "demo", tenant: "demo-tenant" },
      actor: "demo-operator",
      roles: ["read"],
      columns: ["unitId", "variantId", "tier", "outcomeValue"],
      permissionEpoch: 1,
      privacyEpoch: 1,
    },
    snapshotId: "experiment-snapshot-1",
    projection: ["unitId", "variantId", "tier", "outcomeValue"],
    filters: [],
    order: [],
    maxRows: 100,
    maxBytes: 65_536,
    timeoutMs: 1_000,
  });
  assert.equal(page.exactness, "exact");
  const rows: readonly CanonicalRow[] = page.rows;
  return toDataset(
    rows.map((row: CanonicalRow) => ({
      unitId: row["unitId"] ?? null,
      variantId: row["variantId"] ?? null,
      tier: row["tier"] ?? null,
    })),
    rows.map((row: CanonicalRow) => ({
      unitId: row["unitId"] ?? null,
      value: row["outcomeValue"] ?? null,
    })),
  );
}

async function readThroughRegisteredQuery(
  dataset: ExperimentDatasetInput,
): Promise<{ status: string; source?: string }> {
  const window = { ...dataset.plan.observedWindow };
  const budget = {
    maxWindowMs: 604_800_000,
    maxRows: 1_000,
    maxBytes: 65_536,
    maxTimeMs: 1_000,
    maxConcurrency: 1,
    maxCost: 10,
  } as const;
  const definition: RegisteredMetricDefinition = {
    id: "experiment-signup",
    version: 1,
    hash: "sha256:experiment-review",
    unit: "signup-per-unit",
    population: "randomized-units",
    sourceRefs: ["experiment-assignments"],
    description: "Experiment signup review input",
    requiredFields: ["unitId"],
    requiresRaw: false,
  };
  const currentContext = (): MetricReadContext => ({
    principal: {
      app: "experiment-review-example",
      environment: "demo",
      tenant: "demo-tenant",
      subject: "demo-operator",
    },
    allowedFields: ["unitId"],
    allowRaw: false,
    budget: { ...budget },
    sourceRevisions: [{ sourceRef: "experiment-assignments", revision: "experiment-snapshot-1" }],
    snapshotRefs: ["experiment-snapshot-1"],
  });
  const authority: MetricReadAuthority = {
    currentContext,
    async authorize(context, action) {
      if (context.principal.tenant !== "demo-tenant" || action.definitionIds[0] !== definition.id) {
        return null;
      }
      return { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" };
    },
  };
  const quality: MetricReadQuality = {
    temporalCompleteness: "complete",
    freshness: "fresh",
    populationCoverage: "complete",
    validity: "valid",
    exactness: "exact",
    reproducibility: "reproducible",
  };
  const query: RegisteredMetricQuery = {
    id: "experiment-signup-review",
    version: 1,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: "randomized-units",
    requiredFields: definition.requiredFields,
    requiresRaw: false,
    limits: { ...budget },
    inputSchema: {
      parse(input: unknown): unknown {
        if (input !== "review") throw new Error("Only the fixed review input is supported");
        return input;
      },
    },
    outputSchema: { parse: (output: unknown) => output },
    inputKey: () => "review",
    async readExecutor({ context }) {
      const review = summarizeExperiment(dataset);
      const result: MetricReadResult = {
        data: {
          control: review.primary["control"],
          treatment: review.primary["treatment"],
        },
        principal: context.principal,
        definition: {
          id: definition.id,
          version: definition.version,
          hash: definition.hash,
          unit: definition.unit,
          population: definition.population,
          sourceRefs: definition.sourceRefs,
        },
        unit: definition.unit,
        population: definition.population,
        filter: "randomized-units",
        fieldRefs: [...definition.requiredFields],
        window,
        sourceRevisions: [...context.sourceRevisions],
        snapshotRefs: [...context.snapshotRefs],
        quality,
        diagnostics: [],
        rows: dataset.assignments.length,
        bytes: encoder.encode(JSON.stringify(dataset.assignments)).length,
        cost: 1,
      };
      return result;
    },
  };
  const service = new MetricReadService([definition], [query], authority);
  const outcome = await service.runRegisteredQuery(query.id, "review", window);
  return {
    status: outcome.status,
    source: outcome.status === "verified" ? outcome.source : undefined,
  };
}

async function main(): Promise<void> {
  const dataset = await loadNormalizedDataset();
  const direct = summarizeExperiment(dataset);
  const viaSource: ExperimentReviewSource = {
    requiredPermissions: [EXPERIMENT_REVIEW_READ_PERMISSION],
    async load() {
      return {
        kind: "ready",
        dataset: await loadNormalizedDataset(),
        generatedAt: new Date("2026-09-08T00:00:00.000Z"),
        sourceRef: "experiment-snapshot-1",
      };
    },
  };
  const consoleState = await loadExperimentReviewConsole({
    source: viaSource,
    appId: "experiment-review-example",
    environment: "demo",
    tenantId: "demo-tenant",
    grantedPermissions: [EXPERIMENT_REVIEW_READ_PERMISSION],
  });
  assert.equal(consoleState.kind, "ready");
  if (consoleState.kind !== "ready") throw new Error("Expected a ready console state");
  for (const variant of consoleState.snapshot.variants) {
    assert.equal(variant.n, direct.primary[variant.variantId]?.n);
    assert.equal(variant.estimate, direct.primary[variant.variantId]?.estimate);
  }
  assert.equal(direct.primary["control"]?.n, 2);
  assert.equal(direct.primary["treatment"]?.n, 2);
  assert.equal(direct.primary["control"]?.estimate, 0.5);
  assert.equal(direct.primary["treatment"]?.estimate, 1);

  const queryOutcome = await readThroughRegisteredQuery(dataset);
  assert.equal(queryOutcome.status, "verified");

  if (consoleState.kind !== "ready") throw new Error("Expected a ready console state");
  console.log(
    JSON.stringify({
      experimentId: direct.plan.experimentId,
      control: direct.primary["control"],
      treatment: direct.primary["treatment"],
      consoleState: consoleState.kind,
      registeredQuery: queryOutcome,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
