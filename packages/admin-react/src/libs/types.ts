import type { ReactElement } from "react";

import type { BillingAccount, Plan, Subscription, SubscriptionStatus } from "@croco/billing-core";
import type {
  EntitlementCheckResult,
  EntitlementType,
  OveragePolicy,
} from "@croco/entitlements-core";
import type { ImpersonationState } from "@croco/impersonation-core";
import type { AggregationPeriod, MeterDefinition } from "@croco/metering-core";
import type { ProblemDetails } from "@croco/problems-core";
import type { TenantStatus } from "@croco/tenant-core";

export type NonEmptyArray<T> = readonly [T, ...T[]];

export type AdminStateSource = "croco" | "provider";

export type AdminMutability = "editable" | "read-only";

export type AdminActionSource = "croco" | "provider" | "external-link";

export type BillingProviderStatus = "synced" | "stale" | "unavailable";

export type AdminProblemReference = {
  readonly code: string;
  readonly source:
    | "access"
    | "billing"
    | "entitlements"
    | "impersonation"
    | "metering"
    | "permissions"
    | "provider"
    | "tenant"
    | "tenant-isolation";
  readonly detail?: string;
};

export type AdminAuditMetadata = {
  readonly eventName: string;
  readonly subjectType:
    | "tenant"
    | "billing-account"
    | "subscription"
    | "entitlement"
    | "meter"
    | "user"
    | "impersonation-session"
    | "permission";
  readonly subjectId: string;
  readonly actorId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type AdminActionContract = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly source: AdminActionSource;
  readonly mutability: AdminMutability;
  readonly permissions: NonEmptyArray<string>;
  readonly audit: AdminAuditMetadata;
  readonly possibleProblems: NonEmptyArray<AdminProblemReference>;
  readonly disabledReason?: string;
};

export type AdminActionPermissionDecision =
  | {
      readonly kind: "allowed";
      readonly action: AdminActionContract;
    }
  | {
      readonly kind: "denied";
      readonly action: AdminActionContract;
      readonly missingPermissions: readonly string[];
      readonly problem: ProblemDetails;
    };

export type AdminPlanSummary = {
  readonly planId: string;
  readonly name: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly interval?: Plan["interval"];
  readonly intervalCount?: number;
  readonly subscriptionStatus: SubscriptionStatus | "missing";
  readonly source: "croco";
  readonly mutability: "editable";
};

export type AdminBillingStatus = {
  readonly status: SubscriptionStatus | "missing";
  readonly accountId?: string;
  readonly subscriptionId?: string;
  readonly externalCustomerId?: string;
  readonly externalSubscriptionId?: string;
  readonly currentPeriodEnd?: Date;
  readonly cancelAtPeriodEnd?: boolean;
  readonly lastSyncedAt?: Date;
  readonly source: "croco";
  readonly mutability: "editable";
};

export type AdminProviderState = {
  readonly providerName: string;
  readonly status: BillingProviderStatus;
  readonly externalCustomerId?: string;
  readonly externalSubscriptionId?: string;
  readonly lastSyncedAt?: Date;
  readonly problem?: ProblemDetails;
  readonly source: "provider";
  readonly mutability: "read-only";
};

export type AdminEntitlementRow = {
  readonly featureKey: string;
  readonly type: EntitlementType;
  readonly label?: string;
  readonly granted: boolean;
  readonly state: "active" | "missing" | "denied" | "over-quota" | "warn" | "allowed-overage";
  readonly usage?: number;
  readonly quota?: number;
  readonly remaining?: number;
  readonly exceeded?: boolean;
  readonly value?: number;
  readonly reason?: string;
  readonly overagePolicy?: OveragePolicy;
  readonly problem?: ProblemDetails;
  readonly source: "croco";
  readonly mutability: "editable";
};

export type AdminUsageMeter = {
  readonly meterId: string;
  readonly label?: string;
  readonly period?: AggregationPeriod;
  readonly usage: number;
  readonly quota?: number;
  readonly remaining?: number;
  readonly percent?: number;
  readonly state: "within-quota" | "over-quota" | "unlimited";
  readonly source: "croco";
  readonly mutability: "read-only";
};

export type AdminMeteringState = {
  readonly status: "current" | "stale" | "failed";
  readonly lastUpdatedAt?: Date;
  readonly problem?: ProblemDetails;
  readonly source: "croco";
  readonly mutability: "read-only";
};

