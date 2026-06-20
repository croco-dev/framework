import type { EntitlementCheckResult } from "@croco/entitlements-core";
import type { ProblemDetails } from "@croco/problems-core";

import type {
  AdminActionContract,
  AdminActionPermissionDecision,
  AdminFormContract,
  AdminFormFieldErrors,
  AdminFormFieldName,
  AdminFormProblemKind,
  AdminFormProblemResultKind,
  AdminFormState,
  AdminFormStateOptions,
  AdminFormSubmitResult,
  AdminBillingStatus,
  AdminEntitlementRow,
  AdminImpersonationConsoleState,
  AdminImpersonationPrincipal,
  AdminImpersonationStateInput,
  AdminMeteringState,
  AdminPermissionInspectionInput,
  AdminPermissionInspectionRow,
  AdminPlanSummary,
  AdminProviderState,
  AdminTenantInput,
  AdminTenantSummary,
  AdminTenantSwitchOption,
  AdminTenantSwitchOptionInput,
  AdminUsageMeter,
  AdminUsageMeterInput,
  BillingEntitlementAdminPanelState,
  BillingEntitlementAdminPanelStateInput,
  TenantImpersonationConsoleState,
  TenantImpersonationConsoleStateInput,
} from "./types";

const ABOUT_BLANK = "about:blank";

export function createCoreProblemDetails(options: {
  readonly code: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly source?: string;
}): ProblemDetails {
  return {
    type: ABOUT_BLANK,
    title: options.title,
    status: options.status,
    code: options.code,
    ...(options.detail ? { detail: options.detail } : {}),
    ...(options.source ? { source: options.source } : {}),
  };
}

export function createPermissionDeniedProblemDetails(
  tenantId: string,
  missingPermissions: readonly string[],
): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin/permission-denied",
    detail: `Tenant '${tenantId}' requires permissions: ${missingPermissions.join(", ")}`,
    source: "permissions",
    status: 403,
    title: "Forbidden",
  });
}

export function createTenantUnavailableProblemDetails(tenantId?: string): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin/tenant-context-unavailable",
    detail: tenantId
      ? `Tenant '${tenantId}' is unavailable for the admin console`
      : "Tenant context is unavailable for the admin console",
    source: "tenant",
    status: 503,
    title: "Service Unavailable",
  });
}

export function createPermissionInspectionProblemDetails(
  permission: string,
  tenantId?: string,
): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin/permission-inspection-denied",
    detail: tenantId
      ? `Permission '${permission}' is denied in tenant '${tenantId}'`
      : `Permission '${permission}' is denied`,
    source: "permissions",
    status: 403,
    title: "Forbidden",
  });
}

export function createPermissionInspectionUnavailableProblemDetails(
  permission: string,
): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin/permission-inspection-unavailable",
    detail: `Permission '${permission}' could not be inspected`,
    source: "permissions",
    status: 503,
    title: "Service Unavailable",
  });
}

export function createImpersonationExpiredProblemDetails(sessionId: string): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin/impersonation-expired",
    detail: `Impersonation session '${sessionId}' expired and must be exited`,
    source: "impersonation",
    status: 409,
    title: "Impersonation expired",
  });
}

export function evaluateAdminActionPermissions(
  action: AdminActionContract,
  grantedPermissions: readonly string[],
): AdminActionPermissionDecision {
  const granted = new Set(grantedPermissions);
  const missingPermissions = action.permissions.filter((permission) => !granted.has(permission));

  if (missingPermissions.length === 0) {
    return {
      action,
      kind: "allowed",
    };
  }

  return {
    action,
    kind: "denied",
    missingPermissions,
    problem: createPermissionDeniedProblemDetails(action.audit.subjectId, missingPermissions),
  };
}

