/**
 * Referral scope shared by programs, links, attributions, and benefits.
 *
 * A complete scope is required everywhere: omitting the tenant never grants a
 * global permission. The server validates the full scope on every transition.
 */
export type ReferralScope = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId: string;
};

/** Typed customer (or customer-owned subject) a referral is evaluated for. */
export type ReferralSubject = ReferralScope & {
  readonly kind: string;
  readonly id: string;
};

/** Trial credit grant paid through the existing credit ledger. */
export type ReferralCreditBenefit = {
  readonly kind: "trial-credits";
  /** Canonical base-10 amount string (at most 18 fraction digits). */
  readonly creditAmount: string;
  /** Wallet the grant lands in; resolved to a validated mapped ledger account. */
  readonly walletKey?: string;
  /** Optional grant expiry; never refreshed by re-reading the program. */
  readonly expiresAt?: Date;
};

/** Progress-only tracking: no ledger movement, attribution still recorded. */
export type ReferralNoBenefit = {
  readonly kind: "none";
};

export type ReferralBenefit = ReferralCreditBenefit | ReferralNoBenefit;

export type ReferralProgramDefinition = {
  readonly id: string;
  /** Integer program version; links and attributions pin the version they used. */
  readonly version: number;
  /** Program family; defaults to `id`. Receipt limits never reset on revision alone. */
  readonly familyId: string;
  /**
   * Explicit benefit cycle id. A fresh allowance always requires a new explicit
   * cycle id; changing `version` alone never resets per-subject counts.
   */
  readonly benefitCycleId: string;
  /** First qualifying action wins the attribution; later claims are held, not merged. */
  readonly attributionPolicy: "first-valid";
  /** Conversion window after claim inside which qualification still counts. */
  readonly conversionWindowMs: number;
  /** Required qualifying action reported by an authoritative server source. */
  readonly qualifyingAction: string;
  readonly referrerBenefit: ReferralBenefit;
  readonly recipientBenefit: ReferralBenefit;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** Required per-subject receipt limit; unlimited is never implied. */
  readonly perSubjectLimit: number;
  /** Total reservable budget in benefit units for this program version. */
  readonly budgetTotal: string;
  /** Maximum face amount a single attribution may reserve. */
  readonly budgetPerAttribution: string;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly registeredAt: Date;
};

