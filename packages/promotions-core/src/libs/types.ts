/**
 * Offer scope shared by subjects, policies, quotes, and claims.
 *
 * A complete scope is required everywhere: omitting the tenant never grants a
 * global permission. The server validates the full scope on every transition.
 */
export type OfferScope = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId: string;
};

/** Typed customer (or customer-owned subject) an offer is evaluated for. */
export type OfferSubject = OfferScope & {
  readonly kind: string;
  readonly id: string;
};

/** Trial credit grant paid through the existing credit ledger. */
export type TrialCreditBenefit = {
  readonly kind: "trial-credits";
  /** Canonical base-10 offer amount string (at most 18 fraction digits). */
  readonly creditAmount: string;
  /** Wallet the grant lands in; resolved to a validated mapped ledger account. */
  readonly walletKey?: string;
  /** Optional grant expiry; never refreshed by re-reading the offer. */
  readonly expiresAt?: Date;
};

/** Discount computed as pure Money math; provider fulfillment is quote-only. */
export type DiscountQuoteBenefit = {
  readonly kind: "discount-quote";
  /** Integer basis points in 1..10000 (10000 = 100%). */
  readonly percentBps: number;
  /** Cap expressed as Money JSON; currency must equal `currency`. */
  readonly maxDiscount: {
    readonly amount: number;
    readonly currency: string;
  };
  /** ISO 4217 currency the charge must use; mixed currencies are rejected. */
  readonly currency: string;
  /**
   * Providers whose discount feature is actually implemented. An empty list
   * means provider fulfillment is unsupported: quotes stay informational and
   * reservation is refused instead of pretending the discount exists.
   */
  readonly supportedProviders: readonly string[];
};

export type OfferBenefit = TrialCreditBenefit | DiscountQuoteBenefit;

/** Static eligibility conditions pinned to an eligibility revision. */
export type OfferEligibilityConditions = {
  readonly revision: string;
  readonly allowedSubjectKinds?: readonly string[];
  readonly allowedSubjectIds?: readonly string[];
  readonly deniedSubjectIds?: readonly string[];
};

export type OfferBudget = {
  /** Total budget locked by claim reservations for this policy version. */
  readonly total: string;
  /** Maximum face amount a single claim may reserve. */
  readonly perClaim: string;
};