export function createBillingEntitlementAdminPanelState(
  input: BillingEntitlementAdminPanelStateInput,
): BillingEntitlementAdminPanelState {
  const generatedAt = input.generatedAt ?? new Date();
  const requiredPermissions = input.requiredPermissions ?? [];
  const grantedPermissions = input.grantedPermissions ?? [];
  const missingPermissions = requiredPermissions.filter(
    (permission) => !grantedPermissions.includes(permission),
  );
  const actions = input.actions ?? [];

  if (missingPermissions.length > 0) {
    return {
      actions,
      generatedAt,
      grantedPermissions,
      kind: "permission_denied",
      problem: createPermissionDeniedProblemDetails(input.tenantId, missingPermissions),
      requiredPermissions,
      tenantId: input.tenantId,
    };
  }

  const provider = createProviderState(input);
  const providerFailure = input.providerFailure ?? createProviderFailureProblem(provider);

  if (providerFailure) {
    return {
      generatedAt,
      kind: "provider_failure",
      partial: {
        actions,
        billing: createBillingStatus(input),
        entitlements: createEntitlementRows(input.entitlementChecks ?? []),
        metering: createMeteringState(input),
        plan: createPlanSummary(input),
        usage: createUsageMeters(input.usageMeters ?? []),
      },
      problem: providerFailure,
      provider: {
        ...provider,
        problem: providerFailure,
        status: "unavailable",
      },
      tenantId: input.tenantId,
    };
  }

  return {
    actions,
    billing: createBillingStatus(input),
    entitlements: createEntitlementRows(input.entitlementChecks ?? []),
    generatedAt,
    grantedPermissions,
    kind: "ready",
    metering: createMeteringState(input),
    plan: createPlanSummary(input),
    provider,
    tenantId: input.tenantId,
    usage: createUsageMeters(input.usageMeters ?? []),
  };
}

export const createInMemoryBillingEntitlementAdminPanelState =
  createBillingEntitlementAdminPanelState;

export function createTenantImpersonationConsoleState(
  input: TenantImpersonationConsoleStateInput,
): TenantImpersonationConsoleState {
  const generatedAt = input.generatedAt ?? new Date();
  const actions = input.actions ?? [];
  const tenant = input.tenant ? createTenantSummary(input.tenant) : undefined;
  const tenantId = input.selectedTenantId ?? tenant?.tenantId;

  if (input.loading) {
    return {
      generatedAt,
      kind: "loading",
      tenantId,
    };
  }

  const requiredPermissions = input.requiredPermissions ?? [];
  const grantedPermissions = input.grantedPermissions ?? [];
  const permissions = createPermissionInspectionRows(input.permissions ?? [], tenantId);
  const impersonation = createImpersonationState(input.impersonation, generatedAt);
  const consoleFailure = input.tenantIsolationProblem ?? input.providerFailure;

  if (consoleFailure) {
    return {
      actions,
      generatedAt,
      grantedPermissions,
      impersonation,
      kind: "unavailable",
      permissions,
      problem: consoleFailure,
      ...(tenant ? { tenant } : {}),
    };
  }

  if (!tenant) {
    return {
      actions,
      generatedAt,
      grantedPermissions,
      impersonation,
      kind: "unavailable",
      permissions,
      problem: createTenantUnavailableProblemDetails(tenantId),
    };
  }

  const missingPermissions = requiredPermissions.filter(
    (permission) => !grantedPermissions.includes(permission),
  );

  if (missingPermissions.length > 0) {
    return {
      actions,
      generatedAt,
      grantedPermissions,
      kind: "denied",
      problem:
        input.permissionProblem ??
        createPermissionDeniedProblemDetails(tenantId ?? "unknown", missingPermissions),
      requiredPermissions,
      tenantId,
    };
  }

  return {
    actions,
    generatedAt,
    grantedPermissions,
    impersonation,
    kind: "active",
    permissions,
    tenant,
    tenants: createTenantSwitchOptions(input.tenants ?? [], tenant.tenantId),
  };
}

export const createInMemoryTenantImpersonationConsoleState = createTenantImpersonationConsoleState;

export function createAdminFormState<TValues extends object, TResult = unknown>(
  contract: AdminFormContract<TValues, TResult>,
  options: AdminFormStateOptions = {},
): AdminFormState<TValues, TResult> {
  const generatedAt = options.generatedAt ?? new Date();
  const requiredPermissions = contract.requiredPermissions ?? [];
  const grantedPermissions = options.grantedPermissions ?? contract.grantedPermissions ?? [];
  const missingPermissions = getMissingPermissions(requiredPermissions, grantedPermissions);

  if (missingPermissions.length > 0) {
    return createAdminFormBaseState(contract, {
      generatedAt,
      grantedPermissions,
      kind: "failed",
      problem: createPermissionDeniedProblemDetails(contract.audit.subjectId, missingPermissions),
      problemKind: "permission",
      requiredPermissions,
      values: contract.initialValues,
    });
  }

  return createAdminFormBaseState(contract, {
    generatedAt,
    grantedPermissions,
    kind: "idle",
    requiredPermissions,
    values: contract.initialValues,
  });
}

