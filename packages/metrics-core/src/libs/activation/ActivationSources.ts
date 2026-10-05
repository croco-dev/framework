import { decodeSource } from "@croco/etl-core/source";
import {
  ActivationValidationProblem,
  calculateActivationCandidates,
  hashActivationInputs,
} from "./ActivationCandidates";
import type { SourceSchema } from "@croco/etl-core/source";
import type { WarehouseReadRequest, WarehouseReader } from "@croco/warehouse-core/runtime";
import type {
  ActivationDefinition,
  ActivationRow,
  ActivationReport,
  ActivationCandidateResult,
} from "./ActivationCandidates";
import type {
  MetricReadContext,
  MetricReadQuality,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
} from "../read/MetricReadService";

function sameJson(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object")
    return false;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) => sameJson(value, expected[index]))
    );
  }
  const left = actual as Record<string, unknown>;
  const right = expected as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(right).every((key) => Object.hasOwn(left, key) && sameJson(left[key], right[key]))
  );
}

function parseReport(output: unknown, declaration: ActivationDefinition): ActivationReport {
  if (!output || typeof output !== "object") invalid();
  const report = output as ActivationReport;
  if (
    !sameJson(Object.keys(report).sort(), ["candidates", "definition", "rowCount"]) ||
    !sameJson(report.definition, declaration) ||
    !Number.isSafeInteger(report.rowCount) ||
    report.rowCount < 0 ||
    report.rowCount > declaration.maxRows ||
    !Array.isArray(report.candidates)
  )
    invalid();
  const template = calculateActivationCandidates([], declaration);
  if (report.candidates.length !== template.candidates.length) invalid();
  const cells: readonly ActivationCandidateResult[] = report.candidates;
  for (const [index, cell] of cells.entries()) {
    const expected = template.candidates[index];
    if (
      !cell ||
      !expected ||
      !sameJson(Object.keys(cell).sort(), Object.keys(expected).sort()) ||
      !sameJson(cell.candidate, expected.candidate) ||
      cell.cohort !== expected.cohort
    )
      invalid();
    const { eligibleN, DO, RE, NO } = cell;
    if (
      [eligibleN, DO, RE, NO].some(
        (value) => !Number.isSafeInteger(value) || value < 0 || value > report.rowCount,
      ) ||
      RE > DO ||
      DO + NO > eligibleN ||
      !cell.excluded ||
      typeof cell.excluded !== "object"
    )
      invalid();
    const excluded = cell.excluded;
    if (
      Object.keys(excluded).length !== 4 ||
      Object.keys(expected.excluded).some((key) => !Object.hasOwn(excluded, key)) ||
      Object.values(excluded).some((value) => !Number.isSafeInteger(value) || value < 0) ||
      Object.values(excluded).reduce((sum, value) => sum + value, 0) !== report.rowCount - eligibleN
    )
      invalid();
    const ratio = (numerator: number, denominator: number, reason: string) => ({
      value: denominator === 0 ? null : numerator / denominator,
      zeroDenominatorReason: denominator === 0 ? reason : null,
    });
    if (
      !sameJson(cell.support, ratio(DO, eligibleN, "noEligibleSubjects")) ||
      !sameJson(cell.precision, ratio(RE, DO, "noAchievedSubjects")) ||
      !sameJson(cell.coverage, ratio(RE, RE + NO, "noRetainedSubjects")) ||
      !sameJson(cell.noRedo, ratio(RE, NO + DO, "noAchievedOrUncapturedRetainedSubjects")) ||
      cell.passesMinSupport !== (eligibleN > 0 && DO / eligibleN >= declaration.minSupport)
    )
      invalid();
    const curve = cell.achievementCurve;
    if (!curve || typeof curve !== "object") invalid();
    if (curve.status === "unsupported") {
      if (
        !sameJson(curve, {
          status: "unsupported",
          reason: DO === 0 ? "noAchievedSubjects" : "missingVerifiedAchievementTimes",
        })
      )
        invalid();
    } else if (curve.status === "available") {
      const window = declaration.windows.find((value) => value.id === cell.candidate.windowId);
      if (
        !sameJson(curve, { status: "available", points: curve.points }) ||
        !window ||
        DO === 0 ||
        !Array.isArray(curve.points) ||
        curve.points.length === 0 ||
        curve.points.length > DO
      )
        invalid();
      let elapsed = -1;
      let achieved = 0;
      for (const point of curve.points) {
        if (
          !point ||
          !sameJson(point, {
            elapsedMs: point.elapsedMs,
            achieved: point.achieved,
            fraction: point.fraction,
          }) ||
          !Number.isSafeInteger(point.elapsedMs) ||
          point.elapsedMs < window.fromMs ||
          point.elapsedMs >= window.toMs ||
          point.elapsedMs <= elapsed ||
          !Number.isSafeInteger(point.achieved) ||
          point.achieved <= achieved ||
          point.achieved > DO ||
          point.fraction !== point.achieved / eligibleN
        )
          invalid();
        elapsed = point.elapsedMs;
        achieved = point.achieved;
      }
      if (achieved !== DO) invalid();
    } else invalid();
  }
  return report;
}

