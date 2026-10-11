import { Problem, ProblemCategory } from "@croco/problems-core";
import { summarizeExperiment } from "@croco/metrics-core";
import type {
  ExperimentConditionalAggregate,
  ExperimentDatasetInput,
  ExperimentSrm,
  ExperimentVariantAggregate,
  QualityCheck,
} from "@croco/metrics-core";

import type { AdminProblemContract } from "./types";

export const EXPERIMENT_REVIEW_READ_PERMISSION = "experiments:read";
export const EXPERIMENT_REVIEW_REPORT_PERMISSION = "experiments:report";
export const EXPERIMENT_REVIEW_PII_PERMISSION = "experiments:read:pii";

const EXPERIMENT_UNIT_PAGE_SIZE = 50;

/** Reports an RFC 7807 validation failure in the experiment review console. */
export class ExperimentReviewConsoleValidationProblem extends Problem {
  constructor(field: string, reason: string, evidence: Readonly<Record<string, unknown>> = {}) {
    super(
      "admin-core/experiment-review-console-validation-failed",
      ProblemCategory.ValidationError,
      `Experiment review console ${field} is invalid: ${reason}.`,
      { extensions: { field, ...evidence } },
    );
  }
}

export type ExperimentReviewConsoleScope = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId: string | null;
};

export type ExperimentReviewPlanView = {
  readonly experimentId: string;
  readonly revision: string;
  readonly primaryMetricId: string;
  readonly randomizationUnit: "unit" | "cluster";
  readonly outcomeKind: "binary" | "mean";
  readonly observedWindow: { readonly from: string; readonly to: string };
  readonly method: string;
};

export type ExperimentReviewVariantView = {
  readonly variantId: string;
  readonly assigned: number;
  readonly exposed: number;
  readonly n: number;
  readonly estimate: number;
  readonly availability: "complete" | "partial";
  readonly funnel: {
    readonly assigned: number;
    readonly exposed: number;
    readonly actioned: number;
    readonly outcomeObserved: number;
  };
};

export type ExperimentReviewConditionalView = {
  readonly variantId: string;
  readonly exposed: number;
  readonly nExposed: number;
  readonly estimate: number;
  readonly availability: "complete" | "partial";
};

export type ExperimentReviewSrmView = {
  readonly status: "pass_signal" | "warning" | "not_assessed";
  readonly reason: string;
  readonly chiSquare?: number;
  readonly degreesOfFreedom?: number;
  readonly pValue?: number;
  readonly threshold: number;
  readonly plannedCounts: Readonly<Record<string, number>>;
  readonly actualCounts: Readonly<Record<string, number>>;
};

export type ExperimentReviewSliceCellView = {
  readonly variantId: string;
  readonly attribute: string;
  readonly attributeValue: string;
  readonly assigned: number;
  readonly n: number;
  readonly estimate: number;
};

export type ExperimentReviewSliceView = {
  readonly attribute: string;
  readonly cells: readonly ExperimentReviewSliceCellView[];
};

export type ExperimentReviewQualityView = {
  readonly kind: string;
  readonly result: "pass_signal" | "warning" | "not_assessed";
  readonly evidence: string;
  readonly limitations: string;
};

export type ExperimentReviewUnitView = {
  readonly maskedId: string;
  readonly variantId: string;
  readonly exposed: boolean;
};

export type ExperimentReviewUnitPage = {
  readonly units: readonly ExperimentReviewUnitView[];
  readonly nextCursor: string | null;
  readonly total: number;
};

export type ExperimentReviewProviderNote = {
  readonly results?: Readonly<
    Record<string, { readonly n: number; readonly estimate: number; readonly method: string }>
  >;
  readonly error?: string;
};

export type ExperimentReviewSnapshot = {
  readonly scope: ExperimentReviewConsoleScope;
  readonly generatedAt: Date;
  readonly planHash?: string;
  readonly sourceRef?: string;
  readonly plan: ExperimentReviewPlanView;
  readonly denominatorNote: string;
  readonly quality: readonly ExperimentReviewQualityView[];
  readonly variants: readonly ExperimentReviewVariantView[];
  readonly conditional: readonly ExperimentReviewConditionalView[];
  readonly slices?: ExperimentReviewSliceView;
  readonly srm: ExperimentReviewSrmView;
  readonly leakageNote?: string;
  readonly balanceNote?: string;
  readonly methodNote?: string;
  readonly providerNote?: ExperimentReviewProviderNote;
  readonly maskedUnits?: readonly string[];
  readonly unitPage: ExperimentReviewUnitPage;
};

