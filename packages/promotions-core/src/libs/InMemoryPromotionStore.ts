import { addOfferAmounts, compareOfferAmounts, subtractOfferAmounts } from "./amounts";
import { ZERO_OFFER_AMOUNT } from "./amounts";
import {
  InvalidOfferPolicyProblem,
  OfferBudgetExhaustedProblem,
  OfferClaimNotFoundProblem,
  OfferClaimStateConflictProblem,
  OfferDuplicateClaimProblem,
  OfferPolicyConflictProblem,
  OfferPolicyNotFoundProblem,
} from "./problems";
import type { PromotionStore, PromotionTx } from "./PromotionStore";
import type {
  ListClaimsFilter,
  OfferAuditEntry,
  OfferClaim,
  OfferClaimState,
  OfferQuote,
  OfferSubject,
  RegisteredOfferPolicy,
} from "./types";

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneSubject(subject: OfferSubject): OfferSubject {
  return { ...subject };
}

function cloneUnknown<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneUnknown) as unknown as T;
  if (value instanceof Date) return cloneDate(value) as unknown as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = cloneUnknown(entry);
    }
    return result as T;
  }
  return value;
}

function clonePolicy(policy: RegisteredOfferPolicy): RegisteredOfferPolicy {
  return {
    ...policy,
    benefit: cloneUnknown(policy.benefit),
    eligibility: {
      ...policy.eligibility,
      allowedSubjectKinds: policy.eligibility.allowedSubjectKinds
        ? [...policy.eligibility.allowedSubjectKinds]
        : undefined,
      allowedSubjectIds: policy.eligibility.allowedSubjectIds
        ? [...policy.eligibility.allowedSubjectIds]
        : undefined,
      deniedSubjectIds: policy.eligibility.deniedSubjectIds
        ? [...policy.eligibility.deniedSubjectIds]
        : undefined,
    },
    budget: { ...policy.budget },
    startsAt: cloneDate(policy.startsAt),
    endsAt: cloneDate(policy.endsAt),
    registeredAt: cloneDate(policy.registeredAt),
  };
}

function cloneQuote(quote: OfferQuote): OfferQuote {
  return {
    ...quote,
    subject: cloneSubject(quote.subject),
    benefit: cloneUnknown(quote.benefit),
    expiresAt: cloneDate(quote.expiresAt),
    quotedAt: cloneDate(quote.quotedAt),
  };
}

function cloneClaim(claim: OfferClaim): OfferClaim {
  return {
    ...claim,
    subject: cloneSubject(claim.subject),
    benefit: cloneUnknown(claim.benefit),
    budgetReservation: { ...claim.budgetReservation },
    createdAt: cloneDate(claim.createdAt),
    updatedAt: cloneDate(claim.updatedAt),
  };
}

import { stablePromotionFingerprint } from "./PromotionStore";

function matchesSubject(candidate: OfferSubject, filter: OfferSubject): boolean {
  return (
    candidate.appId === filter.appId &&
    candidate.environment === filter.environment &&
    candidate.tenantId === filter.tenantId &&
    candidate.kind === filter.kind &&
    candidate.id === filter.id
  );
}

type PolicyRecord = {
  policy: RegisteredOfferPolicy;
  fingerprint: string;
  reserved: string;
};

/**
 * Single-process promotion store. The store itself serves as the transaction
 * handle, and `transact` serializes work through a mutex so concurrent
 * reserves observe each other's budget reservations, matching the atomicity
 * contract PostgreSQL implementations provide with row locks.
 */
