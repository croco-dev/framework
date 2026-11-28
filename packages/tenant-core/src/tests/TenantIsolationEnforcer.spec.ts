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

  const createEnforcer = (defaultTenantIds?: readonly string[]) =>
    createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      defaultTenantIds,
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
        decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
        policyDecisionTrace: expect.objectContaining({
          policyKind: "tenant-isolation",
          result: "deny",
          ruleId: "tenant-isolation:repository-read:orders.findById",
        }),
      }),
    ]);
    expect(recordEventSpy).toHaveBeenCalledWith(
      "tenant-isolation.denied",
      expect.objectContaining({
        "tenant.operation": "orders.findById",
        "tenant.problem_code": "tenant-core/isolation-context-missing",
        "tenant.policy_decision_id": expect.stringMatching(/^pdt_[a-z0-9]+$/),
      }),
    );
  });

  it("redacts policy decision inputs and attaches the decision id to tenant denial Problems", async () => {
    activeTenantId = null;
    const traceEvents: NonNullable<TenantIsolationAuditEvent["policyDecisionTrace"]>[] = [];
    const operation = markTenantScopedOperation({
      name: "orders.findById",
      kind: "repository-read",
      sourceLocation: {
        file: "src/orders.ts",
        line: 15,
      },
      inputs: {
        authorization: "Bearer tenant-secret",
        diagnostic: "Authorization: Custom sample-credential",
      },
      metadata: {
        route: "orders.show",
      },
    });
    const enforcer = createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      auditSink: {
        recordTenantIsolation: (event) => {
          auditEvents.push(event);
        },
      },
      policyDecisionTraceSink: {
        recordPolicyDecisionTrace: (trace) => {
          traceEvents.push(trace);
        },
      },
    });

    await expect(enforcer.enforce(operation, () => "unreachable")).rejects.toMatchObject({
      extensions: {
        decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
      },
    });

    expect(auditEvents[0]).toMatchObject({
      type: "tenant-isolation.denied",
      decisionId: traceEvents[0]?.decisionId,
      policyDecisionTrace: {
        policyKind: "tenant-isolation",
        result: "deny",
        sourceLocation: {
          file: "src/orders.ts",
          line: 15,
        },
        inputs: {
          authorization: "[Redacted]",
          diagnostic: "Authorization: [Redacted]",
        },
      },
    });
    expect(traceEvents).toEqual([auditEvents[0]?.policyDecisionTrace]);
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

  it.each(["enforce", "read", "write", "query"] as const)(
    "%s records a denial when the active tenant is a fallback",
    async (entryPoint) => {
      activeTenantId = "default";
      const enforcer = createEnforcer();
      const repository = enforcer.createRepositoryBoundary();
      const operation = markTenantScopedOperation({
        name: "orders.scoped",
        kind: "repository-read",
      });
      const work = vi.fn();
      const run = {
        enforce: () => enforcer.enforce(operation, work),
        read: () => repository.read(operation, work),
        write: () => repository.write({ ...operation, kind: "repository-write" }, work),
        query: () => enforcer.enforceQuery({ operation: { ...operation, kind: "query" } }, work),
      }[entryPoint];
      const result = run();

      await expect(result).rejects.toBeInstanceOf(TenantDefaultFallbackProblem);
      expect(work).not.toHaveBeenCalled();
      expect(auditEvents).toEqual([
        expect.objectContaining({
          type: "tenant-isolation.denied",
          operation: operation.name,
          tenantId: "default",
          problemCode: "tenant-core/default-tenant-fallback",
          decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
          policyDecisionTrace: expect.objectContaining({ result: "deny" }),
        }),
      ]);
      await expect(result).rejects.toMatchObject({
        extensions: {
          tenantId: "default",
          decisionId: auditEvents[0]?.policyDecisionTrace?.decisionId,
        },
      });
    },
  );

  it("reports the configured fallback ID when it is the active tenant", async () => {
    activeTenantId = "unresolved";
    const operation = markTenantScopedOperation({ name: "orders.list", kind: "repository-read" });

    await expect(createEnforcer(["unresolved"]).requireOperation(operation)).rejects.toMatchObject({
      code: "tenant-core/default-tenant-fallback",
      extensions: { tenantId: "unresolved" },
    });
  });

  it.each([{ ids: [] }, { ids: ["unresolved"] }])(
    "permits an active tenant named default with fallback IDs $ids",
    async ({ ids }) => {
      activeTenantId = "default";
      const operation = markTenantScopedOperation({ name: "orders.list", kind: "repository-read" });

      await expect(createEnforcer(ids).requireOperation(operation)).resolves.toMatchObject({
        status: "tenant-scoped",
        tenantId: "default",
      });
    },
  );

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

  describe.each([
    { tenantId: "tenant-a", requestedTenantId: "tenant-b" },
    { tenantId: "tenant-b", requestedTenantId: "tenant-a" },
  ])("conflicting tenant claims $tenantId / $requestedTenantId", (claims) => {
    it.each(["enforce", "requireOperation", "enforceQuery"] as const)(
      "%s denies either mismatching claim and records the denial decision",
      async (entryPoint) => {
        const operation = markTenantScopedOperation({
          name: "orders.conflictingClaims",
          kind: "query",
          ...claims,
        });
        const enforcer = createEnforcer();
        const work = vi.fn(() => "unreachable");
        const result =
          entryPoint === "requireOperation"
            ? enforcer.requireOperation(operation)
            : entryPoint === "enforce"
              ? enforcer.enforce(operation, work)
              : enforcer.enforceQuery(
                  {
                    operation,
                    predicates: [{ field: "tenantId", operator: "=", value: "tenant-a" }],
                  },
                  work,
                );

        await expect(result).rejects.toBeInstanceOf(TenantUnsafeQueryProblem);
        await expect(result).rejects.toMatchObject({
          code: "tenant-core/unsafe-query",
          extensions: {
            operation: operation.name,
            activeTenantId: "tenant-a",
            requestedTenantId: "tenant-b",
            decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
          },
        });
        expect(work).not.toHaveBeenCalled();
        expect(auditEvents).toEqual([
          expect.objectContaining({
            type: "tenant-isolation.denied",
            operation: operation.name,
            tenantId: "tenant-a",
            problemCode: "tenant-core/unsafe-query",
            decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
            policyDecisionTrace: expect.objectContaining({
              policyKind: "tenant-isolation",
              result: "deny",
              ruleId: `tenant-isolation:query:${operation.name}`,
            }),
          }),
        ]);
        await expect(result).rejects.toMatchObject({
          extensions: { decisionId: auditEvents[0]?.policyDecisionTrace?.decisionId },
        });
        expect(auditEvents[0]?.decisionId).toBe(auditEvents[0]?.policyDecisionTrace?.decisionId);
      },
    );
  });

  it.each(["read", "write", "query"] as const)(
    "repository %s denies a requested tenant that conflicts with its default tenant",
    async (method) => {
      const boundary = createTenantRepositoryBoundary(createEnforcer(), {
        tenantId: "tenant-a",
      });
      const operation = markTenantScopedOperation({
        name: `orders.${method}`,
        kind: method === "query" ? "query" : `repository-${method}`,
        requestedTenantId: "tenant-b",
      });
      const work = vi.fn(() => "unreachable");
      const result =
        method === "query"
          ? boundary.query(
              {
                operation,
                predicates: [{ field: "tenantId", operator: "=", value: "tenant-a" }],
              },
              work,
            )
          : boundary[method](operation, work);

      await expect(result).rejects.toBeInstanceOf(TenantUnsafeQueryProblem);
      await expect(result).rejects.toMatchObject({
        code: "tenant-core/unsafe-query",
        extensions: {
          operation: operation.name,
          activeTenantId: "tenant-a",
          requestedTenantId: "tenant-b",
          decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
        },
      });
      expect(work).not.toHaveBeenCalled();
      expect(auditEvents).toEqual([
        expect.objectContaining({
          type: "tenant-isolation.denied",
          problemCode: "tenant-core/unsafe-query",
          policyDecisionTrace: expect.objectContaining({ result: "deny" }),
        }),
      ]);
    },
  );

  it.each([
    { label: "both claims match", tenantId: "tenant-a", requestedTenantId: "tenant-a" },
    { label: "only tenantId matches", tenantId: "tenant-a" },
    { label: "only requestedTenantId matches", requestedTenantId: "tenant-a" },
    { label: "neither claim is supplied" },
  ])("allows scoped work when $label", async ({ label: _label, ...claims }) => {
    const operation = markTenantScopedOperation({
      name: "orders.allowedClaims",
      kind: "repository-read",
      ...claims,
    });
    const work = vi.fn(() => "allowed");

    await expect(createEnforcer().enforce(operation, work)).resolves.toBe("allowed");
    expect(work).toHaveBeenCalledOnce();
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "tenant-isolation.allowed",
        policyDecisionTrace: expect.objectContaining({ result: "allow" }),
      }),
    ]);
  });

  it.each(["admin-bypass", "system"] as const)("requires a reason for %s", async (isolation) => {
    activeTenantId = "default";
    const operation = markTenantScopedOperation({
      name: "admin.tenants.reindex",
      kind: "command",
      isolation,
    });

    await expect(createEnforcer().enforce(operation, () => "unreachable")).rejects.toThrow(
      TenantAdminBypassReasonRequiredProblem,
    );
  });

  it.each(["admin-bypass", "system"] as const)("records allowed %s bypasses", async (isolation) => {
    activeTenantId = "default";
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    const operation = markTenantScopedOperation({
      name: "admin.tenants.reindex",
      kind: "command",
      isolation,
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
        policyDecisionTrace: expect.objectContaining({
          policyKind: "tenant-isolation",
          result: "allow",
          subjectRef: "actor:admin-1",
        }),
      }),
    ]);
  });

  it("preserves allowed work and reports best-effort sink failures without error details", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    const enforcer = createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      auditSink: {
        recordTenantIsolation: async () => {
          throw new Error("audit secret must not be reported");
        },
      },
      policyDecisionTraceSink: {
        recordPolicyDecisionTrace: async () => {
          throw new Error("trace secret must not be reported");
        },
      },
    });
    const operation = markTenantScopedOperation({
      name: "orders.list",
      kind: "repository-read",
    });

    await expect(enforcer.enforce(operation, () => "allowed")).resolves.toBe("allowed");

    const failureEvents = recordEventSpy.mock.calls.filter(
      ([eventName]) => eventName === "tenant-isolation.observability-delivery-failed",
    );
    expect(failureEvents).toEqual([
      [
        "tenant-isolation.observability-delivery-failed",
        expect.objectContaining({
          "tenant.operation": "orders.list",
          "tenant.operation.kind": "repository-read",
          "tenant.policy_result": "allow",
          "tenant.observability_sink": "policy-decision-trace",
          "tenant.policy_decision_id": expect.stringMatching(/^pdt_[a-z0-9]+$/),
        }),
      ],
      [
        "tenant-isolation.observability-delivery-failed",
        expect.objectContaining({
          "tenant.operation": "orders.list",
          "tenant.operation.kind": "repository-read",
          "tenant.policy_result": "allow",
          "tenant.observability_sink": "tenant-isolation-audit",
          "tenant.policy_decision_id": expect.stringMatching(/^pdt_[a-z0-9]+$/),
        }),
      ],
    ]);
    expect(JSON.stringify(failureEvents)).not.toContain("secret");
  });

  it("preserves the original denial Problem even when fail-closed sinks fail", async () => {
    activeTenantId = null;
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    const enforcer = createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      observabilityFailureMode: "fail-closed",
      auditSink: {
        recordTenantIsolation: async () => {
          throw new Error("audit unavailable");
        },
      },
      policyDecisionTraceSink: {
        recordPolicyDecisionTrace: async () => {
          throw new Error("trace unavailable");
        },
      },
    });
    const operation = markTenantScopedOperation({
      name: "orders.findById",
      kind: "repository-read",
    });

    const rejection = await enforcer
      .enforce(operation, () => "unreachable")
      .catch((error) => error);

    expect(rejection).toBeInstanceOf(TenantIsolationContextMissingProblem);
    expect(rejection).toMatchObject({
      code: "tenant-core/isolation-context-missing",
      extensions: {
        decisionId: expect.stringMatching(/^pdt_[a-z0-9]+$/),
      },
    });
    expect(
      recordEventSpy.mock.calls.filter(
        ([eventName]) => eventName === "tenant-isolation.observability-delivery-failed",
      ),
    ).toHaveLength(2);
  });

  it("preserves allowed query work when best-effort sinks fail", async () => {
    const enforcer = createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      auditSink: {
        recordTenantIsolation: async () => {
          throw new Error("audit unavailable");
        },
      },
      policyDecisionTraceSink: {
        recordPolicyDecisionTrace: async () => {
          throw new Error("trace unavailable");
        },
      },
    });
    const boundary = createTenantRepositoryBoundary(enforcer);

    await expect(
      boundary.query(
        {
          operation: markTenantScopedOperation({
            name: "orders.query",
            kind: "query",
          }),
          predicates: [{ field: "tenantId", operator: "=", value: "tenant-a" }],
        },
        () => "allowed",
      ),
    ).resolves.toBe("allowed");
  });

  it("retains explicit fail-closed observability for allowed work", async () => {
    const enforcer = createTenantIsolationEnforcer({
      contextProvider: {
        getTenantId: () => activeTenantId,
      },
      observabilityFailureMode: "fail-closed",
      policyDecisionTraceSink: {
        recordPolicyDecisionTrace: async () => {
          throw new Error("trace unavailable");
        },
      },
    });
    const operation = markTenantScopedOperation({
      name: "orders.list",
      kind: "repository-read",
    });
    const work = vi.fn(() => "unreachable");

    await expect(enforcer.enforce(operation, work)).rejects.toThrow("trace unavailable");
    expect(work).not.toHaveBeenCalled();
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
