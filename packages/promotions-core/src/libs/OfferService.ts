import { assertOfferSubject, registerOfferPolicy, sameOfferSubject } from "./OfferPolicy";
import { claimFingerprint } from "./PromotionStore";
import type { PromotionStore } from "./PromotionStore";
import {
  InvalidOfferPolicyProblem,
  OfferClaimNotFoundProblem,
  OfferClaimStateConflictProblem,
  OfferExpiredProblem,
  OfferFulfillmentFailedProblem,
  OfferNotEligibleProblem,
  OfferPolicyNotFoundProblem,
  OfferQuoteMismatchProblem,
  OfferQuoteNotFoundProblem,
  OfferStackingConflictProblem,
  OfferSubjectLimitReachedProblem,
  OfferUnsupportedBenefitProblem,
} from "./problems";
import type {
  EligibilityVerdict,
  OfferAuditEntry,
  OfferClaim,
  OfferClaimState,
  OfferEligibilityHook,
  OfferFulfillmentPort,
  OfferQuote,
  OfferSubject,
  QuoteOfferInput,
  RegisteredOfferPolicy,
  RegisterOfferPolicyInput,
  ReserveClaimInput,
} from "./types";

const DEFAULT_QUOTE_TTL_MS = 15 * 60 * 1000;
const COUNTED_CLAIM_STATES: readonly OfferClaimState[] = [
  "reserved",
  "fulfilling",
  "fulfilled",
  "indeterminate",
];

function defaultEligibilityHook(input: {
  readonly subject: OfferSubject;
  readonly policy: RegisteredOfferPolicy;
}): EligibilityVerdict {
  const { subject, policy } = input;
  const conditions = policy.eligibility;
  if (conditions.deniedSubjectIds?.includes(subject.id)) {
    return { eligible: false, reason: `subject '${subject.id}' is denied for this offer` };
  }
  if (
    conditions.allowedSubjectIds !== undefined &&
    !conditions.allowedSubjectIds.includes(subject.id)
  ) {
    return { eligible: false, reason: `subject '${subject.id}' is not in the allowed list` };
  }
  if (
    conditions.allowedSubjectKinds !== undefined &&
    !conditions.allowedSubjectKinds.includes(subject.kind)
  ) {
    return { eligible: false, reason: `subject kind '${subject.kind}' is not allowed` };
  }
  return { eligible: true };
}

function claimIdempotencyKey(claimId: string): string {
  return `promotion-claim:${claimId}`;
}

export type OfferServiceOptions = {
  readonly store: PromotionStore;
  /** Fulfillment boundary for trial-credit grants; discount quotes complete without ledger movement. */
  readonly fulfillment: OfferFulfillmentPort;
  readonly eligibility?: OfferEligibilityHook;
  readonly clock?: () => Date;
  readonly idGenerator?: () => string;
  readonly quoteTtlMs?: number;
};

export type ReserveClaimResult = {
  readonly claim: OfferClaim;
  /** False when the logical key replayed an identical earlier reservation. */
  readonly created: boolean;
};

export class OfferService {
  private readonly store: PromotionStore;
  private readonly fulfillment: OfferFulfillmentPort;
  private readonly eligibility: OfferEligibilityHook;
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;
  private readonly quoteTtlMs: number;

