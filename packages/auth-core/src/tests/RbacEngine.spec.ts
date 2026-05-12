import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../libs/interfaces/AuthUser";
import { RbacEngine } from "../libs/rbac/RbacEngine";
import { RoleRegistry } from "../libs/rbac/Role";

describe("RbacEngine", () => {
  let rbacEngine!: RbacEngine;
  let roleRegistry!: RoleRegistry;

  beforeEach(() => {
    roleRegistry = new RoleRegistry();
    rbacEngine = new RbacEngine(roleRegistry);

    roleRegistry.register({
      name: "admin",
      permissions: ["system:manage"],
    });
    roleRegistry.register({
      name: "editor",
      permissions: ["posts:write"],
    });
  });

  const mockUser: AuthUser = {
    id: "user-1",
    permissions: ["profile:update"],
    roles: ["editor"],
  } as AuthUser;

  describe("hasPermission", () => {
    it("should return true if user has direct permission", () => {
      expect(rbacEngine.hasPermission(mockUser, "profile:update")).toBe(true);
    });

    it("should return true if user has permission via role", () => {
      expect(rbacEngine.hasPermission(mockUser, "posts:write")).toBe(true);
    });

    it("should return false if user does not have permission", () => {
      expect(rbacEngine.hasPermission(mockUser, "system:manage")).toBe(false);
    });

    it("should handle manage permission correctly via role", () => {
      const adminUser: AuthUser = {
        id: "admin-1",
        permissions: [],
        roles: ["admin"],
      } as AuthUser;

      expect(rbacEngine.hasPermission(adminUser, "system:delete")).toBe(true);
    });
  });

  describe("hasRole", () => {
    it("should return true if user has the role", () => {
      expect(rbacEngine.hasRole(mockUser, "editor")).toBe(true);
    });

    it("should return false if user does not have the role", () => {
      expect(rbacEngine.hasRole(mockUser, "admin")).toBe(false);
    });
  });
});
