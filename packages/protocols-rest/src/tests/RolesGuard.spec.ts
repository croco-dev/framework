import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REST_ROLES_KEY } from "../libs/constants";
import { RolesGuard } from "../libs/guards/RolesGuard";
import type { ExecutionContext } from "../libs/interfaces/ExecutionContext";

describe("RolesGuard", () => {
  let guard!: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard();
  });

  const createMockContext = (user: unknown, roles?: string[]): ExecutionContext => {
    const TestController = class {
      testMethod(): void {}
    };

    if (roles) {
      Reflect.defineMetadata(REST_ROLES_KEY, roles, TestController.prototype, "testMethod");
    }

    return {
      getRequest: vi.fn().mockReturnValue({ user }),
      getClass: () => TestController.prototype,
      getHandler: () => "testMethod",
      getPath: vi.fn(),
      getMethod: vi.fn(),
    } as unknown as ExecutionContext;
  };

  it("should allow access when user has required role", () => {
    const context = createMockContext({ roles: ["admin", "user"] }, ["admin"]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should deny access when user lacks required role", () => {
    const context = createMockContext({ roles: ["user"] }, ["admin"]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should allow access when no roles are required", () => {
    const context = createMockContext({ roles: ["user"] }, []);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should allow access when no metadata is defined", () => {
    const context = createMockContext({ roles: ["user"] });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should allow access when user has any of multiple required roles", () => {
    const context = createMockContext({ roles: ["editor", "user"] }, ["admin", "editor"]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should deny access when user has none of multiple required roles", () => {
    const context = createMockContext({ roles: ["user", "guest"] }, ["admin", "moderator"]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should handle missing user gracefully", () => {
    const context = createMockContext(undefined, ["admin"]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should handle missing user.roles gracefully", () => {
    const context = createMockContext({}, ["admin"]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should handle empty user.roles array", () => {
    const context = createMockContext({ roles: [] }, ["admin"]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it("should allow access when user has more roles than required", () => {
    const context = createMockContext({ roles: ["admin", "moderator", "user", "guest"] }, [
      "admin",
    ]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should allow access when all required roles match", () => {
    const context = createMockContext({ roles: ["user", "moderator"] }, ["admin", "moderator"]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
