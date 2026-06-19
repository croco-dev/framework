/**
 * @croco/admin-react
 *
 * Provider-neutral React primitives and contracts for SaaS billing, entitlement,
 * quota, usage, and provider status administration.
 */

export {
  AdminActionList,
  BillingEntitlementAdminPanel,
  BillingStatus,
  EntitlementList,
  PlanSummary,
  ProblemNotice,
  UsageQuotaMeter,
} from "./libs/components";
export {
  createBillingEntitlementAdminPanelState,
  createCoreProblemDetails,
  createInMemoryBillingEntitlementAdminPanelState,
  createPermissionDeniedProblemDetails,
  evaluateAdminActionPermissions,
} from "./libs/snapshot";
export type {
  AdminActionContract,
  AdminActionPermissionDecision,
  AdminActionSource,
  AdminAuditMetadata,
  AdminBillingStatus,
  AdminEntitlementRow,
  AdminMeteringState,
  AdminMutability,
  AdminPanelActionHandler,
  AdminPlanSummary,
  AdminProblemReference,
  AdminProviderState,
  AdminStateSource,
  AdminUsageMeter,
  BillingEntitlementAdminPanelProps,
  BillingEntitlementAdminPanelReadyState,
  BillingEntitlementAdminPanelState,
  BillingEntitlementAdminPanelStateInput,
  BillingProviderFailureState,
  BillingProviderStatus,
  NonEmptyArray,
  PermissionDeniedAdminPanelState,
} from "./libs/types";
