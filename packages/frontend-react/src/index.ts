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
