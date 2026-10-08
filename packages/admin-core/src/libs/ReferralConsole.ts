import { Problem, ProblemCategory } from "@croco/problems-core";
import { registerReferralProgram } from "@croco/referral-core";
import type {
  ReferralAttribution,
  ReferralBenefit,
  ReferralBenefitSide,
  ReferralFunnelCounts,
  ReferralLink,
  ReferralProgramDefinition,
  ReferralScope,
  ReferralSubject,
  RegisterReferralProgramInput,
} from "@croco/referral-core";

import type { AdminProblemContract } from "./types";

export const REFERRAL_CONSOLE_READ_PERMISSION = "referrals:read";
export const REFERRAL_CONSOLE_WRITE_PERMISSION = "referrals:write";
export const REFERRAL_CONSOLE_RESOLVE_PERMISSION = "referrals:resolve";
export const REFERRAL_CONSOLE_PII_PERMISSION = "referrals:read:pii";

/** Reports an RFC 7807 validation failure in a referral console contract. */
export class ReferralConsoleValidationProblem extends Problem {
  constructor(field: string, reason: string, evidence: Readonly<Record<string, unknown>> = {}) {
    super(
      "admin-core/referral-console-validation-failed",
      ProblemCategory.ValidationError,
      `Referral console ${field} is invalid: ${reason}.`,
      { extensions: { field, ...evidence } },
    );
  }
}

export function maskReferralSubjectId(subjectId: string): string {
  const trimmed = subjectId.trim();
  if (trimmed.length <= 4) return "***";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

export type ReferralConsoleSubjectView = {
  readonly kind: string;
  readonly id: string;
  readonly maskedId: string;
  readonly tenantId: string;
  readonly appId: string;
  readonly environment: string;
};

export function resolveReferralConsoleSubject(
  subject: ReferralSubject,
  grantedPermissions: readonly string[],
): ReferralConsoleSubjectView {
  const disclosed = grantedPermissions.includes(REFERRAL_CONSOLE_PII_PERMISSION);
  return {
    kind: subject.kind,
    id: disclosed ? subject.id : maskReferralSubjectId(subject.id),
    maskedId: maskReferralSubjectId(subject.id),
    tenantId: subject.tenantId,
    appId: subject.appId,
    environment: subject.environment,
  };
}

function referralBenefitFace(benefit: ReferralBenefit): string {
  if (benefit.kind === "trial-credits") return benefit.creditAmount;
  return "none";
}

export type ReferralConsoleProgramView = {
  readonly id: string;
  readonly version: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly qualifyingAction: string;
  readonly conversionWindowMs: number;
  readonly referrerFace: string;
  readonly recipientFace: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly perSubjectLimit: number;
  readonly budgetTotal: string;
  readonly budgetReserved: string;
  readonly status: "scheduled" | "active" | "ended";
};

export function createReferralConsoleProgramView(
  program: ReferralProgramDefinition,
  budgetReserved: string,
  now: Date = new Date(),
): ReferralConsoleProgramView {
  const status =
    now.getTime() < program.startsAt.getTime()
      ? "scheduled"
      : now.getTime() >= program.endsAt.getTime()
        ? "ended"
        : "active";
  return {
    id: program.id,
    version: program.version,
    familyId: program.familyId,
    benefitCycleId: program.benefitCycleId,
    qualifyingAction: program.qualifyingAction,
    conversionWindowMs: program.conversionWindowMs,
    referrerFace: referralBenefitFace(program.referrerBenefit),
    recipientFace: referralBenefitFace(program.recipientBenefit),
    startsAt: new Date(program.startsAt.getTime()),
    endsAt: new Date(program.endsAt.getTime()),
    perSubjectLimit: program.perSubjectLimit,
    budgetTotal: program.budgetTotal,
    budgetReserved,
    status,
  };
}

export type ReferralConsoleAttributionView = {
  readonly id: string;
  readonly linkId: string;
  readonly programId: string;
  readonly programVersion: number;
  readonly referrer: ReferralConsoleSubjectView;
  readonly recipient: ReferralConsoleSubjectView | null;
  readonly state: ReferralAttribution["state"];
  readonly holdReason?: ReferralAttribution["holdReason"];
  readonly rejectReason?: ReferralAttribution["rejectReason"];
  readonly cycleIndex: number;
  readonly claimedAt: Date;
  readonly updatedAt: Date;
};

export function createReferralConsoleAttributionView(
  attribution: ReferralAttribution,
  grantedPermissions: readonly string[],
): ReferralConsoleAttributionView {
  return {
    id: attribution.id,
    linkId: attribution.linkId,
    programId: attribution.programId,
    programVersion: attribution.programVersion,
    referrer: resolveReferralConsoleSubject(attribution.referrer, grantedPermissions),
    recipient: attribution.recipient
      ? resolveReferralConsoleSubject(attribution.recipient, grantedPermissions)
      : null,
    state: attribution.state,
    holdReason: attribution.holdReason,
    rejectReason: attribution.rejectReason,
    cycleIndex: attribution.cycleIndex,
    claimedAt: new Date(attribution.claimedAt.getTime()),
    updatedAt: new Date(attribution.updatedAt.getTime()),
  };
}

export type ReferralConsoleLinkView = {
  readonly id: string;
  readonly programId: string;
  readonly programVersion: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly referrer: ReferralConsoleSubjectView;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt?: Date;
};

export function createReferralConsoleLinkView(
  link: ReferralLink,
  grantedPermissions: readonly string[],
): ReferralConsoleLinkView {
  return {
    id: link.id,
    programId: link.programId,
    programVersion: link.programVersion,
    familyId: link.familyId,
    benefitCycleId: link.benefitCycleId,
    referrer: resolveReferralConsoleSubject(link.referrer, grantedPermissions),
    createdAt: new Date(link.createdAt.getTime()),
    expiresAt: new Date(link.expiresAt.getTime()),
    revokedAt: link.revokedAt ? new Date(link.revokedAt.getTime()) : undefined,
  };
}

export type ReferralConsoleSnapshot = {
  readonly scope: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId?: string;
  };
  readonly generatedAt: Date;
  readonly programs: readonly ReferralConsoleProgramView[];
  readonly links: readonly ReferralConsoleLinkView[];
  readonly attributions: readonly ReferralConsoleAttributionView[];
  readonly funnel: ReferralFunnelCounts;
  readonly nextShareCycle: string;
};

