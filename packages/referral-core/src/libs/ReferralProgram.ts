import { canonicalReferralAmount, compareReferralAmounts } from "./amounts";
import { InvalidReferralProgramProblem } from "./problems";
import type {
  ReferralBenefit,
  ReferralProgramDefinition,
  ReferralScope,
  ReferralSubject,
  RegisterReferralProgramInput,
} from "./types";

function assertNonBlank(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InvalidReferralProgramProblem(`${field} must not be blank`);
  }
}

function assertValidDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidReferralProgramProblem(`${field} must be a valid date`);
  }
  return new Date(value.getTime());
}

function assertCanonicalAmount(value: string, field: string): string {
  try {
    return canonicalReferralAmount(value);
  } catch (error) {
    throw new InvalidReferralProgramProblem(
      `${field} must be a canonical positive base-10 string with at most 18 fractional digits`,
      ...(error instanceof Error ? [{ cause: error }] : []),
    );
  }
}

function validateBenefit(benefit: ReferralBenefit, field: string): ReferralBenefit {
  switch (benefit.kind) {
    case "trial-credits": {
      const credit = assertCanonicalAmount(benefit.creditAmount, `${field}.creditAmount`);
      const walletKey = benefit.walletKey === undefined ? undefined : benefit.walletKey;
      if (walletKey !== undefined) assertNonBlank(walletKey, `${field}.walletKey`);
      const expiresAt =
        benefit.expiresAt === undefined
          ? undefined
          : assertValidDate(benefit.expiresAt, `${field}.expiresAt`);
      return { kind: "trial-credits", creditAmount: credit, walletKey, expiresAt };
    }
    case "none":
      return { kind: "none" };
  }
}

/** Validates a fully qualified referral scope; a missing tenant is never a global scope. */
export function assertReferralScope(scope: ReferralScope): void {
  assertNonBlank(scope.appId, "scope.appId");
  assertNonBlank(scope.environment, "scope.environment");
  assertNonBlank(scope.tenantId, "scope.tenantId");
}

/** Validates a typed referral subject including its full scope. */
export function assertReferralSubject(subject: ReferralSubject): void {
  assertReferralScope(subject);
  assertNonBlank(subject.kind, "subject.kind");
  assertNonBlank(subject.id, "subject.id");
}

export function sameReferralSubject(left: ReferralSubject, right: ReferralSubject): boolean {
  return (
    left.appId === right.appId &&
    left.environment === right.environment &&
    left.tenantId === right.tenantId &&
    left.kind === right.kind &&
    left.id === right.id
  );
}

export function sameReferralScope(left: ReferralScope, right: ReferralScope): boolean {
  return (
    left.appId === right.appId &&
    left.environment === right.environment &&
    left.tenantId === right.tenantId
  );
}

/**
 * Registers a referral program in code. Limits are mandatory, amounts are
 * canonicalized, and the returned document is a frozen snapshot: later
 * registrations never mutate confirmed links, attributions, or benefits.
 */
export function registerReferralProgram(
  input: RegisterReferralProgramInput,
  now: Date = new Date(),
): ReferralProgramDefinition {
  assertNonBlank(input.id, "id");
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new InvalidReferralProgramProblem("version must be an integer of at least 1");
  }
  const familyId = input.familyId ?? input.id;
  assertNonBlank(familyId, "familyId");
  assertNonBlank(input.benefitCycleId, "benefitCycleId");
  assertNonBlank(input.qualifyingAction, "qualifyingAction");
  if (
    !Number.isInteger(input.conversionWindowMs) ||
    input.conversionWindowMs < 60_000 ||
    input.conversionWindowMs > 365 * 24 * 60 * 60 * 1000
  ) {
    throw new InvalidReferralProgramProblem(
      "conversionWindowMs must be an integer between 60000 and 31536000000",
    );
  }
  if (!Number.isInteger(input.perSubjectLimit) || input.perSubjectLimit < 1) {
    throw new InvalidReferralProgramProblem("perSubjectLimit must be an integer of at least 1");
  }
  const startsAt = assertValidDate(input.startsAt, "startsAt");
  const endsAt = assertValidDate(input.endsAt, "endsAt");
  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new InvalidReferralProgramProblem("startsAt must be before endsAt");
  }
  assertNonBlank(input.actorId, "actorId");
  assertNonBlank(input.reason, "reason");
  assertNonBlank(input.idempotencyKey, "idempotencyKey");
  const registeredAt = assertValidDate(now, "now");
  const budgetTotal = assertCanonicalAmount(input.budgetTotal, "budgetTotal");
  const budgetPerAttribution = assertCanonicalAmount(
    input.budgetPerAttribution,
    "budgetPerAttribution",
  );
  if (compareReferralAmounts(budgetPerAttribution, budgetTotal) > 0) {
    throw new InvalidReferralProgramProblem("budgetPerAttribution must not exceed budgetTotal");
  }
  const referrerBenefit = validateBenefit(input.referrerBenefit, "referrerBenefit");
  const recipientBenefit = validateBenefit(input.recipientBenefit, "recipientBenefit");
  if (
    referrerBenefit.kind === "trial-credits" &&
    compareReferralAmounts(referrerBenefit.creditAmount, budgetPerAttribution) > 0
  ) {
    throw new InvalidReferralProgramProblem(
      "referrerBenefit.creditAmount must not exceed budgetPerAttribution",
    );
  }
  if (
    recipientBenefit.kind === "trial-credits" &&
    compareReferralAmounts(recipientBenefit.creditAmount, budgetPerAttribution) > 0
  ) {
    throw new InvalidReferralProgramProblem(
      "recipientBenefit.creditAmount must not exceed budgetPerAttribution",
    );
  }
  return {
    id: input.id,
    version: input.version,
    familyId,
    benefitCycleId: input.benefitCycleId,
    attributionPolicy: "first-valid",
    conversionWindowMs: input.conversionWindowMs,
    qualifyingAction: input.qualifyingAction,
    referrerBenefit,
    recipientBenefit,
    startsAt,
    endsAt,
    perSubjectLimit: input.perSubjectLimit,
    budgetTotal,
    budgetPerAttribution,
    actorId: input.actorId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    registeredAt,
  };
}