export const createInMemoryAdminFormState = createAdminFormState;

export function updateAdminFormField<
  TValues extends object,
  TResult = unknown,
  TName extends AdminFormFieldName<TValues> = AdminFormFieldName<TValues>,
>(
  state: AdminFormState<TValues, TResult>,
  name: TName,
  value: TValues[TName],
): AdminFormState<TValues, TResult> {
  const nextValues = {
    ...state.values,
    [name]: value,
  };
  const nextDirtyFields = state.dirtyFields.includes(name)
    ? state.dirtyFields
    : [...state.dirtyFields, name];
  const missingPermissions = getMissingPermissions(
    state.requiredPermissions,
    state.grantedPermissions,
  );
  const permissionProblem =
    missingPermissions.length > 0
      ? createPermissionDeniedProblemDetails(state.audit.subjectId, missingPermissions)
      : undefined;

  return {
    ...state,
    dirtyFields: nextDirtyFields,
    fieldErrors: removeFieldErrors(state.fieldErrors, name),
    kind: permissionProblem ? "failed" : "dirty",
    problem: permissionProblem,
    problemKind: permissionProblem ? "permission" : undefined,
    submitResult: undefined,
    values: nextValues,
  };
}

export function resetAdminFormState<TValues extends object, TResult = unknown>(
  contract: AdminFormContract<TValues, TResult>,
  options: AdminFormStateOptions = {},
): AdminFormState<TValues, TResult> {
  return createAdminFormState(contract, options);
}

export function startAdminFormSubmit<TValues extends object, TResult = unknown>(
  state: AdminFormState<TValues, TResult>,
  options: { readonly retry?: boolean } = {},
): AdminFormState<TValues, TResult> {
  return {
    ...state,
    fieldErrors: {},
    kind: options.retry ? "retrying" : "submitting",
    problem: undefined,
    problemKind: undefined,
    submitResult: undefined,
  };
}

export async function submitAdminForm<TValues extends object, TResult = unknown>(
  contract: AdminFormContract<TValues, TResult>,
  state: AdminFormState<TValues, TResult>,
  options: { readonly retry?: boolean; readonly signal?: AbortSignal } = {},
): Promise<AdminFormState<TValues, TResult>> {
  const currentState = state.contractId === contract.id ? state : createAdminFormState(contract);
  const permissionProblem = createAdminFormPermissionProblem(
    contract,
    currentState.grantedPermissions,
  );

  if (permissionProblem) {
    return finishAdminFormSubmit(
      currentState,
      {
        kind: "permission_denied",
        problem: permissionProblem,
        recoveryActions: contract.recoveryActions,
      },
      options,
    );
  }

  try {
    const submittingState = startAdminFormSubmit(currentState, { retry: options.retry });
    const result = await contract.submit({
      audit: currentState.audit,
      intent: currentState.intent,
      previousState: currentState,
      signal: options.signal,
      values: currentState.values,
    });

    return finishAdminFormSubmit(submittingState, result, options);
  } catch (error) {
    return finishAdminFormSubmit(
      currentState,
      {
        kind: "external_failure",
        problem: toExternalFailureProblem(error),
        recoveryActions: contract.recoveryActions,
      },
      options,
    );
  }
}

export function finishAdminFormSubmit<TValues extends object, TResult = unknown>(
  state: AdminFormState<TValues, TResult>,
  result: AdminFormSubmitResult<TValues, TResult>,
  _options: { readonly retry?: boolean } = {},
): AdminFormState<TValues, TResult> {
  if (result.kind === "success") {
    return {
      ...state,
      dirtyFields: [],
      fieldErrors: {},
      kind: "succeeded",
      lastSubmitAudit: result.audit ?? state.audit,
      problem: undefined,
      problemKind: undefined,
      recoveryActions: result.recoveryActions ?? [],
      submitResult: result.data,
    };
  }

  if (result.kind === "validation_failed") {
    return {
      ...state,
      fieldErrors: result.fieldErrors,
      kind: "failed",
      lastSubmitAudit: result.audit ?? state.audit,
      problem: result.problem,
      problemKind: "validation",
      recoveryActions: result.recoveryActions ?? state.recoveryActions,
      submitResult: undefined,
    };
  }

  return {
    ...state,
    fieldErrors: {},
    kind: "failed",
    lastSubmitAudit: result.audit ?? state.audit,
    problem: result.problem,
    problemKind: problemKindFromSubmitResult(result.kind),
    recoveryActions: result.recoveryActions ?? state.recoveryActions,
    submitResult: undefined,
  };
}