export type BillingEntitlementAdminPanelReadyState = {
  readonly kind: "ready";
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly grantedPermissions: readonly string[];
  readonly plan: AdminPlanSummary;
  readonly billing: AdminBillingStatus;
  readonly provider: AdminProviderState;
  readonly entitlements: readonly AdminEntitlementRow[];
  readonly usage: readonly AdminUsageMeter[];
  readonly metering: AdminMeteringState;
  readonly actions: readonly AdminActionContract[];
};

export type BillingProviderFailureState = {
  readonly kind: "provider_failure";
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly problem: ProblemDetails;
  readonly provider: AdminProviderState;
  readonly partial?: Partial<
    Pick<
      BillingEntitlementAdminPanelReadyState,
      "plan" | "billing" | "entitlements" | "usage" | "metering" | "actions"
    >
  >;
};

export type PermissionDeniedAdminPanelState = {
  readonly kind: "permission_denied";
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly requiredPermissions: readonly string[];
  readonly grantedPermissions: readonly string[];
  readonly problem: ProblemDetails;
  readonly actions: readonly AdminActionContract[];
};

export type BillingEntitlementAdminPanelState =
  | BillingEntitlementAdminPanelReadyState
  | BillingProviderFailureState
  | PermissionDeniedAdminPanelState;

export type AdminUsageMeterInput = {
  readonly meterId: string;
  readonly label?: string;
  readonly usage: number;
  readonly quota?: number | null;
  readonly period?: AggregationPeriod;
  readonly meter?: Pick<MeterDefinition, "allowOverQuota" | "metadata">;
};

export type BillingEntitlementAdminPanelStateInput = {
  readonly tenantId: string;
  readonly generatedAt?: Date;
  readonly requiredPermissions?: readonly string[];
  readonly grantedPermissions?: readonly string[];
  readonly account?: BillingAccount | null;
  readonly subscription?: Subscription | null;
  readonly plan?: Plan | null;
  readonly provider?: Partial<Omit<AdminProviderState, "source" | "mutability">>;
  readonly providerFailure?: ProblemDetails;
  readonly entitlementChecks?: readonly EntitlementCheckResult[];
  readonly usageMeters?: readonly AdminUsageMeterInput[];
  readonly metering?: Partial<Omit<AdminMeteringState, "source" | "mutability">>;
  readonly actions?: readonly AdminActionContract[];
};

export type AdminPanelActionHandler = (action: AdminActionContract) => void;

export type BillingEntitlementAdminPanelProps = {
  readonly state: BillingEntitlementAdminPanelState;
  readonly onAction?: AdminPanelActionHandler;
};

export type AdminTenantSummary = {
  readonly tenantId: string;
  readonly slug?: string;
  readonly name: string;
  readonly status: TenantStatus | "unknown";
  readonly source: "croco";
  readonly mutability: "read-only";
};

export type AdminTenantInput =
  | AdminTenantSummary
  | {
      readonly id: string;
      readonly slug: string;
      readonly name: string;
      readonly status: TenantStatus;
    };

export type AdminTenantSwitchOptionInput = {
  readonly tenant: AdminTenantInput;
  readonly switchAction?: AdminActionContract;
  readonly disabledReason?: string;
  readonly problem?: ProblemDetails;
};

export type AdminTenantSwitchOption = AdminTenantSummary & {
  readonly selected: boolean;
  readonly switchAction?: AdminActionContract;
  readonly disabledReason?: string;
  readonly problem?: ProblemDetails;
};

export type AdminPermissionInspectionState = "allowed" | "denied" | "unknown" | "provider_failure";

export type AdminPermissionInspectionInput = {
  readonly id?: string;
  readonly permission: string;
  readonly label?: string;
  readonly scope?: "tenant" | "impersonation" | "global";
  readonly subjectId?: string;
  readonly tenantId?: string;
  readonly state: AdminPermissionInspectionState;
  readonly requiredFor?: string;
  readonly problem?: ProblemDetails;
};