  constructor(options: OfferServiceOptions) {
    this.store = options.store;
    this.fulfillment = options.fulfillment;
    this.eligibility = options.eligibility ?? defaultEligibilityHook;
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => globalThis.crypto.randomUUID());
    const quoteTtlMs = options.quoteTtlMs ?? DEFAULT_QUOTE_TTL_MS;
    if (
      !Number.isInteger(quoteTtlMs) ||
      quoteTtlMs < 60_000 ||
      quoteTtlMs > 7 * 24 * 60 * 60 * 1000
    ) {
      throw new InvalidOfferPolicyProblem(
        "quoteTtlMs must be an integer between 60000 and 604800000",
      );
    }
    this.quoteTtlMs = quoteTtlMs;
  }

  async registerPolicy(input: RegisterOfferPolicyInput): Promise<{
    readonly policy: RegisteredOfferPolicy;
    readonly created: boolean;
  }> {
    const policy = registerOfferPolicy(input, this.now());
    const { created } = await this.store.transact(async (tx) => {
      const result = await tx.savePolicy(policy);
      await tx.recordAudit(this.audit("policy", policy.id, "policy.registered", policy, input));
      return result;
    });
    return { policy, created };
  }

  async evaluateEligibility(input: {
    readonly policyId: string;
    readonly version?: number;
    readonly subject: OfferSubject;
    readonly now?: Date;
  }): Promise<EligibilityVerdict> {
    const policy = await this.loadPolicy(input.policyId, input.version);
    assertOfferSubject(input.subject);
    return this.eligibility({ subject: input.subject, policy, now: input.now ?? this.now() });
  }

  async quoteOffer(input: QuoteOfferInput): Promise<OfferQuote> {
    assertOfferSubject(input.subject);
    const now = input.now ?? this.now();
    const policy = await this.loadPolicy(input.policy.id, input.policy.version);
    this.assertPolicyWindow(policy, now);
    const verdict = await this.eligibility({ subject: input.subject, policy, now });
    if (!verdict.eligible) {
      throw new OfferNotEligibleProblem(input.subject.id, policy.id, verdict.reason);
    }
    const ttl = input.quoteTtlMs ?? this.quoteTtlMs;
    if (!Number.isInteger(ttl) || ttl < 60_000 || ttl > 7 * 24 * 60 * 60 * 1000) {
      throw new InvalidOfferPolicyProblem(
        "quoteTtlMs must be an integer between 60000 and 604800000",
      );
    }
    const amounts = faceAndCost(policy);
    const quote: OfferQuote = {
      id: input.quoteId ?? this.idGenerator(),
      policyId: policy.id,
      policyVersion: policy.version,
      familyId: policy.familyId,
      benefitCycleId: policy.benefitCycleId,
      subject: { ...input.subject },
      benefit: structuredBenefit(policy),
      faceAmount: amounts.face,
      costAmount: amounts.cost,
      currency: amounts.currency,
      expiresAt: new Date(now.getTime() + ttl),
      eligibilityRevision: policy.eligibility.revision,
      quotedAt: new Date(now.getTime()),
    };
    if (quote.id.trim().length === 0) {
      throw new InvalidOfferPolicyProblem("quoteId must not be blank");
    }
    await this.store.transact(async (tx) => {
      await tx.saveQuote(quote);
    });
    return quote;
  }

  /**
   * Reserves a claim for a quoted offer. The quoted subject, benefit snapshot,
   * and amounts are taken from the stored quote: client-supplied customers or
   * amounts are never trusted. Eligibility is rechecked live, so a customer
   * who lost eligibility after exposure is rejected here.
   */
  async reserveClaim(input: ReserveClaimInput): Promise<ReserveClaimResult> {
    assertOfferSubject(input.subject);
    if (input.logicalKey.trim().length === 0) {
      throw new InvalidOfferPolicyProblem("logicalKey must not be blank");
    }
    const now = input.now ?? this.now();
    return this.store.transact(async (tx) => {
      const quote = await tx.getQuote(input.quoteId);
      if (!quote) throw new OfferQuoteNotFoundProblem(input.quoteId);
      if (!sameOfferSubject(quote.subject, input.subject)) {
        throw new OfferQuoteMismatchProblem(
          quote.id,
          "the quote belongs to another customer, scope, or subject",
        );
      }
      if (quote.expiresAt.getTime() <= now.getTime()) {
        throw new OfferExpiredProblem(quote.id, "the quote expired before acceptance");
      }
      const policy = await tx.getPolicy(quote.policyId, quote.policyVersion);
      if (!policy) throw new OfferPolicyNotFoundProblem(quote.policyId, quote.policyVersion);
      this.assertPolicyWindow(policy, now);
      const verdict = await this.eligibility({ subject: input.subject, policy, now });
      if (!verdict.eligible) {
        throw new OfferNotEligibleProblem(input.subject.id, policy.id, verdict.reason);
      }
      this.requireProvider(policy, input.provider);
      const candidate: OfferClaim = {
        id: input.claimId ?? this.idGenerator(),
        quoteId: quote.id,
        logicalKey: input.logicalKey,
        policyId: policy.id,
        policyVersion: policy.version,
        familyId: policy.familyId,
        benefitCycleId: policy.benefitCycleId,
        subject: { ...input.subject },
        benefit: structuredBenefit(policy),
        faceAmount: quote.faceAmount,
        costAmount: quote.costAmount,
        currency: quote.currency,
        state: "reserved",
        budgetReservation: { amount: quote.faceAmount },
        stackingGroup: policy.stackingGroup,
        createdAt: new Date(now.getTime()),
        updatedAt: new Date(now.getTime()),
      };
      if (candidate.id.trim().length === 0) {
        throw new InvalidOfferPolicyProblem("claimId must not be blank");
      }
      const fingerprint = claimFingerprint(candidate);
      const replayed = await tx.getClaimByLogicalKey(candidate.logicalKey);
      if (replayed) {
        const result = await tx.saveClaim(candidate, fingerprint);
        return { claim: result.claim, created: result.created };
      }
      const counted = await tx.countSubjectClaims(
        policy.familyId,
        policy.benefitCycleId,
        input.subject,
        COUNTED_CLAIM_STATES,
      );
      if (counted >= policy.perSubjectLimit) {
        throw new OfferSubjectLimitReachedProblem(
          policy.familyId,
          policy.benefitCycleId,
          input.subject.id,
          policy.perSubjectLimit,
        );
      }
      if (policy.stackingGroup !== undefined && !policy.allowStacking) {
        const stacked = await tx.listClaims({
          subject: input.subject,
          stackingGroup: policy.stackingGroup,
          states: COUNTED_CLAIM_STATES,
          limit: 2,
        });
        if (stacked.length > 0) {
          throw new OfferStackingConflictProblem(policy.stackingGroup, input.subject.id);
        }
      }
      await tx.addBudgetReservation(policy.id, policy.version, candidate.budgetReservation.amount);
      const saved = await tx.saveClaim(candidate, fingerprint);
      await tx.recordAudit(
        this.audit("claim", saved.claim.id, "claim.reserved", policy, {
          actorId: input.subject.id,
          reason: `accept quote ${quote.id}`,
          idempotencyKey: candidate.logicalKey,
        }),
      );
      return { claim: saved.claim, created: saved.created };
    });
  }

  /**
   * Fulfills a reserved claim. Trial-credit grants run through the fulfillment
   * port with a deterministic idempotency key, so retries after response loss
   * confirm the original grant instead of paying twice. Discount quotes
   * complete as recorded entitlements without ledger movement. A port that
   * reports `unknown` — or throws after possibly committing — leaves the claim
   * `indeterminate` with its budget locked for later reconciliation.
   */
  async fulfillClaim(input: {
    readonly claimId: string;
    readonly provider?: string;
    readonly now?: Date;
  }): Promise<OfferClaim> {
    const now = input.now ?? this.now();
    const stored = await this.store.getClaim(input.claimId);
    if (!stored) throw new OfferClaimNotFoundProblem(input.claimId);
    if (stored.state === "fulfilled") return stored;
    if (stored.state === "indeterminate") return this.reconcileClaim({ claimId: stored.id, now });
    if (stored.state !== "reserved" && stored.state !== "fulfilling") {
      throw new OfferClaimStateConflictProblem(
        stored.id,
        stored.state,
        "only reserved claims can be fulfilled; reconcile indeterminate claims explicitly",
      );
    }
    const quote = await this.store.getQuote(stored.quoteId);
    if (!quote) throw new OfferQuoteNotFoundProblem(stored.quoteId);
    const policy = await this.store.getPolicy(stored.policyId, stored.policyVersion);
    if (!policy) throw new OfferPolicyNotFoundProblem(stored.policyId, stored.policyVersion);
    if (stored.benefit.kind === "discount-quote") {
      const provider = this.requireProvider(policy, input.provider);
      return this.store.transact(async (tx) => {
        await tx.compareAndSetClaimState(
          stored.id,
          ["reserved", "fulfilling"],
          "fulfilling",
          {},
          now,
        );
        const fulfilled = await tx.compareAndSetClaimState(
          stored.id,
          ["fulfilling"],
          "fulfilled",
          { grantRef: `discount-quote:${provider}:${stored.id}` },
          now,
        );
        await tx.recordAudit(
          this.audit("claim", stored.id, "claim.fulfilled", policy, {
            actorId: stored.subject.id,
            reason: `record ${provider} discount entitlement`,
            idempotencyKey: claimIdempotencyKey(stored.id),
          }),
        );
        return fulfilled;
      });
    }
    await this.store.transact(async (tx) => {
      await tx.compareAndSetClaimState(
        stored.id,
        ["reserved", "fulfilling"],
        "fulfilling",
        {},
        now,
      );
    });
    let result: Awaited<ReturnType<OfferFulfillmentPort["fulfill"]>>;
    try {
      result = await this.fulfillment.fulfill({
        idempotencyKey: claimIdempotencyKey(stored.id),
        claim: stored,
        quote,
        policy,
        subject: stored.subject,
        provider: input.provider,
      });
    } catch (error) {
      await this.markIndeterminate(
        stored,
        policy,
        "the grant outcome is unknown after a port failure",
        now,
      );
      throw error;
    }
    switch (result.outcome) {
      case "granted":
        return this.store.transact(async (tx) => {
          const fulfilled = await tx.compareAndSetClaimState(
            stored.id,
            ["fulfilling"],
            "fulfilled",
            { grantRef: result.grantRef },
            now,
          );
          await tx.recordAudit(
            this.audit("claim", stored.id, "claim.fulfilled", policy, {
              actorId: stored.subject.id,
              reason: `grant ${result.grantRef}`,
              idempotencyKey: claimIdempotencyKey(stored.id),
            }),
          );
          return fulfilled;
        });
      case "failed": {
        await this.store.transact(async (tx) => {
          await tx.compareAndSetClaimState(stored.id, ["fulfilling"], "rejected", {}, now);
          await tx.releaseBudgetReservation(
            stored.policyId,
            stored.policyVersion,
            stored.budgetReservation.amount,
          );
          await tx.recordAudit(
            this.audit("claim", stored.id, "claim.rejected", policy, {
              actorId: stored.subject.id,
              reason: result.reason,
              idempotencyKey: claimIdempotencyKey(stored.id),
            }),
          );
        });
        throw new OfferFulfillmentFailedProblem(stored.id, result.reason);
      }
      case "unknown":
        return this.markIndeterminate(stored, policy, result.reason, now);
    }
  }

  /**
   * Reconciles a claim whose grant outcome is unclear. A visible grant
   * completes the claim; otherwise `fulfilling` claims safely retry the
   * idempotent grant, while `indeterminate` claims stay locked for an explicit
   * operator decision. Reconciliation never releases the budget or pays again
   * on its own.
   */
  async reconcileClaim(input: {
    readonly claimId: string;
    readonly now?: Date;
  }): Promise<OfferClaim> {
    const now = input.now ?? this.now();
    const stored = await this.store.getClaim(input.claimId);
    if (!stored) throw new OfferClaimNotFoundProblem(input.claimId);
    if (stored.state === "fulfilled" || stored.state === "reserved") return stored;
    if (stored.state === "expired" || stored.state === "rejected") {
      throw new OfferClaimStateConflictProblem(
        stored.id,
        stored.state,
        "terminal claims cannot be reconciled",
      );
    }
    const policy = await this.store.getPolicy(stored.policyId, stored.policyVersion);
    if (!policy) throw new OfferPolicyNotFoundProblem(stored.policyId, stored.policyVersion);
    const observed = await this.fulfillment.check({
      idempotencyKey: claimIdempotencyKey(stored.id),
      claim: stored,
      subject: stored.subject,
    });
    if (observed) {
      return this.store.transact(async (tx) => {
        const fulfilled = await tx.compareAndSetClaimState(
          stored.id,
          ["fulfilling", "indeterminate"],
          "fulfilled",
          { grantRef: observed.grantRef },
          now,
        );
        await tx.recordAudit(
          this.audit("claim", stored.id, "claim.reconciled", policy, {
            actorId: "system",
            reason: `observed grant ${observed.grantRef}`,
            idempotencyKey: claimIdempotencyKey(stored.id),
          }),
        );
        return fulfilled;
      });
    }
    if (stored.state === "fulfilling") {
      return this.fulfillClaim({ claimId: stored.id, now });
    }
    return stored;
  }

  /**
   * Operator adjustment for indeterminate claims: explicitly complete with a
   * verified grant reference, or reject and release the locked budget. Every
   * decision preserves actor, reason, and an audit trail.
   */
  async resolveIndeterminateClaim(input: {
    readonly claimId: string;
    readonly decision: "fulfilled" | "rejected";
    readonly grantRef?: string;
    readonly actorId: string;
    readonly reason: string;
    readonly idempotencyKey?: string;
    readonly now?: Date;
  }): Promise<OfferClaim> {
    if (input.actorId.trim().length === 0) {
      throw new InvalidOfferPolicyProblem("actorId must not be blank");
    }
    if (input.reason.trim().length === 0) {
      throw new InvalidOfferPolicyProblem("reason must not be blank");
    }
    if (
      input.decision === "fulfilled" &&
      (input.grantRef === undefined || input.grantRef.trim().length === 0)
    ) {
      throw new InvalidOfferPolicyProblem("fulfilling an indeterminate claim requires a grantRef");
    }
    const now = input.now ?? this.now();
    return this.store.transact(async (tx) => {
      const stored = await tx.getClaim(input.claimId);
      if (!stored) throw new OfferClaimNotFoundProblem(input.claimId);
      if (stored.state !== "indeterminate") {
        throw new OfferClaimStateConflictProblem(
          stored.id,
          stored.state,
          "only indeterminate claims accept an operator decision",
        );
      }
      const policy = await tx.getPolicy(stored.policyId, stored.policyVersion);
      if (!policy) throw new OfferPolicyNotFoundProblem(stored.policyId, stored.policyVersion);
      const resolved = await tx.compareAndSetClaimState(
        stored.id,
        ["indeterminate"],
        input.decision,
        input.decision === "fulfilled" ? { grantRef: input.grantRef } : {},
        now,
      );
      if (input.decision === "rejected") {
        await tx.releaseBudgetReservation(
          stored.policyId,
          stored.policyVersion,
          stored.budgetReservation.amount,
        );
      }
      await tx.recordAudit(
        this.audit("claim", stored.id, `claim.${input.decision}-by-operator`, policy, {
          actorId: input.actorId,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey ?? `operator:${stored.id}:${now.getTime()}`,
        }),
      );
      return resolved;
    });
  }

  /**
   * Expires reserved claims whose quotes lapsed. Re-reading never extends an
   * expiry, and claims with an unclear grant outcome keep their locked budget
   * until reconciliation or an operator decision.
   */
  async expireOverdueClaims(input: {
    readonly now?: Date;
    readonly limit?: number;
  }): Promise<readonly OfferClaim[]> {
    const now = input.now ?? this.now();
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new InvalidOfferPolicyProblem("limit must be an integer between 1 and 1000");
    }
    return this.store.transact(async (tx) => {
      const candidates = await tx.listClaims({ states: ["reserved"], limit });
      const expired: OfferClaim[] = [];
      for (const candidate of candidates) {
        const quote = await tx.getQuote(candidate.quoteId);
        if (!quote || quote.expiresAt.getTime() > now.getTime()) continue;
        const policy = await tx.getPolicy(candidate.policyId, candidate.policyVersion);
        if (!policy) continue;
        const done = await tx.compareAndSetClaimState(
          candidate.id,
          ["reserved"],
          "expired",
          {},
          now,
        );
        await tx.releaseBudgetReservation(
          candidate.policyId,
          candidate.policyVersion,
          candidate.budgetReservation.amount,
        );
        await tx.recordAudit(
          this.audit("claim", candidate.id, "claim.expired", policy, {
            actorId: "system",
            reason: `quote ${quote.id} lapsed`,
            idempotencyKey: `expiry:${candidate.id}`,
          }),
        );
        expired.push(done);
      }
      return expired;
    });
  }

  /** Lists reserved, fulfilling, and indeterminate claims so restarts can resume them. */
  async recoverPendingClaims(input: { readonly limit?: number }): Promise<readonly OfferClaim[]> {
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new InvalidOfferPolicyProblem("limit must be an integer between 1 and 1000");
    }
    return this.store.listClaims({
      states: ["reserved", "fulfilling", "indeterminate"],
      limit,
    });
  }

  async getPolicy(policyId: string, version?: number): Promise<RegisteredOfferPolicy | null> {
    if (version === undefined) {
      const latest = await this.store.latestPolicyVersion(policyId);
      if (latest === null) return null;
      return this.store.getPolicy(policyId, latest);
    }
    return this.store.getPolicy(policyId, version);
  }

  async getQuote(quoteId: string): Promise<OfferQuote | null> {
    return this.store.getQuote(quoteId);
  }

  async getClaim(claimId: string): Promise<OfferClaim | null> {
    return this.store.getClaim(claimId);
  }

  private now(): Date {
    const now = this.clock();
    if (Number.isNaN(now.getTime())) {
      throw new InvalidOfferPolicyProblem("clock returned an invalid date");
    }
    return new Date(now.getTime());
  }

  private async loadPolicy(policyId: string, version?: number): Promise<RegisteredOfferPolicy> {
    if (policyId.trim().length === 0) {
      throw new InvalidOfferPolicyProblem("policyId must not be blank");
    }
    if (version === undefined) {
      const latest = await this.store.latestPolicyVersion(policyId);
      if (latest === null) throw new OfferPolicyNotFoundProblem(policyId);
      const policy = await this.store.getPolicy(policyId, latest);
      if (!policy) throw new OfferPolicyNotFoundProblem(policyId, latest);
      return policy;
    }
    const policy = await this.store.getPolicy(policyId, version);
    if (!policy) throw new OfferPolicyNotFoundProblem(policyId, version);
    return policy;
  }

  private assertPolicyWindow(policy: RegisteredOfferPolicy, now: Date): void {
    if (now.getTime() < policy.startsAt.getTime()) {
      throw new OfferExpiredProblem(policy.id, "the offer has not started yet");
    }
    if (now.getTime() >= policy.endsAt.getTime()) {
      throw new OfferExpiredProblem(policy.id, "the offer window already ended");
    }
  }

  private requireProvider(
    policy: RegisteredOfferPolicy,
    provider: string | undefined,
  ): string | undefined {
    if (policy.benefit.kind !== "discount-quote") return undefined;
    if (provider === undefined || provider.trim().length === 0) {
      throw new InvalidOfferPolicyProblem("discount claims require a provider");
    }
    if (!policy.benefit.supportedProviders.includes(provider)) {
      throw new OfferUnsupportedBenefitProblem(policy.id, provider);
    }
    return provider;
  }

  private async markIndeterminate(
    claim: OfferClaim,
    policy: RegisteredOfferPolicy,
    reason: string,
    now: Date,
  ): Promise<OfferClaim> {
    return this.store.transact(async (tx) => {
      const updated = await tx.compareAndSetClaimState(
        claim.id,
        ["fulfilling"],
        "indeterminate",
        {},
        now,
      );
      await tx.recordAudit(
        this.audit("claim", claim.id, "claim.indeterminate", policy, {
          actorId: claim.subject.id,
          reason,
          idempotencyKey: claimIdempotencyKey(claim.id),
        }),
      );
      return updated;
    });
  }

  private audit(
    targetKind: "policy" | "claim",
    targetId: string,
    action: string,
    policy: RegisteredOfferPolicy,
    evidence: {
      readonly actorId: string;
      readonly reason: string;
      readonly idempotencyKey: string;
    },
  ): OfferAuditEntry {
    return {
      auditId: this.idGenerator(),
      targetKind,
      targetId,
      action,
      actorId: evidence.actorId,
      reason: evidence.reason,
      revision: `${policy.id}@${policy.version}`,
      idempotencyKey: evidence.idempotencyKey,
      recordedAt: this.now(),
    };
  }
}

