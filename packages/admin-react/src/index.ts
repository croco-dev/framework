/**
 * @croco/admin-react
 *
 * Provider-neutral React primitives and contracts for SaaS billing, entitlement,
 * quota, usage, and provider status administration.
 */

export {
  AdminForm,
  AdminFormField,
  AdminFormGlobalProblem,
  AdminFormRecoveryActions,
  AdminActionList,
  BillingEntitlementAdminPanel,
  BillingStatus,
  EntitlementList,
  ImpersonationBanner,
  PlanSummary,
  PermissionInspector,
  ProblemNotice,
  TenantImpersonationConsole,
  TenantSwitcher,
  UsageQuotaMeter,
} from "./libs/components";
export { CreditOperationsConsole } from "./libs/CreditOperationsConsole";
export { OfferConsole } from "./libs/OfferConsole";
export { ExperimentReviewConsole } from "./libs/ExperimentReviewConsole";
export type { ExperimentReviewConsoleProps } from "./libs/ExperimentReviewConsole";
export { ActivationGuideConsole } from "./libs/ActivationGuideConsole";
export type {
  ActivationGuideConsoleProps,
  ActivationGuideTarget,
} from "./libs/ActivationGuideConsole";
export { PlanReleaseConsole } from "./libs/PlanReleaseConsoleView";
export {
  createPlanReleaseConsoleSnapshot,
  createPlanReleaseSemanticDiffGroups,
  getAllowedPlanReleaseActions,
  isPlanReleaseReviewCurrent,
  updatePlanReleaseDraftField,
  validatePlanReleaseActionRequest,
} from "./libs/planReleaseConsole";
export {
  createTenantWorkspaceActionRequest,
  TenantBusinessWorkspace,
} from "./libs/TenantBusinessWorkspace";
export { WebhookReliabilityConsole } from "./libs/WebhookReliabilityConsole";
export { EventCatalogPanel } from "./libs/EventCatalogPanel";
export {
  AudienceCampaignOperationsPanel,
  Customer360CommunicationPanel,
  DeliveryOperationsPanel,
  EngagementOperationsConsole,
  MessageOperationsPanel,
} from "./libs/EngagementOperationsConsole";
export {
  LifecycleAutomationConsole,
  LifecycleDryRunPanel,
  LifecycleRuleOperations,
  LifecycleRunHistory,
} from "./libs/LifecycleAutomationConsole";
export {
  classifyLifecycleRun,
  createLifecycleAutomationLoadingState,
  createLifecycleAutomationSource,
  diffLifecycleRuleDescriptors,
  loadLifecycleAutomationConsole,
} from "./libs/lifecycleAutomation";
export { useAdminForm } from "./libs/hooks";
export { AdminDataTable } from "./libs/DataTable";
export {
  createAdminDataTableInvalidRowIdProblemDetails,
  createAdminDataTableListResult,
  createAdminDataTableListResultFromCursorPage,
  createAdminDataTableListResultFromOffsetPage,
  createAdminDataTableListResultFromSearchResult,
  createAdminDataTablePermissionDeniedProblemDetails,
  createAdminDataTableState,
} from "./libs/dataTableSnapshot";
export {
  createAdminFormState,
  createBillingEntitlementAdminPanelState,
  createCoreProblemDetails,
  createImpersonationExpiredProblemDetails,
  createInMemoryAdminFormState,
  createInMemoryBillingEntitlementAdminPanelState,
  createInMemoryTenantImpersonationConsoleState,
  createPermissionInspectionProblemDetails,
  createPermissionInspectionUnavailableProblemDetails,
  createPermissionDeniedProblemDetails,
  createTenantImpersonationConsoleState,
  createTenantUnavailableProblemDetails,
  evaluateAdminActionPermissions,
  resetAdminFormState,
  submitAdminForm,
  updateAdminFormField,
} from "./libs/snapshot";
export type { CreditOperationsConsoleProps } from "./libs/CreditOperationsConsole";
export type { OfferConsoleProps } from "./libs/OfferConsole";
export { ReferralProgramConsole } from "./libs/ReferralProgramConsole";
export type { ReferralProgramConsoleProps } from "./libs/ReferralProgramConsole";
export type { PlanReleaseConsoleProps } from "./libs/PlanReleaseConsoleView";
export type {
  PlanReleaseActionDenialReason,
  PlanReleaseActionKind,
  PlanReleaseActionRequest,
  PlanReleaseActionValidation,
  PlanReleaseAdminAction,
  PlanReleaseCatalogName,
  PlanReleaseCatalogOption,
  PlanReleaseConsolePhase,
  PlanReleaseConsoleSnapshot,
  PlanReleaseConsoleState,
  PlanReleaseDiagnostic,
  PlanReleaseDraft,
  PlanReleaseDraftEditingState,
  PlanReleaseEditRequest,
  PlanReleaseEditResult,
  PlanReleaseEditor,
  PlanReleaseEditorCatalog,
  PlanReleaseFailureState,
  PlanReleaseFieldDescriptor,
  PlanReleaseImpact,
  PlanReleaseImpactAudience,
  PlanReleaseImpactItem,
  PlanReleaseLoadingState,
  PlanReleaseOperationalState,
  PlanReleasePublishedState,
  PlanReleasePublishedReceipt,
  PlanReleasePublishingState,
  PlanReleaseReadyState,
  PlanReleaseReviewState,
  PlanReleaseSchedulingState,
  PlanReleaseSemanticDiff,
  PlanReleaseSemanticDiffGroup,
  PlanReleaseSemanticDiffGroupName,
  PlanReleaseStaleConflictState,
  PlanReleaseValidationState,
} from "./libs/planReleaseConsole";
export type {
  AdminActionContract,
  AdminActionPermissionDecision,
  AdminActionSource,
  AdminAuditMetadata,
  AdminBillingStatus,
  AdminEntitlementRow,
  AdminImpersonationActiveInput,
  AdminImpersonationActiveState,
  AdminImpersonationConsoleState,
  AdminImpersonationExpiredInput,
  AdminImpersonationExpiredState,
  AdminImpersonationInactiveInput,
  AdminImpersonationInactiveState,
  AdminImpersonationPrincipal,
  AdminImpersonationStateInput,
  AdminImpersonationUnavailableInput,
  AdminImpersonationUnavailableState,
  AdminFormContract,
  AdminFormController,
  AdminFormFieldChangeHandler,
  AdminFormFieldContract,
  AdminFormFieldError,
  AdminFormFieldErrors,
  AdminFormFieldName,
  AdminFormFieldOption,
  AdminFormFieldType,
  AdminFormIntent,
  AdminFormLifecycleState,
  AdminFormProblemKind,
  AdminFormProblemResult,
  AdminFormProblemResultKind,
  AdminFormProps,
  AdminFormRecoveryAction,
  AdminFormRecoveryActionKind,
  AdminFormRenderActionsContext,
  AdminFormRenderFieldContext,
  AdminFormState,
  AdminFormStateOptions,
  AdminFormSubmitAction,
  AdminFormSubmitContext,
  AdminFormSubmitHandler,
  AdminFormSubmitResult,
  AdminFormSubmitSuccess,
  AdminFormValidationFailure,
  AdminMeteringState,
  AdminMutability,
  AdminPanelActionHandler,
  AdminPermissionInspectionInput,
  AdminPermissionInspectionRow,
  AdminPermissionInspectionState,
  AdminPlanSummary,
  AdminProblemReference,
  AdminProviderState,
  AdminStateSource,
  AdminTenantInput,
  AdminTenantSummary,
  AdminTenantSwitchOption,
  AdminTenantSwitchOptionInput,
  AdminUsageMeter,
  BillingEntitlementAdminPanelProps,
  BillingEntitlementAdminPanelReadyState,
  BillingEntitlementAdminPanelState,
  BillingEntitlementAdminPanelStateInput,
  BillingProviderFailureState,
  BillingProviderStatus,
  NonEmptyArray,
  PermissionDeniedAdminPanelState,
  TenantImpersonationConsoleActiveState,
  TenantImpersonationConsoleDeniedState,
  TenantImpersonationConsoleLoadingState,
  TenantImpersonationConsoleProps,
  TenantImpersonationConsoleState,
  TenantImpersonationConsoleStateInput,
  TenantImpersonationConsoleUnavailableState,
} from "./libs/types";
export type {
  AdminDataTableBulkActionEvent,
  AdminDataTableCellContext,
  AdminDataTableColumn,
  AdminDataTableCursorPageInput,
  AdminDataTableEmptyState,
  AdminDataTableField,
  AdminDataTableFilter,
  AdminDataTableFilterChangeEvent,
  AdminDataTableFilterDefinition,
  AdminDataTableFilterOperator,
  AdminDataTableFilterScalar,
  AdminDataTableFilterValue,
  AdminDataTableListConfig,
  AdminDataTableListLoader,
  AdminDataTableListQuery,
  AdminDataTableListResult,
  AdminDataTableListSource,
  AdminDataTableLoadingState,
  AdminDataTableOffsetPageInput,
  AdminDataTablePageChangeEvent,
  AdminDataTablePaginationSummary,
  AdminDataTablePermissionDeniedState,
  AdminDataTableProblemState,
  AdminDataTableProps,
  AdminDataTableReadyState,
  AdminDataTableRecoveryActionEvent,
  AdminDataTableResource,
  AdminDataTableRow,
  AdminDataTableRowActionEvent,
  AdminDataTableRowId,
  AdminDataTableSearchResultInput,
  AdminDataTableSelectionChangeEvent,
  AdminDataTableSort,
  AdminDataTableSortChangeEvent,
  AdminDataTableSortDirection,
  AdminDataTableState,
  AdminDataTableStateBase,
  AdminDataTableStateInput,
} from "./libs/dataTableTypes";
export type {
  TenantBusinessWorkspaceProps,
  TenantWorkspaceActionRequest,
  TenantWorkspaceActionResult,
} from "./libs/TenantBusinessWorkspace";
export type { WebhookReliabilityConsoleProps } from "./libs/WebhookReliabilityConsole";
export type { EventCatalogPanelProps } from "./libs/EventCatalogPanel";
export type {
  AudienceCampaignOperationsPanelProps,
  Customer360CommunicationPanelProps,
  DeliveryOperationsPanelProps,
  EngagementConsoleSection,
  EngagementOperationsConsoleProps,
  MessageOperationsPanelProps,
} from "./libs/EngagementOperationsConsole";
export type { LifecycleAutomationConsoleProps } from "./libs/LifecycleAutomationConsole";
export type {
  LifecycleAutomationConsoleState,
  LifecycleAutomationEmptyState,
  LifecycleAutomationLoadingState,
  LifecycleAutomationPermissionDeniedState,
  LifecycleAutomationReadyState,
  LifecycleAutomationSource,
  LifecycleAutomationSourceOptions,
  LifecycleDescriptorDiff,
  LifecycleDryRunEvidence,
  LifecycleDryRunFixture,
  LifecycleDryRunFixtureDescriptor,
  LifecycleDryRunRequest,
  LifecycleDryRunResponse,
  LifecycleOperationsProblem,
  LifecycleRuleActionInput,
  LifecycleRuleActionResult,
  LifecycleRuleAdminAction,
  LifecycleRuleOperation,
  LifecycleRunActionEvidence,
  LifecycleRunEvidence,
  LifecycleRunFilters,
  LifecycleRunOperation,
  LifecycleRunOutcome,
  LoadLifecycleAutomationOptions,
} from "./libs/lifecycleAutomation";

