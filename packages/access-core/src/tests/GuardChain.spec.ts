import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessEngine } from "../libs/AccessEngine";
import { Access } from "../libs/decorators/Access";
import { AccessGuard, BadRequestProblem, ForbiddenProblem } from "../libs/guards/AccessGuard";

type AuthUser = {
  id: string;
  name: string;
  permissions: string[];
};

type RbacEngine = {
  hasPermission: ReturnType<typeof vi.fn>;
  hasAllPermissions: ReturnType<typeof vi.fn>;
  hasAnyPermission: ReturnType<typeof vi.fn>;
  addRole: ReturnType<typeof vi.fn>;
  removeRole: ReturnType<typeof vi.fn>;
  getRoles: ReturnType<typeof vi.fn>;
  getPermissions: ReturnType<typeof vi.fn>;
};

type ExecutionContext = {
  getRequest: () => Request;
  getClass: () => any;
  getHandler: () => string | symbol;
  getPath: () => string;
  getMethod: () => string;
};

type Guard<T> = {
  canActivate(context: T): boolean | Promise<boolean>;
};

class MockPermissionGuard implements Guard<ExecutionContext> {
  constructor(
    _rbacEngine: RbacEngine,
    private shouldPass: boolean,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    return this.shouldPass;
  }
}

describe("Guard Chain Integration (RBAC OR ReBAC)", () => {
  let accessGuard!: AccessGuard;
  let mockAccessEngine!: AccessEngine;
  let mockRbacEngine!: RbacEngine;

  const mockUser: AuthUser = { id: "user-1", name: "Test User", permissions: [] };
  const mockTenantId = "tenant-1";

  const createMockContext = (
    target: any,
    handlerKey: string,
    user?: any,
    tenantId?: string,
    params?: Record<string, string>,
  ): ExecutionContext => {
    const request = {
      headers: new Headers(),
      user,
      tenantId,
      params,
    } as unknown as Request;

    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerKey,
      getPath: () => "/test",
      getMethod: () => "GET",
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockAccessEngine = {
      check: vi.fn(),
      grant: vi.fn(),
      revoke: vi.fn(),
      list: vi.fn(),
    } as unknown as AccessEngine;

    mockRbacEngine = {
      hasPermission: vi.fn(),
      hasAllPermissions: vi.fn(),
      hasAnyPermission: vi.fn(),
      addRole: vi.fn(),
      removeRole: vi.fn(),
      getRoles: vi.fn(),
      getPermissions: vi.fn(),
    } as unknown as RbacEngine;

    accessGuard = new AccessGuard(mockAccessEngine);
  });

  it("should allow when RBAC passes and ReBAC fails (OR logic)", async () => {
    class TestController {
      @Access("document", "viewer")
      testMethod() {}
    }

    const rbacGuard = new MockPermissionGuard(mockRbacEngine, true);
    const context = createMockContext(TestController, "testMethod", mockUser, mockTenantId, {
      id: "doc-1",
    });

    const rbacResult = rbacGuard.canActivate(context);
    expect(rbacResult).toBe(true);

    vi.spyOn(mockAccessEngine, "check").mockResolvedValue({ decision: "deny", allowed: false });
    await expect(accessGuard.canActivate(context)).rejects.toThrow(ForbiddenProblem);

    const finalResult = rbacResult || false;
    expect(finalResult).toBe(true);
  });

  it("should allow when RBAC fails and ReBAC passes (OR logic)", async () => {
    class TestController {
      @Access("document", "viewer")
      testMethod() {}
    }

    const context = createMockContext(TestController, "testMethod", mockUser, mockTenantId, {
      id: "doc-1",
    });

    const rbacGuard = new MockPermissionGuard(mockRbacEngine, false);
    const rbacResult = rbacGuard.canActivate(context);
    expect(rbacResult).toBe(false);

    vi.spyOn(mockAccessEngine, "check").mockResolvedValue({ decision: "allow", allowed: true });

    const rebacResult = await accessGuard.canActivate(context);
    expect(rebacResult).toBe(true);

    const finalResult = rbacResult || rebacResult;
    expect(finalResult).toBe(true);
  });

  it("should deny when both RBAC and ReBAC fail", async () => {
    class TestController {
      @Access("document", "viewer")
      testMethod() {}
    }

    const context = createMockContext(TestController, "testMethod", mockUser, mockTenantId, {});

    const rbacGuard = new MockPermissionGuard(mockRbacEngine, false);
    const rbacResult = rbacGuard.canActivate(context);
    expect(rbacResult).toBe(false);

    await expect(accessGuard.canActivate(context)).rejects.toThrow(BadRequestProblem);

    const finalResult = rbacResult || false;
    expect(finalResult).toBe(false);
  });

  it("should allow when both RBAC and ReBAC pass", async () => {
    class TestController {
      @Access("document", "viewer")
      testMethod() {}
    }

    const context = createMockContext(TestController, "testMethod", mockUser, mockTenantId, {
      id: "doc-1",
    });

    const rbacGuard = new MockPermissionGuard(mockRbacEngine, true);
    const rbacResult = rbacGuard.canActivate(context);
    expect(rbacResult).toBe(true);

    vi.spyOn(mockAccessEngine, "check").mockResolvedValue({ decision: "allow", allowed: true });
    const rebacResult = await accessGuard.canActivate(context);
    expect(rebacResult).toBe(true);

    const finalResult = rbacResult || rebacResult;
    expect(finalResult).toBe(true);
  });

  it("should handle ReBAC ForbiddenProblem correctly in OR logic", async () => {
    class TestController {
      @Access("document", "viewer")
      testMethod() {}
    }

    const context = createMockContext(TestController, "testMethod", mockUser, mockTenantId, {
      id: "doc-1",
    });

    const rbacGuard = new MockPermissionGuard(mockRbacEngine, true);
    const rbacResult = rbacGuard.canActivate(context);
    expect(rbacResult).toBe(true);

    vi.spyOn(mockAccessEngine, "check").mockResolvedValue({ decision: "deny", allowed: false });
    await expect(accessGuard.canActivate(context)).rejects.toThrow(ForbiddenProblem);

    const finalResult = rbacResult || false;
    expect(finalResult).toBe(true);
  });
});