function faceAndCost(policy: RegisteredOfferPolicy): {
  readonly face: string;
  readonly cost: string;
  readonly currency?: string;
} {
  switch (policy.benefit.kind) {
    case "trial-credits":
      return { face: policy.benefit.creditAmount, cost: policy.benefit.creditAmount };
    case "discount-quote":
      return {
        face: String(policy.benefit.maxDiscount.amount),
        cost: String(policy.benefit.maxDiscount.amount),
        currency: policy.benefit.currency,
      };
  }
}

function structuredBenefit(policy: RegisteredOfferPolicy): RegisteredOfferPolicy["benefit"] {
  const benefit = policy.benefit;
  switch (benefit.kind) {
    case "trial-credits":
      return {
        kind: "trial-credits",
        creditAmount: benefit.creditAmount,
        walletKey: benefit.walletKey,
        expiresAt: benefit.expiresAt ? new Date(benefit.expiresAt.getTime()) : undefined,
      };
    case "discount-quote":
      return {
        kind: "discount-quote",
        percentBps: benefit.percentBps,
        maxDiscount: { ...benefit.maxDiscount },
        currency: benefit.currency,
        supportedProviders: [...benefit.supportedProviders],
      };
  }
}

export { DEFAULT_QUOTE_TTL_MS };
