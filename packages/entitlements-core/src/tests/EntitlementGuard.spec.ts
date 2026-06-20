import { Container } from "@croco/framework-context";
import * as telemetry from "@croco/telemetry-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENTITLEMENT_REQUIRED_KEY,
  RequireEntitlement,
} from "../libs/decorators/RequireEntitlement";
import { EntitlementGuard, type RouteExecutionContext } from "../libs/EntitlementGuard";
import type { EntitlementManager } from "../libs/EntitlementManager";
import { EntitlementAuditSink, type EntitlementGuardAuditEvent } from "../libs/interfaces";
import {
  EntitlementDeniedProblem,
  EntitlementMissingPlanProblem,
  EntitlementProviderUnavailableProblem,
  EntitlementQuotaExceededProblem,
} from "../libs/problems/EntitlementProblems";
import type { EntitlementCheckResult } from "../libs/types";

class MockEntitlementManager {
  checkResult: EntitlementCheckResult = {
    granted: true,
    status: "allowed",
    featureKey: "test_feature",
    type: "boolean",
    planId: "pro",
  };
  error: Error | null = null;

  async check(_tenantId: string, _featureKey: string): Promise<EntitlementCheckResult> {
    if (this.error) {
      throw this.error;
    }

    return this.checkResult;
  }
}

class MockEntitlementAuditSink extends EntitlementAuditSink {
  readonly events: EntitlementGuardAuditEvent[] = [];

  recordEntitlementGuard(event: EntitlementGuardAuditEvent): void {
    this.events.push(event);
  }
}

class FailingEntitlementAuditSink extends EntitlementAuditSink {
  recordEntitlementGuard(_event: EntitlementGuardAuditEvent): void {
    throw new Error("audit sink unavailable");
  }
}

type RequestWithTenant = RouteExecutionContext["getRequest"] extends () => infer T ? T : never;
type RequestWithOptionalTenantUser = Omit<RequestWithTenant, "user"> & {
  params?: Record<string, string>;
  user?: RequestWithTenant["user"] & { tenantId?: string };
};

function createUser(tenantId: string): RequestWithOptionalTenantUser["user"] {
  return {
    id: "user-1",
    roles: [],
    permissions: [],
    tenantId,
  };
}

function createContext(options: {
  target?: unknown;
  handler?: string | symbol;
  request?: Partial<RequestWithOptionalTenantUser>;
}): RouteExecutionContext {
  return {
    getClass: () => options.target ?? {},
    getHandler: () => options.handler ?? "testMethod",
    getRequest: () => options.request as RequestWithTenant,
  };
}

