import { decodeSource } from "@croco/etl-core/source";
import {
  computePeriodicRetention,
  computeCohortRetention,
  computeFrequencyDistribution,
  InvalidBehaviorMetricProblem,
} from "./BehaviorMetrics";
import { cancellableSource, readBoundedWarehouse } from "./read/BoundedSource";
import type { SourceSchema } from "@croco/etl-core/source";
import type { WarehouseReader, WarehouseReadRequest } from "@croco/warehouse-core/runtime";
import type {
  BehaviorDataset,
  BehaviorDefinition,
  BehaviorScope,
  BehaviorObservation,
  BehaviorRetentionOptions,
  BehaviorFrequencyOptions,
  BehaviorMetricResult,
  BehaviorRetentionResult,
  BehaviorFrequencyResult,
} from "./BehaviorMetrics";
import type {
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  MetricReadContext,
  MetricReadQuality,
  SourceRevision,
} from "./read/MetricReadService";

/** Column mapping only: the shared ETL decoder and warehouse provider own parsing and reads. */
export type BehaviorColumnBinding = {
  subjectId: string;
  source: string;
  eventId: string;
  occurredAt: string;
  action: string;
  appId?: string;
  environment?: string;
  tenantId?: string;
};
export type BehaviorSourceMetadata = Omit<BehaviorDataset, "events">;
export type BehaviorQuerySelection =
  | { kind: "periodic" | "cohort"; options: BehaviorRetentionOptions }
  | { kind: "frequency"; options: BehaviorFrequencyOptions };
