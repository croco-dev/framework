import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  createInMemoryTenantBusinessSource,
  createTenantWorkspaceLoadingSnapshot,
  createTenantWorkspaceSourceLoadingSnapshot,
  loadTenantWorkspace,
  type AdminAction,
  type TenantBusinessSource,
  type TenantWorkspaceSnapshot,
  type TenantWorkspaceSourceData,
} from "@croco/admin-core";
import {
  TenantBusinessWorkspace,
  type TenantWorkspaceActionRequest,
  type TenantWorkspaceActionResult,
} from "@croco/admin-react";

const loadedAt = new Date("2026-07-26T00:00:00.000Z");
const grantedPermissions = [
  "tenant:read",
  "billing:read",
  "usage:read",
  "entitlements:read",
  "members:read",
  "entitlements:write",
] as const;

const refreshAction: AdminAction = {
  audit: {
    actor: "required",
    eventName: "tenant.entitlements.refreshed",
    idempotencyKey: "required",
    reason: "required",
    subjectType: "tenant",
  },
  id: "refresh-entitlements",
  idempotency: "required",
  kind: "retry",
  label: "Refresh entitlements",
  mutability: "write",
  permissions: [{ permissions: ["entitlements:write"] }],
  problems: [
    {
      code: "admin-console/entitlement-refresh-failed",
      recoveryActionId: "refresh-entitlements",
      retryable: true,
    },
  ],
  target: "record",
};

function createFakeSources(
  tenantId: string,
): readonly TenantBusinessSource<TenantWorkspaceSourceData>[] {
  const globex = tenantId === "tenant_globex";
  return [
    createInMemoryTenantBusinessSource({
      id: "identity",
      label: "Identity",
      requiredPermissions: ["tenant:read"],
      result: {
        kind: "ready",
        loadedAt,
        state: {
          kind: "identity",
          name: globex ? "Globex Support" : "Acme Operations",
          status: globex ? "at-risk" : "active",
          tenantId,
        },
      },
      section: "overview",
    }),
    createInMemoryTenantBusinessSource({
      id: "billing",
      label: "Billing",
      requiredPermissions: ["billing:read"],
      result: {
        kind: "ready",
        loadedAt,
        state: {
          detailHref: `/admin/tenants/${tenantId}/billing`,
          kind: "subscription",
          planId: "growth",
          planName: "Growth",
          planVersionId: "growth-v4",
          providerState: "read-only",
          status: globex ? "past_due" : "active",
          subscriptionId: `subscription_${tenantId}`,
        },
      },
      section: "billing",
    }),
    createInMemoryTenantBusinessSource({
      id: "usage",
      label: "Usage",
      requiredPermissions: ["usage:read"],
      result: {
        kind: "ready",
        loadedAt,
        state: {
          detailHref: `/admin/tenants/${tenantId}/usage`,
          kind: "usage",
          meters: [
            {
              classification: "billable",
              forecast: globex ? 13_000 : 7_500,
              forecastState: globex ? "over-limit" : "within-limit",
              id: "api-calls",
              label: "API calls",
              limit: 10_000,
              usage: globex ? 10_400 : 6_200,
            },
            {
              classification: "non-billable",
              id: "admin-logins",
              label: "Admin logins",
              usage: globex ? 2 : 8,
            },
          ],
          overLimitCount: globex ? 1 : 0,
          warningCount: globex ? 1 : 0,
        },
      },
      section: "usage",
    }),
    createInMemoryTenantBusinessSource({
      id: "entitlements",
      label: "Entitlements",
      requiredPermissions: ["entitlements:read"],
      result: {
        kind: "ready",
        loadedAt,
        state: {
          denied: globex ? 2 : 0,
          detailHref: `/admin/tenants/${tenantId}/entitlements`,
          granted: globex ? 5 : 8,
          kind: "entitlements",
          overQuota: globex ? 1 : 0,
          warnings: globex ? 2 : 0,
        },
      },
      section: "entitlements",
    }),
    createInMemoryTenantBusinessSource({
      id: "members",
      label: "Members",
      requiredPermissions: ["members:read"],
      result: {
        kind: "ready",
        loadedAt,
        state: {
          activeMembers: globex ? 10 : 7,
          detailHref: `/admin/tenants/${tenantId}/members`,
          kind: "membership",
          pendingInvitations: 1,
          seatLimit: 10,
        },
      },
      section: "members",
    }),
    createInMemoryTenantBusinessSource({
      id: "onboarding",
      label: "Onboarding",
      result: globex
        ? {
            kind: "stale",
            loadedAt,
            staleAt: new Date("2026-07-26T01:00:00.000Z"),
            state: {
              blockedReason: "Billing verification is incomplete.",
              completedSteps: 2,
              kind: "onboarding",
              percent: 50,
              state: "blocked",
              totalSteps: 4,
            },
          }
        : {
            kind: "ready",
            loadedAt,
            state: {
              completedSteps: 4,
              kind: "onboarding",
              percent: 100,
              state: "completed",
              totalSteps: 4,
            },
          },
      section: "onboarding",
    }),
    createInMemoryTenantBusinessSource({
      id: "health",
      label: "Health",
      result: {
        kind: "ready",
        loadedAt,
        state: {
          kind: "health",
          score: globex ? 39 : 91,
          signals: [
            {
              contribution: globex ? -30 : 20,
              id: "adoption",
              label: "Product adoption",
              trend: globex ? "deteriorating" : "improving",
            },
          ],
          state: globex ? "at-risk" : "healthy",
          trend: globex ? "deteriorating" : "improving",
        },
      },
      section: "overview",
    }),
    createInMemoryTenantBusinessSource({
      id: "operations",
      label: "Operations",
      result: globex
        ? {
            kind: "problem",
            problem: {
              code: "admin-console/fake-provider-unavailable",
              detail: "The fake operations provider is unavailable for this fixture.",
              status: 503,
              title: "Operations provider unavailable",
              type: "admin-console/fake-provider-unavailable",
            },
          }
        : {
            kind: "ready",
            loadedAt,
            state: {
              detailHref: `/admin/tenants/${tenantId}/operations`,
              entries: [
                {
                  id: "operation-1",
                  severity: "info",
                  source: "audit",
                  tenantId,
                  timestamp: loadedAt,
                  title: "Tenant fixture loaded",
                },
              ],
              kind: "operations",
            },
          },
      section: "operations",
    }),
    createInMemoryTenantBusinessSource({
      id: "failed-work",
      label: "Failed work",
      result: {
        kind: "ready",
        loadedAt,
        state: {
          detailHref: `/admin/tenants/${tenantId}/operations?state=failed`,
          failedOperations: globex ? 3 : 0,
          kind: "failed-work",
          openProblems: globex ? 4 : 0,
          retryableOperations: globex ? 2 : 0,
        },
      },
      section: "operations",
    }),
    createInMemoryTenantBusinessSource({
      id: "engagement",
      label: "Engagement",
      result: {
        kind: "ready",
        loadedAt,
        state: {
          contractId: "engagement/customer-360",
          extensionId: "engagement",
          kind: "extension",
          label: "Customer communication",
          slot: "tab",
          state: { provider: "fake", recipientCount: globex ? 2 : 8 },
        },
      },
      section: "engagement",
    }),
  ];
}

