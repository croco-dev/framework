import { Problem, ProblemCategory } from "@croco/problems-core";
import { registerOfferPolicy } from "@croco/promotions-core";
import type {
  OfferClaim,
  OfferClaimState,
  OfferSubject,
  RegisteredOfferPolicy,
  RegisterOfferPolicyInput,
} from "@croco/promotions-core";

import type { AdminProblemContract } from "./types";

export type OfferConsoleClaimState = OfferClaimState | "exposed";

export type OfferConsoleSubjectView = {
  readonly kind: string;
  readonly id: string;
  readonly maskedId: string;
  readonly tenantId: string;
  readonly appId: string;
  readonly environment: string;
};

export type OfferConsolePolicyView = {
  readonly id: string;
  readonly version: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly benefitKind: "trial-credits" | "discount-quote";
  readonly face: string;
  readonly currency?: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly perSubjectLimit: number;
  readonly budgetTotal: string;
  readonly budgetReserved: string;
  readonly stackingGroup?: string;
  readonly allowStacking: boolean;
  readonly status: "scheduled" | "active" | "ended";
};

export type OfferConsoleClaimView = {
  readonly id: string;
  readonly logicalKey: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly subject: OfferConsoleSubjectView;
  readonly benefitKind: "trial-credits" | "discount-quote";
  readonly faceAmount: string;
  readonly costAmount: string;
  readonly currency?: string;
  readonly state: OfferClaimState;
  readonly grantRef?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type OfferConsoleSnapshot = {
  readonly scope: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId?: string;
  };
  readonly generatedAt: Date;
  readonly policies: readonly OfferConsolePolicyView[];
  readonly claims: readonly OfferConsoleClaimView[];
  readonly pendingBudget: string;
};

export type OfferConsoleSourceResult =
  | { readonly kind: "empty"; readonly message?: string }
  | { readonly kind: "ready"; readonly snapshot: OfferConsoleSnapshot }
  | {
      readonly kind: "problem";
      readonly problem: AdminProblemContract;
      readonly partial?: OfferConsoleSnapshot;
    };

export interface OfferConsoleSource {
  readonly requiredPermissions: readonly string[];
  load(input: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId?: string;
    readonly signal?: AbortSignal;
  }): Promise<OfferConsoleSourceResult>;
}

export type OfferConsoleState =
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
      readonly partial?: OfferConsoleReadyState;
    }
  | OfferConsoleReadyState;

export type OfferConsoleReadyState = {
  readonly kind: "ready";
  readonly snapshot: OfferConsoleSnapshot;
  readonly grantedPermissions: readonly string[];
  readonly actions: readonly OfferConsoleAction[];
};

export type OfferConsoleActionKind = "register-policy" | "expire-claims" | "resolve-claim";

export type OfferConsoleAction = {
  readonly kind: OfferConsoleActionKind;
  readonly targetId: string;
  readonly scope: OfferConsoleSnapshot["scope"];
  readonly permission: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditEvent: string;
  readonly possibleProblems: readonly string[];
};

export type OfferConsoleActionRequest = {
  readonly action: OfferConsoleActionKind;
  readonly targetId: string;
  readonly scope: OfferConsoleSnapshot["scope"];
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly expectedGeneratedAt: Date;
  readonly decision?: "fulfilled" | "rejected";
  readonly grantRef?: string;
};

