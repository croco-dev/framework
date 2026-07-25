import type { ProblemDetails } from "@croco/problems-core";

import type { AdminAction, AdminPermissionRequirement } from "./types";

export type TenantWorkspaceSectionId =
  | "overview"
  | "usage"
  | "billing"
  | "entitlements"
  | "members"
  | "onboarding"
  | "operations"
  | (string & {});

export type TenantWorkspaceField<TValue = unknown> = {
  readonly id: string;
  readonly label: string;
  readonly value?: TValue;
  readonly maskedValue?: TValue;
  readonly requiredPermissions?: readonly string[];
  readonly visibility: "visible" | "masked" | "denied";
  readonly sensitive?: boolean;
};

export type TenantIdentitySummary = {
  readonly kind: "identity";
  readonly tenantId: string;
  readonly name: string;
  readonly status: string;
  readonly slug?: string;
  readonly fields?: readonly TenantWorkspaceField[];
};

export type TenantSubscriptionSummary = {
  readonly kind: "subscription";
  readonly subscriptionId?: string;
  readonly status: string;
  readonly planId?: string;
  readonly planName?: string;
  readonly planVersionId?: string;
  readonly planVersionEffectiveAt?: Date;
  readonly providerState?: "synced" | "stale" | "unavailable" | "read-only";
  readonly detailHref?: string;
};

export type TenantEntitlementSummary = {
  readonly kind: "entitlements";
  readonly granted: number;
  readonly denied: number;
  readonly overQuota: number;
  readonly warnings: number;
  readonly detailHref?: string;
};

export type TenantUsageMeterSummary = {
  readonly id: string;
  readonly label: string;
  readonly classification: "billable" | "non-billable";
  readonly usage: number;
  readonly limit?: number;
  readonly percent?: number;
  readonly forecast?: number;
  readonly forecastState?: "within-limit" | "warning" | "over-limit";
  readonly detailHref?: string;
};

export type TenantUsageSummary = {
  readonly kind: "usage";
  readonly meters: readonly TenantUsageMeterSummary[];
  readonly warningCount: number;
  readonly overLimitCount: number;
  readonly detailHref?: string;
};

export type TenantMembershipSummary = {
  readonly kind: "membership";
  readonly activeMembers: number;
  readonly seatLimit?: number;
  readonly seatPercent?: number;
  readonly pendingInvitations?: number;
  readonly detailHref?: string;
};

export type TenantOnboardingSummary = {
  readonly kind: "onboarding";
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly percent: number;
  readonly state: "not-started" | "in-progress" | "completed" | "blocked";
  readonly blockedReason?: string;
  readonly detailHref?: string;
};

export type TenantHealthSignal = {
  readonly id: string;
  readonly label: string;
  readonly contribution: number;
  readonly trend?: "improving" | "stable" | "deteriorating";
};

export type TenantHealthSummary = {
  readonly kind: "health";
  readonly score: number;
  readonly state: "healthy" | "at-risk" | "critical" | "unknown";
  readonly trend: "improving" | "stable" | "deteriorating" | "unknown";
  readonly signals: readonly TenantHealthSignal[];
  readonly detailHref?: string;
};

export type TenantFailedWorkSummary = {
  readonly kind: "failed-work";
  readonly openProblems: number;
  readonly failedOperations: number;
  readonly retryableOperations: number;
  readonly detailHref?: string;
};

/**
 * Structural subset of `@croco/admin-ops` OperationsTimelineEvent. Keeping the
 * contract structural lets admin-core remain independent from an operations adapter.
 */
export type TenantOperationsTimelineEntry = {
  readonly id: string;
  readonly source: string;
  readonly timestamp: Date;
  readonly severity: "debug" | "info" | "warning" | "error" | "critical";
  readonly title: string;
  readonly summary?: string;
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly problem?: {
    readonly code?: string;
    readonly message?: string;
    readonly retryable?: boolean;
  };
  readonly recoveryAction?: string;
};

export type TenantOperationsSummary = {
  readonly kind: "operations";
  readonly entries: readonly TenantOperationsTimelineEntry[];
  readonly detailHref?: string;
};

export type TenantWorkspaceExtension = {
  readonly kind: "extension";
  readonly extensionId: string;
  readonly slot: "overview" | "sidebar" | "tab" | (string & {});
  readonly label: string;
  readonly contractId: string;
  readonly state: unknown;
  readonly detailHref?: string;
};

export type TenantWorkspaceSourceData =
  | TenantIdentitySummary
  | TenantSubscriptionSummary
  | TenantEntitlementSummary
  | TenantUsageSummary
  | TenantMembershipSummary
  | TenantOnboardingSummary
  | TenantHealthSummary
  | TenantFailedWorkSummary
  | TenantOperationsSummary
  | TenantWorkspaceExtension;