/** Column mapping only; decoding, pagination and authorization remain with their shared owners. */
export type ActivationColumnBinding = {
  readonly subjectId: string;
  readonly anchorAt: string;
  readonly cohort: string;
  readonly outcome: string;
  readonly completeThrough: string;
  readonly actionCountsByWindow: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly activeDaysByWindow: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly achievementAtByCandidate?: Readonly<Record<string, string>>;
};

function invalid(): never {
  throw new ActivationValidationProblem(
    "Activation source columns do not match the declared semantic contract",
  );
}

export function normalizeActivationRow(
  row: Readonly<Record<string, unknown>>,
  binding: ActivationColumnBinding,
  definition: ActivationDefinition,
): ActivationRow {
  const text = (field: string): string => {
    const value = row[field];
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) invalid();
      return value.toISOString();
    }
    if (typeof value !== "string" || !value.trim()) invalid();
    return value;
  };
  const counts = (fields: ActivationColumnBinding["actionCountsByWindow"]) =>
    Object.fromEntries(
      Object.entries(fields).map(([window, actions]) => [
        window,
        Object.fromEntries(
          Object.entries(actions).flatMap(([action, column]) => {
            const value = row[column];
            if (value === null) return [];
            // Native int64 values arrive as decimal strings; reject coercion, rounding and fractions.
            if (
              typeof value !== "number" &&
              (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value))
            )
              invalid();
            const number = Number(value);
            if (!Number.isSafeInteger(number) || number < 0) invalid();
            return [[action, number]];
          }),
        ),
      ]),
    );
  const cohort = text(binding.cohort);
  if (cohort !== "new" && cohort !== "returning") invalid();
  const outcome = row[binding.outcome];
  if (
    outcome !== null &&
    outcome !== true &&
    outcome !== false &&
    outcome !== "true" &&
    outcome !== "false"
  )
    invalid();
  return {
    subjectId: text(binding.subjectId),
    anchorAt: text(binding.anchorAt),
    cohort,
    outcome: outcome === null ? null : outcome === true || outcome === "true",
    completeThrough: text(binding.completeThrough),
    outcomeWindow: definition.outcomeWindow,
    actionCountsByWindow: counts(binding.actionCountsByWindow),
    activeDaysByWindow: counts(binding.activeDaysByWindow),
    ...(binding.achievementAtByCandidate
      ? {
          achievementAtByCandidate: Object.fromEntries(
            Object.entries(binding.achievementAtByCandidate).flatMap(([id, column]) =>
              row[column] === null ? [] : [[id, text(column)]],
            ),
          ),
        }
      : {}),
  };
}

export async function calculateActivationSource(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  binding: ActivationColumnBinding,
  definition: ActivationDefinition,
  signal?: AbortSignal,
): Promise<{ readonly report: ActivationReport; readonly rows: readonly ActivationRow[] }> {
  const rows: ActivationRow[] = [];
  for await (const row of source) {
    if (signal?.aborted) throw new ActivationValidationProblem("Activation read cancelled");
    if (rows.length >= definition.maxRows)
      throw new ActivationValidationProblem("Activation row budget exceeded");
    rows.push(normalizeActivationRow(row, binding, definition));
  }
  if (signal?.aborted) throw new ActivationValidationProblem("Activation read cancelled");
  return { report: calculateActivationCandidates(rows, definition), rows };
}

export function importActivationSource(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
  binding: ActivationColumnBinding,
  definition: ActivationDefinition,
  signal?: AbortSignal,
): Promise<{ readonly report: ActivationReport; readonly rows: readonly ActivationRow[] }> {
  return calculateActivationSource(decodeSource(bytes, schema), binding, definition, signal);
}