export type AdminPermissionInspectionRow = {
  readonly id: string;
  readonly permission: string;
  readonly label?: string;
  readonly scope: "tenant" | "impersonation" | "global";
  readonly subjectId?: string;
  readonly tenantId?: string;
  readonly state: AdminPermissionInspectionState;
  readonly requiredFor?: string;
  readonly problem?: ProblemDetails;
  readonly source: "croco";
  readonly mutability: "read-only";
};

export type AdminImpersonationPrincipal = {
  readonly userId: string;
  readonly label?: string;
  readonly email?: string;
};

export type AdminImpersonationInactiveInput = {
  readonly kind: "inactive";
  readonly actor?: AdminImpersonationPrincipal;
  readonly startAction?: AdminActionContract;
};

export type AdminImpersonationActiveInput = {
  readonly kind: "active";
  readonly session: ImpersonationState;
  readonly impersonator?: AdminImpersonationPrincipal;
  readonly target?: AdminImpersonationPrincipal;
  readonly exitAction: AdminActionContract;
};

export type AdminImpersonationExpiredInput = {
  readonly kind: "expired";
  readonly session: ImpersonationState;
  readonly impersonator?: AdminImpersonationPrincipal;
  readonly target?: AdminImpersonationPrincipal;
  readonly problem?: ProblemDetails;
  readonly exitAction: AdminActionContract;
};

export type AdminImpersonationUnavailableInput = {
  readonly kind: "unavailable";
  readonly problem: ProblemDetails;
  readonly recoveryAction?: AdminActionContract;
};

export type AdminImpersonationStateInput =
  | AdminImpersonationInactiveInput
  | AdminImpersonationActiveInput
  | AdminImpersonationExpiredInput
  | AdminImpersonationUnavailableInput;

export type AdminImpersonationInactiveState = {
  readonly kind: "inactive";
  readonly actor?: AdminImpersonationPrincipal;
  readonly startAction?: AdminActionContract;
  readonly source: "croco";
  readonly mutability: "read-only";
};

export type AdminImpersonationActiveState = {
  readonly kind: "active";
  readonly session: ImpersonationState;
  readonly impersonator: AdminImpersonationPrincipal;
  readonly target: AdminImpersonationPrincipal;
  readonly exitAction: AdminActionContract;
  readonly source: "croco";
  readonly mutability: "editable";
};

export type AdminImpersonationExpiredState = {
  readonly kind: "expired";
  readonly session: ImpersonationState;
  readonly impersonator: AdminImpersonationPrincipal;
  readonly target: AdminImpersonationPrincipal;
  readonly problem: ProblemDetails;
  readonly exitAction: AdminActionContract;
  readonly source: "croco";
  readonly mutability: "editable";
};

export type AdminImpersonationUnavailableState = {
  readonly kind: "unavailable";
  readonly problem: ProblemDetails;
  readonly recoveryAction?: AdminActionContract;
  readonly source: "croco";
  readonly mutability: "read-only";
};

export type AdminImpersonationConsoleState =
  | AdminImpersonationInactiveState
  | AdminImpersonationActiveState
  | AdminImpersonationExpiredState
  | AdminImpersonationUnavailableState;

export type TenantImpersonationConsoleLoadingState = {
  readonly kind: "loading";
  readonly generatedAt: Date;
  readonly tenantId?: string;
};

export type TenantImpersonationConsoleActiveState = {
  readonly kind: "active";
  readonly generatedAt: Date;
  readonly tenant: AdminTenantSummary;
  readonly tenants: readonly AdminTenantSwitchOption[];
  readonly grantedPermissions: readonly string[];
  readonly impersonation: AdminImpersonationConsoleState;
  readonly permissions: readonly AdminPermissionInspectionRow[];
  readonly actions: readonly AdminActionContract[];
};

export type TenantImpersonationConsoleDeniedState = {
  readonly kind: "denied";
  readonly generatedAt: Date;
  readonly tenantId?: string;
  readonly requiredPermissions: readonly string[];
  readonly grantedPermissions: readonly string[];
  readonly problem: ProblemDetails;
  readonly actions: readonly AdminActionContract[];
};

export type TenantImpersonationConsoleUnavailableState = {
  readonly kind: "unavailable";
  readonly generatedAt: Date;
  readonly tenant?: AdminTenantSummary;
  readonly grantedPermissions: readonly string[];
  readonly problem: ProblemDetails;
  readonly permissions: readonly AdminPermissionInspectionRow[];
  readonly impersonation?: AdminImpersonationConsoleState;
  readonly actions: readonly AdminActionContract[];
};

