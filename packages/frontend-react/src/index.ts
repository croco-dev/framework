/**
 * @croco/frontend-react
 *
 * React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지.
 *
 * @croco/meta-vite runtime에서 렌더링한 page context를 React에 연결하며,
 * page data access 훅과 createCrocoPageConfig 함수을 제공한다.
 */

export type {
  CanonicalCrocoPageOptions,
  CrocoPageConfig,
  CrocoPageOptions,
  LegacyCrocoPageOptions,
} from "./libs/createCrocoPages";
export { createCrocoPageConfig } from "./libs/createCrocoPages";
export {
  AuthBridgeContext,
  AuthBridgeGateStatus,
  AuthBridgeProblemNotice,
  AuthBridgeRecoveryActions,
  CrocoAuthBridgeProvider,
  RequireEntitlement,
  RequirePermission,
  RequireSession,
  createAuthBridgeMissingProviderProblemDetails,
  createFrontendAuthBridgeState,
  createFrontendEntitlementDeniedProblemDetails,
  createFrontendPermissionDeniedProblemDetails,
  createFrontendProblemDetails,
  createFrontendTenantUnavailableProblemDetails,
  createFrontendUnauthenticatedProblemDetails,
  createMissingProviderAuthBridgeState,
  evaluateSessionGateState,
  useAuthBridgeState,
  useEntitlements,
  usePermissionGate,
  useSessionGate,
  useTenant,
} from "./libs/authBridge";
export {
  ProblemBoundary,
  ProblemPanel,
  ProblemRecoveryActions,
  ProblemToastAdapter,
  createProblemToastPayload,
  normalizeProblemDetails,
} from "./libs/problemUi";
export type {
  AuthBridgeGateStatusProps,
  CrocoAuthBridgeProviderProps,
  FrontendAuthBridgeSource,
  FrontendAuthBridgeState,
  FrontendAuthBridgeStateInput,
  FrontendAuthGateAllowedState,
  FrontendAuthGateBlockedState,
  FrontendAuthGateDeniedState,
  FrontendAuthGateFallback,
  FrontendAuthGateLoadingState,
  FrontendAuthGateRequirements,
  FrontendAuthGateState,
  FrontendAuthGateUnauthenticatedState,
  FrontendAuthGateUnavailableState,
  FrontendEntitlementCheck,
  FrontendEntitlementState,
  FrontendPermissionCheck,
  FrontendPermissionState,
  FrontendRecoveryAction,
  FrontendSession,
  FrontendSessionPrincipal,
  FrontendSessionState,
  FrontendTenant,
  FrontendTenantState,
  RequireEntitlementProps,
  RequirePermissionProps,
  RequireSessionProps,
} from "./libs/authBridgeTypes";
export type {
  ProblemBoundaryFallback,
  ProblemBoundaryFallbackState,
  ProblemBoundaryProps,
  ProblemBoundaryState,
  ProblemPanelProps,
  ProblemRecoveryAction,
  ProblemRecoveryActionKind,
  ProblemRecoveryActionsProps,
  ProblemToastAdapterProps,
  ProblemToastPayload,
} from "./libs/problemUiTypes";
export {
  PageDataContext,
  PageDataProvider,
  PageDataUnavailableProblem,
  usePageData,
  usePageMeta,
  useParsedPageData,
  useRequiredPageData,
} from "./libs/hooks/usePageData";
export type { CrocoDataFn, CrocoPageContext } from "./libs/types";
export { GoalProgress, NextActionCard } from "./libs/GoalProgress";
export { MyBenefits, OfferCard } from "./libs/OfferCard";
export { ReferralClaimLanding, ReferralProgress, ReferralShareCard } from "./libs/ReferralCards";
export type {
  ReferralClaimLandingProps,
  ReferralClaimLandingState,
  ReferralProgressProps,
  ReferralProgressState,
  ReferralShareCardProps,
  ReferralShareState,
} from "./libs/ReferralCards";
export type {
  MyBenefitsEntry,
  MyBenefitsProps,
  OfferCardProps,
  OfferCardState,
} from "./libs/OfferCard";
export type {
  GoalProgressProps,
  GoalProgressState,
  NextActionCardProps,
} from "./libs/GoalProgress";
export { ExperienceSlot } from "./libs/ExperienceSlot";
export type { ExperienceRenderer, ExperienceSlotProps } from "./libs/ExperienceSlot";

export { ReminderSettingsForm, SnoozeControl } from "./libs/ReminderSettingsForm";
export type {
  ReminderSettingsInput,
  ReminderSettingsView,
  ReminderSettingsState,
  ReminderSettingsRevision,
  ReminderSettingsSave,
  ReminderSettingsSource,
  ReminderSettingsFormProps,
  SnoozeControlProps,
} from "./libs/ReminderSettingsForm";

export { ContinueCard, SavedItems } from "./libs/SavedItems";
export type { ContinueCardProps, SavedItemsProps, SavedItemsState } from "./libs/SavedItems";

export { GroupProgress } from "./libs/GroupProgress";
export type {
  GroupProgressProps,
  GroupProgressState,
  GroupProgressView,
} from "./libs/GroupProgress";
export { JoinChallenge } from "./libs/JoinChallenge";
export type {
  JoinChallengeProps,
  JoinChallengeRequest,
  JoinChallengeSource,
} from "./libs/JoinChallenge";
export { BadgeShelf, RewardReceipt } from "./libs/Rewards";
export type { RewardViewState } from "./libs/Rewards";

export { ProgressCard, StreakCalendar, AchievementToast } from "./libs/MissionProgress";
export type { MissionProgressState, ProgressCardProps } from "./libs/MissionProgress";
