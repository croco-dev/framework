import type {
  WarehouseAccess,
  WarehouseReader,
  WarehouseSnapshot,
} from "@croco/warehouse-core/runtime";
import {
  compareAssignedOutcomes,
  hashAssignedOutcomeDefinition,
  hashAssignedOutcomeInput,
} from "../outcome/compareAssignedOutcomes";
import {
  canonicalOutcomeJson,
  outcomeTime,
  requireOutcome,
  sameOutcomeScope,
  outcomeText,
  OUTCOME_KINDS,
} from "../outcome/OutcomeLedgerNormalizer";
import type { AssignedOutcomeInput, AssignedOutcomeReport, MoneyEvent } from "../outcome/types";
import { ASSIGNED_OUTCOME_FIELDS, parseAssignedOutcomeRow } from "./AssignedOutcomeImport";
import type {
  MetricReadBudget,
  MetricReadContext,
  MetricReadQuality,
  MetricWindow,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
} from "./MetricReadService";

export const ASSIGNED_OUTCOME_WAREHOUSE_FIELDS = ASSIGNED_OUTCOME_FIELDS.filter(
  (field) => !["app", "environment", "tenant"].includes(field),
);

export type AssignedOutcomeLoadRequest = {
  input: AssignedOutcomeInput;
  context: MetricReadContext;
  window: MetricWindow;
  signal: AbortSignal;
};
export type AssignedOutcomeLoader = (request: AssignedOutcomeLoadRequest) => Promise<{
  input: AssignedOutcomeInput;
  rows: number;
  bytes: number;
  quality?: MetricReadQuality;
}>;
const exactQuality: MetricReadQuality = {
  temporalCompleteness: "complete",
  freshness: "fresh",
  populationCoverage: "complete",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
const byteLength = (value: unknown): number =>
  new TextEncoder().encode(canonicalOutcomeJson(value)).byteLength;
function parseInput(value: unknown): AssignedOutcomeInput {
  requireOutcome(value !== null && typeof value === "object", "invalid_outcome_input");
  requireOutcome(
    "events" in value &&
      Array.isArray(value.events) &&
      "assignmentSnapshot" in value &&
      value.assignmentSnapshot !== null &&
      typeof value.assignmentSnapshot === "object",
    "invalid_outcome_input",
  );
  return structuredClone(value) as AssignedOutcomeInput;
}
function reportObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireOutcome(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "invalid_report",
  );
  requireOutcome(
    Object.keys(value).every((key) => keys.includes(key)),
    "invalid_report_field",
  );
  return value as Record<string, unknown>;
}
function reportArray(value: unknown): unknown[] {
  requireOutcome(Array.isArray(value) && value.length <= 100000, "invalid_report_array");
  return value;
}
function reportRational(value: unknown): void {
  if (value === null) return;
  const ratio = reportObject(value, ["numerator", "denominator"]);
  requireOutcome(
    typeof ratio.numerator === "string" &&
      /^-?(0|[1-9]\d*)$/.test(ratio.numerator) &&
      typeof ratio.denominator === "string" &&
      /^[1-9]\d*$/.test(ratio.denominator),
    "invalid_report_ratio",
  );
}
export function parseAssignedOutcomeReport(
  value: unknown,
  definitionHash: string,
): AssignedOutcomeReport {
  const report = reportObject(value, [
    "sources",
    "assignmentSnapshot",
    "cutoff",
    "revision",
    "metricDefinitionVersion",
    "inputHash",
    "definitionHash",
    "costCompleteness",
    "byCurrency",
    "diagnostics",
    "counts",
    "quality",
  ]);
  requireOutcome(
    report.definitionHash === definitionHash &&
      report.metricDefinitionVersion === "assigned-net-v1" &&
      typeof report.inputHash === "string" &&
      /^[a-f0-9]{64}$/.test(report.inputHash) &&
      outcomeText(report.revision),
    "invalid_report_provenance",
  );
  requireOutcome(reportArray(report.sources).every(outcomeText), "invalid_report_sources");
  const snapshot = reportObject(report.assignmentSnapshot, [
    "id",
    "scope",
    "unit",
    "arms",
    "assignments",
  ]);
  requireOutcome(outcomeText(snapshot.id) && outcomeText(snapshot.unit), "invalid_report_snapshot");
  const scope = reportObject(snapshot.scope, ["app", "environment", "tenant"]);
  requireOutcome(
    outcomeText(scope.app) && outcomeText(scope.environment) && outcomeText(scope.tenant),
    "invalid_report_scope",
  );
  const arms = reportArray(snapshot.arms);
  requireOutcome(arms.every(outcomeText), "invalid_report_arms");
  for (const item of reportArray(snapshot.assignments)) {
    const row = reportObject(item, ["subject", "arm"]);
    requireOutcome(
      outcomeText(row.subject) && typeof row.arm === "string" && arms.includes(row.arm),
      "invalid_report_assignment",
    );
  }
  const cutoff = reportObject(report.cutoff, ["effectiveAt", "knownAt"]);
  requireOutcome(
    typeof cutoff.effectiveAt === "string" && typeof cutoff.knownAt === "string",
    "invalid_report_cutoff",
  );
  outcomeTime(cutoff.effectiveAt);
  outcomeTime(cutoff.knownAt);
  for (const item of reportArray(report.costCompleteness)) {
    const cost = reportObject(item, [
      "arm",
      "source",
      "kind",
      "currency",
      "status",
      "pendingCount",
    ]);
    requireOutcome(
      typeof cost.arm === "string" &&
        arms.includes(cost.arm) &&
        outcomeText(cost.source) &&
        OUTCOME_KINDS.some((kind) => kind === cost.kind) &&
        typeof cost.currency === "string" &&
        /^[A-Z]{3}$/.test(cost.currency) &&
        ["complete", "missing", "pending"].includes(String(cost.status)) &&
        (cost.pendingCount === undefined || Number.isSafeInteger(cost.pendingCount)),
      "invalid_report_cost",
    );
  }
  for (const item of reportArray(report.byCurrency)) {
    const currency = reportObject(item, ["currency", "arms", "delta"]);
    requireOutcome(
      typeof currency.currency === "string" && /^[A-Z]{3}$/.test(currency.currency),
      "invalid_report_currency",
    );
    for (const item of reportArray(currency.arms)) {
      const arm = reportObject(item, [
        "arm",
        "assignedUnits",
        "components",
        "netMinor",
        "complete",
        "perUnit",
        "refundRate",
        "refundRateDenominator",
        "retentionRate",
        "retentionRateDenominator",
      ]);
      requireOutcome(
        typeof arm.arm === "string" &&
          arms.includes(arm.arm) &&
          typeof arm.assignedUnits === "number" &&
          Number.isSafeInteger(arm.assignedUnits) &&
          arm.assignedUnits >= 0 &&
          typeof arm.complete === "boolean" &&
          typeof arm.netMinor === "string" &&
          /^-?(0|[1-9]\d*)$/.test(arm.netMinor) &&
          arm.refundRateDenominator === "paying_assigned_subjects" &&
          arm.retentionRateDenominator === "assigned_units",
        "invalid_report_arm",
      );
      const components = reportObject(arm.components, OUTCOME_KINDS);
      requireOutcome(
        OUTCOME_KINDS.every(
          (kind) =>
            typeof components[kind] === "string" && /^(0|[1-9]\d*)$/.test(String(components[kind])),
        ),
        "invalid_report_components",
      );
      reportRational(arm.perUnit);
      reportRational(arm.refundRate);
      reportRational(arm.retentionRate);
    }
    for (const item of reportArray(currency.delta)) {
      const delta = reportObject(item, ["arm", "baselineArm", "value"]);
      requireOutcome(
        typeof delta.arm === "string" &&
          arms.includes(delta.arm) &&
          typeof delta.baselineArm === "string" &&
          arms.includes(delta.baselineArm),
        "invalid_report_delta",
      );
      reportRational(delta.value);
    }
  }
  for (const item of reportArray(report.diagnostics)) {
    const diagnostic = reportObject(item, ["code", "source", "eventId", "arm", "currency"]);
    requireOutcome(
      [
        "missing_subject",
        "unassigned_event",
        "orphan_refund",
        "zero_denominator",
        "incomplete_cost",
        "incomplete_source",
        "unknown_retention",
      ].includes(String(diagnostic.code)) && Object.values(diagnostic).every(outcomeText),
      "invalid_report_diagnostic",
    );
  }
  const counts = reportObject(report.counts, [
    "received",
    "duplicates",
    "excludedByCutoff",
    "superseded",
    "accepted",
    "rejected",
  ]);
  requireOutcome(
    Object.keys(counts).length === 6 &&
      Object.values(counts).every(
        (count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0,
      ) &&
      ["complete", "partial"].includes(String(report.quality)),
    "invalid_report_counts",
  );
  return value as AssignedOutcomeReport;
}

export async function createAssignedOutcomeQuery(options: {
  id: string;
  sourceRefs: readonly string[];
  limits: MetricReadBudget;
  load?: AssignedOutcomeLoader;
}): Promise<{ definition: RegisteredMetricDefinition; query: RegisteredMetricQuery }> {
  const hash = await hashAssignedOutcomeDefinition();
  const definition: RegisteredMetricDefinition = {
    id: `${options.id}/definition`,
    version: 1,
    hash,
    unit: "minor_units_per_assigned_unit",
    population: "frozen_assignments",
    sourceRefs: options.sourceRefs,
    description: "Observed assigned outcome amounts; separate currencies and noncash face values.",
    requiredFields: ASSIGNED_OUTCOME_FIELDS,
    requiresRaw: true,
  };
  const query: RegisteredMetricQuery = {
    id: options.id,
    version: 1,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: "explicit_assignment_snapshot",
    requiredFields: definition.requiredFields,
    requiresRaw: true,
    limits: options.limits,
    inputSchema: { parse: parseInput },
    outputSchema: { parse: (value) => parseAssignedOutcomeReport(value, hash) },
    inputKey: async (value) => {
      const parsed = parseInput(value);
      requireOutcome(/^[a-f0-9]{64}$/.test(parsed.inputHash), "invalid_input_hash");
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalOutcomeJson(parsed)),
      );
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    partialDataPolicy: "authorized",
    readExecutor: async ({ input: raw, context, signal, window }) => {
      const input = parseInput(raw);
      const loaded = options.load
        ? await options.load({ input, context, signal, window })
        : { input, rows: input.events.length, bytes: byteLength(input) };
      requireOutcome(!signal.aborted, "read_cancelled");
      requireOutcome(
        sameOutcomeScope(loaded.input.assignmentSnapshot.scope, context.principal),
        "scope_mismatch",
      );
      requireOutcome(
        outcomeTime(loaded.input.cutoff.effectiveAt) === Date.parse(window.to) - 1,
        "window_cutoff_mismatch",
      );
      requireOutcome(
        loaded.input.events.every(
          (event) => outcomeTime(event.occurredAt) >= Date.parse(window.from),
        ),
        "event_before_window",
      );
      requireOutcome(
        loaded.rows <= context.budget.maxRows &&
          loaded.bytes <= context.budget.maxBytes &&
          byteLength(loaded.input) <= context.budget.maxBytes,
        "read_budget_exceeded",
      );
      requireOutcome(
        loaded.input.definitionHash === hash &&
          loaded.input.inputHash === (await hashAssignedOutcomeInput(loaded.input)),
        "provenance_hash_mismatch",
      );
      requireOutcome(
        loaded.input.sources.length === options.sourceRefs.length &&
          loaded.input.sources.every((source) => options.sourceRefs.includes(source)),
        "source_context_mismatch",
      );
      const report = compareAssignedOutcomes(loaded.input);
      const sourceQuality = loaded.quality ?? exactQuality;
      const incompleteSource = Object.keys(exactQuality).some(
        (key) =>
          sourceQuality[key as keyof MetricReadQuality] !==
          exactQuality[key as keyof MetricReadQuality],
      );
      if (incompleteSource) {
        report.quality = "partial";
        report.diagnostics.push(
          ...loaded.input.sources.map((source) => ({ code: "incomplete_source" as const, source })),
        );
        for (const currency of report.byCurrency) {
          for (const arm of currency.arms) {
            arm.complete = false;
            arm.perUnit = null;
            arm.refundRate = null;
            arm.retentionRate = null;
          }
          for (const delta of currency.delta) delta.value = null;
        }
      }
      const quality = {
        ...sourceQuality,
        ...(report.quality === "partial" ? { populationCoverage: "partial" as const } : {}),
      };
      return {
        data: report,
        principal: context.principal,
        definition,
        unit: query.unit,
        population: query.population,
        filter: query.filter,
        fieldRefs: query.requiredFields,
        window,
        sourceRevisions: context.sourceRevisions,
        snapshotRefs: context.snapshotRefs,
        quality,
        diagnostics: [...new Set(report.diagnostics.map((item) => item.code.replaceAll("_", "-")))],
        rows: loaded.rows,
        bytes: Math.max(loaded.bytes, byteLength(report)),
        cost: loaded.rows,
      };
    },
  };
  return { definition, query };
}
export function createWarehouseAssignedOutcomeLoader(options: {
  reader: WarehouseReader;
  access: (context: MetricReadContext) => WarehouseAccess;
  snapshot: WarehouseSnapshot;
  pageSize: number;
  quality: MetricReadQuality;
}): AssignedOutcomeLoader {
  requireOutcome(
    Number.isSafeInteger(options.pageSize) && options.pageSize > 0,
    "invalid_page_size",
  );
  const snapshot = structuredClone(options.snapshot);
  const configuredQuality = structuredClone(options.quality);
  return async ({ input, context, signal, window }) => {
    requireOutcome(input.events.length === 0, "warehouse_input_events_forbidden");
    requireOutcome(
      input.inputHash === (await hashAssignedOutcomeInput(input)),
      "provenance_hash_mismatch",
    );
    requireOutcome(
      context.sourceRevisions.length > 0 &&
        context.snapshotRefs.length === context.sourceRevisions.length &&
        context.sourceRevisions.every(
          (source, index) =>
            context.snapshotRefs[index] === snapshot.id &&
            source.revision === String(snapshot.revision) &&
            snapshot.quality.sourceCoverage.some(
              (coverage) => coverage.sourceRef === source.sourceRef,
            ),
        ),
      "snapshot_context_mismatch",
    );
    const deadline = Date.now() + context.budget.maxTimeMs;
    const events: MoneyEvent[] = [];
    let bytes = 0;
    let cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      requireOutcome(!signal.aborted && Date.now() < deadline, "read_cancelled");
      const access = structuredClone(options.access(context));
      requireOutcome(
        access.scope.application === context.principal.app &&
          access.scope.environment === context.principal.environment &&
          access.scope.tenant === context.principal.tenant &&
          access.actor === context.principal.subject &&
          access.permissionEpoch === snapshot.permissionEpoch &&
          access.privacyEpoch === snapshot.privacyEpoch,
        "warehouse_access_mismatch",
      );
      requireOutcome(
        events.length < context.budget.maxRows && bytes < context.budget.maxBytes,
        "read_budget_exceeded",
      );
      const page = await options.reader.read({
        access,
        snapshotId: snapshot.id,
        cursor,
        projection: ASSIGNED_OUTCOME_WAREHOUSE_FIELDS,
        filters: [],
        order: [
          { column: "source", direction: "asc" },
          { column: "eventId", direction: "asc" },
        ],
        maxRows: Math.min(1000, options.pageSize, context.budget.maxRows - events.length),
        maxBytes: Math.min(1048576, context.budget.maxBytes - bytes),
        timeoutMs: Math.min(30000, Math.max(1, deadline - Date.now())),
        signal,
      });
      requireOutcome(
        page.snapshotId === snapshot.id &&
          page.permissionEpoch === snapshot.permissionEpoch &&
          page.privacyEpoch === snapshot.privacyEpoch &&
          page.exactness === "exact",
        "warehouse_page_mismatch",
      );
      bytes += byteLength(page.rows);
      requireOutcome(
        events.length + page.rows.length <= context.budget.maxRows &&
          bytes <= context.budget.maxBytes,
        "read_budget_exceeded",
      );
      for (const row of page.rows)
        events.push(
          parseAssignedOutcomeRow(
            {
              ...row,
              app: access.scope.application,
              environment: access.scope.environment,
              tenant: access.scope.tenant,
            },
            events.length + 1,
          ),
        );
      if (page.nextCursor !== null) {
        requireOutcome(page.rows.length > 0 && !cursors.has(page.nextCursor), "invalid_pagination");
        cursors.add(page.nextCursor);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    requireOutcome(!signal.aborted && Date.now() < deadline, "read_cancelled");
    const sourceQuality = snapshot.quality;
    const observedAt = Date.parse(sourceQuality.freshness.observedAt);
    const quality: MetricReadQuality = {
      ...configuredQuality,
      temporalCompleteness:
        sourceQuality.temporalCompleteness === "complete" &&
        Number.isFinite(observedAt) &&
        observedAt >= outcomeTime(input.cutoff.knownAt) &&
        sourceQuality.sourceCoverage.every(
          (coverage) =>
            (coverage.state === "complete" || coverage.state === "empty") &&
            coverage.gaps.length === 0 &&
            Date.parse(coverage.from) <= Date.parse(window.from) &&
            Date.parse(coverage.through) >= Date.parse(window.to) - 1,
        ) &&
        context.sourceRevisions.every((source) =>
          sourceQuality.sourceCoverage.some((coverage) => coverage.sourceRef === source.sourceRef),
        )
          ? configuredQuality.temporalCompleteness
          : "partial",
      populationCoverage:
        sourceQuality.populationCoverage === "complete"
          ? configuredQuality.populationCoverage
          : "partial",
      validity: sourceQuality.validity === "valid" ? configuredQuality.validity : "invalid",
      reproducibility:
        sourceQuality.reproducibility === "reproducible"
          ? configuredQuality.reproducibility
          : "unverified",
    };
    const materialized = { ...input, events };
    materialized.inputHash = await hashAssignedOutcomeInput(materialized);
    return { input: materialized, rows: events.length, bytes, quality };
  };
}