export type ReferralConsoleSourceResult =
  | { readonly kind: "empty"; readonly message?: string }
  | { readonly kind: "ready"; readonly snapshot: ReferralConsoleSnapshot }
  | {
      readonly kind: "problem";
      readonly problem: AdminProblemContract;
      readonly partial?: ReferralConsoleSnapshot;
    };

export interface ReferralConsoleSource {
  readonly requiredPermissions: readonly string[];
  load(input: {
    readonly appId: string;
    readonly environment: string;
    readonly tenantId?: string;
    readonly signal?: AbortSignal;
  }): Promise<ReferralConsoleSourceResult>;
}

export type ReferralConsoleState =
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
      readonly partial?: ReferralConsoleReadyState;
    }
  | ReferralConsoleReadyState;

export type ReferralConsoleReadyState = {
  readonly kind: "ready";
  readonly snapshot: ReferralConsoleSnapshot;
  readonly grantedPermissions: readonly string[];
  readonly actions: readonly ReferralConsoleAction[];
};

export type ReferralConsoleActionKind =
  | "register-program"
  | "expire-attributions"
  | "resolve-attribution"
  | "cancel-benefit"
  | "return-benefit";

export type ReferralConsoleAction = {
  readonly kind: ReferralConsoleActionKind;
  readonly targetId: string;
  readonly scope: ReferralConsoleSnapshot["scope"];
  readonly permission: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditEvent: string;
  readonly possibleProblems: readonly string[];
};

export type ReferralConsoleActionRequest = {
  readonly action: ReferralConsoleActionKind;
  readonly targetId: string;
  readonly scope: ReferralScope & { readonly tenantId?: string };
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly expectedGeneratedAt: Date;
  readonly decision?: "fulfilled" | "rejected";
  readonly grantRefs?: Partial<Record<"referrer" | "recipient", string>>;
  readonly side?: ReferralBenefitSide;
  readonly policy?: string;
  readonly returnIdempotencyKey?: string;
};

export type ReferralConsoleCancelBenefitRequest = {
  readonly targetId: string;
  readonly side: ReferralBenefitSide;
  readonly actorId: string;
  readonly reason: string;
  readonly policy: string;
  readonly idempotencyKey: string;
  readonly expectedGeneratedAt: Date;
};