export type BehaviorQueryResult = Omit<BehaviorMetricResult, "subjects" | "sourceRefs"> & {
  baselineWindow?: BehaviorRetentionResult["baselineWindow"];
  measure?: BehaviorFrequencyResult["measure"];
  buckets?: BehaviorFrequencyResult["buckets"];
};
function invalid(field: string): never {
  throw new InvalidBehaviorMetricProblem(field);
}
function sameScope(a: BehaviorScope, b: BehaviorScope): boolean {
  return a.appId === b.appId && a.environment === b.environment && a.tenantId === b.tenantId;
}
export function normalizeBehaviorRow(
  row: Readonly<Record<string, unknown>>,
  binding: BehaviorColumnBinding,
  scope?: BehaviorScope,
): BehaviorObservation {
  const text = (column: string) => {
    const value = row[column];
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
    if (typeof value !== "string" || !value.trim()) invalid("source.column");
    return value;
  };
  return {
    subjectId: text(binding.subjectId),
    source: text(binding.source),
    eventId: text(binding.eventId),
    occurredAt: text(binding.occurredAt),
    action: text(binding.action),
    scope: {
      appId: binding.appId ? text(binding.appId) : (scope?.appId ?? invalid("source.scope")),
      environment: binding.environment
        ? text(binding.environment)
        : (scope?.environment ?? invalid("source.scope")),
      tenantId: binding.tenantId
        ? text(binding.tenantId)
        : (scope?.tenantId ?? invalid("source.scope")),
    },
  };
}
/** Metadata is trusted, scope-bound source evidence; unknown coverage must remain unknown. */
export async function collectBehaviorSource(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  binding: BehaviorColumnBinding,
  metadata: BehaviorSourceMetadata,
  maxEvents: number,
  signal?: AbortSignal,
): Promise<BehaviorDataset> {
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1) invalid("source.maxEvents");
  const declaration = structuredClone(metadata);
  const columns = structuredClone(binding);
  const events: BehaviorObservation[] = [];
  for await (const row of cancellableSource(source, signal)) {
    if (events.length >= maxEvents) invalid("source.row-budget");
    const event = normalizeBehaviorRow(row, columns, declaration.scope);
    if (!sameScope(event.scope, declaration.scope)) invalid("source.scope");
    events.push(event);
  }
  return { ...declaration, events };
}
export function importBehaviorSource(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
  binding: BehaviorColumnBinding,
  metadata: BehaviorSourceMetadata,
  maxEvents: number,
  signal?: AbortSignal,
): Promise<BehaviorDataset> {
  return collectBehaviorSource(
    decodeSource(cancellableSource(bytes, signal), schema),
    binding,
    metadata,
    maxEvents,
    signal,
  );
}
export function readBehaviorWarehouse(
  reader: WarehouseReader,
  request: Omit<WarehouseReadRequest, "cursor">,
  limits: { maxRows: number; maxBytes: number; maxPages: number },
): AsyncIterable<Readonly<Record<string, unknown>>> {
  return readBoundedWarehouse(reader, request, limits, (detail) => invalid(`source.${detail}`));
}
function calculate(
  definition: BehaviorDefinition,
  dataset: BehaviorDataset,
  selection: BehaviorQuerySelection,
): BehaviorQueryResult {
  const result =
    selection.kind === "frequency"
      ? computeFrequencyDistribution(definition, dataset, selection.options)
      : selection.kind === "cohort"
        ? computeCohortRetention(definition, dataset, selection.options)
        : computePeriodicRetention(definition, dataset, selection.options);
  const { subjects: _subjects, sourceRefs: _sourceRefs, ...aggregate } = result;
  return aggregate;
}
async function digest(value: unknown): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** Register a fixed, trusted declaration; MetricReadService owns authorization, budgets and quality. */
export async function registerBehaviorQuery(options: {
  definition: BehaviorDefinition;
  queryId: string;
  queryVersion: number;
  selection: BehaviorQuerySelection;
  scope: BehaviorScope;
  sourceRevisions: readonly SourceRevision[];
  limits: RegisteredMetricQuery["limits"];
  requiredFields: readonly string[];
  source(
    context: MetricReadContext,
    signal: AbortSignal,
  ): Promise<{ dataset: BehaviorDataset; quality: MetricReadQuality }>;
}): Promise<{ definition: RegisteredMetricDefinition; query: RegisteredMetricQuery }> {
  const { source, ...configuration } = options;
  const declaration = structuredClone(configuration);
  if (
    !declaration.queryId.trim() ||
    !Number.isSafeInteger(declaration.queryVersion) ||
    declaration.queryVersion < 1 ||
    declaration.sourceRevisions.length === 0
  )
    invalid("query.declaration");
  const hash = await digest(declaration);
  const definition: RegisteredMetricDefinition = {
    id: declaration.definition.id,
    version: declaration.queryVersion,
    hash,
    unit: "subjects",
    population: declaration.definition.subjectKind,
    sourceRefs: declaration.sourceRevisions.map((ref) => ref.sourceRef),
    description: "Observed behavior retention and frequency",
    requiredFields: declaration.requiredFields,
    requiresRaw: false,
  };
  const parseInput = (input: unknown) => {
    if (input !== null) invalid("query.input");
    return null;
  };
  const query: RegisteredMetricQuery = {
    id: declaration.queryId,
    version: declaration.queryVersion,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: declaration.selection.kind,
    requiredFields: [...declaration.requiredFields],
    requiresRaw: false,
    limits: declaration.limits,
    inputSchema: { parse: parseInput },
    inputKey: (input) => {
      parseInput(input);
      return hash;
    },
    outputSchema: {
      parse: (output) => {
        if (!output || typeof output !== "object" || Array.isArray(output)) invalid("query.output");
        const result = output as BehaviorQueryResult;
        const keys = [
          "definitionId",
          "definitionVersion",
          "numerator",
          "denominator",
          "value",
          "availability",
          "reason",
          "window",
          ...(declaration.selection.kind === "frequency"
            ? ["measure", "buckets"]
            : ["baselineWindow"]),
        ];
        if (
          Object.keys(result).length !== keys.length ||
          keys.some((key) => !Object.hasOwn(result, key)) ||
          result.definitionId !== declaration.definition.id ||
          result.definitionVersion !== declaration.definition.version ||
          !Number.isSafeInteger(result.numerator) ||
          !Number.isSafeInteger(result.denominator) ||
          result.numerator < 0 ||
          result.denominator < result.numerator ||
          !["complete", "provisional", "insufficient"].includes(result.availability) ||
          result.value !==
            (result.availability === "complete" && result.denominator > 0
              ? result.numerator / result.denominator
              : null)
        )
          invalid("query.output");
        return structuredClone(result);
      },
    },
    async readExecutor({ context, signal, window }) {
      signal.throwIfAborted();
      const principalScope = {
        appId: context.principal.app,
        environment: context.principal.environment,
        tenantId: context.principal.tenant,
      };
      if (
        !sameScope(principalScope, declaration.scope) ||
        declaration.sourceRevisions.some(
          (ref) =>
            !context.sourceRevisions.some(
              (actual) => actual.sourceRef === ref.sourceRef && actual.revision === ref.revision,
            ),
        )
      )
        invalid("query.scope-or-revision");
      const loaded = structuredClone(await source(context, signal));
      signal.throwIfAborted();
      const dataset = loaded.dataset;
      if (
        !dataset.sourceRef ||
        !context.snapshotRefs.includes(dataset.sourceRef) ||
        !sameScope(dataset.scope, declaration.scope) ||
        dataset.events.length > declaration.limits.maxRows ||
        new TextEncoder().encode(JSON.stringify(dataset)).length > declaration.limits.maxBytes ||
        dataset.events.some(
          (event) =>
            !definition.sourceRefs.includes(event.source) ||
            Date.parse(event.occurredAt) < Date.parse(window.from) ||
            Date.parse(event.occurredAt) >= Date.parse(window.to),
        )
      )
        invalid("query.dataset");
      const data = calculate(declaration.definition, dataset, declaration.selection);
      const first = data.baselineWindow?.from ?? data.window.from;
      if (
        Date.parse(first) < Date.parse(window.from) ||
        Date.parse(data.window.to) > Date.parse(window.to) ||
        (declaration.selection.kind === "cohort" &&
          Date.parse(window.from) > Date.parse(declaration.definition.historyStart))
      )
        invalid("query.window");
      const quality: MetricReadQuality = {
        ...loaded.quality,
        temporalCompleteness:
          data.availability === "provisional" ? "partial" : loaded.quality.temporalCompleteness,
        populationCoverage:
          data.availability === "insufficient" ? "partial" : loaded.quality.populationCoverage,
      };
      return {
        data,
        principal: context.principal,
        definition: structuredClone(definition),
        unit: definition.unit,
        population: definition.population,
        filter: declaration.selection.kind,
        fieldRefs: [...declaration.requiredFields],
        window,
        sourceRevisions: context.sourceRevisions,
        snapshotRefs: context.snapshotRefs,
        quality,
        diagnostics: data.reason ? [data.reason] : [],
        numerator: String(data.numerator),
        denominator: String(data.denominator),
        rows: dataset.events.length,
        bytes: new TextEncoder().encode(JSON.stringify(data)).length,
        cost: dataset.events.length,
      };
    },
  };
  return { definition: structuredClone(definition), query };
}
