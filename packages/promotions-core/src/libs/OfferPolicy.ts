import { canonicalOfferAmount, compareOfferAmounts } from "./amounts";
import { InvalidOfferPolicyProblem } from "./problems";
import type {
  DiscountQuoteBenefit,
  OfferBenefit,
  OfferBudget,
  OfferEligibilityConditions,
  OfferSubject,
  RegisteredOfferPolicy,
  RegisterOfferPolicyInput,
  TrialCreditBenefit,
} from "./types";

function assertNonBlank(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InvalidOfferPolicyProblem(`${field} must not be blank`);
  }
}

const OFFER_CURRENCY_PATTERN = /^[A-Z]{3}$/;

function normalizeOfferCurrency(value: string, message: string): string {
  const normalized = value.trim().toUpperCase();
  if (!OFFER_CURRENCY_PATTERN.test(normalized)) {
    throw new InvalidOfferPolicyProblem(message);
  }
  return normalized;
}

function assertValidDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidOfferPolicyProblem(`${field} must be a valid date`);
  }
  return new Date(value.getTime());
}

function assertCanonicalAmount(value: string, field: string): string {
  try {
    return canonicalOfferAmount(value);
  } catch (error) {
    throw new InvalidOfferPolicyProblem(
      `${field} must be a canonical positive base-10 string with at most 18 fractional digits`,
      ...(error instanceof Error ? [{ cause: error }] : []),
    );
  }
}

