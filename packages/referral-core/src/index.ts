/**
 * @packageDocumentation
 *
 * Explicit referral attribution from a shared link through qualification to
 * dual-side benefits. Programs pin benefit snapshots, conversion windows,
 * and qualifying actions; the first valid claim for a recipient inside a
 * program family wins, and later claims are held as duplicates. Qualification
 * and novelty come from authoritative app-owned server sources, never from
 * client assertions or IP/device similarity. Benefits fulfill per side with
 * deterministic idempotency keys, so one side may succeed while the other
 * stays pending without re-paying the completed side on retry.
 */

export {
  registerReferralProgram,
  assertReferralScope,
  assertReferralSubject,
  sameReferralSubject,
  sameReferralScope,
} from "./libs/ReferralProgram";
export { InMemoryReferralStore } from "./libs/InMemoryReferralStore";
export {
  ZERO_REFERRAL_AMOUNT,
  addReferralAmounts,
  canonicalReferralAmount,
  compareReferralAmounts,
  subtractReferralAmounts,
} from "./libs/amounts";
export {
  attributionFingerprint,
  stableReferralFingerprint,
  assertReferralLimit,
} from "./libs/ReferralStore";
export type { ReferralStore, ReferralTx } from "./libs/ReferralStore";
export {
  ReferralService,
  referralBenefitIdempotencyKey,
  DEFAULT_LINK_TTL_MS,
} from "./libs/ReferralService";
export type {
  ReferralServiceOptions,
  ReferralTokenHooks,
  ClaimReferralResult,
} from "./libs/ReferralService";
export {
  InvalidReferralProgramProblem,
  ReferralProgramNotFoundProblem,
  ReferralProgramConflictProblem,
  ReferralLinkNotFoundProblem,
  ReferralLinkRevokedProblem,
  ReferralLinkExpiredProblem,
  ReferralSelfReferralProblem,
  ReferralTenantMismatchProblem,
  ReferralExistingCustomerProblem,
  ReferralNoveltyUnknownProblem,
  ReferralDuplicateClaimProblem,
  ReferralSubjectLimitReachedProblem,
  ReferralBudgetExhaustedProblem,
  ReferralAttributionNotFoundProblem,
  ReferralAttributionStateConflictProblem,
  ReferralQualificationRejectedProblem,
  ReferralBenefitFailedProblem,
} from "./libs/problems";
export type {
  ReferralScope,
  ReferralSubject,
  ReferralCreditBenefit,
  ReferralNoBenefit,
  ReferralBenefit,
  ReferralProgramDefinition,
  RegisterReferralProgramInput,
  ReferralLink,
  ReferralAttributionState,
  ReferralAttributionHoldReason,
  ReferralAttributionRejectReason,
  ReferralAttribution,
  ReferralBenefitSide,
  ReferralBenefitIntentStatus,
  ReferralBenefitIntent,
  ReferralAuditEntry,
  ReferralNoveltyVerdict,
  ReferralQualificationVerdict,
  ReferralNoveltyHook,
  ReferralQualificationHook,
  ReferralFulfillmentResult,
  ReferralFulfillmentPort,
  CreateReferralLinkInput,
  CreateReferralLinkResult,
  ClaimReferralAttributionInput,
  QualifyReferralAttributionInput,
  FulfillReferralBenefitsInput,
  ReferralFunnelCounts,
  ListAttributionsFilter,
  ListBenefitIntentsFilter,
  ListReferralLinksFilter,
} from "./libs/types";