export type OfferPolicyEditorDraft = {
  readonly id: string;
  readonly versionText: string;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly benefitKind: "trial-credits" | "discount-quote";
  readonly creditAmount: string;
  readonly walletKey: string;
  readonly percentBpsText: string;
  readonly maxDiscountAmountText: string;
  readonly currency: string;
  readonly supportedProvidersText: string;
  readonly startsAtText: string;
  readonly endsAtText: string;
  readonly perSubjectLimitText: string;
  readonly budgetTotal: string;
  readonly budgetPerClaim: string;
  readonly stackingGroup: string;
  readonly allowStacking: boolean;
  readonly eligibilityRevision: string;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type OfferPolicyEditorResult =
  | { readonly ok: true; readonly input: RegisterOfferPolicyInput }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

const READ_PERMISSION = "promotions:read";
const WRITE_PERMISSION = "promotions:write";
const RESOLVE_PERMISSION = "promotions:resolve";
const PII_PERMISSION = "promotions:read:pii";

/** Reports an RFC 7807 validation failure in an offer console contract. */
export class OfferConsoleValidationProblem extends Problem {
  constructor(field: string, reason: string, evidence: Readonly<Record<string, unknown>> = {}) {
    super(
      "admin-core/offer-console-validation-failed",
      ProblemCategory.ValidationError,
      `Offer console ${field} is invalid: ${reason}.`,
      { extensions: { field, ...evidence } },
    );
  }
}

export function maskOfferSubjectId(subjectId: string): string {
  const trimmed = subjectId.trim();
  if (trimmed.length <= 4) return "***";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

export function resolveOfferConsoleSubject(
  subject: OfferSubject,
  grantedPermissions: readonly string[],
): OfferConsoleSubjectView {
  const disclosed = grantedPermissions.includes(PII_PERMISSION);
  return {
    kind: subject.kind,
    id: disclosed ? subject.id : maskOfferSubjectId(subject.id),
    maskedId: maskOfferSubjectId(subject.id),
    tenantId: subject.tenantId,
    appId: subject.appId,
    environment: subject.environment,
  };
}

export function createOfferConsolePolicyView(
  policy: RegisteredOfferPolicy,
  budgetReserved: string,
  now: Date = new Date(),
): OfferConsolePolicyView {
  const status =
    now.getTime() < policy.startsAt.getTime()
      ? "scheduled"
      : now.getTime() >= policy.endsAt.getTime()
        ? "ended"
        : "active";
  const face =
    policy.benefit.kind === "trial-credits"
      ? policy.benefit.creditAmount
      : String(policy.benefit.maxDiscount.amount);
  return {
    id: policy.id,
    version: policy.version,
    familyId: policy.familyId,
    benefitCycleId: policy.benefitCycleId,
    benefitKind: policy.benefit.kind,
    face,
    currency: policy.benefit.kind === "discount-quote" ? policy.benefit.currency : undefined,
    startsAt: new Date(policy.startsAt.getTime()),
    endsAt: new Date(policy.endsAt.getTime()),
    perSubjectLimit: policy.perSubjectLimit,
    budgetTotal: policy.budget.total,
    budgetReserved,
    stackingGroup: policy.stackingGroup,
    allowStacking: policy.allowStacking,
    status,
  };
}

export function createOfferConsoleClaimView(
  claim: OfferClaim,
  grantedPermissions: readonly string[],
): OfferConsoleClaimView {
  return {
    id: claim.id,
    logicalKey: claim.logicalKey,
    policyId: claim.policyId,
    policyVersion: claim.policyVersion,
    subject: resolveOfferConsoleSubject(claim.subject, grantedPermissions),
    benefitKind: claim.benefit.kind,
    faceAmount: claim.faceAmount,
    costAmount: claim.costAmount,
    currency: claim.currency,
    state: claim.state,
    grantRef: claim.grantRef,
    createdAt: new Date(claim.createdAt.getTime()),
    updatedAt: new Date(claim.updatedAt.getTime()),
  };
}

export function createOfferConsoleLoadingState(input: {
  readonly appId: string;
  readonly environment: string;
}): OfferConsoleState {
  return { kind: "loading", ...input };
}

export async function loadOfferConsole(input: {
  readonly source: OfferConsoleSource;
  readonly appId: string;
  readonly environment: string;
  readonly tenantId?: string;
  readonly grantedPermissions: readonly string[];
  readonly signal?: AbortSignal;
}): Promise<OfferConsoleState> {
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
        code: "admin-core/offer-console-permission-denied",
        status: 403,
        title: "Offer console permission denied",
        detail: `Missing permissions: ${missing.join(", ")}`,
      },
    };
  }
  let result: OfferConsoleSourceResult;
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
        code: "admin-core/offer-console-source-failed",
        status: 503,
        title: "Offer console unavailable",
        detail: "The offer console source failed. Inspect server-side provider evidence.",
        retryable: true,
        metadata: { cause: caught },
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
    return {
      kind: "problem",
      appId: input.appId,
      environment: input.environment,
      problem: result.problem,
      partial:
        result.partial === undefined
          ? undefined
          : createOfferConsoleReadyState(result.partial, input.grantedPermissions),
    };
  }
  return createOfferConsoleReadyState(result.snapshot, input.grantedPermissions);
}

