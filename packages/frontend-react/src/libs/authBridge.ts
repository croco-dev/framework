import {
  createContext,
  createElement,
  Fragment,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";

import type { ProblemDetails } from "@croco/problems-core";

import type {
  AuthBridgeGateStatusProps,
  CrocoAuthBridgeProviderProps,
  FrontendAuthBridgeState,
  FrontendAuthBridgeStateInput,
  FrontendAuthGateAllowedState,
  FrontendAuthGateBlockedState,
  FrontendAuthGateFallback,
  FrontendAuthGateRequirements,
  FrontendAuthGateState,
  FrontendEntitlementCheck,
  FrontendEntitlementState,
  FrontendPermissionCheck,
  FrontendPermissionState,
  FrontendRecoveryAction,
  FrontendSessionState,
  FrontendTenant,
  FrontendTenantState,
  RequireEntitlementProps,
  RequirePermissionProps,
  RequireSessionProps,
} from "./authBridgeTypes";

const ABOUT_BLANK = "about:blank";

export function createFrontendProblemDetails(options: {
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

export function createAuthBridgeMissingProviderProblemDetails(): ProblemDetails {
  return createFrontendProblemDetails({
    code: "frontend-react/auth-bridge-provider-missing",
    detail: "CrocoAuthBridgeProvider is required before auth and entitlement state can be read.",
    source: "frontend-react",
    status: 503,
    title: "Auth bridge unavailable",
  });
}

export function createFrontendPermissionDeniedProblemDetails(
  permissions: readonly string[],
): ProblemDetails {
  return createFrontendProblemDetails({
    code: "frontend-react/permission-denied",
    detail: `Missing permissions: ${permissions.join(", ")}`,
    source: "permissions",
    status: 403,
    title: "Permission denied",
  });
}

export function createFrontendEntitlementDeniedProblemDetails(
  entitlements: readonly string[],
): ProblemDetails {
  return createFrontendProblemDetails({
    code: "frontend-react/entitlement-denied",
    detail: `Missing entitlements: ${entitlements.join(", ")}`,
    source: "entitlements",
    status: 403,
    title: "Entitlement denied",
  });
}

export function createFrontendTenantUnavailableProblemDetails(): ProblemDetails {
  return createFrontendProblemDetails({
    code: "frontend-react/tenant-unavailable",
    detail: "Tenant state is required but no tenant is available.",
    source: "tenant",
    status: 503,
    title: "Tenant unavailable",
  });
}

export function createFrontendUnauthenticatedProblemDetails(): ProblemDetails {
  return createFrontendProblemDetails({
    code: "frontend-react/session-unauthenticated",
    detail: "An authenticated Croco session is required.",
    source: "session",
    status: 401,
    title: "Unauthenticated",
  });
}

export function createFrontendAuthBridgeState(
  input: FrontendAuthBridgeStateInput = {},
): FrontendAuthBridgeState {
  const session = normalizeSessionState(input);
  const tenant = normalizeTenantState(input);
  const permissions = normalizePermissionState(input);
  const entitlements = normalizeEntitlementState(input);

  return {
    entitlements,
    generatedAt: input.generatedAt,
    permissions,
    providerName: input.providerName,
    session,
    tenant,
  };
}

export function createMissingProviderAuthBridgeState(): FrontendAuthBridgeState {
  const problem = createAuthBridgeMissingProviderProblemDetails();

  return createFrontendAuthBridgeState({
    providerFailure: problem,
    recoveryActions: [],
  });
}

export const AuthBridgeContext = createContext<FrontendAuthBridgeState>(
  createMissingProviderAuthBridgeState(),
);

export function CrocoAuthBridgeProvider({
  children,
  value,
}: CrocoAuthBridgeProviderProps): ReactElement {
  return createElement(AuthBridgeContext.Provider, { value }, children);
}

export function useAuthBridgeState(): FrontendAuthBridgeState {
  return useContext(AuthBridgeContext);
}

export function useTenant(): FrontendTenantState {
  return useAuthBridgeState().tenant;
}

export function useSessionGate(
  requirements: FrontendAuthGateRequirements = {},
): FrontendAuthGateState {
  return evaluateSessionGateState(useAuthBridgeState(), requirements);
}

export function usePermissionGate(
  permissions: string | readonly string[],
  options: Pick<FrontendAuthGateRequirements, "tenantRequired"> = {},
): FrontendAuthGateState {
  return useSessionGate({
    permissions,
    tenantRequired: options.tenantRequired,
  });
}

export function useEntitlements(): FrontendEntitlementState;
export function useEntitlements(
  entitlements: string | readonly string[],
  options?: Pick<FrontendAuthGateRequirements, "tenantRequired">,
): FrontendAuthGateState;
export function useEntitlements(
  entitlements?: string | readonly string[],
  options: Pick<FrontendAuthGateRequirements, "tenantRequired"> = {},
): FrontendAuthGateState | FrontendEntitlementState {
  const state = useAuthBridgeState();

  if (entitlements === undefined) {
    return state.entitlements;
  }

  return evaluateSessionGateState(state, {
    entitlements,
    tenantRequired: options.tenantRequired,
  });
}

export function RequireSession({
  children,
  fallback,
  tenantRequired,
}: RequireSessionProps): ReactElement {
  const state = useSessionGate({ tenantRequired });

  return renderGateState(state, children, fallback);
}

export function RequirePermission({
  children,
  fallback,
  permissions,
  tenantRequired,
}: RequirePermissionProps): ReactElement {
  const state = usePermissionGate(permissions, { tenantRequired });

  return renderGateState(state, children, fallback);
}

export function RequireEntitlement({
  children,
  entitlements,
  fallback,
  tenantRequired,
}: RequireEntitlementProps): ReactElement {
  const state = useEntitlements(entitlements, { tenantRequired });

  return renderGateState(state, children, fallback);
}

export function AuthBridgeGateStatus({ state }: AuthBridgeGateStatusProps): ReactElement {
  const role = state.kind === "loading" ? "status" : "alert";
  const problem = "problem" in state ? state.problem : undefined;
  const recoveryActions = "recoveryActions" in state ? state.recoveryActions : undefined;

  return createElement(
    "section",
    {
      "aria-busy": state.kind === "loading" ? true : undefined,
      "data-croco-auth-state": state.kind,
      "data-testid": `frontend-auth-${state.kind}`,
      role,
    },
    createElement("p", { "data-testid": "frontend-auth-state" }, state.kind),
    problem ? createElement(AuthBridgeProblemNotice, { problem }) : null,
    state.kind === "denied" && state.missingPermissions.length > 0
      ? createElement(
          "p",
          { "data-testid": "frontend-auth-missing-permissions" },
          `Missing permissions: ${state.missingPermissions.join(", ")}`,
        )
      : null,
    state.kind === "denied" && state.missingEntitlements.length > 0
      ? createElement(
          "p",
          { "data-testid": "frontend-auth-missing-entitlements" },
          `Missing entitlements: ${state.missingEntitlements.join(", ")}`,
        )
      : null,
    recoveryActions && recoveryActions.length > 0
      ? createElement(AuthBridgeRecoveryActions, { actions: recoveryActions })
      : null,
  );
}

export function AuthBridgeProblemNotice({
  problem,
}: {
  readonly problem: ProblemDetails;
}): ReactElement {
  return createElement(
    "div",
    {
      "data-problem-code": problem.code,
      "data-problem-status": problem.status,
      "data-testid": "frontend-auth-problem",
    },
    createElement("strong", null, problem.title),
    problem.detail ? createElement("p", null, problem.detail) : null,
  );
}

export function AuthBridgeRecoveryActions({
  actions,
}: {
  readonly actions: readonly FrontendRecoveryAction[];
}): ReactElement {
  return createElement(
    "ul",
    { "data-testid": "frontend-auth-recovery-actions" },
    actions.map((action) =>
      createElement(
        "li",
        { key: action.id },
        action.href
          ? createElement("a", { href: action.href }, action.label)
          : createElement(
              "button",
              {
                onClick: action.onRecover,
                type: "button",
              },
              action.label,
            ),
      ),
    ),
  );
}

export function evaluateSessionGateState(
  state: FrontendAuthBridgeState,
  requirements: FrontendAuthGateRequirements = {},
): FrontendAuthGateState {
  const requiredPermissions = normalizeList(requirements.permissions);
  const requiredEntitlements = normalizeList(requirements.entitlements);

  if (state.session.kind === "loading") {
    return {
      kind: "loading",
      recoveryActions: state.session.recoveryActions,
      requiredEntitlements,
      requiredPermissions,
    };
  }

  if (state.session.kind === "unavailable") {
    return {
      kind: "unavailable",
      problem: state.session.problem,
      recoveryActions: state.session.recoveryActions,
      requiredEntitlements,
      requiredPermissions,
    };
  }

  if (state.session.kind === "unauthenticated") {
    return {
      kind: "unauthenticated",
      problem: state.session.problem,
      recoveryActions: state.session.recoveryActions,
      requiredEntitlements,
      requiredPermissions,
    };
  }

  const tenantGate = evaluateTenantRequirement(
    state.tenant,
    requirements.tenantRequired,
    requiredPermissions.length > 0 || requiredEntitlements.length > 0,
  );
  if (tenantGate.kind === "loading") {
    return {
      kind: "loading",
      recoveryActions: tenantGate.recoveryActions,
      requiredEntitlements,
      requiredPermissions,
    };
  }

  if (tenantGate.kind === "unavailable") {
    return {
      kind: "unavailable",
      problem: tenantGate.problem,
      recoveryActions: tenantGate.recoveryActions,
      requiredEntitlements,
      requiredPermissions,
    };
  }

  const permissionGate = evaluatePermissionRequirement(state.permissions, requiredPermissions);
  const entitlementGate = evaluateEntitlementRequirement(state.entitlements, requiredEntitlements);
  const blockedGate = combineRequirementGateStates(
    permissionGate,
    entitlementGate,
    requiredPermissions,
    requiredEntitlements,
  );

  if (blockedGate) {
    return blockedGate;
  }

  if (permissionGate.kind !== "allowed") {
    return withRequirements(permissionGate, requiredPermissions, requiredEntitlements);
  }

  if (entitlementGate.kind !== "allowed") {
    return withRequirements(entitlementGate, requiredPermissions, requiredEntitlements);
  }

  return {
    entitlements: entitlementGate.entitlements,
    kind: "allowed",
    permissions: permissionGate.permissions,
    session: state.session.session,
    tenant: tenantGate.tenant,
  };
}

function normalizeSessionState(input: FrontendAuthBridgeStateInput): FrontendSessionState {
  if (input.providerFailure) {
    return {
      kind: "unavailable",
      problem: input.providerFailure,
      recoveryActions: input.recoveryActions,
    };
  }

  if (input.loading) {
    return {
      kind: "loading",
      recoveryActions: input.recoveryActions,
    };
  }

  if (input.session === null || input.session === undefined) {
    return {
      kind: "unauthenticated",
      problem: createFrontendUnauthenticatedProblemDetails(),
      recoveryActions: input.recoveryActions,
    };
  }

  if (hasKind(input.session)) {
    return input.session;
  }

  return {
    kind: "authenticated",
    session: input.session,
  };
}

function normalizeTenantState(input: FrontendAuthBridgeStateInput): FrontendTenantState {
  if (input.providerFailure) {
    return {
      kind: "unavailable",
      problem: input.providerFailure,
      recoveryActions: input.recoveryActions,
    };
  }

  if (input.loading) {
    return {
      kind: "loading",
      recoveryActions: input.recoveryActions,
    };
  }

  if (input.tenant === null || input.tenant === undefined) {
    return {
      kind: "missing",
    };
  }

  if (hasKind(input.tenant)) {
    return input.tenant;
  }

  return {
    kind: "available",
    tenant: input.tenant,
  };
}

function normalizePermissionState(input: FrontendAuthBridgeStateInput): FrontendPermissionState {
  if (input.providerFailure) {
    return {
      checks: [],
      kind: "unavailable",
      problem: input.providerFailure,
      recoveryActions: input.recoveryActions,
    };
  }

  if (input.loading) {
    return {
      kind: "loading",
      recoveryActions: input.recoveryActions,
    };
  }

  const permissions = input.permissions ?? [];
  if (hasKind<FrontendPermissionState>(permissions)) {
    return permissions;
  }

  const denied = permissions.filter((check) => !check.granted);
  if (denied.length > 0) {
    return {
      checks: permissions,
      kind: "denied",
      missingPermissions: denied.map((check) => check.permission),
      problem: denied.find((check) => check.problem)?.problem,
      recoveryActions: collectRecoveryActions(denied),
    };
  }

  return {
    checks: permissions,
    grantedPermissions: permissions.map((check) => check.permission),
    kind: "allowed",
  };
}

function normalizeEntitlementState(input: FrontendAuthBridgeStateInput): FrontendEntitlementState {
  if (input.providerFailure) {
    return {
      checks: [],
      kind: "unavailable",
      problem: input.providerFailure,
      recoveryActions: input.recoveryActions,
    };
  }

  if (input.loading) {
    return {
      kind: "loading",
      recoveryActions: input.recoveryActions,
    };
  }

  const entitlements = input.entitlements ?? [];
  if (hasKind<FrontendEntitlementState>(entitlements)) {
    return entitlements;
  }

  const denied = entitlements.filter((check) => !check.granted);
  if (denied.length > 0) {
    return {
      checks: entitlements,
      kind: "denied",
      missingEntitlements: denied.map((check) => check.featureKey),
      problem: denied.find((check) => check.problem)?.problem,
      recoveryActions: collectRecoveryActions(denied),
    };
  }

  return {
    checks: entitlements,
    grantedEntitlements: entitlements.map((check) => check.featureKey),
    kind: "allowed",
  };
}

function evaluateTenantRequirement(
  tenant: FrontendTenantState,
  tenantRequired: boolean | undefined,
  hasTenantDependentRequirements: boolean,
):
  | {
      readonly kind: "available";
      readonly tenant?: FrontendTenant;
    }
  | {
      readonly kind: "loading";
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    } {
  if (!tenantRequired && !hasTenantDependentRequirements) {
    return tenant.kind === "available"
      ? {
          kind: "available",
          tenant: tenant.tenant,
        }
      : {
          kind: "available",
        };
  }

  if (tenant.kind === "loading") {
    return {
      kind: "loading",
      recoveryActions: tenant.recoveryActions,
    };
  }

  if (tenant.kind === "unavailable") {
    return tenant;
  }

  if (tenant.kind === "available") {
    return {
      kind: "available",
      tenant: tenant.tenant,
    };
  }

  if (tenantRequired) {
    return {
      kind: "unavailable",
      problem: tenant.problem ?? createFrontendTenantUnavailableProblemDetails(),
      recoveryActions: tenant.recoveryActions,
    };
  }

  return {
    kind: "available",
  };
}

function evaluatePermissionRequirement(
  permissions: FrontendPermissionState,
  requiredPermissions: readonly string[],
):
  | {
      readonly kind: "allowed";
      readonly permissions: readonly FrontendPermissionCheck[];
    }
  | FrontendAuthGateBlockedState {
  if (requiredPermissions.length === 0) {
    return {
      kind: "allowed",
      permissions:
        permissions.kind === "allowed" || permissions.kind === "denied" ? permissions.checks : [],
    };
  }

  if (permissions.kind === "loading") {
    return {
      kind: "loading",
      recoveryActions: permissions.recoveryActions,
      requiredEntitlements: [],
      requiredPermissions,
    };
  }

  if (permissions.kind === "unavailable") {
    return {
      kind: "unavailable",
      problem: permissions.problem,
      recoveryActions: permissions.recoveryActions,
      requiredEntitlements: [],
      requiredPermissions,
    };
  }

  const checks = permissions.checks;
  const missingPermissions = requiredPermissions.filter((permission) => {
    const check = checks.find((candidate) => candidate.permission === permission);

    return !check?.granted;
  });

  if (missingPermissions.length > 0) {
    const deniedChecks = checks.filter((check) => missingPermissions.includes(check.permission));

    return {
      kind: "denied",
      missingEntitlements: [],
      missingPermissions,
      problem:
        deniedChecks.find((check) => check.problem)?.problem ??
        (permissions.kind === "denied" ? permissions.problem : undefined) ??
        createFrontendPermissionDeniedProblemDetails(missingPermissions),
      recoveryActions:
        collectRecoveryActions(deniedChecks) ??
        (permissions.kind === "denied" ? permissions.recoveryActions : undefined),
      requiredEntitlements: [],
      requiredPermissions,
    };
  }

  return {
    kind: "allowed",
    permissions: checks,
  };
}

function evaluateEntitlementRequirement(
  entitlements: FrontendEntitlementState,
  requiredEntitlements: readonly string[],
):
  | {
      readonly kind: "allowed";
      readonly entitlements: readonly FrontendEntitlementCheck[];
    }
  | FrontendAuthGateBlockedState {
  if (requiredEntitlements.length === 0) {
    return {
      entitlements:
        entitlements.kind === "allowed" || entitlements.kind === "denied"
          ? entitlements.checks
          : [],
      kind: "allowed",
    };
  }

  if (entitlements.kind === "loading") {
    return {
      kind: "loading",
      recoveryActions: entitlements.recoveryActions,
      requiredEntitlements,
      requiredPermissions: [],
    };
  }

  if (entitlements.kind === "unavailable") {
    return {
      kind: "unavailable",
      problem: entitlements.problem,
      recoveryActions: entitlements.recoveryActions,
      requiredEntitlements,
      requiredPermissions: [],
    };
  }

  const checks = entitlements.checks;
  const missingEntitlements = requiredEntitlements.filter((featureKey) => {
    const check = checks.find((candidate) => candidate.featureKey === featureKey);

    return !check?.granted;
  });

  if (missingEntitlements.length > 0) {
    const deniedChecks = checks.filter((check) => missingEntitlements.includes(check.featureKey));

    return {
      kind: "denied",
      missingEntitlements,
      missingPermissions: [],
      problem:
        deniedChecks.find((check) => check.problem)?.problem ??
        (entitlements.kind === "denied" ? entitlements.problem : undefined) ??
        createFrontendEntitlementDeniedProblemDetails(missingEntitlements),
      recoveryActions:
        collectRecoveryActions(deniedChecks) ??
        (entitlements.kind === "denied" ? entitlements.recoveryActions : undefined),
      requiredEntitlements,
      requiredPermissions: [],
    };
  }

  return {
    entitlements: checks,
    kind: "allowed",
  };
}

function combineRequirementGateStates(
  permissionGate: ReturnType<typeof evaluatePermissionRequirement>,
  entitlementGate: ReturnType<typeof evaluateEntitlementRequirement>,
  requiredPermissions: readonly string[],
  requiredEntitlements: readonly string[],
): FrontendAuthGateBlockedState | undefined {
  if (permissionGate.kind === "allowed" && entitlementGate.kind === "allowed") {
    return undefined;
  }

  const unavailableGate = firstGateOfKind("unavailable", permissionGate, entitlementGate);
  if (unavailableGate) {
    return withRequirements(unavailableGate, requiredPermissions, requiredEntitlements);
  }

  const loadingGate = firstGateOfKind("loading", permissionGate, entitlementGate);
  if (loadingGate) {
    return withRequirements(loadingGate, requiredPermissions, requiredEntitlements);
  }

  return combineDeniedRequirementGateStates(
    permissionGate,
    entitlementGate,
    requiredPermissions,
    requiredEntitlements,
  );
}

function combineDeniedRequirementGateStates(
  permissionGate: ReturnType<typeof evaluatePermissionRequirement>,
  entitlementGate: ReturnType<typeof evaluateEntitlementRequirement>,
  requiredPermissions: readonly string[],
  requiredEntitlements: readonly string[],
): FrontendAuthGateBlockedState {
  const permissionDenied = permissionGate.kind === "denied" ? permissionGate : undefined;
  const entitlementDenied = entitlementGate.kind === "denied" ? entitlementGate : undefined;
  const missingPermissions = permissionDenied?.missingPermissions ?? [];
  const missingEntitlements = entitlementDenied?.missingEntitlements ?? [];
  const problems = [permissionDenied?.problem, entitlementDenied?.problem].filter(isProblemDetails);

  return {
    kind: "denied",
    missingEntitlements,
    missingPermissions,
    problem:
      permissionDenied && entitlementDenied
        ? createFrontendAccessDeniedProblemDetails({
            missingEntitlements,
            missingPermissions,
            problems,
          })
        : (permissionDenied?.problem ?? entitlementDenied?.problem),
    recoveryActions: mergeRecoveryActions(
      permissionDenied?.recoveryActions,
      entitlementDenied?.recoveryActions,
    ),
    requiredEntitlements,
    requiredPermissions,
  };
}

function createFrontendAccessDeniedProblemDetails(options: {
  readonly missingPermissions: readonly string[];
  readonly missingEntitlements: readonly string[];
  readonly problems: readonly ProblemDetails[];
}): ProblemDetails {
  const details = [
    options.missingPermissions.length > 0
      ? `Missing permissions: ${options.missingPermissions.join(", ")}`
      : undefined,
    options.missingEntitlements.length > 0
      ? `Missing entitlements: ${options.missingEntitlements.join(", ")}`
      : undefined,
  ].filter(isString);

  return {
    ...createFrontendProblemDetails({
      code: "frontend-react/access-denied",
      detail: details.join("; "),
      source: "auth-bridge",
      status: 403,
      title: "Access denied",
    }),
    ...(options.problems.length > 0 ? { problems: options.problems } : {}),
  };
}

function firstGateOfKind<Kind extends FrontendAuthGateBlockedState["kind"]>(
  kind: Kind,
  ...states: readonly ReturnType<
    typeof evaluatePermissionRequirement | typeof evaluateEntitlementRequirement
  >[]
): Extract<FrontendAuthGateBlockedState, { readonly kind: Kind }> | undefined {
  return states.find(
    (state): state is Extract<FrontendAuthGateBlockedState, { readonly kind: Kind }> =>
      state.kind === kind,
  );
}

function withRequirements(
  state: FrontendAuthGateBlockedState,
  requiredPermissions: readonly string[],
  requiredEntitlements: readonly string[],
): FrontendAuthGateBlockedState {
  return {
    ...state,
    requiredEntitlements,
    requiredPermissions,
  };
}

function renderGateState(
  state: FrontendAuthGateState,
  children: ReactNode | ((state: FrontendAuthGateAllowedState) => ReactNode),
  fallback?: FrontendAuthGateFallback,
): ReactElement {
  if (state.kind === "allowed") {
    const content = typeof children === "function" ? children(state) : children;

    return wrapNode(content);
  }

  const content = typeof fallback === "function" ? fallback(state) : fallback;

  return content === undefined || content === null
    ? createElement(AuthBridgeGateStatus, { state })
    : wrapNode(content);
}

function wrapNode(node: ReactNode): ReactElement {
  return isValidElement(node) ? node : createElement(Fragment, null, node);
}

function collectRecoveryActions(
  checks: readonly { readonly recoveryActions?: readonly FrontendRecoveryAction[] }[],
): readonly FrontendRecoveryAction[] | undefined {
  const actions = checks.flatMap((check) => check.recoveryActions ?? []);

  return actions.length > 0 ? actions : undefined;
}

function mergeRecoveryActions(
  ...actionGroups: readonly (readonly FrontendRecoveryAction[] | undefined)[]
): readonly FrontendRecoveryAction[] | undefined {
  const actionsById = new Map<string, FrontendRecoveryAction>();

  for (const action of actionGroups.flatMap((actions) => actions ?? [])) {
    if (!actionsById.has(action.id)) {
      actionsById.set(action.id, action);
    }
  }

  return actionsById.size > 0 ? [...actionsById.values()] : undefined;
}

function normalizeList(value: string | readonly string[] | undefined): readonly string[] {
  if (!value) {
    return [];
  }

  return typeof value === "string" ? [value] : [...new Set(value)];
}

function hasKind<T extends { readonly kind: string }>(value: unknown): value is T {
  return Boolean(value && typeof value === "object" && "kind" in value);
}

function isProblemDetails(problem: ProblemDetails | undefined): problem is ProblemDetails {
  return problem !== undefined;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