export type ReferralConsoleReturnBenefitRequest = {
  readonly targetId: string;
  readonly side: ReferralBenefitSide;
  readonly actorId: string;
  readonly reason: string;
  readonly policy: string;
  readonly idempotencyKey: string;
  readonly returnIdempotencyKey: string;
  readonly expectedGeneratedAt: Date;
};

export function createReferralConsoleLoadingState(input: {
  readonly appId: string;
  readonly environment: string;
}): ReferralConsoleState {
  return { kind: "loading", ...input };
}

export async function loadReferralConsole(input: {
  readonly source: ReferralConsoleSource;
  readonly appId: string;
  readonly environment: string;
  readonly tenantId?: string;
  readonly grantedPermissions: readonly string[];
  readonly signal?: AbortSignal;
}): Promise<ReferralConsoleState> {
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
        code: "admin-core/referral-console-permission-denied",
        status: 403,
        title: "Referral console permission denied",
        detail: `Missing permissions: ${missing.join(", ")}`,
      },
    };
  }
  let result: ReferralConsoleSourceResult;
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
        code: "admin-core/referral-console-source-failed",
        status: 503,
        title: "Referral console unavailable",
        detail: "The referral console source failed. Inspect server-side provider evidence.",
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
          : createReferralConsoleReadyState(result.partial, input.grantedPermissions),
    };
  }
  return createReferralConsoleReadyState(result.snapshot, input.grantedPermissions);
}

export function createReferralConsoleReadyState(
  snapshot: ReferralConsoleSnapshot,
  grantedPermissions: readonly string[],
): ReferralConsoleReadyState {
  return {
    kind: "ready",
    snapshot,
    grantedPermissions,
    actions: createReferralConsoleActions(snapshot, grantedPermissions),
  };
}

export function createReferralConsoleActions(
  snapshot: ReferralConsoleSnapshot,
  grantedPermissions: readonly string[],
): readonly ReferralConsoleAction[] {
  const actions: ReferralConsoleAction[] = [
    {
      kind: "register-program",
      targetId: `${snapshot.scope.appId}:${snapshot.scope.environment}`,
      scope: snapshot.scope,
      permission: REFERRAL_CONSOLE_WRITE_PERMISSION,
      allowed: grantedPermissions.includes(REFERRAL_CONSOLE_WRITE_PERMISSION),
      reason: grantedPermissions.includes(REFERRAL_CONSOLE_WRITE_PERMISSION)
        ? "Register a new versioned referral program with actor, reason, and idempotency evidence"
        : `Missing ${REFERRAL_CONSOLE_WRITE_PERMISSION} permission`,
      auditEvent: "referrals.admin.register-program",
      possibleProblems: [
        "referral-core/program-invalid",
        "referral-core/program-conflict",
        "referral-core/duplicate-claim",
      ],
    },
    {
      kind: "expire-attributions",
      targetId: `${snapshot.scope.appId}:${snapshot.scope.environment}`,
      scope: snapshot.scope,
      permission: REFERRAL_CONSOLE_WRITE_PERMISSION,
      allowed: grantedPermissions.includes(REFERRAL_CONSOLE_WRITE_PERMISSION),
      reason: grantedPermissions.includes(REFERRAL_CONSOLE_WRITE_PERMISSION)
        ? "Expire claimed attributions past their conversion window without touching unclear grants"
        : `Missing ${REFERRAL_CONSOLE_WRITE_PERMISSION} permission`,
      auditEvent: "referrals.admin.expire-attributions",
      possibleProblems: [
        "referral-core/attribution-not-found",
        "referral-core/attribution-state-conflict",
      ],
    },
  ];
  for (const attribution of snapshot.attributions) {
    if (attribution.state !== "indeterminate") continue;
    const allowed = grantedPermissions.includes(REFERRAL_CONSOLE_RESOLVE_PERMISSION);
    actions.push({
      kind: "resolve-attribution",
      targetId: attribution.id,
      scope: snapshot.scope,
      permission: REFERRAL_CONSOLE_RESOLVE_PERMISSION,
      allowed,
      reason: allowed
        ? "Resolve an unclear grant with an explicit fulfill or reject decision"
        : `Missing ${REFERRAL_CONSOLE_RESOLVE_PERMISSION} permission`,
      auditEvent: "referrals.admin.resolve-attribution",
      possibleProblems: [
        "referral-core/attribution-not-found",
        "referral-core/attribution-state-conflict",
        "referral-core/program-invalid",
      ],
    });
  }
  for (const attribution of snapshot.attributions) {
    if (
      attribution.state !== "benefits-pending" &&
      attribution.state !== "benefits-partial" &&
      attribution.state !== "qualified"
    ) {
      continue;
    }
    const cancelAllowed = grantedPermissions.includes(REFERRAL_CONSOLE_WRITE_PERMISSION);
    actions.push({
      kind: "cancel-benefit",
      targetId: attribution.id,
      scope: snapshot.scope,
      permission: REFERRAL_CONSOLE_WRITE_PERMISSION,
      allowed: cancelAllowed,
      reason: cancelAllowed
        ? "Cancel a pending benefit side with an explicit policy before any grant completed"
        : `Missing ${REFERRAL_CONSOLE_WRITE_PERMISSION} permission`,
      auditEvent: "referrals.admin.cancel-benefit",
      possibleProblems: [
        "referral-core/attribution-not-found",
        "referral-core/attribution-state-conflict",
        "referral-core/program-invalid",
      ],
    });
    const returnAllowed = grantedPermissions.includes(REFERRAL_CONSOLE_RESOLVE_PERMISSION);
    actions.push({
      kind: "return-benefit",
      targetId: attribution.id,
      scope: snapshot.scope,
      permission: REFERRAL_CONSOLE_RESOLVE_PERMISSION,
      allowed: returnAllowed,
      reason: returnAllowed
        ? "Return a granted benefit side through an explicit compensating reversal"
        : `Missing ${REFERRAL_CONSOLE_RESOLVE_PERMISSION} permission`,
      auditEvent: "referrals.admin.return-benefit",
      possibleProblems: [
        "referral-core/attribution-not-found",
        "referral-core/attribution-state-conflict",
        "referral-core/program-invalid",
      ],
    });
  }
  return actions;
}

