import { describe, expect, it } from "vitest";
import {
  formatPermission,
  getResourcePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  hasResourcePermission,
  parsePermission,
} from "../libs/rbac/Permission";

describe("Permission", () => {
  describe("parsePermission", () => {
    it("should parse valid permission string", () => {
      const result = parsePermission("billing:write");
      expect(result).toEqual({ resource: "billing", action: "write" });
    });

    it("should throw error for invalid format", () => {
      expect(() => parsePermission("invalid")).toThrow("Invalid permission format");
    });

    it("should throw error for invalid action", () => {
      expect(() => parsePermission("billing:invalid_action")).toThrow("Invalid permission action");
    });

    it("should parse manage action", () => {
      const result = parsePermission("users:manage");
      expect(result).toEqual({ resource: "users", action: "manage" });
    });

    it("should parse resource level permission", () => {
      const result = parsePermission("posts:write:123");
      expect(result).toEqual({ resource: "posts", action: "write", resourceId: "123" });
    });
  });

  describe("formatPermission", () => {
    it("should format permission object to string", () => {
      const permission = { resource: "billing", action: "write" as const };
      expect(formatPermission(permission)).toBe("billing:write");
    });

    it("should format resource level permission to string", () => {
      const permission = { resource: "posts", action: "write" as const, resourceId: "123" };
      expect(formatPermission(permission)).toBe("posts:write:123");
    });
  });

  describe("hasPermission", () => {
    it("should return true for exact match", () => {
      const userPermissions = ["billing:read", "billing:write"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(true);
    });

    it("should return true when user has manage permission", () => {
      const userPermissions = ["billing:manage"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(true);
      expect(hasPermission(userPermissions, "billing:read")).toBe(true);
      expect(hasPermission(userPermissions, "billing:delete")).toBe(true);
    });

    it("should return false for mismatch", () => {
      const userPermissions = ["billing:read"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(false);
    });

    it("should return false for different resource", () => {
      const userPermissions = ["users:write"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(false);
    });

    it("should handle invalid permissions in user list gracefully", () => {
      const userPermissions = ["invalid:permission", "billing:write"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(true);
    });

    describe("resource level permissions", () => {
      it("should return true for exact resource id match", () => {
        const userPermissions = ["posts:write:123"];
        expect(hasPermission(userPermissions, "posts:write:123")).toBe(true);
      });

      it("should return true when user has resource-wide permission", () => {
        const userPermissions = ["posts:write"];
        expect(hasPermission(userPermissions, "posts:write:123")).toBe(true);
      });

      it("should return false for different resource id", () => {
        const userPermissions = ["posts:write:456"];
        expect(hasPermission(userPermissions, "posts:write:123")).toBe(false);
      });

      it("should return true when user has manage permission on resource", () => {
        const userPermissions = ["posts:manage"];
        expect(hasPermission(userPermissions, "posts:write:123")).toBe(true);
      });
    });
  });

  describe("hasResourcePermission", () => {
    it("should check resource level permission with resourceId", () => {
      const userPermissions = ["posts:write:123"];
      expect(hasResourcePermission(userPermissions, "posts", "write", "123")).toBe(true);
      expect(hasResourcePermission(userPermissions, "posts", "write", "456")).toBe(false);
    });

    it("should check resource level permission without resourceId", () => {
      const userPermissions = ["posts:write"];
      expect(hasResourcePermission(userPermissions, "posts", "write")).toBe(true);
      expect(hasResourcePermission(userPermissions, "posts", "read")).toBe(false);
    });

    it("should allow access when user has manage permission", () => {
      const userPermissions = ["posts:manage"];
      expect(hasResourcePermission(userPermissions, "posts", "delete", "123")).toBe(true);
    });
  });

  describe("getResourcePermissions", () => {
    it("should return permissions for specific resource", () => {
      const userPermissions = ["posts:write:123", "posts:read", "users:manage"];
      const result = getResourcePermissions(userPermissions, "posts");
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ action: "write", resourceId: "123" });
      expect(result).toContainEqual({ action: "read" });
    });

    it("should return empty array for resource with no permissions", () => {
      const userPermissions = ["users:manage"];
      const result = getResourcePermissions(userPermissions, "posts");
      expect(result).toEqual([]);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has any of the required permissions", () => {
      const userPermissions = ["posts:write", "users:read"];
      expect(hasAnyPermission(userPermissions, ["posts:delete", "posts:write"])).toBe(true);
    });

    it("should return false if user has none of the required permissions", () => {
      const userPermissions = ["posts:read"];
      expect(hasAnyPermission(userPermissions, ["posts:delete", "users:write"])).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all required permissions", () => {
      const userPermissions = ["posts:write", "posts:read"];
      expect(hasAllPermissions(userPermissions, ["posts:write", "posts:read"])).toBe(true);
    });

    it("should return false if user is missing any permission", () => {
      const userPermissions = ["posts:write"];
      expect(hasAllPermissions(userPermissions, ["posts:write", "posts:delete"])).toBe(false);
    });
  });
});
