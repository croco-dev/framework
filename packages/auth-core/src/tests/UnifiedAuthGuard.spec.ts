import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import { Trace } from "@croco/telemetry-api";
import {
  authGuardConformance,
  createConformanceApiKeyPrincipal,
  createConformanceAuthCoreUser,
  createRouteMetadataAdapterFixtures,
} from "../../../../test-support/authGuardConformance";
import { AUTH_PUBLIC_KEY } from "../libs/constants";
import { Public } from "../libs/decorators/Public";
import { RequireApiKey } from "../libs/decorators/RequireApiKey";
import { UnifiedAuthGuard } from "../libs/guards/UnifiedAuthGuard";
import type { ApiKeyProvider } from "../libs/interfaces/ApiKeyProvider";
import type { AuthProvider } from "../libs/interfaces/AuthProvider";
import type { AuthRequest } from "../libs/interfaces/AuthRequest";
import type { AuthUser } from "../libs/interfaces/AuthUser";
import type { RouteExecutionContext } from "../libs/interfaces/Guard";
import type { ApiKeyPrincipal } from "../libs/interfaces/Principal";
import {
  AuthProviderUnavailableProblem,
  InvalidRouteMetadataTargetProblem,
  UnauthorizedProblem,
} from "../libs/problems/AuthProblems";