export { FactHistoryPanel } from "./libs/FactHistoryPanel";
export type { FactHistoryPanelProps } from "./libs/FactHistoryPanel";
export { CohortBuilder } from "./libs/CohortBuilder";
export type { CohortBuilderProps } from "./libs/CohortBuilder";
export { DatasetExplorer } from "./libs/DatasetExplorer";
export type {
  DatasetExplorerProps,
  DatasetExplorerState,
  DatasetExplorerAction,
  DatasetExplorerRepublishAction,
} from "./libs/DatasetExplorer";
export { MetricInspector } from "./libs/MetricInspector";
export type {
  MetricInspectorOutcome,
  MetricInspectorProps,
  MetricInspectorResult,
} from "./libs/MetricInspector";
export { ExperienceConsole } from "./libs/ExperienceConsole";
export type { ExperienceConsoleProps } from "./libs/ExperienceConsole";
export { PolicyReleaseConsole } from "./libs/PolicyReleaseConsole";
export type {
  PolicyReleaseConsoleField,
  PolicyReleaseConsoleState,
  PolicyReleaseConsoleProps,
} from "./libs/PolicyReleaseConsole";

export { ContactPolicyConsole } from "./libs/ContactPolicyConsole";
export type { ContactPolicyConsoleProps } from "./libs/ContactPolicyConsole";