export function createOfferConsoleReadyState(
  snapshot: OfferConsoleSnapshot,
  grantedPermissions: readonly string[],
): OfferConsoleReadyState {
  return {
    kind: "ready",
    snapshot,
    grantedPermissions,
    actions: createOfferConsoleActions(snapshot, grantedPermissions),
  };
}

export function createOfferConsoleActions(
  snapshot: OfferConsoleSnapshot,
  grantedPermissions: readonly string[],
): readonly OfferConsoleAction[] {
  const actions: OfferConsoleAction[] = [
    {
      kind: "register-policy",
      targetId: `${snapshot.scope.appId}:${snapshot.scope.environment}`,
      scope: snapshot.scope,
      permission: WRITE_PERMISSION,
      allowed: grantedPermissions.includes(WRITE_PERMISSION),
      reason: grantedPermissions.includes(WRITE_PERMISSION)
        ? "Register a new versioned offer policy with actor, reason, and idempotency evidence"
        : `Missing ${WRITE_PERMISSION} permission`,
      auditEvent: "promotions.admin.register-policy",
      possibleProblems: [
        "promotions-core/policy-invalid",
        "promotions-core/policy-conflict",
        "promotions-core/duplicate-claim",
      ],
    },
    {
      kind: "expire-claims",
      targetId: `${snapshot.scope.appId}:${snapshot.scope.environment}`,
      scope: snapshot.scope,
      permission: WRITE_PERMISSION,
      allowed: grantedPermissions.includes(WRITE_PERMISSION),
      reason: grantedPermissions.includes(WRITE_PERMISSION)
        ? "Expire reserved claims whose quotes lapsed without touching unclear grants"
        : `Missing ${WRITE_PERMISSION} permission`,
      auditEvent: "promotions.admin.expire-claims",
      possibleProblems: ["promotions-core/offer-expired", "promotions-core/claim-state-conflict"],
    },
  ];
  for (const claim of snapshot.claims) {
    if (claim.state !== "indeterminate") continue;
    const allowed = grantedPermissions.includes(RESOLVE_PERMISSION);
    actions.push({
      kind: "resolve-claim",
      targetId: claim.id,
      scope: snapshot.scope,
      permission: RESOLVE_PERMISSION,
      allowed,
      reason: allowed
        ? "Resolve an unclear grant with an explicit fulfill or reject decision"
        : `Missing ${RESOLVE_PERMISSION} permission`,
      auditEvent: "promotions.admin.resolve-claim",
      possibleProblems: [
        "promotions-core/claim-not-found",
        "promotions-core/claim-state-conflict",
        "promotions-core/policy-invalid",
      ],
    });
  }
  return actions;
}

export function assertOfferConsoleActionRequest(
  request: OfferConsoleActionRequest,
): OfferConsoleActionRequest {
  for (const [field, value] of [
    ["actorId", request.actorId],
    ["reason", request.reason],
    ["idempotencyKey", request.idempotencyKey],
    ["targetId", request.targetId],
  ] as const) {
    if (value.trim() === "") {
      throw new OfferConsoleValidationProblem(field, "a non-empty value is required");
    }
  }
  if (Number.isNaN(request.expectedGeneratedAt.getTime())) {
    throw new OfferConsoleValidationProblem(
      "expectedGeneratedAt",
      "a valid snapshot timestamp is required",
    );
  }
  if (request.action === "resolve-claim") {
    if (request.decision !== "fulfilled" && request.decision !== "rejected") {
      throw new OfferConsoleValidationProblem(
        "decision",
        "resolving an indeterminate claim requires fulfilled or rejected",
      );
    }
    if (
      request.decision === "fulfilled" &&
      (request.grantRef === undefined || request.grantRef.trim() === "")
    ) {
      throw new OfferConsoleValidationProblem(
        "grantRef",
        "fulfilling an indeterminate claim requires a verified grant reference",
      );
    }
  }
  return request;
}

/**
 * Validates an operator policy draft into a registerable policy input. Size,
 * period, caps, exclusions, and cost caps are parsed per field; the shared
 * registration validator enforces the cross-field budget and benefit rules.
 */
