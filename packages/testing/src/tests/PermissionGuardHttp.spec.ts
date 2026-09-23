import "reflect-metadata";
import {
  AbstractRoleRegistry,
  PermissionGuard,
  RbacEngine,
  RequirePermission,
} from "@croco/auth-core";
import type { AuthRequest } from "@croco/auth-core";
import type { ILogger } from "@croco/framework-context";
import { ErrorHandler, HttpExecutionContext, PipelineRunner } from "@croco/transports-http";
import type { CrocoHttpContext } from "@croco/transports-http";
import { describe, expect, it, vi } from "vitest";

class EmptyRoleRegistry extends AbstractRoleRegistry {
  getRolePermissions(): string[] {
    return [];
  }
}

class PermissionController {
  @RequirePermission("resource:read")
  protectedMethod() {}
}

function createContext(request: AuthRequest): HttpExecutionContext {
  const httpContext = {
    req: {
      method: "GET",
      url: request.url,
      path: "/protected",
      params: {},
    },
    res: { status: 200, headers: {} },
    raw: { req: { raw: request } },
    get: vi.fn(),
    jsonResponse: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
  } as unknown as CrocoHttpContext;

  return new HttpExecutionContext(httpContext, PermissionController, "protectedMethod");
}

function createRunner(): PipelineRunner {
  const logger = { error: vi.fn() } as unknown as ILogger;
  return new PipelineRunner(new ErrorHandler(logger));
}

describe("PermissionGuard HTTP response", () => {
  const permissionGuard = new PermissionGuard(new RbacEngine(new EmptyRoleRegistry()));

  it("returns a 401 Problem with an authentication hint when credentials are missing", async () => {
    const context = createContext(new Request("http://localhost/protected"));
    const handler = vi.fn();

    const response = (await createRunner().run(context, handler, {
      guards: [permissionGuard],
      interceptors: [],
      filters: [],
    })) as Response;

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      detail: "Authentication required",
    });
  });

  it("keeps authenticated permission denial at 403", async () => {
    const request = new Request("http://localhost/protected") as AuthRequest;
    request.user = { id: "user-1", roles: [], permissions: [] };
    const context = createContext(request);

    const response = (await createRunner().run(context, vi.fn(), {
      guards: [permissionGuard],
      interceptors: [],
      filters: [],
    })) as Response;

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("keeps false results from other guards at 403", async () => {
    const context = createContext(new Request("http://localhost/protected"));

    const response = (await createRunner().run(context, vi.fn(), {
      guards: [{ canActivate: () => false }],
      interceptors: [],
      filters: [],
    })) as Response;

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ACCESS_DENIED", status: 403 });
  });
});