export function assertReferralConsoleActionRequest(
  request: ReferralConsoleActionRequest,
): ReferralConsoleActionRequest {
  for (const [field, value] of [
    ["actorId", request.actorId],
    ["reason", request.reason],
    ["idempotencyKey", request.idempotencyKey],
    ["targetId", request.targetId],
  ] as const) {
    if (value.trim() === "") {
      throw new ReferralConsoleValidationProblem(field, "a non-empty value is required");
    }
  }
  if (Number.isNaN(request.expectedGeneratedAt.getTime())) {
    throw new ReferralConsoleValidationProblem(
      "expectedGeneratedAt",
      "a valid snapshot timestamp is required",
    );
  }
  if (request.action === "resolve-attribution") {
    if (request.decision !== "fulfilled" && request.decision !== "rejected") {
      throw new ReferralConsoleValidationProblem(
        "decision",
        "resolving an indeterminate attribution requires fulfilled or rejected",
      );
    }
    if (request.decision === "fulfilled") {
      for (const side of ["referrer", "recipient"] as const) {
        const grantRef = request.grantRefs?.[side];
        if (grantRef === undefined || grantRef.trim() === "") {
          throw new ReferralConsoleValidationProblem(
            `grantRefs.${side}`,
            `fulfilling side '${side}' requires a verified grant reference`,
          );
        }
      }
    }
  }
  if (request.action === "cancel-benefit") {
    if (request.side !== "referrer" && request.side !== "recipient") {
      throw new ReferralConsoleValidationProblem(
        "side",
        "canceling a benefit requires referrer or recipient",
      );
    }
    if (request.policy === undefined || request.policy.trim() === "") {
      throw new ReferralConsoleValidationProblem(
        "policy",
        "canceling a benefit requires an explicit policy",
      );
    }
  }
  if (request.action === "return-benefit") {
    if (request.side !== "referrer" && request.side !== "recipient") {
      throw new ReferralConsoleValidationProblem(
        "side",
        "returning a benefit requires referrer or recipient",
      );
    }
    if (request.policy === undefined || request.policy.trim() === "") {
      throw new ReferralConsoleValidationProblem(
        "policy",
        "returning a benefit requires an explicit policy",
      );
    }
    if (request.returnIdempotencyKey !== undefined && request.returnIdempotencyKey.trim() === "") {
      throw new ReferralConsoleValidationProblem(
        "returnIdempotencyKey",
        "a non-empty return idempotency key is required",
      );
    }
  }
  return request;
}