export type TenantImpersonationConsoleState =
  | TenantImpersonationConsoleLoadingState
  | TenantImpersonationConsoleActiveState
  | TenantImpersonationConsoleDeniedState
  | TenantImpersonationConsoleUnavailableState;

export type TenantImpersonationConsoleStateInput = {
  readonly generatedAt?: Date;
  readonly loading?: boolean;
  readonly selectedTenantId?: string;
  readonly tenant?: AdminTenantInput | null;
  readonly tenants?: readonly AdminTenantSwitchOptionInput[];
  readonly requiredPermissions?: readonly string[];
  readonly grantedPermissions?: readonly string[];
  readonly permissionProblem?: ProblemDetails;
  readonly tenantIsolationProblem?: ProblemDetails;
  readonly providerFailure?: ProblemDetails;
  readonly permissions?: readonly AdminPermissionInspectionInput[];
  readonly impersonation?: AdminImpersonationStateInput;
  readonly actions?: readonly AdminActionContract[];
};

export type TenantImpersonationConsoleProps = {
  readonly state: TenantImpersonationConsoleState;
  readonly onAction?: AdminPanelActionHandler;
};

export type AdminFormIntent = "create" | "update" | "action";

export type AdminFormLifecycleState =
  | "idle"
  | "dirty"
  | "submitting"
  | "succeeded"
  | "failed"
  | "retrying";

export type AdminFormProblemKind = "validation" | "domain" | "permission" | "external";

export type AdminFormFieldName<TValues extends object> = Extract<keyof TValues, string>;

export type AdminFormFieldType =
  | "checkbox"
  | "date"
  | "email"
  | "hidden"
  | "number"
  | "select"
  | "textarea"
  | "text";

export type AdminFormFieldOption<Value = unknown> = {
  readonly label: string;
  readonly value: Value;
  readonly disabled?: boolean;
};

export type AdminFormFieldContract<
  TValues extends object,
  TName extends AdminFormFieldName<TValues> = AdminFormFieldName<TValues>,
> = {
  readonly name: TName;
  readonly label: string;
  readonly inputType?: AdminFormFieldType;
  readonly description?: string;
  readonly required?: boolean;
  readonly schemaPath?: string;
  readonly options?: readonly AdminFormFieldOption<TValues[TName]>[];
};

export type AdminFormFieldError = {
  readonly code: string;
  readonly message: string;
  readonly problem?: ProblemDetails;
  readonly recoveryActionIds?: readonly string[];
};

export type AdminFormFieldErrors<TValues extends object> = Partial<
  Record<AdminFormFieldName<TValues>, NonEmptyArray<AdminFormFieldError>>
>;

export type AdminFormRecoveryActionKind = "retry" | "reset" | "navigate" | "custom";

export type AdminFormRecoveryAction = {
  readonly id: string;
  readonly label: string;
  readonly kind: AdminFormRecoveryActionKind;
  readonly description?: string;
  readonly problemCodes?: readonly string[];
  readonly disabledReason?: string;
  readonly audit?: AdminAuditMetadata;
};

export type AdminFormSubmitContext<TValues extends object, TResult = unknown> = {
  readonly values: TValues;
  readonly audit: AdminAuditMetadata;
  readonly intent: AdminFormIntent;
  readonly previousState: AdminFormState<TValues, TResult>;
  readonly signal?: AbortSignal;
};

export type AdminFormSubmitSuccess<TResult> = {
  readonly kind: "success";
  readonly data?: TResult;
  readonly audit?: AdminAuditMetadata;
  readonly recoveryActions?: readonly AdminFormRecoveryAction[];
};

export type AdminFormValidationFailure<TValues extends object> = {
  readonly kind: "validation_failed";
  readonly fieldErrors: AdminFormFieldErrors<TValues>;
  readonly problem?: ProblemDetails;
  readonly audit?: AdminAuditMetadata;
  readonly recoveryActions?: readonly AdminFormRecoveryAction[];
};

export type AdminFormProblemResultKind =
  | "domain_problem"
  | "permission_denied"
  | "external_failure";

export type AdminFormProblemResult = {
  readonly kind: AdminFormProblemResultKind;
  readonly problem: ProblemDetails;
  readonly audit?: AdminAuditMetadata;
  readonly recoveryActions?: readonly AdminFormRecoveryAction[];
};