function assertUniqueList(values: readonly string[], field: string): readonly string[] {
  const normalized = values.map((value) => {
    assertNonBlank(value, `${field} entry`);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new InvalidOfferPolicyProblem(`${field} must not contain duplicates`);
  }
  return [...normalized];
}

function validateTrialBenefit(benefit: TrialCreditBenefit): TrialCreditBenefit {
  const credit = assertCanonicalAmount(benefit.creditAmount, "benefit.creditAmount");
  const walletKey = benefit.walletKey === undefined ? undefined : benefit.walletKey;
  if (walletKey !== undefined) assertNonBlank(walletKey, "benefit.walletKey");
  const expiresAt =
    benefit.expiresAt === undefined
      ? undefined
      : assertValidDate(benefit.expiresAt, "benefit.expiresAt");
  return { kind: "trial-credits", creditAmount: credit, walletKey, expiresAt };
}

function validateDiscountBenefit(benefit: DiscountQuoteBenefit): DiscountQuoteBenefit {
  if (
    !Number.isInteger(benefit.percentBps) ||
    benefit.percentBps < 1 ||
    benefit.percentBps > 10000
  ) {
    throw new InvalidOfferPolicyProblem(
      "benefit.percentBps must be an integer between 1 and 10000",
    );
  }
  if (
    !Number.isInteger(benefit.maxDiscount.amount) ||
    !Number.isSafeInteger(benefit.maxDiscount.amount)
  ) {
    throw new InvalidOfferPolicyProblem(
      "benefit.maxDiscount must be a valid Money value with an ISO 4217 currency",
    );
  }
  const faceAmount = benefit.maxDiscount.amount === 0 ? 0 : benefit.maxDiscount.amount;
  if (faceAmount <= 0) {
    throw new InvalidOfferPolicyProblem("benefit.maxDiscount must be greater than zero");
  }
  const faceCurrency = normalizeOfferCurrency(
    benefit.maxDiscount.currency,
    "benefit.maxDiscount must be a valid Money value with an ISO 4217 currency",
  );
  const currency = normalizeOfferCurrency(
    benefit.currency,
    "benefit.currency must be an ISO 4217 currency code",
  );
  if (faceCurrency !== currency) {
    throw new InvalidOfferPolicyProblem("benefit.maxDiscount currency must equal benefit.currency");
  }
  return {
    kind: "discount-quote",
    percentBps: benefit.percentBps,
    maxDiscount: { amount: faceAmount, currency: faceCurrency },
    currency,
    supportedProviders: assertUniqueList(benefit.supportedProviders, "benefit.supportedProviders"),
  };
}

function validateBenefit(benefit: OfferBenefit): OfferBenefit {
  switch (benefit.kind) {
    case "trial-credits":
      return validateTrialBenefit(benefit);
    case "discount-quote":
      return validateDiscountBenefit(benefit);
  }
}

function validateEligibility(eligibility: OfferEligibilityConditions): OfferEligibilityConditions {
  assertNonBlank(eligibility.revision, "eligibility.revision");
  return {
    revision: eligibility.revision,
    allowedSubjectKinds:
      eligibility.allowedSubjectKinds === undefined
        ? undefined
        : assertUniqueList(eligibility.allowedSubjectKinds, "eligibility.allowedSubjectKinds"),
    allowedSubjectIds:
      eligibility.allowedSubjectIds === undefined
        ? undefined
        : assertUniqueList(eligibility.allowedSubjectIds, "eligibility.allowedSubjectIds"),
    deniedSubjectIds:
      eligibility.deniedSubjectIds === undefined
        ? undefined
        : assertUniqueList(eligibility.deniedSubjectIds, "eligibility.deniedSubjectIds"),
  };
}

function validateBudget(budget: OfferBudget): OfferBudget {
  const total = assertCanonicalAmount(budget.total, "budget.total");
  const perClaim = assertCanonicalAmount(budget.perClaim, "budget.perClaim");
  if (compareOfferAmounts(perClaim, total) > 0) {
    throw new InvalidOfferPolicyProblem("budget.perClaim must not exceed budget.total");
  }
  return { total, perClaim };
}

const MINOR_UNITS_PATTERN = /^(0|[1-9]\d*)$/;

/**
 * Validates that the budget uses the benefit unit and that a single benefit
 * can never exceed the per-claim reservation cap.
 */
function assertBudgetMatchesBenefit(benefit: OfferBenefit, budget: OfferBudget): void {
  switch (benefit.kind) {
    case "trial-credits":
      if (compareOfferAmounts(benefit.creditAmount, budget.perClaim) > 0) {
        throw new InvalidOfferPolicyProblem("benefit.creditAmount must not exceed budget.perClaim");
      }
      return;
    case "discount-quote": {
      for (const [field, value] of [
        ["budget.total", budget.total],
        ["budget.perClaim", budget.perClaim],
      ] as const) {
        if (!MINOR_UNITS_PATTERN.test(value)) {
          throw new InvalidOfferPolicyProblem(
            `${field} must be whole Money minor units for discount benefits`,
          );
        }
      }
      if (BigInt(benefit.maxDiscount.amount) > BigInt(budget.perClaim)) {
        throw new InvalidOfferPolicyProblem("benefit.maxDiscount must not exceed budget.perClaim");
      }
      return;
    }
  }
}

/** Validates a fully qualified offer scope; a missing tenant is never a global scope. */
export function assertOfferScope(scope: {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId: string;
}): void {
  assertNonBlank(scope.appId, "scope.appId");
  assertNonBlank(scope.environment, "scope.environment");
  assertNonBlank(scope.tenantId, "scope.tenantId");
}

/** Validates a typed offer subject including its full scope. */
export function assertOfferSubject(subject: OfferSubject): void {
  assertOfferScope(subject);
  assertNonBlank(subject.kind, "subject.kind");
  assertNonBlank(subject.id, "subject.id");
}

function sameScope(left: OfferSubject, right: OfferSubject): boolean {
  return (
    left.appId === right.appId &&
    left.environment === right.environment &&
    left.tenantId === right.tenantId &&
    left.kind === right.kind &&
    left.id === right.id
  );
}

export { sameScope as sameOfferSubject };

/**
 * Registers an offer policy in code. Limits are mandatory, amounts are
 * canonicalized, and the returned document is a frozen snapshot: later
 * registrations never mutate confirmed quotes or claims made under it.
 */
export function registerOfferPolicy(
  input: RegisterOfferPolicyInput,
  now: Date = new Date(),
): RegisteredOfferPolicy {
  assertNonBlank(input.id, "id");
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new InvalidOfferPolicyProblem("version must be an integer of at least 1");
  }
  const familyId = input.familyId ?? input.id;
  assertNonBlank(familyId, "familyId");
  assertNonBlank(input.benefitCycleId, "benefitCycleId");
  if (!Number.isInteger(input.perSubjectLimit) || input.perSubjectLimit < 1) {
    throw new InvalidOfferPolicyProblem("perSubjectLimit must be an integer of at least 1");
  }
  const startsAt = assertValidDate(input.startsAt, "startsAt");
  const endsAt = assertValidDate(input.endsAt, "endsAt");
  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new InvalidOfferPolicyProblem("startsAt must be before endsAt");
  }
  const stackingGroup = input.stackingGroup === undefined ? undefined : input.stackingGroup;
  if (stackingGroup !== undefined) assertNonBlank(stackingGroup, "stackingGroup");
  assertNonBlank(input.actorId, "actorId");
  assertNonBlank(input.reason, "reason");
  assertNonBlank(input.idempotencyKey, "idempotencyKey");
  const registeredAt = assertValidDate(now, "now");
  const benefit = validateBenefit(input.benefit);
  const budget = validateBudget(input.budget);
  assertBudgetMatchesBenefit(benefit, budget);
  return {
    id: input.id,
    version: input.version,
    familyId,
    benefitCycleId: input.benefitCycleId,
    benefit,
    eligibility: validateEligibility(input.eligibility),
    startsAt,
    endsAt,
    perSubjectLimit: input.perSubjectLimit,
    budget,
    stackingGroup,
    allowStacking: input.allowStacking ?? false,
    actorId: input.actorId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    registeredAt,
  };
}
