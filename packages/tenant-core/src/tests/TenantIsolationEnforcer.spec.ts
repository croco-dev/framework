import * as telemetry from "@croco/telemetry-api";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createCrossTenantLeakFixture,
  createTenantIsolationEnforcer,
  createTenantRepositoryBoundary,
  markTenantScopedOperation,
  type TenantContextRequirement,
  TenantAdminBypassReasonRequiredProblem,
  TenantCrossTenantLeakProblem,
  TenantDefaultFallbackProblem,
  TenantIsolationContextMissingProblem,
  TenantUnsafeQueryProblem,
} from "../index";
import type { TenantIsolationAuditEvent } from "../libs/TenantIsolationEnforcer";

describe("TenantIsolationEnforcer", () => {
  const auditEvents: TenantIsolationAuditEvent[] = [];
  let activeTenantId: string | null = null;

  beforeEach(() => {
    activeTenantId = "tenant-a";
    auditEvents.length = 0;
    vi.restoreAllMocks();
  });

  const createEnforcer = () =>
    createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      auditSink: {
        recordTenantIsolation: (event) => {
          auditEvents.push(event);
        },
      },
    });

  it("exposes a compile-time tenant context requirement type", () => {
    type TenantCommand = TenantContextRequirement & { command: "create-order" };

    expectTypeOf<TenantCommand>().toMatchTypeOf<{
      tenantId: string;
      command: "create-order";
    }>();
  });

  it("fails deterministically when a tenant-scoped operation has no context", async () => {
    activeTenantId = null;
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});

    const operation = markTenantScopedOperation({
      name: "orders.findById",
      kind: "repository-read",
    });

    await expect(createEnforcer().enforce(operation, () => "unreachable")).rejects.toThrow(
      TenantIsolationContextMissingProblem,
    );
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "tenant-isolation.denied",
        operation: "orders.findById",
        problemCode: "tenant-core/isolation-context-missing",
      }),
    ]);
    expect(recordEventSpy).toHaveBeenCalledWith(
      "tenant-isolation.denied",
      expect.objectContaining({
        "tenant.operation": "orders.findById",
        "tenant.problem_code": "tenant-core/isolation-context-missing",
      }),
    );
  });

  it("rejects unsafe default tenant fallback before executing repository work", async () => {
    const operation = markTenantScopedOperation({
      name: "orders.list",
      kind: "repository-read",
      requestedTenantId: "default",
    });

    await expect(createEnforcer().enforce(operation, () => "unreachable")).rejects.toThrow(
      TenantDefaultFallbackProblem,
    );
  });

  it("rejects cross-tenant operation hints without an admin bypass", async () => {
    const operation = markTenantScopedOperation({
      name: "orders.findById",
      kind: "repository-read",
      requestedTenantId: "tenant-b",
    });

    await expect(createEnforcer().enforce(operation, () => "unreachable")).rejects.toThrow(
      TenantUnsafeQueryProblem,
    );
  });

  it("requires an explicit reason for admin and system bypasses", async () => {
    const operation = markTenantScopedOperation({
      name: "admin.tenants.reindex",
      kind: "command",
      isolation: "admin-bypass",
    });

    await expect(createEnforcer().enforce(operation, () => "unreachable")).rejects.toThrow(
      TenantAdminBypassReasonRequiredProblem,
    );
  });

  it("records telemetry and audit evidence for allowed bypasses", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    const operation = markTenantScopedOperation({
      name: "admin.tenants.reindex",
      kind: "command",
      isolation: "admin-bypass",
      bypass: {
        reason: "support ticket T-100",
        actorId: "admin-1",
      },
    });

    const result = await createEnforcer().enforce(operation, (evidence) => evidence.status);

    expect(result).toBe("bypassed");
    expect(recordEventSpy).toHaveBeenCalledWith(
      "tenant-isolation.bypassed",
      expect.objectContaining({
        "tenant.operation": "admin.tenants.reindex",
        "tenant.reason": "support ticket T-100",
      }),
    );
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "tenant-isolation.bypassed",
        reason: "support ticket T-100",
      }),
    ]);
  });

  it("wraps repository read and write boundaries with tenant evidence", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer(), {
      resource: "orders",
    });

    const readTenantId = await boundary.read(
      markTenantScopedOperation({
        name: "orders.read",
        kind: "repository-read",
      }),
      (evidence) => evidence.tenantId,
    );
    const writeStatus = await boundary.write(
      markTenantScopedOperation({
        name: "orders.write",
        kind: "repository-write",
      }),
      (evidence) => evidence.status,
    );

    expect(readTenantId).toBe("tenant-a");
    expect(writeStatus).toBe("tenant-scoped");
  });

  it("rejects query boundaries that omit tenant predicates", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer());

    await expect(
      boundary.query(
        {
          operation: markTenantScopedOperation({
            name: "orders.query",
            kind: "query",
          }),
          tenantColumn: "tenantId",
          predicates: [{ field: "status", operator: "=", value: "open" }],
        },
        () => "unreachable",
      ),
    ).rejects.toThrow(TenantUnsafeQueryProblem);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "tenant-isolation.denied",
        operation: "orders.query",
        problemCode: "tenant-core/unsafe-query",
      }),
    ]);
  });

  it("rejects mixed tenant predicates even when they include the active tenant", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer());

    await expect(
      boundary.query(
        {
          operation: markTenantScopedOperation({
            name: "orders.mixedTenantQuery",
            kind: "query",
          }),
          tenantColumn: "tenantId",
          predicates: [{ field: "tenantId", operator: "in", value: ["tenant-a", "tenant-b"] }],
        },
        () => "unreachable",
      ),
    ).rejects.toThrow(TenantUnsafeQueryProblem);
  });

  it("rejects raw tenant predicates unless RLS or admin bypass is used", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer());

    await expect(
      boundary.query(
        {
          operation: markTenantScopedOperation({
            name: "orders.rawTenantQuery",
            kind: "query",
          }),
          tenantColumn: "tenantId",
          predicates: [{ field: "tenantId", operator: "raw", value: "tenant-a" }],
        },
        () => "unreachable",
      ),
    ).rejects.toThrow(TenantUnsafeQueryProblem);
  });

  it("reports the default tenant fallback value when it appears after the active tenant", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer());

    await expect(
      boundary.query(
        {
          operation: markTenantScopedOperation({
            name: "orders.defaultTenantQuery",
            kind: "query",
          }),
          tenantColumn: "tenantId",
          predicates: [{ field: "tenantId", operator: "in", value: ["tenant-a", "default"] }],
        },
        () => "unreachable",
      ),
    ).rejects.toMatchObject({
      code: "tenant-core/default-tenant-fallback",
      detail:
        "Tenant-scoped operation 'orders.defaultTenantQuery' attempted to use unsafe default tenant 'default'",
    });
  });

  it("accepts adapter-neutral RLS evidence when it matches the active tenant", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer());

    const result = await boundary.query(
      {
        operation: markTenantScopedOperation({
          name: "orders.rlsQuery",
          kind: "query",
        }),
        rls: {
          adapter: "drizzle",
          configKey: "app.current_tenant",
          tenantId: "tenant-a",
          enforced: true,
        },
      },
      (evidence) => evidence.tenantId,
    );

    expect(result).toBe("tenant-a");
  });

  it("rejects adapter-neutral RLS evidence that is not enforced", async () => {
    const boundary = createTenantRepositoryBoundary(createEnforcer());

    await expect(
      boundary.query(
        {
          operation: markTenantScopedOperation({
            name: "orders.rlsQuery",
            kind: "query",
          }),
          rls: {
            adapter: "drizzle",
            configKey: "app.current_tenant",
            tenantId: "tenant-a",
            enforced: false,
          },
        },
        () => "unreachable",
      ),
    ).rejects.toThrow(TenantUnsafeQueryProblem);
  });

  it("provides reusable cross-tenant leak fixtures for repository adapters", () => {
    const fixture = createCrossTenantLeakFixture({
      operation: "orders.adapter-fixture",
      recordsPerTenant: 2,
      createRecord: (tenantId, index) => ({
        id: `${tenantId}-${index}`,
        tenantId,
        value: index,
      }),
    });

    const tenantRows = fixture.expectedRowsForTenant("tenant-a");

    expect(tenantRows).toHaveLength(2);
    expect(() => fixture.assertNoCrossTenantRows("tenant-a", tenantRows)).not.toThrow();
    expect(() =>
      fixture.assertNoCrossTenantRows("tenant-a", [
        ...tenantRows,
        { id: "tenant-b-1", tenantId: "tenant-b", value: 1 },
      ]),
    ).toThrow(TenantCrossTenantLeakProblem);
  });
});