export { ExperimentConsole } from "./libs/ExperimentConsole";
export type {
  ExperimentConsoleProps,
  ExperimentConsolePreview,
  ExperimentConsoleState,
} from "./libs/ExperimentConsole";

export { GrowthAnalysisPanel } from "./libs/GrowthAnalysisPanel";
export type { GrowthAnalysisPanelProps } from "./libs/GrowthAnalysisPanel";

export { JourneyConsole } from "./libs/JourneyConsole";
export type { JourneyConsoleProps } from "./libs/JourneyConsole";

export { CustomerExplorer } from "./libs/CustomerExplorer";
export type {
  CustomerExplorerNote,
  CustomerExplorerOperations,
  CustomerExplorerProps,
} from "./libs/CustomerExplorer";

export { ReminderOperationsPanel } from "./libs/ReminderOperationsPanel";
export type { ReminderOperationsPanelProps } from "./libs/ReminderOperationsPanel";

export { NetOutcomePanel } from "./libs/NetOutcomePanel";
export type { NetOutcomePanelProps } from "./libs/NetOutcomePanel";

export { ActivationCandidateExplorer } from "./libs/ActivationCandidateExplorer";
export type { ActivationCandidateExplorerProps } from "./libs/ActivationCandidateExplorer";

export { SavedIntentConsole } from "./libs/SavedIntentConsole";
export type { SavedIntentConsoleProps } from "./libs/SavedIntentConsole";

export { TargetingImpactInspector } from "./libs/TargetingImpactInspector";
export type {
  TargetingImpactInspectorProps,
  TargetingImpactInspectorState,
} from "./libs/TargetingImpactInspector";

export { ChallengeConsole } from "./libs/ChallengeConsole";
export type { ChallengeConsoleProps } from "./libs/ChallengeConsole";
export { RewardConsole } from "./libs/RewardConsole";
export type { RewardConsoleProps } from "./libs/RewardConsole";

export { MissionConsole } from "./libs/MissionConsole";
export type { MissionConsoleProps } from "./libs/MissionConsole";
export { RetentionOfferConsole } from "./libs/RetentionOfferConsole";
export type { RetentionOfferConsoleProps } from "./libs/RetentionOfferConsole";
