import { decodeSource } from "@croco/etl-core/source";
import { cancellableSource, readBoundedWarehouse } from "./read/BoundedSource";
import {
  calculatePageExperience,
  hashPageExperience,
  requirePageExperience,
  validatePageExperienceRow,
} from "./PageExperience";
import type { SourceSchema } from "@croco/etl-core/source";
import type { WarehouseReader, WarehouseReadRequest } from "@croco/warehouse-core/runtime";
import type {
  PageExperienceInput,
  PageExperienceRow,
  PageExperienceReport,
} from "./PageExperience";
import type {
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  MetricReadContext,
  MetricReadQuality,
} from "./read/MetricReadService";

export const PAGE_EXPERIENCE_FIELDS = [
  "id",
  "source",
  "kind",
  "session",
  "subject",
  "pageInstance",
  "page",
  "occurredAt",
  "receivedAt",
  "value",
] as const;
/** Semantic decoding only. CSV/JSONL syntax and physical reads belong to the shared engines. */
export function normalizePageExperienceRow(
  raw: Readonly<Record<string, unknown>>,
): PageExperienceRow {
  const row = Object.fromEntries(
    PAGE_EXPERIENCE_FIELDS.map((key) => {
      const value = raw[key];
      return [key, value instanceof Date ? value.toISOString() : value];
    }),
  );
  // Reject foreign scope/PII fields rather than silently transporting them into a report.
  requirePageExperience(
    Object.keys(raw).every((key) =>
      PAGE_EXPERIENCE_FIELDS.includes(key as (typeof PAGE_EXPERIENCE_FIELDS)[number]),
    ),
    "source-fields",
  );
  return validatePageExperienceRow(row as PageExperienceRow);
}
export async function collectPageExperienceSource(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  maxRows: number,
  signal?: AbortSignal,
): Promise<PageExperienceRow[]> {
  requirePageExperience(
    Number.isSafeInteger(maxRows) && maxRows > 0 && maxRows <= 100000,
    "source-budget",
  );
  const rows: PageExperienceRow[] = [];
  for await (const row of cancellableSource(source, signal)) {
    requirePageExperience(rows.length < maxRows, "source-budget");
    rows.push(normalizePageExperienceRow(row));
  }
  return rows;
}
export function importPageExperienceSource(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
  maxRows: number,
  signal?: AbortSignal,
): Promise<PageExperienceRow[]> {
  return collectPageExperienceSource(
    decodeSource(cancellableSource(bytes, signal), schema),
    maxRows,
    signal,
  );
}
export function readPageExperienceWarehouse(
  reader: WarehouseReader,
  request: Omit<WarehouseReadRequest, "cursor">,
  limits: { maxRows: number; maxBytes: number; maxPages: number },
): Promise<PageExperienceRow[]> {
  return collectPageExperienceSource(
    readBoundedWarehouse(
      reader,
      request,
      limits,
      (detail) => requirePageExperience(false, detail) as never,
    ),
    limits.maxRows,
    request.signal,
  );
}
/** Registered server source only. MetricReadService checks current permissions/privacy before returning or caching. */
export async function registerPageExperienceQuery(options: {
  id: string;
  version: number;
  metadata: Omit<PageExperienceInput, "rows">;
  limits: RegisteredMetricQuery["limits"];
  load(
    context: MetricReadContext,
    signal: AbortSignal,
  ): Promise<{ rows: readonly PageExperienceRow[]; quality: MetricReadQuality }>;
}): Promise<{ definition: RegisteredMetricDefinition; query: RegisteredMetricQuery }> {
  const { load, ...raw } = options;
  const declaration = structuredClone(raw);
  const empty = await calculatePageExperience({ ...declaration.metadata, rows: [] });
  const metadata = declaration.metadata;
  const hash = await hashPageExperience(declaration);
  const definition: RegisteredMetricDefinition = {
    id: metadata.definition.id,
    version: metadata.definition.version,
    hash,
    unit: metadata.definition.unit,
    population: metadata.definition.page,
    sourceRefs: [metadata.sourceRef],
    description: "Page experience ordered funnel, custom engagement and confirmed outcomes",
    requiredFields: PAGE_EXPERIENCE_FIELDS,
    requiresRaw: false,
  };
  const inputSchema = {
    parse(input: unknown) {
      requirePageExperience(input === null, "query-input");
      return null;
    },
  };
  const query: RegisteredMetricQuery = {
    id: declaration.id,
    version: declaration.version,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: "page-experience",
    requiredFields: PAGE_EXPERIENCE_FIELDS,
    requiresRaw: false,
    partialDataPolicy: "authorized",
    limits: declaration.limits,
    inputSchema,
    inputKey: (input) => {
      inputSchema.parse(input);
      return hash;
    },
    outputSchema: {
      parse(output: unknown) {
        requirePageExperience(
          output && typeof output === "object" && !Array.isArray(output),
          "query-output",
        );
        const result = output as PageExperienceReport;
        const keys = Object.keys(empty);
        requirePageExperience(
          Object.keys(result).length === keys.length &&
            keys.every((key) => Object.hasOwn(result, key)),
          "query-output-fields",
        );
        for (const key of [
          "definition",
          "sourceRef",
          "sourceRevision",
          "snapshotRef",
          "definitionHash",
          "window",
          "cutoff",
          "allowedLatenessMs",
          "unit",
        ] as const)
          requirePageExperience(
            JSON.stringify(result[key]) === JSON.stringify(empty[key]),
            "query-output-context",
          );
        requirePageExperience(
          typeof result.inputHash === "string" &&
            /^[a-f0-9]{64}$/.test(result.inputHash) &&
            result.revision === result.inputHash,
          "query-output-hash",
        );
        for (const key of [
          "viewed",
          "confirmedOutcomes",
          "unlinkedCommitted",
          "completeSessions",
          "openSessions",
          "unknownSessions",
          "lateRows",
        ] as const)
          requirePageExperience(
            Number.isSafeInteger(result[key]) && result[key] >= 0,
            "query-output-count",
          );
        for (const key of ["engaged", "attempted", "committed", "bounce"] as const) {
          const ratio = result[key];
          requirePageExperience(
            ratio &&
              Object.keys(ratio).length === 4 &&
              Number.isSafeInteger(ratio.numerator) &&
              Number.isSafeInteger(ratio.denominator) &&
              ratio.numerator >= 0 &&
              ratio.denominator >= ratio.numerator &&
              ratio.denominator === result.viewed &&
              Number.isSafeInteger(ratio.unobserved) &&
              ratio.unobserved >= 0 &&
              ratio.unobserved + ratio.numerator <= ratio.denominator &&
              ratio.value ===
                (ratio.denominator && !ratio.unobserved
                  ? ratio.numerator / ratio.denominator
                  : null),
            "query-output-ratio",
          );
          if (key !== "bounce")
            requirePageExperience(ratio.denominator === result.viewed, "query-output-denominator");
        }
        requirePageExperience(
          result.engaged.numerator >= result.attempted.numerator &&
            result.attempted.numerator >= result.committed.numerator &&
            result.confirmedOutcomes >= result.committed.numerator &&
            result.confirmedOutcomes >= result.unlinkedCommitted,
          "query-output-order",
        );
        requirePageExperience(
          ["complete", "partial", "unknown"].includes(result.coverage) &&
            Array.isArray(result.diagnostics) &&
            result.diagnostics.every((code) =>
              ["open-sessions", "incomplete-coverage", "late-rows-excluded"].includes(code),
            ),
          "query-output-quality",
        );
        return structuredClone(result);
      },
    },
    async readExecutor({ context, window, signal }) {
      requirePageExperience(
        context.principal.app === metadata.scope.app &&
          context.principal.environment === metadata.scope.environment &&
          context.principal.tenant === metadata.scope.tenant,
        "query-scope",
      );
      requirePageExperience(
        window.from === metadata.window.from && window.to === metadata.window.to,
        "query-window",
      );
      requirePageExperience(
        context.snapshotRefs.length === 1 &&
          context.snapshotRefs[0] === metadata.snapshotRef &&
          context.sourceRevisions.length === 1 &&
          context.sourceRevisions[0]?.sourceRef === metadata.sourceRef &&
          context.sourceRevisions[0]?.revision === metadata.sourceRevision,
        "query-snapshot",
      );
      signal.throwIfAborted();
      const loaded = structuredClone(await load(context, signal));
      signal.throwIfAborted();
      const bytes = new TextEncoder().encode(JSON.stringify(loaded.rows)).length;
      requirePageExperience(
        loaded.rows.length <= declaration.limits.maxRows && bytes <= declaration.limits.maxBytes,
        "query-budget",
      );
      const sourceComplete =
        loaded.quality.temporalCompleteness === "complete" &&
        loaded.quality.populationCoverage === "complete";
      const data = await calculatePageExperience({
        ...metadata,
        coverage: sourceComplete ? metadata.coverage : "partial",
        rows: loaded.rows,
      });
      return {
        data,
        principal: context.principal,
        definition,
        unit: definition.unit,
        population: definition.population,
        filter: "page-experience",
        fieldRefs: PAGE_EXPERIENCE_FIELDS,
        window,
        sourceRevisions: context.sourceRevisions,
        snapshotRefs: context.snapshotRefs,
        quality: {
          ...loaded.quality,
          temporalCompleteness:
            data.openSessions || data.unknownSessions
              ? "partial"
              : loaded.quality.temporalCompleteness,
        },
        diagnostics: data.diagnostics,
        rows: loaded.rows.length,
        bytes: Math.max(bytes, new TextEncoder().encode(JSON.stringify(data)).length),
        cost: loaded.rows.length,
      };
    },
  };
  return { definition, query };
}