export class InMemoryPromotionStore implements PromotionStore, PromotionTx {
  private readonly policies = new Map<string, PolicyRecord>();
  private readonly quotes = new Map<string, OfferQuote>();
  private readonly claims = new Map<string, OfferClaim>();
  private readonly claimsByLogicalKey = new Map<string, { claimId: string; fingerprint: string }>();
  private readonly audits: OfferAuditEntry[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  private static policyKey(policyId: string, version: number): string {
    return `${policyId}@${version}`;
  }

  async transact<T>(work: (tx: PromotionTx) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => work(this));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async getPolicy(policyId: string, version: number): Promise<RegisteredOfferPolicy | null> {
    const record = this.policies.get(InMemoryPromotionStore.policyKey(policyId, version));
    return record ? clonePolicy(record.policy) : null;
  }

  async latestPolicyVersion(policyId: string): Promise<number | null> {
    let latest: number | null = null;
    for (const record of this.policies.values()) {
      if (record.policy.id === policyId && (latest === null || record.policy.version > latest)) {
        latest = record.policy.version;
      }
    }
    return latest;
  }

  async savePolicy(policy: RegisteredOfferPolicy): Promise<{ readonly created: boolean }> {
    const key = InMemoryPromotionStore.policyKey(policy.id, policy.version);
    const fingerprint = stablePromotionFingerprint(policy);
    const existing = this.policies.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new OfferPolicyConflictProblem(policy.id, policy.version);
      }
      return { created: false };
    }
    this.policies.set(key, {
      policy: clonePolicy(policy),
      fingerprint,
      reserved: ZERO_OFFER_AMOUNT,
    });
    return { created: true };
  }

  async getQuote(quoteId: string): Promise<OfferQuote | null> {
    const quote = this.quotes.get(quoteId);
    return quote ? cloneQuote(quote) : null;
  }

  async saveQuote(quote: OfferQuote): Promise<void> {
    if (!this.quotes.has(quote.id)) {
      this.quotes.set(quote.id, cloneQuote(quote));
    }
  }

  async getClaim(claimId: string): Promise<OfferClaim | null> {
    const claim = this.claims.get(claimId);
    return claim ? cloneClaim(claim) : null;
  }

  async getClaimByLogicalKey(logicalKey: string): Promise<OfferClaim | null> {
    const entry = this.claimsByLogicalKey.get(logicalKey);
    if (!entry) return null;
    return this.getClaim(entry.claimId);
  }

  async saveClaim(
    claim: OfferClaim,
    fingerprint: string,
  ): Promise<{ readonly created: boolean; readonly claim: OfferClaim }> {
    const existing = this.claimsByLogicalKey.get(claim.logicalKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new OfferDuplicateClaimProblem(claim.logicalKey);
      }
      const stored = this.claims.get(existing.claimId);
      if (!stored) throw new OfferDuplicateClaimProblem(claim.logicalKey);
      return { created: false, claim: cloneClaim(stored) };
    }
    if (this.claims.has(claim.id)) {
      throw new OfferDuplicateClaimProblem(claim.logicalKey);
    }
    this.claims.set(claim.id, cloneClaim(claim));
    this.claimsByLogicalKey.set(claim.logicalKey, { claimId: claim.id, fingerprint });
    return { created: true, claim: cloneClaim(claim) };
  }

  async compareAndSetClaimState(
    claimId: string,
    expected: readonly OfferClaimState[],
    next: OfferClaimState,
    patch: { readonly grantRef?: string } = {},
    now: Date = new Date(),
  ): Promise<OfferClaim> {
    const stored = this.claims.get(claimId);
    if (!stored) throw new OfferClaimNotFoundProblem(claimId);
    if (!expected.includes(stored.state)) {
      throw new OfferClaimStateConflictProblem(
        claimId,
        stored.state,
        `expected one of ${expected.join(", ")} to move to '${next}'`,
      );
    }
    const updated: OfferClaim = {
      ...cloneClaim(stored),
      state: next,
      grantRef: patch.grantRef ?? stored.grantRef,
      updatedAt: new Date(now.getTime()),
    };
    this.claims.set(claimId, updated);
    return cloneClaim(updated);
  }

  async addBudgetReservation(policyId: string, version: number, amount: string): Promise<void> {
    const record = this.policies.get(InMemoryPromotionStore.policyKey(policyId, version));
    if (!record) throw new OfferPolicyNotFoundProblem(policyId, version);
    const next = addOfferAmounts(record.reserved, amount);
    if (compareOfferAmounts(next, record.policy.budget.total) > 0) {
      throw new OfferBudgetExhaustedProblem(policyId, version);
    }
    record.reserved = next;
  }

  async releaseBudgetReservation(policyId: string, version: number, amount: string): Promise<void> {
    const record = this.policies.get(InMemoryPromotionStore.policyKey(policyId, version));
    if (!record) throw new OfferPolicyNotFoundProblem(policyId, version);
    record.reserved =
      compareOfferAmounts(amount, record.reserved) >= 0
        ? ZERO_OFFER_AMOUNT
        : subtractOfferAmounts(record.reserved, amount);
  }

  async readBudgetReserved(policyId: string, version: number): Promise<string> {
    const record = this.policies.get(InMemoryPromotionStore.policyKey(policyId, version));
    if (!record) throw new OfferPolicyNotFoundProblem(policyId, version);
    return record.reserved;
  }

  async countSubjectClaims(
    familyId: string,
    benefitCycleId: string,
    subject: OfferSubject,
    states: readonly OfferClaimState[],
  ): Promise<number> {
    let count = 0;
    for (const claim of this.claims.values()) {
      if (
        claim.familyId === familyId &&
        claim.benefitCycleId === benefitCycleId &&
        matchesSubject(claim.subject, subject) &&
        states.includes(claim.state)
      ) {
        count += 1;
      }
    }
    return count;
  }

  async listClaims(filter: ListClaimsFilter): Promise<readonly OfferClaim[]> {
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new InvalidOfferPolicyProblem("list limit must be an integer between 1 and 1000");
    }
    const result: OfferClaim[] = [];
    for (const claim of this.claims.values()) {
      if (filter.subject !== undefined && !matchesSubject(claim.subject, filter.subject)) continue;
      if (filter.familyId !== undefined && claim.familyId !== filter.familyId) continue;
      if (filter.benefitCycleId !== undefined && claim.benefitCycleId !== filter.benefitCycleId) {
        continue;
      }
      if (filter.stackingGroup !== undefined && claim.stackingGroup !== filter.stackingGroup) {
        continue;
      }
      if (filter.states !== undefined && !filter.states.includes(claim.state)) continue;
      result.push(cloneClaim(claim));
      if (result.length >= limit) break;
    }
    return result;
  }

  async recordAudit(entry: OfferAuditEntry): Promise<void> {
    this.audits.push({ ...entry, recordedAt: new Date(entry.recordedAt.getTime()) });
  }

  /** Test and console support: read-only audit trail in insertion order. */
  async listAudits(): Promise<readonly OfferAuditEntry[]> {
    return this.audits.map((entry) => ({
      ...entry,
      recordedAt: new Date(entry.recordedAt.getTime()),
    }));
  }
}