export type TenantWorkspaceActionPermission =
  | {
      readonly kind: "allowed";
      readonly grantedPermissions: readonly string[];
    }
  | {
      readonly kind: "denied";
      readonly grantedPermissions: readonly string[];
      readonly missingPermissions: readonly string[];
      readonly unresolvedRequirements: readonly AdminPermissionRequirement[];
    };

export type TenantWorkspaceActionAvailability =
  | { readonly kind: "enabled" }
  | { readonly kind: "disabled"; readonly reason: string };

export type TenantWorkspaceAction = {
  readonly action: AdminAction;
  readonly availability: TenantWorkspaceActionAvailability;
  readonly permission: TenantWorkspaceActionPermission;
};

export type TenantSourceResult<TState> =
  | {
      readonly kind: "ready";
      readonly state: TState;
      readonly loadedAt: Date;
      readonly expiresAt?: Date;
    }
  | {
      readonly kind: "empty";
      readonly loadedAt: Date;
      readonly message?: string;
    }
  | {
      readonly kind: "stale";
      readonly state: TState;
      readonly loadedAt: Date;
      readonly staleAt: Date;
      readonly problem?: ProblemDetails;
    }
  | {
      readonly kind: "permission-denied";
      readonly problem: ProblemDetails;
      readonly requiredPermissions: readonly string[];
      readonly grantedPermissions: readonly string[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly retryable: boolean;
    }
  | {
      readonly kind: "problem";
      readonly problem: ProblemDetails;
      readonly recoveryActions?: readonly TenantWorkspaceAction[];
    };

export interface TenantBusinessSource<TState extends TenantWorkspaceSourceData> {
  readonly id: string;
  readonly label: string;
  readonly section: TenantWorkspaceSectionId;
  readonly requiredPermissions: readonly string[];
  load(input: { tenantId: string; signal?: AbortSignal }): Promise<TenantSourceResult<TState>>;
}

export type TenantWorkspaceSourceState<
  TState extends TenantWorkspaceSourceData = TenantWorkspaceSourceData,
> =
  | {
      readonly kind: "loading";
      readonly sourceId: string;
      readonly label: string;
      readonly section: TenantWorkspaceSectionId;
    }
  | ({
      readonly sourceId: string;
      readonly label: string;
      readonly section: TenantWorkspaceSectionId;
    } & TenantSourceResult<TState>);

export type TenantWorkspaceSnapshot = {
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly grantedPermissions: readonly string[];
  readonly sources: readonly TenantWorkspaceSourceState[];
  readonly actions: readonly TenantWorkspaceAction[];
};

export type LoadTenantWorkspaceInput = {
  readonly tenantId: string;
  readonly sources: readonly TenantBusinessSource<TenantWorkspaceSourceData>[];
  readonly grantedPermissions: readonly string[];
  readonly actions?: readonly (AdminAction | TenantWorkspaceAction)[];
  readonly signal?: AbortSignal;
  readonly generatedAt?: Date;
};

export function createTenantWorkspaceLoadingSnapshot(
  input: Pick<LoadTenantWorkspaceInput, "tenantId" | "sources"> & {
    readonly generatedAt?: Date;
    readonly grantedPermissions?: readonly string[];
  },
): TenantWorkspaceSnapshot {
  return {
    tenantId: input.tenantId,
    generatedAt: input.generatedAt ?? new Date(),
    grantedPermissions: input.grantedPermissions ?? [],
    sources: input.sources.map((source) => ({
      kind: "loading",
      label: source.label,
      section: source.section,
      sourceId: source.id,
    })),
    actions: [],
  };
}

export function createTenantWorkspaceSourceLoadingSnapshot(
  snapshot: TenantWorkspaceSnapshot,
  sourceId: string,
  generatedAt: Date = new Date(),
): TenantWorkspaceSnapshot {
  return {
    ...snapshot,
    generatedAt,
    sources: snapshot.sources.map((source) =>
      source.sourceId === sourceId
        ? {
            kind: "loading",
            label: source.label,
            section: source.section,
            sourceId: source.sourceId,
          }
        : source,
    ),
  };
}

export async function loadTenantWorkspace(
  input: LoadTenantWorkspaceInput,
): Promise<TenantWorkspaceSnapshot> {
  const sources = await Promise.all(
    input.sources.map(async (source): Promise<TenantWorkspaceSourceState> => {
      const missingPermissions = source.requiredPermissions.filter(
        (permission) => !input.grantedPermissions.includes(permission),
      );

      if (missingPermissions.length > 0) {
        return {
          kind: "permission-denied",
          grantedPermissions: input.grantedPermissions,
          label: source.label,
          problem: createPermissionDeniedProblem(source.id, missingPermissions),
          requiredPermissions: source.requiredPermissions,
          section: source.section,
          sourceId: source.id,
        };
      }

      try {
        const result = await source.load({ tenantId: input.tenantId, signal: input.signal });
        return {
          ...result,
          label: source.label,
          section: source.section,
          sourceId: source.id,
        };
      } catch (error) {
        if (input.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
          throw error;
        }
        return {
          kind: "unavailable",
          label: source.label,
          problem: {
            code: "admin-core/tenant-source-unavailable",
            detail: `The '${source.id}' tenant source did not return a modeled result.`,
            diagnosticCode: "TENANT_SOURCE_THROWN_FAILURE",
            sourceId: source.id,
            status: 503,
            title: "Tenant source unavailable",
            type: "admin-core/tenant-source-unavailable",
          },
          retryable: true,
          section: source.section,
          sourceId: source.id,
        };
      }
    }),
  );

  return {
    tenantId: input.tenantId,
    generatedAt: input.generatedAt ?? new Date(),
    grantedPermissions: input.grantedPermissions,
    sources,
    actions: (input.actions ?? []).map((action) =>
      "action" in action ? action : evaluateTenantWorkspaceAction(action, input.grantedPermissions),
    ),
  };
}

export function evaluateTenantWorkspaceAction(
  action: AdminAction,
  grantedPermissions: readonly string[],
): TenantWorkspaceAction {
  const missingPermissions = collectMissingPermissions(action.permissions, grantedPermissions);
  const unresolvedRequirements = action.permissions.filter(
    (requirement) =>
      requirement.condition !== undefined ||
      requirement.resource !== undefined ||
      requirement.scope !== undefined,
  );
  return {
    action,
    availability:
      action.disabledWhen === undefined
        ? { kind: "enabled" }
        : {
            kind: "disabled",
            reason: `The '${action.disabledWhen}' availability condition requires an explicit host decision.`,
          },
    permission:
      missingPermissions.length === 0 && unresolvedRequirements.length === 0
        ? { kind: "allowed", grantedPermissions }
        : {
            kind: "denied",
            grantedPermissions,
            missingPermissions,
            unresolvedRequirements,
          },
  };
}

export function resolveTenantWorkspaceField<TValue>(
  input: Omit<TenantWorkspaceField<TValue>, "visibility">,
  grantedPermissions: readonly string[],
): TenantWorkspaceField<TValue> {
  const requiredPermissions = input.requiredPermissions ?? [];
  const allowed =
    (!input.sensitive || requiredPermissions.length > 0) &&
    requiredPermissions.every((permission) => grantedPermissions.includes(permission));

  if (allowed) {
    return { ...input, visibility: "visible" };
  }
  if (input.maskedValue !== undefined) {
    return { ...input, value: undefined, visibility: "masked" };
  }
  return { ...input, value: undefined, visibility: "denied" };
}

export function createInMemoryTenantBusinessSource<
  TState extends TenantWorkspaceSourceData,
>(input: {
  readonly id: string;
  readonly label: string;
  readonly section: TenantWorkspaceSectionId;
  readonly requiredPermissions?: readonly string[];
  readonly result:
    | TenantSourceResult<TState>
    | ((tenantId: string) => TenantSourceResult<TState> | Promise<TenantSourceResult<TState>>);
}): TenantBusinessSource<TState> {
  return {
    id: input.id,
    label: input.label,
    section: input.section,
    requiredPermissions: input.requiredPermissions ?? [],
    async load({ tenantId }) {
      return typeof input.result === "function" ? input.result(tenantId) : input.result;
    },
  };
}

function collectMissingPermissions(
  requirements: readonly AdminPermissionRequirement[],
  grantedPermissions: readonly string[],
): string[] {
  const missing = new Set<string>();
  for (const requirement of requirements) {
    const absent = requirement.permissions.filter(
      (permission) => !grantedPermissions.includes(permission),
    );
    if ((requirement.mode ?? "all") === "all") {
      absent.forEach((permission) => missing.add(permission));
    } else if (absent.length === requirement.permissions.length) {
      requirement.permissions.forEach((permission) => missing.add(permission));
    }
  }
  return [...missing];
}

function createPermissionDeniedProblem(
  sourceId: string,
  missingPermissions: readonly string[],
): ProblemDetails {
  return {
    code: "admin-core/tenant-source-permission-denied",
    detail: `The '${sourceId}' tenant source requires: ${missingPermissions.join(", ")}`,
    status: 403,
    title: "Tenant source permission denied",
    type: "admin-core/tenant-source-permission-denied",
  };
}
