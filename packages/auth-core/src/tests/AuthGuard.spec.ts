import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import {
  authGuardConformance,
  createConformanceAuthCoreUser,
} from "../../../../test-support/authGuardConformance";
import { AUTH_PUBLIC_KEY } from "../libs/constants";
import { AUTH_PROVIDER_TOKEN, AuthGuard } from "../libs/guards/AuthGuard";
import type { AuthProvider } from "../libs/interfaces/AuthProvider";
import type { AuthRequest } from "../libs/interfaces/AuthRequest";
import type { AuthUser } from "../libs/interfaces/AuthUser";
import type { RouteExecutionContext } from "../libs/interfaces/Guard";
import { AuthProviderUnavailableProblem, UnauthorizedProblem } from "../libs/problems/AuthProblems";

describe("AuthGuard", () => {
  let authGuard!: AuthGuard;
  let mockAuthProvider!: AuthProvider;

  const mockUser = createConformanceAuthCoreUser() as AuthUser;

  // Mock context factory
  const createMockContext = (target: unknown, handlerName: string) => {
    const request = { headers: new Headers() } as unknown as AuthRequest;
    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => "/test",
      getMethod: () => "GET",
    } as RouteExecutionContext;
  };

  beforeEach(() => {
    Container.reset();
    mockAuthProvider = {
      authenticate: vi.fn(),
    };
    Container.set(AUTH_PROVIDER_TOKEN, mockAuthProvider);
    authGuard = new AuthGuard();
  });

  it("should return true when route is public", async () => {
    class TestController {
      publicMethod() {}
    }
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, TestController.prototype, "publicMethod");

    const context = createMockContext(TestController.prototype, "publicMethod");
    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should return true when controller is public", async () => {
    @Reflect.metadata(AUTH_PUBLIC_KEY, true)
    class PublicController {
      method() {}
    }
    // Note: In TypeScript decorators, metadata is defined on the constructor for class decorators
    // But AuthGuard checks: Reflect.getMetadata(AUTH_PUBLIC_KEY, target.constructor)
    // context.getClass() usually returns the prototype or instance depending on implementation
    // Let's assume context.getClass() returns prototype, so target.constructor is the class

    // Manually mocking what decorator does if needed, but Reflect.metadata should work
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, PublicController);

    const context = createMockContext(PublicController.prototype, "method");
    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should authenticate and attach conformance user metadata to request", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod");

    // Mock successful authentication
    vi.spyOn(mockAuthProvider, "authenticate").mockResolvedValue(mockUser);

    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(context.getRequest().user).toBe(mockUser);
    expect(context.getRequest().user).toMatchObject({
      id: authGuardConformance.subject.id,
      email: authGuardConformance.subject.email,
      roles: [...authGuardConformance.subject.roles],
      permissions: [...authGuardConformance.subject.permissions],
      tenantId: authGuardConformance.subject.tenantId,
      metadata: {
        tenantId: authGuardConformance.subject.tenantId,
        scopes: [...authGuardConformance.subject.scopes],
      },
    });
  });

  it("should throw UnauthorizedProblem when authentication fails", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod");

    // Mock failed authentication
    vi.spyOn(mockAuthProvider, "authenticate").mockResolvedValue(null);

    const activation = authGuard.canActivate(context);

    await expect(activation).rejects.toThrow(UnauthorizedProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.invalidCredentials,
    );
  });

  it("should throw UnauthorizedProblem when auth provider is not registered", async () => {
    class TestController {
      protectedMethod() {}
    }
    Container.reset();
    authGuard = new AuthGuard();
    const context = createMockContext(TestController.prototype, "protectedMethod");

    const activation = authGuard.canActivate(context);

    await expect(activation).rejects.toThrow(UnauthorizedProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.missingCredentials,
    );
  });

  it("should surface provider outages as an auth-core Problem", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod");
    const cause = new Error("ECONNRESET");
    vi.spyOn(mockAuthProvider, "authenticate").mockRejectedValue(cause);

    const activation = authGuard.canActivate(context);

    await expect(activation).rejects.toThrow(AuthProviderUnavailableProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.providerUnavailable,
    );
    await expect(activation).rejects.toHaveProperty("cause", cause);
  });

  it("should preserve provider-thrown Croco Problems", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod");
    const problem = ProblemFactory.forbidden(
      authGuardConformance.preservedProblem.policyDenied.code,
      "Policy denied",
    );
    vi.spyOn(mockAuthProvider, "authenticate").mockRejectedValue(problem);

    const activation = authGuard.canActivate(context);

    await expect(activation).rejects.toBe(problem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.preservedProblem.policyDenied,
    );
  });
});