function createPlanSummary(input: BillingEntitlementAdminPanelStateInput): AdminPlanSummary {
  const subscriptionStatus = input.subscription?.status ?? "missing";
  const planId = input.plan?.id ?? input.subscription?.planId ?? "missing";

  return {
    interval: input.plan?.interval,
    intervalCount: input.plan?.intervalCount,
    ...(input.plan ? { amountMinor: input.plan.amount, currency: input.plan.currency } : {}),
    mutability: "editable",
    name: input.plan?.name ?? "No plan",
    planId,
    source: "croco",
    subscriptionStatus,
  };
}

function createBillingStatus(input: BillingEntitlementAdminPanelStateInput): AdminBillingStatus {
  return {
    accountId: input.account?.id,
    cancelAtPeriodEnd: input.subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: input.subscription?.currentPeriodEnd,
    externalCustomerId: input.account?.externalCustomerId,
    externalSubscriptionId: input.subscription?.externalSubscriptionId,
    lastSyncedAt: input.subscription?.lastSyncedAt,
    mutability: "editable",
    source: "croco",
    status: input.subscription?.status ?? "missing",
    subscriptionId: input.subscription?.id,
  };
}

function createProviderState(input: BillingEntitlementAdminPanelStateInput): AdminProviderState {
  return {
    externalCustomerId: input.provider?.externalCustomerId ?? input.account?.externalCustomerId,
    externalSubscriptionId:
      input.provider?.externalSubscriptionId ?? input.subscription?.externalSubscriptionId,
    lastSyncedAt: input.provider?.lastSyncedAt ?? input.subscription?.lastSyncedAt,
    mutability: "read-only",
    problem: input.provider?.problem,
    providerName: input.provider?.providerName ?? "unknown",
    source: "provider",
    status: input.provider?.status ?? "synced",
  };
}

function createProviderFailureProblem(provider: AdminProviderState): ProblemDetails | undefined {
  if (provider.problem) {
    return provider.problem;
  }

  if (provider.status !== "unavailable") {
    return undefined;
  }

  return createCoreProblemDetails({
    code: "billing-provider/unavailable",
    detail: `Billing provider '${provider.providerName}' is unavailable`,
    source: "provider",
    status: 503,
    title: "Service Unavailable",
  });
}

function createMeteringState(input: BillingEntitlementAdminPanelStateInput): AdminMeteringState {
  return {
    lastUpdatedAt: input.metering?.lastUpdatedAt,
    mutability: "read-only",
    problem: input.metering?.problem,
    source: "croco",
    status: input.metering?.status ?? "current",
  };
}

function createEntitlementRows(checks: readonly EntitlementCheckResult[]): AdminEntitlementRow[] {
  return checks.map((check) => {
    const state = getEntitlementState(check);
    const problem = createEntitlementProblem(check, state);

    return {
      exceeded: check.exceeded,
      featureKey: check.featureKey,
      granted: check.granted,
      mutability: "editable",
      overagePolicy: check.overagePolicy,
      problem,
      quota: check.quota,
      reason: check.reason,
      remaining: check.remaining,
      source: "croco",
      state,
      type: check.type,
      usage: check.usage,
      value: check.value,
    };
  });
}

function getEntitlementState(check: EntitlementCheckResult): AdminEntitlementRow["state"] {
  if (check.granted && !check.exceeded) {
    return "active";
  }

  if (check.exceeded && check.overagePolicy === "WARN") {
    return "warn";
  }

  if (check.exceeded && check.overagePolicy === "ALLOW_WITH_OVERAGE") {
    return "allowed-overage";
  }

  if (check.exceeded) {
    return "over-quota";
  }

  if (isMissingEntitlementReason(check.reason)) {
    return "missing";
  }

  return "denied";
}