export function assertReferralConsoleCancelBenefitRequest(
  request: ReferralConsoleCancelBenefitRequest,
): ReferralConsoleCancelBenefitRequest {
  for (const [field, value] of [
    ["targetId", request.targetId],
    ["actorId", request.actorId],
    ["reason", request.reason],
    ["policy", request.policy],
    ["idempotencyKey", request.idempotencyKey],
  ] as const) {
    if (value.trim() === "") {
      throw new ReferralConsoleValidationProblem(field, "a non-empty value is required");
    }
  }
  if (request.side !== "referrer" && request.side !== "recipient") {
    throw new ReferralConsoleValidationProblem(
      "side",
      "canceling a benefit requires referrer or recipient",
    );
  }
  if (Number.isNaN(request.expectedGeneratedAt.getTime())) {
    throw new ReferralConsoleValidationProblem(
      "expectedGeneratedAt",
      "a valid snapshot timestamp is required",
    );
  }
  return request;
}

export function assertReferralConsoleReturnBenefitRequest(
  request: ReferralConsoleReturnBenefitRequest,
): ReferralConsoleReturnBenefitRequest {
  for (const [field, value] of [
    ["targetId", request.targetId],
    ["actorId", request.actorId],
    ["reason", request.reason],
    ["policy", request.policy],
    ["idempotencyKey", request.idempotencyKey],
    ["returnIdempotencyKey", request.returnIdempotencyKey],
  ] as const) {
    if (value.trim() === "") {
      throw new ReferralConsoleValidationProblem(field, "a non-empty value is required");
    }
  }
  if (request.side !== "referrer" && request.side !== "recipient") {
    throw new ReferralConsoleValidationProblem(
      "side",
      "returning a benefit requires referrer or recipient",
    );
  }
  if (Number.isNaN(request.expectedGeneratedAt.getTime())) {
    throw new ReferralConsoleValidationProblem(
      "expectedGeneratedAt",
      "a valid snapshot timestamp is required",
    );
  }
  return request;
}