export type ExperimentReviewSourceResult =
  | { readonly kind: "empty"; readonly message?: string }
  | {
      readonly kind: "ready";
      readonly dataset: ExperimentDatasetInput;
      readonly generatedAt: Date;
      readonly planHash?: string;
      readonly sourceRef?: string;
      readonly sliceAttribute?: string;
    }
  | {
      readonly kind: "problem";
      readonly problem: AdminProblemContract;
      readonly partial?: {
        readonly dataset: ExperimentDatasetInput;
        readonly generatedAt: Date;
        readonly planHash?: string;
        readonly sourceRef?: string;
        readonly sliceAttribute?: string;
      };
    };

export interface ExperimentReviewSource {
  readonly requiredPermissions: readonly string[];
  load(input: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId: string;
    readonly signal?: AbortSignal;
  }): Promise<ExperimentReviewSourceResult>;
}

export type ExperimentReviewConsoleState =
  | {
      readonly kind: "loading";
      readonly appId: string;
      readonly environment: string;
    }
  | {
      readonly kind: "empty";
      readonly appId: string;
      readonly environment: string;
      readonly message?: string;
    }
  | {
      readonly kind: "tenant-required";
      readonly appId: string;
      readonly environment: string;
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "permission-denied";
      readonly appId: string;
      readonly environment: string;
      readonly requiredPermissions: readonly string[];
      readonly grantedPermissions: readonly string[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly appId: string;
      readonly environment: string;
      readonly problem: AdminProblemContract;
      readonly partial?: ExperimentReviewReadyState;
    }
  | ExperimentReviewReadyState;

export type ExperimentReviewReadyState = {
  readonly kind: "ready";
  readonly snapshot: ExperimentReviewSnapshot;
  readonly grantedPermissions: readonly string[];
  readonly actions: readonly ExperimentReviewAction[];
};

export type ExperimentReviewActionKind = "generate-report";

export type ExperimentReviewAction = {
  readonly kind: ExperimentReviewActionKind;
  readonly targetId: string;
  readonly scope: ExperimentReviewConsoleScope;
  readonly permission: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditEvent: string;
  readonly possibleProblems: readonly string[];
};

export function maskExperimentUnitId(unitId: string): string {
  const trimmed = unitId.trim();
  if (trimmed.length <= 4) return "***";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

export function createExperimentReviewLoadingState(input: {
  readonly appId: string;
  readonly environment: string;
}): ExperimentReviewConsoleState {
  return { kind: "loading", ...input };
}

export function createExperimentReviewTenantRequiredState(input: {
  readonly appId: string;
  readonly environment: string;
}): ExperimentReviewConsoleState {
  return {
    kind: "tenant-required",
    appId: input.appId,
    environment: input.environment,
    problem: {
      code: "admin-core/experiment-review-tenant-required",
      status: 400,
      title: "Experiment review tenant required",
      detail:
        "Select a tenant before loading experiment review data. Tenant omission never loads global data.",
    },
  };
}

function toProblemContract(caught: unknown, fallbackCode: string): AdminProblemContract {
  if (caught instanceof Problem) {
    // Validation messages may embed raw unit/variant ids (failInput detail).
    // PII permission is not checked on this path, so never surface them to clients.
    return {
      code: caught.code,
      status: 422,
      title: "Experiment review unavailable",
      detail: "The experiment review input failed validation.",
    };
  }
  return {
    code: fallbackCode,
    status: 422,
    title: "Experiment review unavailable",
    detail: "The experiment review input failed validation.",
  };
}

export async function loadExperimentReviewConsole(input: {
  readonly source: ExperimentReviewSource;
  readonly appId: string;
  readonly environment: string;
  readonly tenantId?: string | null;
  readonly grantedPermissions: readonly string[];
  readonly signal?: AbortSignal;
}): Promise<ExperimentReviewConsoleState> {
  if (input.tenantId === undefined || input.tenantId === null || input.tenantId.trim() === "") {
    return createExperimentReviewTenantRequiredState({
      appId: input.appId,
      environment: input.environment,
    });
  }
  const missing = input.source.requiredPermissions.filter(
    (permission) => !input.grantedPermissions.includes(permission),
  );
  if (missing.length > 0) {
    return {
      kind: "permission-denied",
      appId: input.appId,
      environment: input.environment,
      requiredPermissions: input.source.requiredPermissions,
      grantedPermissions: input.grantedPermissions,
      problem: {
        code: "admin-core/experiment-review-permission-denied",
        status: 403,
        title: "Experiment review permission denied",
        detail: `Missing permissions: ${missing.join(", ")}`,
      },
    };
  }
  let result: ExperimentReviewSourceResult;
  try {
    result = await input.source.load({
      appId: input.appId,
      environment: input.environment,
      tenantId: input.tenantId,
      signal: input.signal,
    });
  } catch (caught) {
    if (input.signal?.aborted) {
      throw input.signal.reason ?? caught;
    }
    return {
      kind: "problem",
      appId: input.appId,
      environment: input.environment,
      problem: {
        code: "admin-core/experiment-review-source-failed",
        status: 503,
        title: "Experiment review unavailable",
        detail: "The experiment review source failed. Inspect server-side provider evidence.",
        retryable: true,
      },
    };
  }
  if (result.kind === "empty") {
    return {
      kind: "empty",
      appId: input.appId,
      environment: input.environment,
      message: result.message,
    };
  }
  if (result.kind === "problem") {
    let partial: ExperimentReviewReadyState | undefined;
    if (result.partial !== undefined) {
      try {
        partial = summarizeIntoReadyState(result.partial, input, undefined);
      } catch {
        partial = undefined;
      }
    }
    return {
      kind: "problem",
      appId: input.appId,
      environment: input.environment,
      problem: result.problem,
      partial,
    };
  }
  try {
    return summarizeIntoReadyState(result, input, undefined);
  } catch (caught) {
    return {
      kind: "problem",
      appId: input.appId,
      environment: input.environment,
      problem: toProblemContract(caught, "admin-core/experiment-review-invalid"),
    };
  }
}

function summarizeIntoReadyState(
  ready: {
    readonly dataset: ExperimentDatasetInput;
    readonly generatedAt: Date;
    readonly planHash?: string;
    readonly sourceRef?: string;
    readonly sliceAttribute?: string;
  },
  input: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId?: string | null;
    readonly grantedPermissions: readonly string[];
  },
  cursor: string | undefined,
): ExperimentReviewReadyState {
  const review = summarizeExperiment({
    ...ready.dataset,
    ...(ready.sliceAttribute === undefined ? {} : { sliceAttribute: ready.sliceAttribute }),
  });
  const scope: ExperimentReviewConsoleScope = {
    appId: input.appId,
    environment: input.environment,
    tenantId: input.tenantId ?? null,
  };
  const variants = review.plan.variants.map((variant) => {
    const aggregate: ExperimentVariantAggregate | undefined = review.primary[variant.id];
    const funnel = review.funnel[variant.id] ?? {
      assigned: 0,
      exposed: 0,
      actioned: 0,
      outcomeObserved: 0,
    };
    return {
      variantId: variant.id,
      assigned: aggregate?.assigned ?? 0,
      exposed: aggregate?.exposed ?? 0,
      n: aggregate?.n ?? 0,
      estimate: aggregate?.estimate ?? 0,
      availability: aggregate?.availability ?? "complete",
      funnel: { ...funnel },
    } satisfies ExperimentReviewVariantView;
  });
  const conditional = review.plan.variants.map((variant) => {
    const aggregate: ExperimentConditionalAggregate | undefined = review.conditional[variant.id];
    return {
      variantId: variant.id,
      exposed: aggregate?.exposed ?? 0,
      nExposed: aggregate?.nExposed ?? 0,
      estimate: aggregate?.estimate ?? 0,
      availability: aggregate?.availability ?? "complete",
    } satisfies ExperimentReviewConditionalView;
  });
  const srm: ExperimentReviewSrmView = toSrmView(review.srm, review.plan.srmWarningThreshold);
  const quality: readonly ExperimentReviewQualityView[] = review.quality.map(
    (check: QualityCheck) => ({
      kind: check.kind,
      result: check.result,
      evidence: check.evidence,
      limitations: check.limitations,
    }),
  );
  const leakage = review.quality.find((check) => check.kind === "leakage");
  const method = review.quality.find((check) => check.kind === "method");
  const balance = review.quality.filter((check) => check.kind.startsWith("balance:"));
  const providerNote: ExperimentReviewProviderNote | undefined =
    review.provider === undefined
      ? undefined
      : {
          ...(review.provider.results === undefined
            ? {}
            : {
                results: Object.fromEntries(
                  Object.entries(review.provider.results).map(([variantId, result]) => [
                    variantId,
                    { n: result.n, estimate: result.estimate, method: result.method },
                  ]),
                ),
              }),
          ...(review.provider.error === undefined ? {} : { error: review.provider.error }),
        };
  const snapshot: ExperimentReviewSnapshot = {
    scope,
    generatedAt: new Date(ready.generatedAt.getTime()),
    ...(ready.planHash === undefined ? {} : { planHash: ready.planHash }),
    ...(ready.sourceRef === undefined ? {} : { sourceRef: ready.sourceRef }),
    plan: {
      experimentId: review.plan.experimentId,
      revision: review.plan.revision,
      primaryMetricId: review.plan.primaryMetricId,
      randomizationUnit: review.plan.randomizationUnit,
      outcomeKind: review.plan.outcomeKind,
      observedWindow: { ...review.plan.observedWindow },
      method: review.plan.method ?? "local",
    },
    denominatorNote: "primary n = randomized denominator",
    quality,
    variants,
    conditional,
    ...(review.slices === undefined
      ? {}
      : {
          slices: {
            attribute: review.slices.attribute,
            cells: Object.values(review.slices.cells).map((cell) => ({ ...cell })),
          },
        }),
    srm,
    ...(leakage === undefined ? {} : { leakageNote: leakage.evidence }),
    ...(balance.length === 0
      ? {}
      : { balanceNote: balance.map((check) => `${check.kind}: ${check.evidence}`).join(" | ") }),
    ...(method === undefined ? {} : { methodNote: method.evidence }),
    ...(providerNote === undefined ? {} : { providerNote }),
    maskedUnits: ready.dataset.assignments
      .slice(0, EXPERIMENT_UNIT_PAGE_SIZE)
      .map((row) => maskExperimentUnitId(row.unitId)),
    unitPage: createExperimentReviewUnitPage(ready.dataset, cursor),
  };
  return createExperimentReviewReadyState(snapshot, input.grantedPermissions);
}

function toSrmView(srm: ExperimentSrm, threshold: number): ExperimentReviewSrmView {
  return {
    status: srm.status,
    reason: srm.reason,
    ...(srm.detail === undefined
      ? {}
      : {
          chiSquare: srm.detail.chiSquare,
          degreesOfFreedom: srm.detail.degreesOfFreedom,
          pValue: srm.detail.pValue,
        }),
    threshold,
    plannedCounts: srm.detail?.plannedCounts ?? {},
    actualCounts: srm.detail?.actualCounts ?? {},
  };
}

export function createExperimentReviewUnitPage(
  dataset: ExperimentDatasetInput,
  cursor?: string,
): ExperimentReviewUnitPage {
  const offset = parseCursor(cursor);
  const exposureByUnit = new Map(
    dataset.exposures.map((exposure) => [exposure.unitId, exposure.exposed]),
  );
  const rows = dataset.assignments.slice(offset, offset + EXPERIMENT_UNIT_PAGE_SIZE);
  const units = rows.map((row) => ({
    maskedId: maskExperimentUnitId(row.unitId),
    variantId: row.variantId,
    exposed: exposureByUnit.get(row.unitId) === true,
  }));
  const nextOffset = offset + rows.length;
  return {
    units,
    nextCursor: nextOffset < dataset.assignments.length ? String(nextOffset) : null,
    total: dataset.assignments.length,
  };
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined || cursor.trim() === "") return 0;
  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ExperimentReviewConsoleValidationProblem(
      "cursor",
      "a non-negative integer offset is required",
      {
        cursor,
      },
    );
  }
  return parsed;
}

