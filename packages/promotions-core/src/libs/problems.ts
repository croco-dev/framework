import { Problem, ProblemCategory } from "@croco/problems-core";

/** Reports a non-canonical, non-positive, or otherwise invalid offer amount. */
export class InvalidOfferAmountProblem extends Problem {
  readonly code = "promotions-core/amount-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string, options?: { readonly cause?: Error }) {
    super(undefined, undefined, `Offer amount is invalid: ${reason}.`, options);
  }
}

/** Reports an invalid offer policy registration or policy editor value. */
export class InvalidOfferPolicyProblem extends Problem {
  readonly code = "promotions-core/policy-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string, options?: { readonly cause?: Error }) {
    super(undefined, undefined, `Offer policy is invalid: ${reason}.`, options);
  }
}

/** Reports that a subject is not eligible for an offer. */
export class OfferNotEligibleProblem extends Problem {
  readonly code = "promotions-core/not-eligible";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(subjectId: string, policyId: string, reason: string) {
    super(
      undefined,
      undefined,
      `Subject '${subjectId}' is not eligible for offer '${policyId}': ${reason}.`,
    );
  }
}

/** Reports that a referenced offer policy does not exist. */
export class OfferPolicyNotFoundProblem extends Problem {
  readonly code = "promotions-core/policy-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(policyId: string, version?: number) {
    super(
      undefined,
      undefined,
      version === undefined
        ? `Offer policy '${policyId}' was not found.`
        : `Offer policy '${policyId}' version ${version} was not found.`,
    );
  }
}

/** Reports that a fulfillment attempt failed without moving value. */
export class OfferFulfillmentFailedProblem extends Problem {
  readonly code = "promotions-core/fulfillment-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(claimId: string, reason: string) {
    super(undefined, undefined, `Offer claim '${claimId}' could not be fulfilled: ${reason}.`);
  }
}

/** Reports a conflicting re-registration of the same policy id and version. */
export class OfferPolicyConflictProblem extends Problem {
  readonly code = "promotions-core/policy-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(policyId: string, version: number) {
    super(
      undefined,
      undefined,
      `Offer policy '${policyId}' version ${version} is already registered with different content.`,
    );
  }
}

/** Reports that a referenced offer quote does not exist. */
export class OfferQuoteNotFoundProblem extends Problem {
  readonly code = "promotions-core/quote-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(quoteId: string) {
    super(undefined, undefined, `Offer quote '${quoteId}' was not found.`);
  }
}

/** Reports a quote presented by another subject or with a forged customer or amount. */
export class OfferQuoteMismatchProblem extends Problem {
  readonly code = "promotions-core/quote-mismatch";
  readonly category = ProblemCategory.Forbidden;

  constructor(quoteId: string, reason: string) {
    super(undefined, undefined, `Offer quote '${quoteId}' cannot be accepted: ${reason}.`);
  }
}

/** Reports an expired quote or an offer outside its validity window. */
export class OfferExpiredProblem extends Problem {
  readonly code = "promotions-core/offer-expired";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(targetId: string, reason: string) {
    super(undefined, undefined, `Offer '${targetId}' is expired: ${reason}.`);
  }
}

/** Reports reuse of a logical claim key for a different semantic claim. */
export class OfferDuplicateClaimProblem extends Problem {
  readonly code = "promotions-core/duplicate-claim";
  readonly category = ProblemCategory.Conflict;

  constructor(logicalKey: string) {
    super(
      undefined,
      undefined,
      `Logical claim '${logicalKey}' was already used for a different claim payload.`,
    );
  }
}

/** Reports that the policy budget cannot cover another claim reservation. */
export class OfferBudgetExhaustedProblem extends Problem {
  readonly code = "promotions-core/budget-exhausted";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(policyId: string, version: number) {
    super(
      undefined,
      undefined,
      `Offer policy '${policyId}' version ${version} has no remaining budget for another claim.`,
    );
  }
}

/** Reports that a subject already received the per-subject limit for a cycle. */
export class OfferSubjectLimitReachedProblem extends Problem {
  readonly code = "promotions-core/subject-limit-reached";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(familyId: string, cycleId: string, subjectId: string, limit: number) {
    super(
      undefined,
      undefined,
      `Subject '${subjectId}' already reached the limit of ${limit} for offer family '${familyId}' cycle '${cycleId}'.`,
    );
  }
}

/** Reports two non-stackable claims in the same stacking group. */
export class OfferStackingConflictProblem extends Problem {
  readonly code = "promotions-core/stacking-conflict";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(stackingGroup: string, subjectId: string) {
    super(
      undefined,
      undefined,
      `Subject '${subjectId}' already holds a non-stackable claim in group '${stackingGroup}'.`,
    );
  }
}

/** Reports that a referenced offer claim does not exist. */
export class OfferClaimNotFoundProblem extends Problem {
  readonly code = "promotions-core/claim-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(claimId: string) {
    super(undefined, undefined, `Offer claim '${claimId}' was not found.`);
  }
}

/** Reports a claim transition that the current claim state does not allow. */
export class OfferClaimStateConflictProblem extends Problem {
  readonly code = "promotions-core/claim-state-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(claimId: string, state: string, reason: string) {
    super(
      undefined,
      undefined,
      `Offer claim '${claimId}' in state '${state}' cannot transition: ${reason}.`,
    );
  }
}

/** Reports a benefit whose fulfillment is not implemented for the provider. */
export class OfferUnsupportedBenefitProblem extends Problem {
  readonly code = "promotions-core/unsupported-benefit";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(policyId: string, provider: string) {
    super(
      undefined,
      undefined,
      `Offer '${policyId}' has no implemented discount fulfillment for provider '${provider}'.`,
    );
  }
}

/** Reports a discount charge whose currency does not match the benefit currency. */
export class OfferCurrencyMismatchProblem extends Problem {
  readonly code = "promotions-core/currency-mismatch";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(expectedCurrency: string, actualCurrency: string) {
    super(
      undefined,
      undefined,
      `Offer currency mismatch: expected '${expectedCurrency}', received '${actualCurrency}'.`,
    );
  }
}