export type ReferralProgramEditorDraft = {
  readonly id: string;
  readonly versionText: string;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly qualifyingAction: string;
  readonly conversionWindowDaysText: string;
  readonly referrerKind: "trial-credits" | "none";
  readonly referrerCreditAmount: string;
  readonly referrerWalletKey: string;
  readonly recipientKind: "trial-credits" | "none";
  readonly recipientCreditAmount: string;
  readonly recipientWalletKey: string;
  readonly startsAtText: string;
  readonly endsAtText: string;
  readonly perSubjectLimitText: string;
  readonly budgetTotal: string;
  readonly budgetPerAttribution: string;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type ReferralProgramEditorResult =
  | { readonly kind: "ok"; readonly input: RegisterReferralProgramInput }
  | { readonly kind: "errors"; readonly errors: Readonly<Record<string, string>> };

function parseEditorDate(
  field: string,
  value: string,
  errors: Record<string, string>,
): Date | null {
  if (value.trim() === "") {
    errors[field] = "a date is required";
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors[field] = "a valid date is required";
    return null;
  }
  return parsed;
}

function parseEditorBenefit(
  side: "referrer" | "recipient",
  kind: "trial-credits" | "none",
  amount: string,
  walletKey: string,
  errors: Record<string, string>,
): ReferralBenefit | null {
  if (kind === "none") return { kind: "none" };
  if (amount.trim() === "") {
    errors[side === "referrer" ? "referrerCreditAmount" : "recipientCreditAmount"] =
      "a credit amount is required";
    return null;
  }
  return {
    kind: "trial-credits",
    creditAmount: amount.trim(),
    walletKey: walletKey.trim() === "" ? undefined : walletKey.trim(),
  };
}

/**
 * Validates an operator program draft into a registerable program input.
 * Family limits never reset on revision alone: a fresh allowance always
 * requires a new explicit benefitCycleId, and registration keeps the pinned
 * per-subject receipt rule.
 */
export function validateReferralProgramEditor(
  draft: ReferralProgramEditorDraft,
  now: Date = new Date(),
): ReferralProgramEditorResult {
  const errors: Record<string, string> = {};
  if (draft.id.trim() === "") errors.id = "a program id is required";
  const version = Number.parseInt(draft.versionText, 10);
  if (!Number.isInteger(version) || version < 1) {
    errors.versionText = "version must be a positive integer";
  }
  if (draft.benefitCycleId.trim() === "") {
    errors.benefitCycleId = "an explicit benefit cycle id is required";
  }
  if (draft.qualifyingAction.trim() === "") {
    errors.qualifyingAction = "a qualifying action is required";
  }
  const conversionDays = Number(draft.conversionWindowDaysText);
  if (!Number.isFinite(conversionDays) || conversionDays <= 0 || conversionDays > 365) {
    errors.conversionWindowDaysText = "conversion window must be between 1 and 365 days";
  }
  const startsAt = parseEditorDate("startsAtText", draft.startsAtText, errors);
  const endsAt = parseEditorDate("endsAtText", draft.endsAtText, errors);
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAtText = "endsAt must be after startsAt";
  }
  const perSubjectLimit = Number.parseInt(draft.perSubjectLimitText, 10);
  if (!Number.isInteger(perSubjectLimit) || perSubjectLimit < 1) {
    errors.perSubjectLimitText = "per-subject limit must be a positive integer";
  }
  if (draft.budgetTotal.trim() === "") errors.budgetTotal = "a total budget is required";
  if (draft.budgetPerAttribution.trim() === "") {
    errors.budgetPerAttribution = "a per-attribution budget is required";
  }
  if (draft.actorId.trim() === "") errors.actorId = "an actor id is required";
  if (draft.reason.trim() === "") errors.reason = "a reason is required";
  if (draft.idempotencyKey.trim() === "") errors.idempotencyKey = "an idempotency key is required";
  const referrerBenefit = parseEditorBenefit(
    "referrer",
    draft.referrerKind,
    draft.referrerCreditAmount,
    draft.referrerWalletKey,
    errors,
  );
  const recipientBenefit = parseEditorBenefit(
    "recipient",
    draft.recipientKind,
    draft.recipientCreditAmount,
    draft.recipientWalletKey,
    errors,
  );
  if (Object.keys(errors).length > 0) return { kind: "errors", errors };
  const input: RegisterReferralProgramInput = {
    id: draft.id.trim(),
    version,
    familyId: draft.familyId.trim() === "" ? draft.id.trim() : draft.familyId.trim(),
    benefitCycleId: draft.benefitCycleId.trim(),
    conversionWindowMs: Math.round(conversionDays * 24 * 60 * 60 * 1000),
    qualifyingAction: draft.qualifyingAction.trim(),
    referrerBenefit: referrerBenefit ?? { kind: "none" },
    recipientBenefit: recipientBenefit ?? { kind: "none" },
    startsAt: startsAt ?? now,
    endsAt: endsAt ?? now,
    perSubjectLimit,
    budgetTotal: draft.budgetTotal.trim(),
    budgetPerAttribution: draft.budgetPerAttribution.trim(),
    actorId: draft.actorId.trim(),
    reason: draft.reason.trim(),
    idempotencyKey: draft.idempotencyKey.trim(),
  };
  try {
    registerReferralProgram(input);
  } catch (error) {
    return {
      kind: "errors",
      errors: {
        id: error instanceof Error ? error.message : "the program draft is not registerable",
      },
    };
  }
  return { kind: "ok", input };
}

export type ReferralConsoleQualifiedRecipient = {
  readonly recipientMaskedId: string;
  readonly attributionId: string;
  readonly qualifiedAt?: Date;
};

/** Operator view of qualified recipients plus the next share cycle. Never discloses raw subject ids. */
export function summarizeReferralConsoleQualifiedRecipients(input: {
  readonly attributions: readonly ReferralAttribution[];
  readonly grantedPermissions: readonly string[];
  readonly nextShareCycle: string;
}): {
  readonly qualified: readonly ReferralConsoleQualifiedRecipient[];
  readonly nextShareCycle: string;
} {
  return {
    qualified: input.attributions
      .filter(
        (entry) =>
          entry.state === "qualified" ||
          entry.state === "benefits-pending" ||
          entry.state === "benefits-partial" ||
          entry.state === "fulfilled",
      )
      .map((entry) => ({
        recipientMaskedId: entry.recipient
          ? resolveReferralConsoleSubject(entry.recipient, input.grantedPermissions).id
          : "unknown",
        attributionId: entry.id,
        qualifiedAt: entry.qualification
          ? new Date(entry.qualification.qualifiedAt.getTime())
          : undefined,
      })),
    nextShareCycle: input.nextShareCycle,
  };
}
