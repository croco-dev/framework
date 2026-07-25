import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createInMemoryTenantBusinessSource,
  createTenantWorkspaceLoadingSnapshot,
  createTenantWorkspaceSourceLoadingSnapshot,
  evaluateTenantWorkspaceAction,
  loadTenantWorkspace,
  resolveTenantWorkspaceField,
} from "../index";
import type {
  AdminAction,
  TenantBusinessSource,
  TenantHealthSummary,
  TenantIdentitySummary,
  TenantUsageSummary,
  TenantWorkspaceExtension,
  TenantWorkspaceSourceData,
} from "../index";

const loadedAt = new Date("2026-07-26T00:00:00.000Z");

const identity: TenantIdentitySummary = {
  kind: "identity",
  name: "Acme",
  status: "active",
  tenantId: "tenant-acme",
};

const action: AdminAction = {
  audit: {
    actor: "required",
    eventName: "tenant.plan.changed",
    idempotencyKey: "required",
    reason: "required",
    subjectType: "tenant",
  },
  id: "change-plan",
  idempotency: "required",
  kind: "edit",
  label: "Change plan",
  mutability: "write",
  permissions: [{ permissions: ["tenant:write", "billing:write"] }],
  problems: [{ code: "billing/plan-change-failed", retryable: true }],
  target: "record",
};