export function TenantWorkspaceDemo({ tenantId }: { readonly tenantId: string }) {
  const sources = useMemo(() => createFakeSources(tenantId), [tenantId]);
  const [snapshot, setSnapshot] = useState<TenantWorkspaceSnapshot>(() =>
    createTenantWorkspaceLoadingSnapshot({ sources, tenantId }),
  );
  const [actionResult, setActionResult] = useState<TenantWorkspaceActionResult>({ kind: "idle" });
  const [pendingAction, setPendingAction] = useState<TenantWorkspaceActionRequest>();
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [lastActionEvidence, setLastActionEvidence] = useState<string>();

  const loadAllSources = useCallback(async () => {
    setSnapshot(createTenantWorkspaceLoadingSnapshot({ sources, tenantId }));
    setSnapshot(
      await loadTenantWorkspace({
        actions: [refreshAction],
        grantedPermissions,
        sources,
        tenantId,
      }),
    );
  }, [sources, tenantId]);

  const refreshSource = useCallback(
    async (sourceId: string) => {
      const source = sources.find((candidate) => candidate.id === sourceId);
      if (source === undefined) {
        return;
      }
      setSnapshot((current) => createTenantWorkspaceSourceLoadingSnapshot(current, sourceId));
      const refreshed = await loadTenantWorkspace({
        grantedPermissions,
        sources: [source],
        tenantId,
      });
      setSnapshot((current) => ({
        ...current,
        generatedAt: refreshed.generatedAt,
        sources: current.sources.map((currentSource) =>
          currentSource.sourceId === sourceId
            ? (refreshed.sources[0] ?? currentSource)
            : currentSource,
        ),
      }));
    },
    [sources, tenantId],
  );

  useEffect(() => {
    void loadAllSources();
  }, [loadAllSources]);

  function handleAction(request: TenantWorkspaceActionRequest) {
    setPendingAction(request);
    setReason("");
    setIdempotencyKey("");
    setActionResult({
      actionId: request.action.id,
      kind: "confirming",
      requiredInput: request.requiredInput,
    });
  }

  async function confirmAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pendingAction === undefined ||
      (pendingAction.requiredInput.reason && reason.trim() === "") ||
      (pendingAction.requiredInput.idempotencyKey && idempotencyKey.trim() === "")
    ) {
      return;
    }
    const action = pendingAction.action;
    setActionResult({ actionId: action.id, kind: "running" });
    await Promise.resolve();
    setLastActionEvidence(
      `${action.audit.eventName} · idempotency ${idempotencyKey.trim()} · reason captured`,
    );
    setActionResult({
      actionId: action.id,
      kind: "succeeded",
      message: `${action.audit.eventName} recorded by the fake provider.`,
    });
    setPendingAction(undefined);
  }

  return (
    <>
      <TenantBusinessWorkspace
        actionResult={actionResult}
        onAction={handleAction}
        onRefreshSource={(sourceId) => void refreshSource(sourceId)}
        renderExtension={(extension) => (
          <p>
            {extension.label} mounted through <code>{extension.contractId}</code> using a fake
            provider.
          </p>
        )}
        state={snapshot}
      />
      {pendingAction ? (
        <form aria-label={`Confirm ${pendingAction.action.label}`} onSubmit={confirmAction}>
          <h2>Confirm {pendingAction.action.label}</h2>
          {pendingAction.requiredInput.reason ? (
            <label>
              Audit reason
              <input
                name="reason"
                onChange={(event) => setReason(event.currentTarget.value)}
                required
                value={reason}
              />
            </label>
          ) : null}
          {pendingAction.requiredInput.idempotencyKey ? (
            <label>
              Idempotency key
              <input
                name="idempotencyKey"
                onChange={(event) => setIdempotencyKey(event.currentTarget.value)}
                required
                value={idempotencyKey}
              />
            </label>
          ) : null}
          <button type="submit">Run audited action</button>
        </form>
      ) : null}
      {lastActionEvidence ? <output aria-live="polite">{lastActionEvidence}</output> : null}
    </>
  );
}