describe("EntitlementGuard", () => {
  let guard!: EntitlementGuard;
  let mockManager!: MockEntitlementManager;
  let auditSink!: MockEntitlementAuditSink;

  beforeEach(() => {
    Container.reset();
    vi.restoreAllMocks();
    mockManager = new MockEntitlementManager();
    auditSink = new MockEntitlementAuditSink();
    Container.set(EntitlementAuditSink.token, auditSink);
    guard = new EntitlementGuard(mockManager as unknown as EntitlementManager);
  });

  it("should pass when no metadata is present", async () => {
    const context = createContext({
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should pass when entitlement is granted", async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIRED_KEY,
      "test_feature",
      TestController.prototype,
      "testMethod",
    );

    mockManager.checkResult = {
      granted: true,
      status: "allowed",
      featureKey: "test_feature",
      type: "boolean",
      planId: "pro",
    };

    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should read entitlement metadata from static method decorators", async () => {
    class TestController {
      @RequireEntitlement({ feature: "reports.export" })
      static testMethod() {}

      instanceMethod() {}
    }

    const checkSpy = vi.spyOn(mockManager, "check");
    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(checkSpy).toHaveBeenCalledWith("tenant-123", "reports.export");
  });

  it("should throw EntitlementDeniedProblem when entitlement is denied", async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIRED_KEY,
      "test_feature",
      TestController.prototype,
      "testMethod",
    );

    mockManager.checkResult = {
      granted: false,
      status: "denied",
      featureKey: "test_feature",
      type: "boolean",
      reason: "limit_exceeded",
    };

    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementDeniedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow("Entitlement");
  });

  it("should throw EntitlementDeniedProblem when tenantId is missing", async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIRED_KEY,
      "test_feature",
      TestController.prototype,
      "testMethod",
    );

    const context = createContext({
      target: TestController,
      request: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementDeniedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow("tenantId not found");
  });

  it("should use request.tenantId when available", async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIRED_KEY,
      "test_feature",
      TestController.prototype,
      "testMethod",
    );

    mockManager.checkResult = {
      granted: true,
      status: "allowed",
      featureKey: "test_feature",
      type: "boolean",
      planId: "pro",
    };

    const checkSpy = vi.spyOn(mockManager, "check");
    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-from-request",
      },
    });

    await guard.canActivate(context);

    expect(checkSpy).toHaveBeenCalledWith("tenant-from-request", "test_feature");
  });

  it("should fallback to user.tenantId when request.tenantId is missing", async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIRED_KEY,
      "test_feature",
      TestController.prototype,
      "testMethod",
    );

    mockManager.checkResult = {
      granted: true,
      status: "allowed",
      featureKey: "test_feature",
      type: "boolean",
      planId: "pro",
    };

    const checkSpy = vi.spyOn(mockManager, "check");
    const context = createContext({
      target: TestController,
      request: {
        user: createUser("tenant-from-user"),
      },
    });

    await guard.canActivate(context);

    expect(checkSpy).toHaveBeenCalledWith("tenant-from-user", "test_feature");
  });

  it("should expose route requirement, tenant, user, resource, telemetry, and audit evidence", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});

    class TestController {
      @RequireEntitlement({
        feature: "reports.export",
        resource: { type: "report", idParam: "reportId" },
      })
      testMethod() {}
    }

    const checkSpy = vi.spyOn(mockManager, "check");
    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
        params: { reportId: "report-1" },
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(checkSpy).toHaveBeenCalledWith("tenant-123", "reports.export");
    expect(recordEventSpy).toHaveBeenCalledWith(
      "entitlement.guard.allowed",
      expect.objectContaining({
        "entitlement.feature": "reports.export",
        "entitlement.status": "allowed",
        "tenant.id": "tenant-123",
        "user.id": "user-1",
        "resource.type": "report",
        "resource.id": "report-1",
        "route.id": "TestController.testMethod",
      }),
    );
    expect(auditSink.events).toEqual([
      expect.objectContaining({
        type: "entitlement.guard.allowed",
        tenantId: "tenant-123",
        feature: "reports.export",
        status: "allowed",
        userId: "user-1",
        resource: { type: "report", id: "report-1" },
        route: {
          controllerName: "TestController",
          handlerName: "testMethod",
          routeId: "TestController.testMethod",
        },
      }),
    ]);
  });

  it("should map missing plan and quota denial results to standard Problems", async () => {
    class TestController {
      @RequireEntitlement({ feature: "reports.export" })
      testMethod() {}
    }

    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    mockManager.checkResult = {
      granted: false,
      status: "denied",
      featureKey: "reports.export",
      type: "boolean",
      reason: "no_subscription",
    };

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementMissingPlanProblem);

    mockManager.checkResult = {
      granted: false,
      status: "denied",
      featureKey: "reports.export",
      type: "metered",
      reason: "quota_exceeded",
      usage: 11,
      quota: 10,
      exceeded: true,
      remaining: -1,
      overagePolicy: "BLOCK",
    };

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementQuotaExceededProblem);
  });

  it("should record denied evidence when the entitlement provider is unavailable", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});

    class TestController {
      @RequireEntitlement({ feature: "reports.export" })
      testMethod() {}
    }

    mockManager.error = new Error("billing connection failed");

    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementProviderUnavailableProblem);
    expect(recordEventSpy).toHaveBeenCalledWith(
      "entitlement.guard.denied",
      expect.objectContaining({
        "entitlement.feature": "reports.export",
        "entitlement.status": "unknown",
        "entitlement.reason": "provider_unavailable",
        "problem.code": "ENTITLEMENT_PROVIDER_UNAVAILABLE",
      }),
    );
    expect(auditSink.events).toEqual([
      expect.objectContaining({
        type: "entitlement.guard.denied",
        feature: "reports.export",
        status: "unknown",
        problemCode: "ENTITLEMENT_PROVIDER_UNAVAILABLE",
      }),
    ]);
  });

  it("should not let audit sink failures override allowed guard decisions", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    Container.set(EntitlementAuditSink.token, new FailingEntitlementAuditSink());

    class TestController {
      @RequireEntitlement({ feature: "reports.export" })
      testMethod() {}
    }

    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(recordEventSpy).toHaveBeenCalledWith(
      "entitlement.guard.audit_failed",
      expect.objectContaining({
        "entitlement.feature": "reports.export",
        "entitlement.status": "allowed",
        "tenant.id": "tenant-123",
        "route.id": "TestController.testMethod",
        "audit.event": "entitlement.guard.allowed",
      }),
    );
  });

  it("should not let audit sink failures override denied guard decisions", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    Container.set(EntitlementAuditSink.token, new FailingEntitlementAuditSink());

    class TestController {
      @RequireEntitlement({ feature: "reports.export" })
      testMethod() {}
    }

    mockManager.checkResult = {
      granted: false,
      status: "denied",
      featureKey: "reports.export",
      type: "boolean",
      reason: "not_entitled",
    };

    const context = createContext({
      target: TestController,
      request: {
        tenantId: "tenant-123",
        user: createUser("tenant-123"),
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementDeniedProblem);
    expect(recordEventSpy).toHaveBeenCalledWith(
      "entitlement.guard.audit_failed",
      expect.objectContaining({
        "entitlement.feature": "reports.export",
        "entitlement.status": "denied",
        "tenant.id": "tenant-123",
        "route.id": "TestController.testMethod",
        "audit.event": "entitlement.guard.denied",
      }),
    );
  });
});