describe("TenantWorkspace", () => {
  it("loads structural sources independently without domain package dependencies", async () => {
    const identitySource = createInMemoryTenantBusinessSource({
      id: "identity",
      label: "Identity",
      requiredPermissions: ["tenant:read"],
      result: { kind: "ready", loadedAt, state: identity },
      section: "overview",
    });
    const failingSource: TenantBusinessSource<TenantUsageSummary> = {
      id: "usage",
      label: "Usage",
      requiredPermissions: [],
      section: "usage",
      async load() {
        throw new Error("provider credential must not escape");
      },
    };

    const snapshot = await loadTenantWorkspace({
      actions: [action],
      generatedAt: loadedAt,
      grantedPermissions: ["tenant:read"],
      sources: [identitySource, failingSource],
      tenantId: "tenant-acme",
    });

    expect(snapshot.sources).toHaveLength(2);
    expect(snapshot.sources[0]).toMatchObject({
      kind: "ready",
      sourceId: "identity",
      state: identity,
    });
    expect(snapshot.sources[1]).toMatchObject({
      kind: "unavailable",
      problem: {
        code: "admin-core/tenant-source-unavailable",
        diagnosticCode: "TENANT_SOURCE_THROWN_FAILURE",
        status: 503,
      },
      retryable: true,
      sourceId: "usage",
    });
    expect(JSON.stringify(snapshot.sources[1])).not.toContain("credential");
    expect(snapshot.actions[0].permission).toEqual({
      grantedPermissions: ["tenant:read"],
      kind: "denied",
      missingPermissions: ["tenant:write", "billing:write"],
      unresolvedRequirements: [],
    });
    expect(snapshot.actions[0].availability).toEqual({ kind: "enabled" });
  });

  it("propagates source cancellation instead of reporting a retryable provider failure", async () => {
    const controller = new AbortController();
    controller.abort();
    const source: TenantBusinessSource<TenantIdentitySummary> = {
      id: "identity",
      label: "Identity",
      requiredPermissions: [],
      section: "overview",
      async load() {
        throw new DOMException("Cancelled by the operator", "AbortError");
      },
    };

    await expect(
      loadTenantWorkspace({
        grantedPermissions: [],
        signal: controller.signal,
        sources: [source],
        tenantId: "tenant-acme",
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not call a source when its explicit permissions are missing", async () => {
    const load = vi.fn(async () => ({ kind: "ready", loadedAt, state: identity }) as const);
    const snapshot = await loadTenantWorkspace({
      grantedPermissions: ["tenant:read"],
      sources: [
        {
          id: "sensitive",
          label: "Sensitive profile",
          load,
          requiredPermissions: ["tenant:read", "tenant:pii:read"],
          section: "overview",
        },
      ],
      tenantId: "tenant-acme",
    });

    expect(load).not.toHaveBeenCalled();
    expect(snapshot.sources[0]).toMatchObject({
      kind: "permission-denied",
      requiredPermissions: ["tenant:read", "tenant:pii:read"],
    });
  });

  it("models loading, empty, stale, domain Problem, and extension states explicitly", async () => {
    const health: TenantHealthSummary = {
      kind: "health",
      score: 42,
      signals: [{ contribution: -20, id: "adoption", label: "Adoption", trend: "deteriorating" }],
      state: "at-risk",
      trend: "deteriorating",
    };
    const extension: TenantWorkspaceExtension = {
      contractId: "engagement/customer-360",
      extensionId: "engagement",
      kind: "extension",
      label: "Engagement",
      slot: "tab",
      state: { recipientCount: 3 },
    };
    const sources: TenantBusinessSource<TenantWorkspaceSourceData>[] = [
      createInMemoryTenantBusinessSource({
        id: "health",
        label: "Health",
        result: {
          kind: "stale",
          loadedAt,
          staleAt: new Date("2026-07-26T01:00:00.000Z"),
          state: health,
        },
        section: "overview",
      }),
      createInMemoryTenantBusinessSource({
        id: "onboarding",
        label: "Onboarding",
        result: { kind: "empty", loadedAt, message: "No onboarding plan" },
        section: "onboarding",
      }),
      createInMemoryTenantBusinessSource({
        id: "operations",
        label: "Operations",
        result: {
          kind: "problem",
          problem: {
            code: "operations/retryable-read-failed",
            detail: "Retry the bounded query.",
            status: 503,
            title: "Operations unavailable",
            type: "operations/retryable-read-failed",
          },
        },
        section: "operations",
      }),
      createInMemoryTenantBusinessSource({
        id: "engagement",
        label: "Engagement",
        result: { kind: "ready", loadedAt, state: extension },
        section: "engagement",
      }),
    ];

    const loading = createTenantWorkspaceLoadingSnapshot({
      generatedAt: loadedAt,
      sources,
      tenantId: "tenant-acme",
    });
    const loaded = await loadTenantWorkspace({
      generatedAt: loadedAt,
      grantedPermissions: [],
      sources,
      tenantId: "tenant-acme",
    });

    expect(loading.sources.map((source) => source.kind)).toEqual([
      "loading",
      "loading",
      "loading",
      "loading",
    ]);
    expect(loaded.sources.map((source) => source.kind)).toEqual([
      "stale",
      "empty",
      "problem",
      "ready",
    ]);
    const partiallyLoading = createTenantWorkspaceSourceLoadingSnapshot(
      loaded,
      "onboarding",
      loadedAt,
    );
    expect(partiallyLoading.sources.map((source) => source.kind)).toEqual([
      "stale",
      "loading",
      "problem",
      "ready",
    ]);
    expect(partiallyLoading.actions).toBe(loaded.actions);
    expectTypeOf(extension.state).toEqualTypeOf<unknown>();
  });

  it("masks or denies sensitive fields unless their field permission is granted", () => {
    const input = {
      id: "owner-email",
      label: "Owner email",
      maskedValue: "o***@example.com",
      requiredPermissions: ["tenant:pii:read"],
      sensitive: true,
      value: "owner@example.com",
    } as const;

    expect(resolveTenantWorkspaceField(input, [])).toMatchObject({
      maskedValue: "o***@example.com",
      value: undefined,
      visibility: "masked",
    });
    expect(resolveTenantWorkspaceField(input, ["tenant:pii:read"])).toMatchObject({
      value: "owner@example.com",
      visibility: "visible",
    });
    expect(
      resolveTenantWorkspaceField(
        {
          id: "secret",
          label: "Secret",
          requiredPermissions: ["tenant:secret:read"],
          sensitive: true,
          value: "never-render",
        },
        [],
      ),
    ).toMatchObject({ value: undefined, visibility: "denied" });
  });

  it("honors all and any permission modes for explicit action availability", () => {
    const anyAction: AdminAction = {
      ...action,
      id: "inspect",
      mutability: "read",
      permissions: [{ mode: "any", permissions: ["tenant:read", "support:read"] }],
    };

    expect(evaluateTenantWorkspaceAction(action, ["tenant:write"]).permission).toMatchObject({
      kind: "denied",
      missingPermissions: ["billing:write"],
    });
    expect(evaluateTenantWorkspaceAction(anyAction, ["support:read"]).permission.kind).toBe(
      "allowed",
    );
    expect(evaluateTenantWorkspaceAction(anyAction, []).permission).toMatchObject({
      kind: "denied",
      missingPermissions: ["tenant:read", "support:read"],
    });
    expect(
      evaluateTenantWorkspaceAction(
        {
          ...anyAction,
          permissions: [
            {
              condition: "tenant.status == 'active'",
              permissions: ["tenant:read"],
              resource: "tenant-acme",
              scope: "tenant",
            },
          ],
        },
        ["tenant:read"],
      ).permission,
    ).toMatchObject({
      kind: "denied",
      missingPermissions: [],
      unresolvedRequirements: [
        {
          condition: "tenant.status == 'active'",
          resource: "tenant-acme",
          scope: "tenant",
        },
      ],
    });
    expect(
      evaluateTenantWorkspaceAction({ ...anyAction, disabledWhen: "tenant.status != 'active'" }, [
        "tenant:read",
      ]).availability,
    ).toMatchObject({
      kind: "disabled",
      reason: expect.stringContaining("explicit host decision"),
    });
  });
});