describe("UnifiedAuthGuard", () => {
  let guard!: UnifiedAuthGuard;
  let mockAuthProvider!: AuthProvider & { authenticate: ReturnType<typeof vi.fn> };
  let mockApiKeyProvider!: ApiKeyProvider & { authenticate: ReturnType<typeof vi.fn> };

  const mockUser = createConformanceAuthCoreUser() as AuthUser;

  const mockApiKeyPrincipal = createConformanceApiKeyPrincipal() as ApiKeyPrincipal;

  const createMockContext = (
    target: unknown,
    handlerName: string,
    headers: Record<string, string> = {},
  ): RouteExecutionContext => {
    const request = { headers } as unknown as AuthRequest;
    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => "/test",
      getMethod: () => "GET",
    } as RouteExecutionContext;
  };

  const createRequestContext = (
    target: unknown,
    handlerName: string,
    headersInit: HeadersInit = {},
  ): RouteExecutionContext => {
    const request: AuthRequest = new Request("https://example.com/test", {
      headers: new Headers(headersInit),
    });

    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => "/test",
      getMethod: () => "GET",
    } as RouteExecutionContext;
  };

  beforeEach(() => {
    mockAuthProvider = {
      authenticate: vi.fn<(request: unknown) => Promise<AuthUser | null>>(),
    };
    mockApiKeyProvider = {
      authenticate: vi.fn<(request: unknown) => Promise<ApiKeyPrincipal | null>>(),
    };
    guard = new UnifiedAuthGuard(mockAuthProvider, mockApiKeyProvider);
  });

  describe.each(authGuardConformance.invalidRouteMetadataTargets)(
    "with a $name route metadata target",
    ({ value }) => {
      it.each(createRouteMetadataAdapterFixtures(value, { headers: {} }))(
        "should reject the malformed $adapter adapter context",
        async ({ context }) => {
          await expect(guard.canActivate(context as RouteExecutionContext)).rejects.toThrow(
            InvalidRouteMetadataTargetProblem,
          );
          await expect(guard.canActivate(context as RouteExecutionContext)).rejects.toMatchObject({
            code: "auth-core/invalid-route-metadata-target",
            status: 500,
          });
          expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
          expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
        },
      );
    },
  );

  it("should return true when route is public", async () => {
    class TestController {
      publicMethod() {}
    }
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, TestController.prototype, "publicMethod");

    const context = createMockContext(TestController.prototype, "publicMethod", {
      "x-api-key": "pk_test_key",
    });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should authenticate with API key when X-API-Key header is present", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {
      "x-api-key": "pk_test_valid_key",
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toBe(mockApiKeyPrincipal);
    expect(request.apiKey).toBe(mockApiKeyPrincipal);
    expect(request.principal).toMatchObject({
      permissions: [...authGuardConformance.subject.permissions],
      tenantId: authGuardConformance.subject.tenantId,
      metadata: {
        scopes: [...authGuardConformance.subject.scopes],
      },
    });
    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should authenticate with API key when X-API-Key header is uppercase", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {
      "X-API-Key": "pk_test_valid_key",
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toBe(mockApiKeyPrincipal);
    expect(request.apiKey).toBe(mockApiKeyPrincipal);
  });

  it("should authenticate with API key when request uses Headers object", async () => {
    class TestController {
      protectedMethod() {}
    }

    const context = createRequestContext(TestController.prototype, "protectedMethod", {
      "x-api-key": "pk_test_valid_key",
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toBe(mockApiKeyPrincipal);
    expect(request.apiKey).toBe(mockApiKeyPrincipal);
    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should reject user authentication for an API-key-only route", async () => {
    class TestController {
      @RequireApiKey()
      protectedMethod() {}
    }
    const context = createMockContext(TestController, "protectedMethod");
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toThrow(UnauthorizedProblem);
    await expect(activation).rejects.toThrow("Missing API key");
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should not let public metadata bypass an API-key-only route", async () => {
    class TestController {
      @Public()
      @RequireApiKey()
      protectedMethod() {}
    }
    const context = createMockContext(TestController, "protectedMethod");
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    await expect(guard.canActivate(context)).rejects.toThrow("Missing API key");
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should preserve API-key-only enforcement when a later decorator wraps the route", async () => {
    class TestController {
      @Trace()
      @RequireApiKey()
      async protectedMethod(): Promise<void> {}
    }
    const context = createMockContext(TestController, "protectedMethod");
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    await expect(guard.canActivate(context)).rejects.toThrow("Missing API key");
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should accept valid API key authentication for an API-key-only route", async () => {
    class TestController {
      @RequireApiKey()
      protectedMethod() {}
    }
    const context = createMockContext(TestController, "protectedMethod", {
      "x-api-key": "pk_test_valid_key",
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.getRequest().principal).toBe(mockApiKeyPrincipal);
    expect(context.getRequest().apiKey).toBe(mockApiKeyPrincipal);
    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should reject user authentication for an API-key-only controller", async () => {
    @RequireApiKey()
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod");
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    await expect(guard.canActivate(context)).rejects.toThrow("Missing API key");
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedProblem when API key is invalid", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {
      "x-api-key": "pk_test_invalid_key",
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(null);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toThrow(UnauthorizedProblem);
    await expect(activation).rejects.toThrow("Invalid API key");
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should authenticate with user when no API key header is present", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toEqual({ ...mockUser, type: "user" });
    expect(request.user).toBe(mockUser);
    expect(request.principal).toMatchObject({
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
    expect(mockAuthProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedProblem when both API key and user authentication fail", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    mockAuthProvider.authenticate.mockResolvedValue(null);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toThrow(UnauthorizedProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.invalidCredentials,
    );
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedProblem when no credentials are provided", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    mockAuthProvider.authenticate.mockResolvedValue(null);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toThrow(UnauthorizedProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.missingCredentials,
    );
  });

  it("should surface API key provider outages as an auth-core Problem", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {
      "x-api-key": "pk_test_service_error",
    });
    const cause = new Error("ECONNRESET");
    mockApiKeyProvider.authenticate.mockRejectedValue(cause);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toThrow(AuthProviderUnavailableProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.providerUnavailable,
    );
    await expect(activation).rejects.toHaveProperty("cause", cause);
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should preserve API key provider-thrown Croco Problems", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {
      "x-api-key": "pk_test_policy_denied",
    });
    const problem = ProblemFactory.forbidden(
      authGuardConformance.preservedProblem.policyDenied.code,
      "Policy denied",
    );
    mockApiKeyProvider.authenticate.mockRejectedValue(problem);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toBe(problem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.preservedProblem.policyDenied,
    );
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should surface user auth provider outages as an auth-core Problem", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    const cause = new Error("ECONNRESET");
    mockAuthProvider.authenticate.mockRejectedValue(cause);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toThrow(AuthProviderUnavailableProblem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.authCore.providerUnavailable,
    );
    await expect(activation).rejects.toHaveProperty("cause", cause);
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should preserve user auth provider-thrown Croco Problems", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    const problem = ProblemFactory.forbidden(
      authGuardConformance.preservedProblem.policyDenied.code,
      "Policy denied",
    );
    mockAuthProvider.authenticate.mockRejectedValue(problem);

    const activation = guard.canActivate(context);

    await expect(activation).rejects.toBe(problem);
    await expect(activation).rejects.toMatchObject(
      authGuardConformance.preservedProblem.policyDenied,
    );
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it("should prefer lowercase x-api-key header when both exist", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {
      "x-api-key": "lowercase_key",
      "X-API-Key": "uppercase_key",
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    await guard.canActivate(context);

    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledTimes(1);
  });

  it("should not set principal/user when authentication returns null", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    mockAuthProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow();

    const request = context.getRequest();
    expect(request.principal).toBeUndefined();
    expect(request.user).toBeUndefined();
  });

  it("should pass the original request to providers", async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, "protectedMethod", {});
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    await guard.canActivate(context);

    expect(mockAuthProvider.authenticate).toHaveBeenCalledTimes(1);
    const requestArg = mockAuthProvider.authenticate.mock.calls[0][0];
    expect(requestArg).toBe(context.getRequest());
  });
});