function createEntitlementProblem(
  check: EntitlementCheckResult,
  state: AdminEntitlementRow["state"],
): ProblemDetails | undefined {
  if (state === "active" || state === "warn" || state === "allowed-overage") {
    return undefined;
  }

  if (state === "missing") {
    return createCoreProblemDetails({
      code: "ENTITLEMENT_NOT_FOUND",
      detail: `Entitlement '${check.featureKey}' is not available for the tenant plan`,
      source: "entitlements",
      status: 404,
      title: "Not Found",
    });
  }

  if (state === "over-quota") {
    return createCoreProblemDetails({
      code: "metering/quota-exceeded",
      detail: `Entitlement '${check.featureKey}' exceeded quota ${check.quota ?? "unknown"}`,
      source: "metering",
      status: 429,
      title: "Too Many Requests",
    });
  }

  return createCoreProblemDetails({
    code: "ENTITLEMENT_DENIED",
    detail: check.reason ?? `Entitlement '${check.featureKey}' denied`,
    source: "entitlements",
    status: 403,
    title: "Forbidden",
  });
}

function isMissingEntitlementReason(reason: string | undefined): boolean {
  if (!reason) {
    return false;
  }

  const normalized = reason.toLowerCase();
  return (
    normalized.includes("missing") ||
    normalized.includes("not_found") ||
    normalized.includes("not found")
  );
}

function createUsageMeters(inputs: readonly AdminUsageMeterInput[]): AdminUsageMeter[] {
  return inputs.map((input) => {
    const quota = input.quota ?? undefined;
    const remaining = quota === undefined ? undefined : quota - input.usage;
    const percent =
      quota === undefined || quota <= 0 ? undefined : Math.round((input.usage / quota) * 100);
    const state =
      quota === undefined ? "unlimited" : input.usage > quota ? "over-quota" : "within-quota";

    return {
      label: input.label,
      meterId: input.meterId,
      mutability: "read-only",
      percent,
      period: input.period,
      quota,
      remaining,
      source: "croco",
      state,
      usage: input.usage,
    };
  });
}

function createTenantSummary(input: AdminTenantInput): AdminTenantSummary {
  if ("tenantId" in input) {
    return input;
  }

  return {
    mutability: "read-only",
    name: input.name,
    slug: input.slug,
    source: "croco",
    status: input.status,
    tenantId: input.id,
  };
}

function createTenantSwitchOptions(
  inputs: readonly AdminTenantSwitchOptionInput[],
  selectedTenantId: string,
): AdminTenantSwitchOption[] {
  return inputs.map((input) => {
    const tenant = createTenantSummary(input.tenant);

    return {
      ...tenant,
      disabledReason: input.disabledReason,
      problem: input.problem,
      selected: tenant.tenantId === selectedTenantId,
      switchAction: input.switchAction,
    };
  });
}

function createPermissionInspectionRows(
  inputs: readonly AdminPermissionInspectionInput[],
  activeTenantId: string | undefined,
): AdminPermissionInspectionRow[] {
  return inputs.map((input) => {
    const tenantId = input.tenantId ?? activeTenantId;
    const scope = input.scope ?? "tenant";
    const id = input.id ?? `${scope}:${tenantId ?? "global"}:${input.permission}`;

    return {
      id,
      label: input.label,
      mutability: "read-only",
      permission: input.permission,
      problem: input.problem ?? createPermissionInspectionProblem(input, tenantId),
      requiredFor: input.requiredFor,
      scope,
      source: "croco",
      state: input.state,
      subjectId: input.subjectId,
      tenantId,
    };
  });
}

function createPermissionInspectionProblem(
  input: AdminPermissionInspectionInput,
  tenantId: string | undefined,
): ProblemDetails | undefined {
  if (input.state === "denied") {
    return createPermissionInspectionProblemDetails(input.permission, tenantId);
  }

  if (input.state === "provider_failure") {
    return createPermissionInspectionUnavailableProblemDetails(input.permission);
  }

  return undefined;
}

