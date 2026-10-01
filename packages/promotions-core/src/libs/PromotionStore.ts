import type {
  ListClaimsFilter,
  OfferAuditEntry,
  OfferClaim,
  OfferClaimState,
  OfferQuote,
  OfferSubject,
  RegisteredOfferPolicy,
} from "./types";

function stableSerialize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Deterministic fingerprint shared by every PromotionStore implementation, so
 * idempotency replays agree across in-memory and PostgreSQL adapters.
 */
export function stablePromotionFingerprint(value: unknown): string {
  return stableSerialize(value);
}

/**
 * Semantic fingerprint of a claim: identical retries replay the same receipt
 * while a different payload under the same logical key is a conflict.
 */ export function claimFingerprint(claim: OfferClaim): string {
  return stableSerialize({
    quoteId: claim.quoteId,
    policyId: claim.policyId,
    policyVersion: claim.policyVersion,
    familyId: claim.familyId,
    benefitCycleId: claim.benefitCycleId,
    subject: claim.subject,
    benefit: claim.benefit,
    faceAmount: claim.faceAmount,
    costAmount: claim.costAmount,
    currency: claim.currency,
    stackingGroup: claim.stackingGroup,
    budgetReservation: claim.budgetReservation,
  });
}

/**
 * Transactional promotion storage boundary.
 *
 * Implementations must make `transact` atomic: budget reservation, subject
 * counting, stacking checks, and claim insertion inside one `transact` call
 * observe each other, so concurrent reserves serialize instead of
 * overspending the budget. Claim state changes are compare-and-set guarded by
 * the expected states.
 */
export interface PromotionTx {
  getPolicy(policyId: string, version: number): Promise<RegisteredOfferPolicy | null>;
  latestPolicyVersion(policyId: string): Promise<number | null>;
  /**
   * Persists a registered policy. The same `(id, version)` with an identical
   * document replays as `{ created: false }`; a different document under the
   * same `(id, version)` is a conflict.
   */
  savePolicy(policy: RegisteredOfferPolicy): Promise<{ readonly created: boolean }>;
  getQuote(quoteId: string): Promise<OfferQuote | null>;
  saveQuote(quote: OfferQuote): Promise<void>;
  getClaim(claimId: string): Promise<OfferClaim | null>;
  getClaimByLogicalKey(logicalKey: string): Promise<OfferClaim | null>;
  /**
   * Persists a claim. A known logical key with an identical claim fingerprint
   * replays as `{ created: false }`; a different payload under the same key is
   * a duplicate-claim conflict.
   */
  saveClaim(
    claim: OfferClaim,
    fingerprint: string,
  ): Promise<{ readonly created: boolean; readonly claim: OfferClaim }>;
  compareAndSetClaimState(
    claimId: string,
    expected: readonly OfferClaimState[],
    next: OfferClaimState,
    patch?: {
      readonly grantRef?: string;
    },
    now?: Date,
  ): Promise<OfferClaim>;
  addBudgetReservation(policyId: string, version: number, amount: string): Promise<void>;
  releaseBudgetReservation(policyId: string, version: number, amount: string): Promise<void>;
  readBudgetReserved(policyId: string, version: number): Promise<string>;
  countSubjectClaims(
    familyId: string,
    benefitCycleId: string,
    subject: OfferSubject,
    states: readonly OfferClaimState[],
  ): Promise<number>;
  listClaims(filter: ListClaimsFilter): Promise<readonly OfferClaim[]>;
  recordAudit(entry: OfferAuditEntry): Promise<void>;
}

export interface PromotionStore {
  transact<T>(work: (tx: PromotionTx) => Promise<T>): Promise<T>;
  getPolicy(policyId: string, version: number): Promise<RegisteredOfferPolicy | null>;
  latestPolicyVersion(policyId: string): Promise<number | null>;
  getQuote(quoteId: string): Promise<OfferQuote | null>;
  getClaim(claimId: string): Promise<OfferClaim | null>;
  getClaimByLogicalKey(logicalKey: string): Promise<OfferClaim | null>;
  listClaims(filter: ListClaimsFilter): Promise<readonly OfferClaim[]>;
}
