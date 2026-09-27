import {
  computePeriodicRetention,
  computeCohortRetention,
  computeFrequencyDistribution,
} from "@croco/metrics-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  BehaviorDefinition,
  BehaviorDataset,
  BehaviorScope,
  BehaviorRetentionOptions,
  BehaviorFrequencyOptions,
  BehaviorMetricResult,
  BehaviorSubjectMembership,
  BehaviorFrequencyResult,
  BehaviorWindow,
} from "@croco/metrics-core";

export type RetentionMetricSelection =
  | { id: string; kind: "periodic" | "cohort"; options: BehaviorRetentionOptions }
  | { id: string; kind: "frequency"; options: BehaviorFrequencyOptions };
export type RetentionWorkbenchRequest = {
  definitionId: string;
  definitionVersion: string;
  scope: BehaviorScope;
  subjectKind: string;
  selections: readonly RetentionMetricSelection[];
  savedViewId?: string;
};
export type RetentionMetricCard = Omit<BehaviorMetricResult, "subjects" | "sourceRefs"> & {
  id: string;
  kind: RetentionMetricSelection["kind"];
  sources: readonly string[];
  baselineWindow?: { from: string; to: string };
  buckets?: BehaviorFrequencyResult["buckets"];
  measure?: BehaviorFrequencyResult["measure"];
};
export type RetentionWorkbenchSnapshot = {
  inputToken: string;
  definition: BehaviorDefinition;
  scope: BehaviorScope;
  completeThrough: string | null;
  knownHistoryFrom: string | null;
  cards: readonly RetentionMetricCard[];
};
export type RetentionWorkbenchState =
  | { kind: "loading" }
  | { kind: "denied"; code: string }
  | { kind: "error"; code: string }
  | {
      kind: "empty" | "provisional" | "insufficient" | "ready";
      snapshot: RetentionWorkbenchSnapshot;
    };
export type RetentionDrilldownRow = Omit<BehaviorSubjectMembership, "subjectId"> & {
  subjectLabel: string;
};
export type RetentionDrilldownPage = {
  inputToken: string;
  selectionId: string;
  rows: readonly RetentionDrilldownRow[];
  offset: number;
  nextOffset: number | null;
  total: number;
};
export type RetentionPermission =
  | "retention:read"
  | "retention:drilldown"
  | "retention:saved-view:read";
