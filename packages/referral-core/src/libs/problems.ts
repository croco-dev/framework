import { Problem, ProblemCategory } from "@croco/problems-core";

/** Reports an invalid referral program registration or link input. */
export class InvalidReferralProgramProblem extends Problem {
  readonly code = "referral-core/program-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string, options?: { readonly cause?: Error }) {
    super(undefined, undefined, `Referral program is invalid: ${reason}.`, options);
  }
}

/** Reports that a referenced referral program does not exist. */
export class ReferralProgramNotFoundProblem extends Problem {
  readonly code = "referral-core/program-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(programId: string, version?: number) {
    super(
      undefined,
      undefined,
      version === undefined
        ? `Referral program '${programId}' was not found.`
        : `Referral program '${programId}' version ${version} was not found.`,
    );
  }
}

/** Reports a conflicting re-registration of the same program id and version. */
export class ReferralProgramConflictProblem extends Problem {
  readonly code = "referral-core/program-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(programId: string, version: number) {
    super(
      undefined,
      undefined,
      `Referral program '${programId}' version ${version} is already registered with different content.`,
    );
  }
}

/** Reports that a referral link token does not resolve to a known link. */
export class ReferralLinkNotFoundProblem extends Problem {
  readonly code = "referral-core/link-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor() {
    super(undefined, undefined, "Referral link was not found for the presented token.");
  }
}

/** Reports a revoked referral link presented for claim. */
export class ReferralLinkRevokedProblem extends Problem {
  readonly code = "referral-core/link-revoked";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(linkId: string) {
    super(undefined, undefined, `Referral link '${linkId}' was revoked and accepts no claims.`);
  }
}

/** Reports an expired referral link presented for claim. */
export class ReferralLinkExpiredProblem extends Problem {
  readonly code = "referral-core/link-expired";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(linkId: string) {
    super(undefined, undefined, `Referral link '${linkId}' expired before the claim.`);
  }
}

/** Reports a claim where referrer and recipient resolve to the same subject. */
export class ReferralSelfReferralProblem extends Problem {
  readonly code = "referral-core/self-referral";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor() {
    super(
      undefined,
      undefined,
      "Self-referral is rejected: referrer and recipient resolved to the same subject.",
    );
  }
}

/** Reports a claim from another tenant against a link owned by this tenant. */
export class ReferralTenantMismatchProblem extends Problem {
  readonly code = "referral-core/other-tenant-link";
  readonly category = ProblemCategory.Forbidden;

  constructor(linkId: string) {
    super(
      undefined,
      undefined,
      `Referral link '${linkId}' belongs to another tenant and cannot be claimed here.`,
    );
  }
}

/** Reports a recipient already known as an existing customer. */
export class ReferralExistingCustomerProblem extends Problem {
  readonly code = "referral-core/existing-customer";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(recipientId: string, reason: string) {
    super(
      undefined,
      undefined,
      `Recipient '${recipientId}' is an existing customer and cannot be referred: ${reason}.`,
    );
  }
}

/** Reports that recipient novelty could not be determined from the server source. */
export class ReferralNoveltyUnknownProblem extends Problem {
  readonly code = "referral-core/novelty-unknown";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(recipientId: string, reason: string) {
    super(
      undefined,
      undefined,
      `Recipient '${recipientId}' novelty is unknown, so attribution is held: ${reason}.`,
    );
  }
}

/** Reports a later claim losing the first-valid race for the same recipient. */
export class ReferralDuplicateClaimProblem extends Problem {
  readonly code = "referral-core/duplicate-claim";
  readonly category = ProblemCategory.Conflict;

  constructor(recipientId: string) {
    super(
      undefined,
      undefined,
      `Recipient '${recipientId}' already holds a first-valid attribution for this program family.`,
    );
  }
}

/** Reports that a recipient already received the per-subject limit for a cycle. */
export class ReferralSubjectLimitReachedProblem extends Problem {
  readonly code = "referral-core/subject-limit-reached";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(familyId: string, cycleId: string, side: string, limit: number) {
    super(
      undefined,
      undefined,
      `${side} already reached the limit of ${limit} for referral family '${familyId}' cycle '${cycleId}'.`,
    );
  }
}

/** Reports that the program budget cannot cover another attribution. */
export class ReferralBudgetExhaustedProblem extends Problem {
  readonly code = "referral-core/budget-exhausted";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(programId: string, version: number) {
    super(
      undefined,
      undefined,
      `Referral program '${programId}' version ${version} has no remaining budget for another attribution.`,
    );
  }
}

/** Reports that a referenced attribution does not exist. */
export class ReferralAttributionNotFoundProblem extends Problem {
  readonly code = "referral-core/attribution-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(attributionId: string) {
    super(undefined, undefined, `Referral attribution '${attributionId}' was not found.`);
  }
}

/** Reports an attribution transition the current state does not allow. */
export class ReferralAttributionStateConflictProblem extends Problem {
  readonly code = "referral-core/attribution-state-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(attributionId: string, state: string, reason: string) {
    super(
      undefined,
      undefined,
      `Referral attribution '${attributionId}' in state '${state}' cannot transition: ${reason}.`,
    );
  }
}

/** Reports a qualification attempt rejected by the authoritative source. */
export class ReferralQualificationRejectedProblem extends Problem {
  readonly code = "referral-core/qualification-rejected";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(attributionId: string, reason: string) {
    super(
      undefined,
      undefined,
      `Referral attribution '${attributionId}' did not qualify: ${reason}.`,
    );
  }
}

/** Reports a benefit attempt that failed without moving value. */
export class ReferralBenefitFailedProblem extends Problem {
  readonly code = "referral-core/benefit-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    attributionId: string,
    side: string,
    reason: string,
    options?: { readonly cause?: Error },
  ) {
    super(
      undefined,
      undefined,
      `Referral benefit for '${attributionId}' side '${side}' could not be fulfilled: ${reason}.`,
      options,
    );
  }
}
