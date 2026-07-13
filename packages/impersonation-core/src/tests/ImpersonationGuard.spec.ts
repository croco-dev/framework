import "reflect-metadata";
import type { AuthRequest, Principal, RouteExecutionContext } from "@croco/auth-core";
import { describe, expect, it } from "vitest";
import { ImpersonationGuard } from "../libs/ImpersonationGuard";

function contextWith(principal?: Principal): RouteExecutionContext {
  const request = { principal } as unknown as AuthRequest;
  return {
    getClass: () => ({}),
    getHandler: () => "handler",
    getRequest: () => request,
  };
}

describe("ImpersonationGuard", () => {
  const guard = new ImpersonationGuard();

  it("rejects anonymous requests", () => {
    expect(() => guard.canActivate(contextWith())).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("rejects principals without manage permission", () => {
    const principal: Principal = {
      type: "user",
      id: "admin-1",
      permissions: ["impersonation:read"],
    };

    expect(() => guard.canActivate(contextWith(principal))).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("uses shared permission semantics for equivalent manage permission", () => {
    const principal: Principal = {
      type: "user",
      id: "admin-1",
      permissions: ["impersonation:manage:tenant-1"],
    };

    expect(guard.canActivate(contextWith(principal))).toBe(true);
  });
});