export async function* readActivationWarehouse(
  reader: WarehouseReader,
  request: Omit<WarehouseReadRequest, "cursor">,
  limits: { readonly maxRows: number; readonly maxBytes: number; readonly maxPages: number },
): AsyncIterable<Readonly<Record<string, unknown>>> {
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1)) invalid();
  let cursor: string | undefined;
  let rows = 0;
  let bytes = 0;
  const cursors = new Set<string>();
  for (let pageIndex = 0; pageIndex < limits.maxPages; pageIndex++) {
    if (request.signal?.aborted) throw new ActivationValidationProblem("Activation read cancelled");
    const page = await reader.read({ ...request, ...(cursor ? { cursor } : {}) });
    if (
      page.snapshotId !== request.snapshotId ||
      page.permissionEpoch !== request.access.permissionEpoch ||
      page.privacyEpoch !== request.access.privacyEpoch ||
      page.exactness !== "exact"
    )
      invalid();
    rows += page.rows.length;
    bytes += new TextEncoder().encode(JSON.stringify(page.rows)).length;
    if (rows > limits.maxRows || bytes > limits.maxBytes)
      throw new ActivationValidationProblem("Activation source budget exceeded");
    for (const row of page.rows) yield row;
    if (page.nextCursor === null) return;
    if (!page.rows.length || cursors.has(page.nextCursor)) invalid();
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw new ActivationValidationProblem("Activation page budget exceeded");
}

/** Register once in trusted server code and execute through MetricReadService. */
export async function registerActivationQuery(options: {
  readonly definition: ActivationDefinition;
  readonly limits: RegisteredMetricQuery["limits"];
  readonly requiredFields: readonly string[];
  readonly source: (
    context: MetricReadContext,
    signal: AbortSignal,
  ) => Promise<{ readonly rows: readonly ActivationRow[]; readonly quality: MetricReadQuality }>;
}): Promise<{
  readonly definition: RegisteredMetricDefinition;
  readonly query: RegisteredMetricQuery;
}> {
  const declaration = structuredClone(options.definition);
  const { definitionHash } = await hashActivationInputs([], declaration);
  const definition: RegisteredMetricDefinition = {
    id: declaration.id,
    version: declaration.version,
    hash: definitionHash,
    unit: declaration.unit,
    population: `${declaration.subjectKind}:${declaration.cohortPolicy}`,
    sourceRefs: Object.keys(declaration.sourceRevisions).sort(),
    description: "Activation candidate association; no causal or optimality claim",
    requiredFields: options.requiredFields,
    requiresRaw: false,
  };
  const parse = (input: unknown) => {
    if (input !== null) invalid();
    return null;
  };
  const query: RegisteredMetricQuery = {
    id: declaration.id,
    version: declaration.version,
    definitionRefs: [declaration.id],
    unit: definition.unit,
    population: definition.population,
    filter: declaration.cohortPolicy,
    requiredFields: options.requiredFields,
    requiresRaw: false,
    limits: options.limits,
    inputSchema: { parse },
    inputKey: (input) => {
      parse(input);
      return definitionHash;
    },
    outputSchema: { parse: (output) => parseReport(output, declaration) },
    async readExecutor({ context, signal, window }) {
      if (
        definition.sourceRefs.some(
          (ref) =>
            !context.sourceRevisions.some(
              (source) =>
                source.sourceRef === ref && source.revision === declaration.sourceRevisions[ref],
            ),
        )
      )
        invalid();
      const { rows, quality } = await options.source(context, signal);
      if (signal.aborted) throw new ActivationValidationProblem("Activation read cancelled");
      if (
        rows.some(
          (row) =>
            Date.parse(row.anchorAt) < Date.parse(window.from) ||
            Date.parse(row.anchorAt) >= Date.parse(window.to),
        )
      )
        invalid();
      const data = calculateActivationCandidates(rows, declaration);
      return {
        data,
        principal: context.principal,
        definition,
        unit: definition.unit,
        population: definition.population,
        filter: declaration.cohortPolicy,
        fieldRefs: options.requiredFields,
        window,
        sourceRevisions: context.sourceRevisions,
        snapshotRefs: context.snapshotRefs,
        quality,
        diagnostics: data.candidates.some(
          (cell) => cell.eligibleN < data.rowCount - cell.excluded.cohort,
        )
          ? ["activation-exclusions"]
          : [],
        rows: rows.length,
        bytes: new TextEncoder().encode(JSON.stringify(data)).length,
        cost: rows.length,
      };
    },
  };
  return { definition, query };
}