export type RegisterReferralProgramInput = {
  readonly id: string;
  readonly version: number;
  readonly familyId?: string;
  readonly benefitCycleId: string;
  readonly conversionWindowMs: number;
  readonly qualifyingAction: string;
  readonly referrerBenefit: ReferralBenefit;
  readonly recipientBenefit: ReferralBenefit;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly perSubjectLimit: number;
  readonly budgetTotal: string;
  readonly budgetPerAttribution: string;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type ReferralLink = {
  readonly id: string;
  /** SHA-256 hash of the raw token; the raw token never persists or logs. */
  readonly tokenHash: string;
  readonly programId: string;
  readonly programVersion: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly referrer: ReferralSubject;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt?: Date;
};

export type ReferralAttributionState =
  | "claimed"
  | "qualified"
  | "benefits-pending"
  | "benefits-partial"
  | "fulfilled"
  | "held"
  | "rejected"
  | "expired"
  | "indeterminate";

export type ReferralAttributionHoldReason =
  | "duplicate-claim"
  | "unknown-novelty"
  | "existing-customer-review";

export type ReferralAttributionRejectReason =
  | "self-referral"
  | "expired-link"
  | "existing-customer"
  | "other-tenant-link"
  | "link-not-found"
  | "link-revoked"
  | "program-window-closed"
  | "subject-limit-reached"
  | "budget-exhausted";

export type ReferralAttribution = {
  readonly id: string;
  readonly linkId: string;
  readonly programId: string;
  readonly programVersion: number;
  readonly familyId: string;
  readonly benefitCycleId: string;
  readonly scope: ReferralScope;
  readonly referrer: ReferralSubject;
  /** Present once the recipient is known; absent while the link is only shared. */
  readonly recipient?: ReferralSubject;
  readonly claimedAt: Date;
  readonly expiresAt: Date;
  readonly state: ReferralAttributionState;
  readonly holdReason?: ReferralAttributionHoldReason;
  readonly rejectReason?: ReferralAttributionRejectReason;
  /** Authoritative qualification evidence; present once qualified. */
  readonly qualification?: {
    readonly sourceEventId: string;
    readonly qualifyingAction: string;
    readonly qualifiedAt: Date;
    readonly eligibleReason: string;
  };
  readonly cycleIndex: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ReferralBenefitSide = "referrer" | "recipient";

export type ReferralBenefitIntentStatus =
  | "pending"
  | "granting"
  | "granted"
  | "failed"
  | "unknown"
  | "canceled"
  | "returned"
  | "skipped";

export type ReferralBenefitIntent = {
  readonly id: string;
  readonly attributionId: string;
  readonly side: ReferralBenefitSide;
  /** Deterministic key: `referral-benefit:<attributionId>:<side>`. */
  readonly logicalKey: string;
  readonly idempotencyKey: string;
  readonly subject: ReferralSubject;
  readonly benefit: ReferralBenefit;
  readonly status: ReferralBenefitIntentStatus;
  readonly accountRef?: string;
  readonly receipt?: string;
  readonly reason?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ReferralAuditEntry = {
  readonly auditId: string;
  readonly targetKind: "program" | "link" | "attribution" | "benefit";
  readonly targetId: string;
  readonly action: string;
  readonly actorId: string;
  readonly reason: string;
  readonly revision: string;
  readonly idempotencyKey: string;
  readonly recordedAt: Date;
};

/** Authoritative novelty evidence supplied by the app's own signup source. */
export type ReferralNoveltyVerdict =
  | { readonly novelty: "new"; readonly reason: string }
  | { readonly novelty: "existing"; readonly reason: string }
  | { readonly novelty: "unknown"; readonly reason: string };

/** Authoritative qualification evidence supplied by the app's own action source. */
export type ReferralQualificationVerdict =
  | {
      readonly qualified: true;
      readonly sourceEventId: string;
      readonly qualifyingAction: string;
      readonly eligibleReason: string;
    }
  | { readonly qualified: false; readonly reason: string };

export type ReferralNoveltyHook = (input: {
  readonly recipient: ReferralSubject;
  readonly attribution: Pick<ReferralAttribution, "id" | "programId" | "programVersion">;
  readonly now: Date;
}) => Promise<ReferralNoveltyVerdict> | ReferralNoveltyVerdict;

export type ReferralQualificationHook = (input: {
  readonly recipient: ReferralSubject;
  readonly attribution: ReferralAttribution;
  readonly now: Date;
}) => Promise<ReferralQualificationVerdict> | ReferralQualificationVerdict;

export type ReferralFulfillmentResult =
  | { readonly outcome: "granted"; readonly grantRef: string }
  | { readonly outcome: "unknown"; readonly reason: string }
  | { readonly outcome: "failed"; readonly reason: string }
  | { readonly outcome: "skipped"; readonly reason: string };

/**
 * External benefit boundary. `fulfill` must be idempotent on
 * `idempotencyKey`: a retry after response loss returns the original grant
 * instead of paying twice. `check` reports a previously completed grant or
 * null when nothing durable is visible; it never pays. `reverse` posts a
 * compensating return for an already granted side; it never deletes history.
 */
export interface ReferralFulfillmentPort {
  fulfill(input: {
    readonly idempotencyKey: string;
    readonly intent: ReferralBenefitIntent;
    readonly attribution: ReferralAttribution;
    readonly program: ReferralProgramDefinition;
    readonly subject: ReferralSubject;
  }): Promise<ReferralFulfillmentResult>;
  check(input: {
    readonly idempotencyKey: string;
    readonly intent: ReferralBenefitIntent;
    readonly subject: ReferralSubject;
  }): Promise<{ readonly grantRef: string } | null>;
  reverse?(input: {
    readonly returnIdempotencyKey: string;
    readonly intent: ReferralBenefitIntent;
    readonly subject: ReferralSubject;
    readonly attributionId: string;
    readonly policy: string;
    readonly reason: string;
  }): Promise<{ readonly returnRef: string } | { readonly error: string }>;
}

export type CreateReferralLinkInput = {
  readonly programId: string;
  readonly programVersion?: number;
  readonly referrer: ReferralSubject;
  readonly linkId?: string;
  readonly token?: string;
  readonly tokenHash?: string;
  readonly linkTtlMs?: number;
  readonly now?: Date;
};

export type CreateReferralLinkResult = {
  /** Durable link row; never carries the raw token. */
  readonly link: ReferralLink;
  /** Raw token returned once to the caller for sharing; never persisted. */
  readonly token: string;
};

export type ClaimReferralAttributionInput = {
  readonly token: string;
  readonly recipient: ReferralSubject;
  readonly attributionId?: string;
  readonly now?: Date;
};

export type QualifyReferralAttributionInput = {
  readonly attributionId: string;
  readonly recipient: ReferralSubject;
  readonly now?: Date;
};

export type FulfillReferralBenefitsInput = {
  readonly attributionId: string;
  readonly now?: Date;
};

export type ReferralFunnelCounts = {
  readonly clicks: number;
  readonly claims: number;
  readonly signups: number;
  readonly qualified: number;
  readonly fulfilled: number;
};

export type ListReferralLinksFilter = {
  readonly programId?: string;
  readonly familyId?: string;
  readonly benefitCycleId?: string;
  readonly referrer?: ReferralSubject;
  readonly limit?: number;
};

export type ListAttributionsFilter = {
  readonly programId?: string;
  readonly familyId?: string;
  readonly benefitCycleId?: string;
  readonly referrer?: ReferralSubject;
  readonly recipient?: ReferralSubject;
  readonly states?: readonly ReferralAttributionState[];
  readonly limit?: number;
};

export type ListBenefitIntentsFilter = {
  readonly attributionId?: string;
  readonly side?: ReferralBenefitSide;
  readonly statuses?: readonly ReferralBenefitIntentStatus[];
  readonly limit?: number;
};