function createImpersonationState(
  input: AdminImpersonationStateInput | undefined,
  generatedAt: Date,
): AdminImpersonationConsoleState {
  if (!input) {
    return {
      kind: "inactive",
      mutability: "read-only",
      source: "croco",
    };
  }

  if (input.kind === "inactive") {
    return {
      actor: input.actor,
      kind: "inactive",
      mutability: "read-only",
      source: "croco",
      startAction: input.startAction,
    };
  }

  if (input.kind === "unavailable") {
    return {
      kind: "unavailable",
      mutability: "read-only",
      problem: input.problem,
      recoveryAction: input.recoveryAction,
      source: "croco",
    };
  }

  const impersonator = createImpersonationPrincipal(
    input.session.impersonatorId,
    input.impersonator,
  );
  const target = createImpersonationPrincipal(input.session.targetUserId, input.target);
  const expired =
    input.kind === "expired" || input.session.expiresAt.getTime() <= generatedAt.getTime();
  const expiredProblem = input.kind === "expired" ? input.problem : undefined;

  if (expired) {
    return {
      exitAction: input.exitAction,
      impersonator,
      kind: "expired",
      mutability: "editable",
      problem: expiredProblem ?? createImpersonationExpiredProblemDetails(input.session.sessionId),
      session: input.session,
      source: "croco",
      target,
    };
  }

  return {
    exitAction: input.exitAction,
    impersonator,
    kind: "active",
    mutability: "editable",
    session: input.session,
    source: "croco",
    target,
  };
}

function createImpersonationPrincipal(
  userId: string,
  input: AdminImpersonationPrincipal | undefined,
): AdminImpersonationPrincipal {
  return {
    email: input?.email,
    label: input?.label,
    userId,
  };
}

function createAdminFormBaseState<TValues extends object, TResult = unknown>(
  contract: AdminFormContract<TValues, TResult>,
  input: {
    readonly generatedAt: Date;
    readonly grantedPermissions: readonly string[];
    readonly kind: AdminFormState<TValues, TResult>["kind"];
    readonly problem?: ProblemDetails;
    readonly problemKind?: AdminFormProblemKind;
    readonly requiredPermissions: readonly string[];
    readonly values: TValues;
  },
): AdminFormState<TValues, TResult> {
  return {
    audit: contract.audit,
    contractId: contract.id,
    dirtyFields: [],
    fieldErrors: {},
    fields: contract.fields,
    generatedAt: input.generatedAt,
    grantedPermissions: input.grantedPermissions,
    initialValues: contract.initialValues,
    intent: contract.intent,
    kind: input.kind,
    problem: input.problem,
    problemKind: input.problemKind,
    recoveryActions: contract.recoveryActions ?? [],
    requiredPermissions: input.requiredPermissions,
    submitLabel: contract.submitLabel ?? defaultSubmitLabel(contract.intent),
    successMessage: contract.successMessage,
    title: contract.title,
    values: input.values,
  };
}

function createAdminFormPermissionProblem<TValues extends object, TResult = unknown>(
  contract: AdminFormContract<TValues, TResult>,
  grantedPermissions: readonly string[],
): ProblemDetails | undefined {
  const requiredPermissions = contract.requiredPermissions ?? [];
  const missingPermissions = getMissingPermissions(requiredPermissions, grantedPermissions);

  if (missingPermissions.length === 0) {
    return undefined;
  }

  return createPermissionDeniedProblemDetails(contract.audit.subjectId, missingPermissions);
}

function getMissingPermissions(
  requiredPermissions: readonly string[],
  grantedPermissions: readonly string[],
): readonly string[] {
  return requiredPermissions.filter((permission) => !grantedPermissions.includes(permission));
}

function defaultSubmitLabel(intent: AdminFormContract<object>["intent"]): string {
  if (intent === "create") {
    return "Create";
  }

  if (intent === "update") {
    return "Save";
  }

  return "Run action";
}

function removeFieldErrors<TValues extends object>(
  fieldErrors: AdminFormFieldErrors<TValues>,
  name: AdminFormFieldName<TValues>,
): AdminFormFieldErrors<TValues> {
  const nextFieldErrors = { ...fieldErrors };

  delete nextFieldErrors[name];

  return nextFieldErrors;
}

function problemKindFromSubmitResult(kind: AdminFormProblemResultKind): AdminFormProblemKind {
  if (kind === "domain_problem") {
    return "domain";
  }

  if (kind === "permission_denied") {
    return "permission";
  }

  return "external";
}

function toExternalFailureProblem(error: unknown): ProblemDetails {
  if (isProblemDetails(error)) {
    return error;
  }

  return createCoreProblemDetails({
    code: "admin-form/external-failure",
    detail:
      error instanceof Error ? error.message : "Admin form submit failed outside Croco Problems",
    source: "external",
    status: 502,
    title: "Bad Gateway",
  });
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ProblemDetails>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.type === "string"
  );
}
