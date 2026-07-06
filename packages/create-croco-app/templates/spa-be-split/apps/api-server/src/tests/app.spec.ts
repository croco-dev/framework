import type { Guard } from "@croco/framework-context";
import { Controller, Get, UseGuards, type ExecutionContext } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import { createCrocoApp } from "../app";
import { getUserAuditEntries, resetUserRuntimeForTests } from "../users";

const protectedRouteToken = "generated-smoke-token";

class ProtectedRouteGuard implements Guard<ExecutionContext> {
  canActivate(context: ExecutionContext): boolean {
    return context.getRequest().headers.get("authorization") === `Bearer ${protectedRouteToken}`;
  }
}

@Controller("/protected-smoke")
class ProtectedSmokeController {
  @Get()
  @UseGuards(ProtectedRouteGuard)
  read() {
    return { ok: true };
  }
}

describe("API server", () => {
  beforeEach(() => {
    resetUserRuntimeForTests();
  });

  it("serves users through the operational app", async () => {
    const app = createCrocoApp();

    const response = await app.fetch(new Request("http://localhost/users"));
    const users = (await response.json()) as Array<{ id: string; name: string }>;

    expect(response.status).toBe(200);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user-1",
          name: "Ada Lovelace",
        }),
      ]),
    );
    expect(users).toHaveLength(2);
  });

  it("creates users through the operational app and publishes the domain event", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Katherine Johnson", email: "katherine@example.com" }),
      }),
    );
    const user = await response.json();

    expect(response.status).toBe(200);
    expect(user).toEqual(
      expect.objectContaining({
        name: "Katherine Johnson",
        email: "katherine@example.com",
      }),
    );
    expect(getUserAuditEntries()).toContain(user.id);
  });

  it("returns RFC 7807 Problem details for missing users", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(new Request("http://localhost/users/missing"));
    const problem = await response.json();

    expect(response.status).toBe(404);
    expect(problem).toEqual(
      expect.objectContaining({
        status: 404,
        code: "starter/user-not-found",
      }),
    );
  });

  it("requires credentials for a protected route", async () => {
    const app = createCrocoApp({ extraControllers: [ProtectedSmokeController] });

    const denied = await app.fetch(new Request("http://localhost/protected-smoke"));
    const deniedProblem = await denied.json();
    const allowed = await app.fetch(
      new Request("http://localhost/protected-smoke", {
        headers: { authorization: `Bearer ${protectedRouteToken}` },
      }),
    );
    const allowedBody = await allowed.json();

    expect(denied.status).toBe(403);
    expect(deniedProblem).toEqual(
      expect.objectContaining({
        status: 403,
        code: "ACCESS_DENIED",
      }),
    );
    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual({ ok: true });
  });
});