export type AdminFormSubmitResult<TValues extends object, TResult = unknown> =
  | AdminFormSubmitSuccess<TResult>
  | AdminFormValidationFailure<TValues>
  | AdminFormProblemResult;

export type AdminFormSubmitHandler<TValues extends object, TResult = unknown> = (
  context: AdminFormSubmitContext<TValues, TResult>,
) => AdminFormSubmitResult<TValues, TResult> | Promise<AdminFormSubmitResult<TValues, TResult>>;

export type AdminFormContract<TValues extends object, TResult = unknown> = {
  readonly id: string;
  readonly title: string;
  readonly intent: AdminFormIntent;
  readonly fields: NonEmptyArray<AdminFormFieldContract<TValues>>;
  readonly initialValues: TValues;
  readonly submitLabel?: string;
  readonly successMessage?: string;
  readonly requiredPermissions?: readonly string[];
  readonly grantedPermissions?: readonly string[];
  readonly audit: AdminAuditMetadata;
  readonly submit: AdminFormSubmitHandler<TValues, TResult>;
  readonly recoveryActions?: readonly AdminFormRecoveryAction[];
};

export type AdminFormState<TValues extends object, TResult = unknown> = {
  readonly kind: AdminFormLifecycleState;
  readonly contractId: string;
  readonly title: string;
  readonly intent: AdminFormIntent;
  readonly generatedAt: Date;
  readonly fields: NonEmptyArray<AdminFormFieldContract<TValues>>;
  readonly initialValues: TValues;
  readonly values: TValues;
  readonly dirtyFields: readonly AdminFormFieldName<TValues>[];
  readonly fieldErrors: AdminFormFieldErrors<TValues>;
  readonly problem?: ProblemDetails;
  readonly problemKind?: AdminFormProblemKind;
  readonly recoveryActions: readonly AdminFormRecoveryAction[];
  readonly audit: AdminAuditMetadata;
  readonly lastSubmitAudit?: AdminAuditMetadata;
  readonly submitResult?: TResult;
  readonly submitLabel: string;
  readonly successMessage?: string;
  readonly requiredPermissions: readonly string[];
  readonly grantedPermissions: readonly string[];
};

export type AdminFormStateOptions = {
  readonly generatedAt?: Date;
  readonly grantedPermissions?: readonly string[];
};

export type AdminFormFieldChangeHandler<TValues extends object> = <
  TName extends AdminFormFieldName<TValues>,
>(
  name: TName,
  value: TValues[TName],
) => void;

export type AdminFormSubmitAction<TValues extends object, TResult = unknown> = () => Promise<
  AdminFormState<TValues, TResult>
>;

export type AdminFormController<TValues extends object, TResult = unknown> = {
  readonly contract: AdminFormContract<TValues, TResult>;
  readonly state: AdminFormState<TValues, TResult>;
  readonly setFieldValue: AdminFormFieldChangeHandler<TValues>;
  readonly reset: () => void;
  readonly submit: AdminFormSubmitAction<TValues, TResult>;
  readonly retry: AdminFormSubmitAction<TValues, TResult>;
};

export type AdminFormRenderFieldContext<TValues extends object, TResult = unknown> = {
  readonly field: AdminFormFieldContract<TValues>;
  readonly value: TValues[AdminFormFieldName<TValues>];
  readonly errors: readonly AdminFormFieldError[];
  readonly state: AdminFormState<TValues, TResult>;
};

export type AdminFormRenderActionsContext<TValues extends object, TResult = unknown> = {
  readonly state: AdminFormState<TValues, TResult>;
  readonly submitDisabled: boolean;
};

export type AdminFormProps<TValues extends object, TResult = unknown> = {
  readonly state: AdminFormState<TValues, TResult>;
  readonly onFieldChange?: AdminFormFieldChangeHandler<TValues>;
  readonly onSubmit?: () => void;
  readonly onRecoveryAction?: (action: AdminFormRecoveryAction) => void;
  readonly renderField?: (context: AdminFormRenderFieldContext<TValues, TResult>) => ReactElement;
  readonly renderActions?: (
    context: AdminFormRenderActionsContext<TValues, TResult>,
  ) => ReactElement;
};