export type RegisterOfferPolicyInput = {
  readonly id: string;
  /** Integer policy version; quotes and claims pin the version they were made under. */
  readonly version: number;
  /** Policy family; defaults to `id`. perSubjectLimit counts never reset on revision alone. */
  readonly familyId?: string;
  /**
   * Explicit benefit cycle id. A fresh allowance always requires a new explicit
   * cycle id; changing `version` alone never resets per-subject counts.
   */
  readonly benefitCycleId: string;
  readonly benefit: OfferBenefit;
  readonly eligibility: OfferEligibilityConditions;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** Required per-subject receipt limit; unlimited is never implied. */
  readonly perSubjectLimit: number;
  readonly budget: OfferBudget;
  /** Claims sharing a group conflict unless `allowStacking` is true. */
  readonly stackingGroup?: string;
  readonly allowStacking?: boolean;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type RegisteredOfferPolicy = {
  readonly id: string;
  readonly version: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly benefit: OfferBenefit;
  readonly eligibility: OfferEligibilityConditions;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly perSubjectLimit: number;
  readonly budget: OfferBudget;
  readonly stackingGroup?: string;
  readonly allowStacking: boolean;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly registeredAt: Date;
};

export type OfferQuote = {
  readonly id: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly subject: OfferSubject;
  /** Benefit snapshot pinned at quote time; later policy revisions never rewrite it. */
  readonly benefit: OfferBenefit;
  /** Locked face value and actual cost, pinned with amount and unit. */
  readonly faceAmount: string;
  readonly costAmount: string;
  readonly currency?: string;
  readonly expiresAt: Date;
  readonly eligibilityRevision: string;
  readonly quotedAt: Date;
};

export type OfferClaimState =
  | "reserved"
  | "fulfilling"
  | "fulfilled"
  | "expired"
  | "rejected"
  | "indeterminate";

export type OfferClaim = {
  readonly id: string;
  readonly quoteId: string;
  readonly logicalKey: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly subject: OfferSubject;
  /** Benefit snapshot pinned from the quote; immune to later policy revisions. */
  readonly benefit: OfferBenefit;
  readonly faceAmount: string;
  readonly costAmount: string;
  readonly currency?: string;
  readonly state: OfferClaimState;
  readonly grantRef?: string;
  /** Budget locked by this claim until it reaches a terminal state. */
  readonly budgetReservation: {
    readonly amount: string;
  };
  readonly stackingGroup?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type OfferAuditEntry = {
  readonly auditId: string;
  readonly targetKind: "policy" | "claim";
  readonly targetId: string;
  readonly action: string;
  readonly actorId: string;
  readonly reason: string;
  readonly revision: string;
  readonly idempotencyKey: string;
  readonly recordedAt: Date;
};

export type EligibilityVerdict =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: string };

/** Live eligibility hook; re-evaluated server-side at accept time, not just exposure. */
export type OfferEligibilityHook = (input: {
  readonly subject: OfferSubject;
  readonly policy: RegisteredOfferPolicy;
  readonly now: Date;
}) => Promise<EligibilityVerdict> | EligibilityVerdict;

export type QuoteOfferInput = {
  readonly policy: {
    readonly id: string;
    readonly version?: number;
  };
  readonly subject: OfferSubject;
  readonly quoteId?: string;
  readonly quoteTtlMs?: number;
  readonly now?: Date;
};

export type ReserveClaimInput = {
  readonly quoteId: string;
  /** Authenticated caller; must equal the quoted subject or the claim is rejected. */
  readonly subject: OfferSubject;
  readonly logicalKey: string;
  readonly claimId?: string;
  /** Provider the discount is fulfilled through; required for discount benefits. */
  readonly provider?: string;
  readonly now?: Date;
};

export type FulfillmentResult =
  | { readonly outcome: "granted"; readonly grantRef: string }
  | { readonly outcome: "unknown"; readonly reason: string }
  | { readonly outcome: "failed"; readonly reason: string };

/**
 * External fulfillment boundary. `fulfill` must be idempotent on
 * `idempotencyKey`: a retry after response loss returns the original grant
 * instead of paying twice. `check` reports a previously completed grant or
 * null when nothing durable is visible; it never pays.
 */
export interface OfferFulfillmentPort {
  fulfill(input: {
    readonly idempotencyKey: string;
    readonly claim: OfferClaim;
    readonly quote: OfferQuote;
    readonly policy: RegisteredOfferPolicy;
    readonly subject: OfferSubject;
    readonly provider?: string;
  }): Promise<FulfillmentResult>;
  check(input: {
    readonly idempotencyKey: string;
    readonly claim: OfferClaim;
    readonly subject: OfferSubject;
  }): Promise<{ readonly grantRef: string } | null>;
}

export type DiscountQuote = {
  /** False when the provider has no implemented discount feature. */
  readonly supported: boolean;
  readonly discount: {
    readonly amount: number;
    readonly currency: string;
  };
  readonly face: {
    readonly amount: number;
    readonly currency: string;
  };
  readonly provider: string;
  readonly currency: string;
};

export type QuoteDiscountInput = {
  readonly benefit: DiscountQuoteBenefit;
  readonly charge: {
    readonly amount: number;
    readonly currency: string;
  };
  readonly provider: string;
};

export type ListClaimsFilter = {
  readonly subject?: OfferSubject;
  readonly familyId?: string;
  readonly benefitCycleId?: string;
  readonly stackingGroup?: string;
  readonly states?: readonly OfferClaimState[];
  readonly limit?: number;
};
