import type { ReactNode } from "react";

import type { ProblemDetails } from "@croco/problems-core";

export type FrontendAuthBridgeSource = "croco" | "generated-client" | "provider";

export type FrontendRecoveryAction = {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly onRecover?: () => void | Promise<void>;
  readonly problemCodes?: readonly string[];
};

export type FrontendSessionPrincipal = {
  readonly userId: string;
  readonly label?: string;
  readonly email?: string;
  readonly roles?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type FrontendSession = {
  readonly user: FrontendSessionPrincipal;
  readonly provider?: string;
  readonly issuedAt?: Date;
  readonly expiresAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type FrontendTenant = {
  readonly tenantId: string;
  readonly slug?: string;
  readonly name?: string;
  readonly status?: string;
  readonly source?: FrontendAuthBridgeSource;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type FrontendPermissionCheck = {
  readonly permission: string;
  readonly granted: boolean;
  readonly source?: FrontendAuthBridgeSource;
  readonly problem?: ProblemDetails;
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
};

export type FrontendEntitlementCheck = {
  readonly featureKey: string;
  readonly granted: boolean;
  readonly source?: FrontendAuthBridgeSource;
  readonly reason?: string;
  readonly usage?: number;
  readonly quota?: number | null;
  readonly remaining?: number | null;
  readonly problem?: ProblemDetails;
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
};

export type FrontendSessionState =
  | {
      readonly kind: "loading";
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "authenticated";
      readonly session: FrontendSession;
    }
  | {
      readonly kind: "unauthenticated";
      readonly problem?: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    };

export type FrontendTenantState =
  | {
      readonly kind: "loading";
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "available";
      readonly tenant: FrontendTenant;
    }
  | {
      readonly kind: "missing";
      readonly problem?: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    };

export type FrontendPermissionState =
  | {
      readonly kind: "loading";
      readonly checks?: readonly FrontendPermissionCheck[];
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "allowed";
      readonly checks: readonly FrontendPermissionCheck[];
      readonly grantedPermissions: readonly string[];
    }
  | {
      readonly kind: "denied";
      readonly checks: readonly FrontendPermissionCheck[];
      readonly missingPermissions: readonly string[];
      readonly problem?: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly checks?: readonly FrontendPermissionCheck[];
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    };

export type FrontendEntitlementState =
  | {
      readonly kind: "loading";
      readonly checks?: readonly FrontendEntitlementCheck[];
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "allowed";
      readonly checks: readonly FrontendEntitlementCheck[];
      readonly grantedEntitlements: readonly string[];
    }
  | {
      readonly kind: "denied";
      readonly checks: readonly FrontendEntitlementCheck[];
      readonly missingEntitlements: readonly string[];
      readonly problem?: ProblemDetails;
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly checks?: readonly FrontendEntitlementCheck[];
      readonly recoveryActions?: readonly FrontendRecoveryAction[];
    };

export type FrontendAuthBridgeState = {
  readonly session: FrontendSessionState;
  readonly tenant: FrontendTenantState;
  readonly permissions: FrontendPermissionState;
  readonly entitlements: FrontendEntitlementState;
  readonly generatedAt?: Date;
  readonly providerName?: string;
};

export type FrontendAuthBridgeStateInput = {
  readonly session?: FrontendSession | FrontendSessionState | null;
  readonly tenant?: FrontendTenant | FrontendTenantState | null;
  readonly permissions?: readonly FrontendPermissionCheck[] | FrontendPermissionState;
  readonly entitlements?: readonly FrontendEntitlementCheck[] | FrontendEntitlementState;
  readonly loading?: boolean;
  readonly providerFailure?: ProblemDetails;
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
  readonly generatedAt?: Date;
  readonly providerName?: string;
};

export type FrontendAuthGateRequirements = {
  readonly tenantRequired?: boolean;
  readonly permissions?: string | readonly string[];
  readonly entitlements?: string | readonly string[];
};

export type FrontendAuthGateLoadingState = {
  readonly kind: "loading";
  readonly requiredPermissions: readonly string[];
  readonly requiredEntitlements: readonly string[];
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
};

export type FrontendAuthGateAllowedState = {
  readonly kind: "allowed";
  readonly session: FrontendSession;
  readonly tenant?: FrontendTenant;
  readonly permissions: readonly FrontendPermissionCheck[];
  readonly entitlements: readonly FrontendEntitlementCheck[];
};

export type FrontendAuthGateDeniedState = {
  readonly kind: "denied";
  readonly requiredPermissions: readonly string[];
  readonly requiredEntitlements: readonly string[];
  readonly missingPermissions: readonly string[];
  readonly missingEntitlements: readonly string[];
  readonly problem?: ProblemDetails;
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
};

export type FrontendAuthGateUnauthenticatedState = {
  readonly kind: "unauthenticated";
  readonly requiredPermissions: readonly string[];
  readonly requiredEntitlements: readonly string[];
  readonly problem?: ProblemDetails;
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
};

export type FrontendAuthGateUnavailableState = {
  readonly kind: "unavailable";
  readonly requiredPermissions: readonly string[];
  readonly requiredEntitlements: readonly string[];
  readonly problem: ProblemDetails;
  readonly recoveryActions?: readonly FrontendRecoveryAction[];
};

export type FrontendAuthGateState =
  | FrontendAuthGateLoadingState
  | FrontendAuthGateAllowedState
  | FrontendAuthGateDeniedState
  | FrontendAuthGateUnauthenticatedState
  | FrontendAuthGateUnavailableState;

export type FrontendAuthGateBlockedState = Exclude<
  FrontendAuthGateState,
  FrontendAuthGateAllowedState
>;

export type FrontendAuthGateFallback =
  | ReactNode
  | ((state: FrontendAuthGateBlockedState) => ReactNode);

export type CrocoAuthBridgeProviderProps = {
  readonly value: FrontendAuthBridgeState;
  readonly children?: ReactNode;
};

export type RequirePermissionProps = {
  readonly permissions: string | readonly string[];
  readonly tenantRequired?: boolean;
  readonly children: ReactNode | ((state: FrontendAuthGateAllowedState) => ReactNode);
  readonly fallback?: FrontendAuthGateFallback;
};

export type RequireEntitlementProps = {
  readonly entitlements: string | readonly string[];
  readonly tenantRequired?: boolean;
  readonly children: ReactNode | ((state: FrontendAuthGateAllowedState) => ReactNode);
  readonly fallback?: FrontendAuthGateFallback;
};

export type RequireSessionProps = {
  readonly tenantRequired?: boolean;
  readonly children: ReactNode | ((state: FrontendAuthGateAllowedState) => ReactNode);
  readonly fallback?: FrontendAuthGateFallback;
};

export type AuthBridgeGateStatusProps = {
  readonly state: FrontendAuthGateBlockedState;
};
