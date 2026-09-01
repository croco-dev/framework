import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleRegistry } from "@croco/auth-core";
import { DrizzleRoleRegistry } from "../libs/DrizzleRoleRegistry";
import type { userRoles as userRolesSchema } from "../schema";

describe("DrizzleRoleRegistry", () => {
  let registry!: DrizzleRoleRegistry;
  let mockDb!: {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: {
      userRoles: {
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(),
      delete: vi.fn(),
      query: {
        userRoles: {
          findMany: vi.fn(),
        },
      },
    };

    registry = new DrizzleRoleRegistry(
      mockDb as unknown as ConstructorParameters<typeof DrizzleRoleRegistry>[0],
      {
        userRoles: {} as typeof userRolesSchema,
      },
    );
  });

  describe("registerRole", () => {
    it("should register a role with definition", () => {
      registry.registerRole("admin", { name: "Admin", permissions: ["read", "write", "delete"] });

      const definition = registry.getRoleDefinition("admin");
      expect(definition).toEqual({ name: "Admin", permissions: ["read", "write", "delete"] });
    });

    it("should update existing role definition", () => {
      registry.registerRole("admin", { name: "Admin", permissions: ["read"] });
      registry.registerRole("admin", { name: "Admin", permissions: ["read", "write"] });

      const definition = registry.getRoleDefinition("admin");
      expect(definition?.permissions).toEqual(["read", "write"]);
    });
  });

  describe("getRoleDefinition", () => {
    it("should return undefined for unregistered role", () => {
      const definition = registry.getRoleDefinition("non-existent");
      expect(definition).toBeUndefined();
    });

    it("should return definition for registered role", () => {
      registry.registerRole("editor", { name: "Editor", permissions: ["read", "write"] });

      const definition = registry.getRoleDefinition("editor");
      expect(definition).toEqual({ name: "Editor", permissions: ["read", "write"] });
    });
  });

  describe("getRolePermissions", () => {
    it("should return empty array for unregistered role", () => {
      const permissions = registry.getRolePermissions("non-existent");
      expect(permissions).toEqual([]);
    });

    it("should return permissions for registered role", () => {
      registry.registerRole("admin", { name: "Admin", permissions: ["read", "write", "delete"] });

      const permissions = registry.getRolePermissions("admin");
      expect(permissions).toEqual(["read", "write", "delete"]);
    });

    it("should include inherited permissions", () => {
      registry.registerRole("viewer", { name: "viewer", permissions: ["posts:read"] });
      registry.registerRole("editor", {
        name: "editor",
        permissions: ["posts:write"],
        inherits: ["viewer"],
      });

      expect(registry.getRolePermissions("editor")).toEqual(["posts:write", "posts:read"]);
    });

    it("should include transitively inherited permissions", () => {
      registry.registerRole("viewer", { name: "viewer", permissions: ["posts:read"] });
      registry.registerRole("editor", {
        name: "editor",
        permissions: ["posts:write"],
        inherits: ["viewer"],
      });
      registry.registerRole("admin", {
        name: "admin",
        permissions: ["posts:delete"],
        inherits: ["editor"],
      });

      expect(registry.getRolePermissions("admin")).toEqual([
        "posts:delete",
        "posts:write",
        "posts:read",
      ]);
    });

    it("should deduplicate permissions inherited through multiple roles", () => {
      registry.registerRole("viewer", {
        name: "viewer",
        permissions: ["posts:read", "posts:comment"],
      });
      registry.registerRole("editor", {
        name: "editor",
        permissions: ["posts:read", "posts:write"],
        inherits: ["viewer"],
      });

      expect(registry.getRolePermissions("editor")).toEqual([
        "posts:read",
        "posts:write",
        "posts:comment",
      ]);
    });

    it("should terminate cyclic inheritance while preserving effective permissions", () => {
      registry.registerRole("role-a", {
        name: "role-a",
        permissions: ["permission:a"],
        inherits: ["role-b"],
      });
      registry.registerRole("role-b", {
        name: "role-b",
        permissions: ["permission:b"],
        inherits: ["role-a"],
      });

      expect(registry.getRolePermissions("role-a")).toEqual(["permission:a", "permission:b"]);
      expect(registry.getRolePermissions("role-b")).toEqual(["permission:b", "permission:a"]);
    });

    it("should match auth-core for diamond inheritance", () => {
      const reference = new RoleRegistry();
      const roles = [
        { name: "viewer", permissions: ["posts:read"] },
        { name: "author", permissions: ["posts:write"], inherits: ["viewer"] },
        { name: "editor", permissions: ["posts:edit"], inherits: ["viewer"] },
        {
          name: "admin",
          permissions: ["posts:manage"],
          inherits: ["author", "editor"],
        },
      ];

      for (const role of roles) {
        reference.register(role);
        registry.registerRole(role.name, role);
      }

      for (const role of roles) {
        expect(registry.getRolePermissions(role.name)).toEqual(
          reference.getRolePermissions(role.name),
        );
      }
    });

    it("should honor a seeded visited set like auth-core", () => {
      const reference = new RoleRegistry();
      const viewer = { name: "viewer", permissions: ["posts:read"] };
      const editor = {
        name: "editor",
        permissions: ["posts:write"],
        inherits: ["viewer"],
      };

      reference.register(viewer);
      reference.register(editor);
      registry.registerRole(viewer.name, viewer);
      registry.registerRole(editor.name, editor);

      const visited = new Set(["viewer"]);
      expect(registry.getRolePermissions("editor", new Set(visited))).toEqual(["posts:write"]);
      expect(registry.getRolePermissions("editor", new Set(visited))).toEqual(
        reference.getRolePermissions("editor", new Set(visited)),
      );
    });
  });

  describe("getUserRoles", () => {
    it("should return roles for user", async () => {
      const mockRoles = [
        { id: "1", userId: "user-1", tenantId: "tenant-1", role: "admin", createdAt: new Date() },
        { id: "2", userId: "user-1", tenantId: "tenant-1", role: "editor", createdAt: new Date() },
      ];

      mockDb.query.userRoles.findMany.mockResolvedValue(mockRoles);

      const result = await registry.getUserRoles("user-1", "tenant-1");

      expect(result).toEqual(["admin", "editor"]);
    });

    it("should return empty array when user has no roles", async () => {
      mockDb.query.userRoles.findMany.mockResolvedValue([]);

      const result = await registry.getUserRoles("user-1", "tenant-1");

      expect(result).toEqual([]);
    });

    it("should filter out invalid rows", async () => {
      const mockRoles = [
        { id: "1", userId: "user-1", tenantId: "tenant-1", role: "admin", createdAt: new Date() },
        { invalid: "data" },
      ];

      mockDb.query.userRoles.findMany.mockResolvedValue(mockRoles);

      const result = await registry.getUserRoles("user-1", "tenant-1");

      expect(result).toEqual(["admin"]);
    });

    it("should filter by tenant", async () => {
      const mockRoles = [
        { id: "1", userId: "user-1", tenantId: "tenant-1", role: "admin", createdAt: new Date() },
      ];

      mockDb.query.userRoles.findMany.mockResolvedValue(mockRoles);

      const result = await registry.getUserRoles("user-1", "tenant-1");

      expect(result).toEqual(["admin"]);
      expect(mockDb.query.userRoles.findMany).toHaveBeenCalled();
    });
  });

  describe("assignRole", () => {
    it("should assign role to user", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await registry.assignRole("user-1", "tenant-1", "admin");

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle duplicate assignment gracefully", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await registry.assignRole("user-1", "tenant-1", "admin");
      await registry.assignRole("user-1", "tenant-1", "admin");

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("revokeRole", () => {
    it("should revoke role from user", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await registry.revokeRole("user-1", "tenant-1", "admin");

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should handle condition when and() returns undefined", async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await registry.revokeRole("user-1", "tenant-1", "admin");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("getPermissionsForRole", () => {
    it("should return permissions for registered role", () => {
      registry.registerRole("admin", { name: "Admin", permissions: ["read", "write", "delete"] });

      const permissions = registry.getPermissionsForRole("admin");
      expect(permissions).toEqual(["read", "write", "delete"]);
    });

    it("should return empty array for unregistered role", () => {
      const permissions = registry.getPermissionsForRole("non-existent");
      expect(permissions).toEqual([]);
    });
  });
});