export function validateOfferPolicyEditor(
  draft: OfferPolicyEditorDraft,
  now: Date = new Date(),
): OfferPolicyEditorResult {
  const fieldErrors: Record<string, string> = {};
  const version = Number.parseInt(draft.versionText, 10);
  if (!Number.isInteger(version) || version < 1) {
    fieldErrors.versionText = "use an integer version of at least 1";
  }
  const perSubjectLimit = Number.parseInt(draft.perSubjectLimitText, 10);
  if (!Number.isInteger(perSubjectLimit) || perSubjectLimit < 1) {
    fieldErrors.perSubjectLimitText = "a per-subject limit of at least 1 is required";
  }
  const startsAt = new Date(draft.startsAtText);
  if (Number.isNaN(startsAt.getTime())) {
    fieldErrors.startsAtText = "use a valid start timestamp";
  }
  const endsAt = new Date(draft.endsAtText);
  if (Number.isNaN(endsAt.getTime())) {
    fieldErrors.endsAtText = "use a valid end timestamp";
  }
  if (draft.benefitKind === "discount-quote") {
    const percentBps = Number.parseInt(draft.percentBpsText, 10);
    if (!Number.isInteger(percentBps) || percentBps < 1 || percentBps > 10000) {
      fieldErrors.percentBpsText = "use integer basis points between 1 and 10000";
    }
    const maxDiscount = Number.parseInt(draft.maxDiscountAmountText, 10);
    if (!Number.isInteger(maxDiscount) || maxDiscount <= 0) {
      fieldErrors.maxDiscountAmountText = "use a positive whole minor-unit cap";
    }
  }
  for (const [field, value] of [
    ["id", draft.id],
    ["benefitCycleId", draft.benefitCycleId],
    ["actorId", draft.actorId],
    ["reason", draft.reason],
    ["idempotencyKey", draft.idempotencyKey],
    ["eligibilityRevision", draft.eligibilityRevision],
  ] as const) {
    if (value.trim() === "") fieldErrors[field] = "a non-empty value is required";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const supportedProviders = draft.supportedProvidersText
    .split(",")
    .map((provider) => provider.trim())
    .filter((provider) => provider.length > 0);
  try {
    const input: RegisterOfferPolicyInput = {
      id: draft.id.trim(),
      version,
      familyId: draft.familyId.trim() === "" ? undefined : draft.familyId.trim(),
      benefitCycleId: draft.benefitCycleId.trim(),
      benefit:
        draft.benefitKind === "trial-credits"
          ? {
              kind: "trial-credits",
              creditAmount: draft.creditAmount.trim(),
              walletKey: draft.walletKey.trim() === "" ? undefined : draft.walletKey.trim(),
            }
          : {
              kind: "discount-quote",
              percentBps: Number.parseInt(draft.percentBpsText, 10),
              maxDiscount: {
                amount: Number.parseInt(draft.maxDiscountAmountText, 10),
                currency: draft.currency.trim(),
              },
              currency: draft.currency.trim(),
              supportedProviders,
            },
      eligibility: { revision: draft.eligibilityRevision.trim() },
      startsAt,
      endsAt,
      perSubjectLimit,
      budget: { total: draft.budgetTotal.trim(), perClaim: draft.budgetPerClaim.trim() },
      stackingGroup: draft.stackingGroup.trim() === "" ? undefined : draft.stackingGroup.trim(),
      allowStacking: draft.allowStacking,
      actorId: draft.actorId.trim(),
      reason: draft.reason.trim(),
      idempotencyKey: draft.idempotencyKey.trim(),
    };
    registerOfferPolicy(input, now);
    return { ok: true, input };
  } catch (error) {
    return {
      ok: false,
      fieldErrors: {
        general: error instanceof Error ? error.message : "the policy draft failed validation",
      },
    };
  }
}

export const OFFER_CONSOLE_READ_PERMISSION = READ_PERMISSION;
export const OFFER_CONSOLE_WRITE_PERMISSION = WRITE_PERMISSION;
export const OFFER_CONSOLE_RESOLVE_PERMISSION = RESOLVE_PERMISSION;
export const OFFER_CONSOLE_PII_PERMISSION = PII_PERMISSION;