export function createExperimentReviewReadyState(
  snapshot: ExperimentReviewSnapshot,
  grantedPermissions: readonly string[],
): ExperimentReviewReadyState {
  return {
    kind: "ready",
    snapshot,
    grantedPermissions,
    actions: createExperimentReviewActions(snapshot, grantedPermissions),
  };
}

export function createExperimentReviewActions(
  snapshot: ExperimentReviewSnapshot,
  grantedPermissions: readonly string[],
): readonly ExperimentReviewAction[] {
  // No declare-winner action: the console surfaces quality signals only and
  // leaves rollout decisions to an explicit operator workflow outside v1.
  const allowed = grantedPermissions.includes(EXPERIMENT_REVIEW_REPORT_PERMISSION);
  return [
    {
      kind: "generate-report",
      targetId: `${snapshot.plan.experimentId}@${snapshot.plan.revision}`,
      scope: snapshot.scope,
      permission: EXPERIMENT_REVIEW_REPORT_PERMISSION,
      allowed,
      reason: allowed
        ? "Export the reviewed snapshot with quality signals for operator follow-up"
        : `Missing ${EXPERIMENT_REVIEW_REPORT_PERMISSION} permission`,
      auditEvent: "experiments.admin.generate-report",
      possibleProblems: [
        "metrics-core/experiment-plan-invalid",
        "metrics-core/experiment-input-invalid",
        "admin-core/experiment-review-source-failed",
      ],
    },
  ];
}