export interface RetentionWorkbenchAdapter {
  authorize(input: {
    scope: BehaviorScope;
    subjectKind: string;
    permission: RetentionPermission;
    savedViewId?: string;
  }): Promise<boolean>;
  /** Return a stable opaque reference or masked display label; never raw PII. Called only after drilldown authorization. */
  subjectLabel(input: {
    scope: BehaviorScope;
    subjectKind: string;
    subjectId: string;
  }): Promise<string>;
  /** Fetch at most limit normalized observations; never silently truncate a complete dataset. */
  read(input: {
    definition: BehaviorDefinition;
    scope: BehaviorScope;
    limit: number;
  }): Promise<BehaviorDataset>;
}
const RETENTION_PROBLEMS = {
  "invalid-request": {
    code: "admin-core/retention-invalid-request",
    category: ProblemCategory.ValidationError,
  },
  denied: { code: "admin-core/retention-denied", category: ProblemCategory.Forbidden },
  "row-limit": {
    code: "admin-core/retention-row-limit",
    category: ProblemCategory.ValidationError,
  },
  "scope-mismatch": {
    code: "admin-core/retention-scope-mismatch",
    category: ProblemCategory.ValidationError,
  },
  "invalid-dataset": {
    code: "admin-core/retention-invalid-dataset",
    category: ProblemCategory.ValidationError,
  },
  "stale-input": {
    code: "admin-core/retention-stale-input",
    category: ProblemCategory.ValidationError,
  },
  "source-failed": {
    code: "admin-core/retention-source-failed",
    category: ProblemCategory.InternalServerError,
  },
} as const;
export class RetentionWorkbenchProblem extends Problem {
  constructor(
    readonly reason:
      | "invalid-request"
      | "denied"
      | "row-limit"
      | "scope-mismatch"
      | "invalid-dataset"
      | "stale-input",
  ) {
    super(
      RETENTION_PROBLEMS[reason].code,
      RETENTION_PROBLEMS[reason].category,
      `Retention workbench: ${reason}`,
    );
  }
}
function assertRequest(condition: boolean): asserts condition {
  if (!condition) throw new RetentionWorkbenchProblem("invalid-request");
}
function windowIdentity(window: BehaviorWindow) {
  return window.kind === "calendar"
    ? [window.kind, window.from, window.to]
    : [window.kind, window.anchor, window.durationMs, window.index];
}
async function inputIdentity(
  definition: BehaviorDefinition,
  dataset: BehaviorDataset,
  request: RetentionWorkbenchRequest,
): Promise<string> {
  const scope = (value: BehaviorScope) => [value.appId, value.environment, value.tenantId];
  const payload = JSON.stringify([
    [
      definition.id,
      definition.version,
      definition.subjectKind,
      definition.timezone,
      [...definition.actions].sort(),
      definition.deletedSubjectPolicy,
      definition.historyStart,
    ],
    [
      scope(request.scope),
      request.subjectKind,
      request.savedViewId ?? null,
      request.selections.map((selection) => [
        selection.id,
        selection.kind,
        selection.kind === "frequency"
          ? [windowIdentity(selection.options.window), selection.options.measure]
          : [
              windowIdentity(selection.options.baseline),
              windowIdentity(selection.options.returning),
            ],
      ]),
    ],
    [
      dataset.definitionId,
      dataset.version,
      dataset.subjectKind,
      dataset.timezone,
      scope(dataset.scope),
      dataset.completeThrough ?? null,
      dataset.knownHistoryFrom ?? null,
      [...(dataset.deletedSubjectIds ?? [])].sort(),
      dataset.events
        .map((event) =>
          JSON.stringify([
            event.subjectId,
            event.source,
            event.eventId,
            event.occurredAt,
            event.action,
            scope(event.scope),
          ]),
        )
        .sort(),
    ],
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** Server-side execution over bounded normalized observations. Keep the adapter on the server. */
export function createRetentionWorkbenchSource(input: {
  definitions: readonly BehaviorDefinition[];
  adapter: RetentionWorkbenchAdapter;
  maxEvents: number;
  maxPageSize: number;
}) {
  assertRequest(
    Number.isSafeInteger(input.maxEvents) &&
      input.maxEvents > 0 &&
      Number.isSafeInteger(input.maxPageSize) &&
      input.maxPageSize > 0,
  );
  const definitions = input.definitions.map((definition) => ({
    ...definition,
    actions: [...definition.actions],
  }));
  assertRequest(
    new Set(definitions.map((definition) => JSON.stringify([definition.id, definition.version])))
      .size === definitions.length,
  );
  async function calculate(request: RetentionWorkbenchRequest, drilldown: boolean) {
    request = structuredClone(request);
    assertRequest(
      request != null &&
        request.scope != null &&
        [
          request.scope.appId,
          request.scope.environment,
          request.scope.tenantId,
          request.subjectKind,
        ].every((value) => typeof value === "string" && value.trim().length > 0),
    );
    assertRequest(
      Array.isArray(request.selections) &&
        request.selections.length > 0 &&
        request.selections.length <= 100 &&
        request.selections.every(
          (selection) =>
            selection != null &&
            typeof selection.id === "string" &&
            selection.id.trim().length > 0 &&
            ["periodic", "cohort", "frequency"].includes(selection.kind),
        ) &&
        new Set(request.selections.map((selection) => selection.id)).size ===
          request.selections.length,
    );
    assertRequest(
      request.savedViewId === undefined ||
        (typeof request.savedViewId === "string" && request.savedViewId.trim().length > 0),
    );
    const definition = definitions.find(
      (item) =>
        item.id === request.definitionId &&
        item.version === request.definitionVersion &&
        item.subjectKind === request.subjectKind,
    );
    assertRequest(definition !== undefined);
    const permissions: RetentionPermission[] = ["retention:read"];
    if (drilldown) permissions.push("retention:drilldown");
    if (request.savedViewId !== undefined) permissions.push("retention:saved-view:read");
    for (const permission of permissions) {
      if (
        !(await input.adapter.authorize({
          scope: request.scope,
          subjectKind: request.subjectKind,
          permission,
          savedViewId: request.savedViewId,
        }))
      )
        throw new RetentionWorkbenchProblem("denied");
    }
    const dataset = structuredClone(
      await input.adapter.read({
        definition,
        scope: request.scope,
        limit: input.maxEvents + 1,
      }),
    );
    if (dataset == null || !Array.isArray(dataset.events) || dataset.scope == null)
      throw new RetentionWorkbenchProblem("invalid-dataset");
    if (dataset.events.length > input.maxEvents) throw new RetentionWorkbenchProblem("row-limit");
    if (
      dataset.scope.appId !== request.scope.appId ||
      dataset.scope.environment !== request.scope.environment ||
      dataset.scope.tenantId !== request.scope.tenantId
    )
      throw new RetentionWorkbenchProblem("scope-mismatch");
    const results = request.selections.map((selection) => ({
      selection,
      result:
        selection.kind === "frequency"
          ? computeFrequencyDistribution(definition, dataset, selection.options)
          : selection.kind === "cohort"
            ? computeCohortRetention(definition, dataset, selection.options)
            : computePeriodicRetention(definition, dataset, selection.options),
    }));
    return {
      definition,
      dataset,
      results,
      inputToken: await inputIdentity(definition, dataset, request),
    };
  }
  return {
    async load(request: RetentionWorkbenchRequest): Promise<RetentionWorkbenchState> {
      try {
        const { definition, dataset, results, inputToken } = await calculate(request, false);
        const cards: RetentionMetricCard[] = results.map(({ selection, result }) => {
          const { subjects: _subjects, sourceRefs, ...aggregate } = result;
          return {
            ...aggregate,
            id: selection.id,
            kind: selection.kind,
            sources: [...new Set(sourceRefs.map((ref) => ref.source))],
          };
        });
        const snapshot: RetentionWorkbenchSnapshot = {
          inputToken,
          definition: { ...definition, actions: [...definition.actions] },
          scope: { ...dataset.scope },
          completeThrough: dataset.completeThrough ?? null,
          knownHistoryFrom: dataset.knownHistoryFrom ?? null,
          cards,
        };
        const kind = cards.some((card) => card.availability === "insufficient")
          ? "insufficient"
          : cards.some((card) => card.availability === "provisional")
            ? "provisional"
            : cards.every((card) => card.denominator === 0)
              ? "empty"
              : "ready";
        return { kind, snapshot };
      } catch (error) {
        if (error instanceof RetentionWorkbenchProblem && error.reason === "denied")
          return { kind: "denied", code: RETENTION_PROBLEMS.denied.code };
        return {
          kind: "error",
          code: error instanceof Problem ? error.code : RETENTION_PROBLEMS["source-failed"].code,
        };
      }
    },
    async drilldown(
      request: RetentionWorkbenchRequest,
      page: { selectionId: string; offset: number; limit: number; inputToken: string },
    ): Promise<RetentionDrilldownPage> {
      request = structuredClone(request);
      page = structuredClone(page);
      assertRequest(request != null && Array.isArray(request.selections) && page != null);
      assertRequest(
        typeof page.inputToken === "string" &&
          /^[a-f0-9]{64}$/.test(page.inputToken) &&
          Number.isSafeInteger(page.offset) &&
          page.offset >= 0 &&
          Number.isSafeInteger(page.limit) &&
          page.limit > 0 &&
          page.limit <= input.maxPageSize &&
          request.selections.some(
            (selection) => selection != null && selection.id === page.selectionId,
          ),
      );
      const { results, inputToken } = await calculate(request, true);
      if (inputToken !== page.inputToken) throw new RetentionWorkbenchProblem("stale-input");
      const selected = results.find(({ selection }) => selection.id === page.selectionId);
      assertRequest(selected !== undefined);
      const subjects = selected.result.subjects;
      const rows = await Promise.all(
        subjects
          .slice(page.offset, page.offset + page.limit)
          .map(async ({ subjectId, ...membership }) => {
            const subjectLabel = await input.adapter.subjectLabel({
              scope: request.scope,
              subjectKind: request.subjectKind,
              subjectId,
            });
            assertRequest(typeof subjectLabel === "string" && subjectLabel.trim().length > 0);
            return { ...membership, subjectLabel };
          }),
      );
      return {
        selectionId: page.selectionId,
        inputToken,
        rows,
        offset: page.offset,
        nextOffset: page.offset + rows.length < subjects.length ? page.offset + rows.length : null,
        total: subjects.length,
      };
    },
  };
}
