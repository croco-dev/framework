/**
 * @packageDocumentation
 *
 * Code-registered promotional offers with controlled eligibility, stacking,
 * and budget. Policies pin benefit snapshots into quotes and claims, so later
 * revisions never rewrite confirmed terms. Trial credits fulfill through the
 * existing credit ledger adapter; discount quotes stay pure Money math and
 * never pretend an unimplemented provider feature exists.
 */

export { registerOfferPolicy, assertOfferScope, assertOfferSubject } from "./libs/OfferPolicy";
export { sameOfferSubject } from "./libs/OfferPolicy";
export { quoteDiscount } from "./libs/quoteDiscount";
export { InMemoryPromotionStore } from "./libs/InMemoryPromotionStore";
export {
  ZERO_OFFER_AMOUNT,
  addOfferAmounts,
  canonicalOfferAmount,
  compareOfferAmounts,
  subtractOfferAmounts,
} from "./libs/amounts";
export { claimFingerprint, stablePromotionFingerprint } from "./libs/PromotionStore";
export type { PromotionStore, PromotionTx } from "./libs/PromotionStore";
export { OfferService, DEFAULT_QUOTE_TTL_MS } from "./libs/OfferService";
export type { OfferServiceOptions, ReserveClaimResult } from "./libs/OfferService";
export type { CreditGrantAccountResolver } from "./libs/CreditGrantAdapter";
export {
  OfferCurrencyMismatchProblem,
  InvalidOfferAmountProblem,
  InvalidOfferPolicyProblem,
  OfferBudgetExhaustedProblem,
  OfferClaimNotFoundProblem,
  OfferClaimStateConflictProblem,
  OfferDuplicateClaimProblem,
  OfferExpiredProblem,
  OfferFulfillmentFailedProblem,
  OfferNotEligibleProblem,
  OfferPolicyConflictProblem,
  OfferPolicyNotFoundProblem,
  OfferQuoteMismatchProblem,
  OfferQuoteNotFoundProblem,
  OfferStackingConflictProblem,
  OfferSubjectLimitReachedProblem,
  OfferUnsupportedBenefitProblem,
} from "./libs/problems";
export type {
  DiscountQuote,
  DiscountQuoteBenefit,
  EligibilityVerdict,
  FulfillmentResult,
  ListClaimsFilter,
  OfferAuditEntry,
  OfferBenefit,
  OfferBudget,
  OfferClaim,
  OfferClaimState,
  OfferEligibilityConditions,
  OfferEligibilityHook,
  OfferFulfillmentPort,
  OfferQuote,
  OfferScope,
  OfferSubject,
  QuoteDiscountInput,
  QuoteOfferInput,
  RegisteredOfferPolicy,
  RegisterOfferPolicyInput,
  ReserveClaimInput,
  TrialCreditBenefit,
} from "./libs/types";
