import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatPermission,
  getResourcePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  hasResourcePermission,
  parsePermission,
} from "../libs/rbac/Permission";
import type { PermissionAction } from "../libs/rbac/Permission";

const REQUIRED_ACTIONS: PermissionAction[] = ["read", "write", "delete", "manage"];

function permission(action: PermissionAction, resourceId?: string): string {
  return resourceId ? `documents:${action}:${resourceId}` : `documents:${action}`;
}

describe("Permission", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("scope contract", () => {
    const scopeCases = [
      {
        name: "global grant and global requirement",
        userPermission: "posts:write",
        requiredPermission: "posts:write",
        expected: true,
      },
      {
        name: "global grant and scoped requirement",
        userPermission: "posts:write",
        requiredPermission: "posts:write:123",
        expected: true,
      },
      {
        name: "matching scoped grant and scoped requirement",
        userPermission: "posts:write:123",
        requiredPermission: "posts:write:123",
        expected: true,
      },
      {
        name: "different scoped grant and scoped requirement",
        userPermission: "posts:write:456",
        requiredPermission: "posts:write:123",
        expected: false,
      },
      {
        name: "scoped grant and global requirement",
        userPermission: "posts:write:123",
        requiredPermission: "posts:write",
        expected: false,
      },
      {
        name: "scoped manage grant and global requirement",
        userPermission: "posts:manage:123",
        requiredPermission: "posts:write",
        expected: false,
      },
      {
        name: "scoped manage grant and different scoped requirement",
        userPermission: "posts:manage:456",
        requiredPermission: "posts:write:123",
        expected: false,
      },
      {
        name: "scoped manage grant and matching scoped requirement",
        userPermission: "posts:manage:123",
        requiredPermission: "posts:write:123",
        expected: true,
      },
      {
        name: "global manage grant and scoped requirement",
        userPermission: "posts:manage",
        requiredPermission: "posts:write:123",
        expected: true,
      },
    ];

    it.each(scopeCases)(
      "should enforce $name across every permission entry point",
      ({ userPermission, requiredPermission, expected }) => {
        const userPermissions = [userPermission];
        const required = parsePermission(requiredPermission);

        expect(hasPermission(userPermissions, requiredPermission)).toBe(expected);
        expect(
          hasResourcePermission(
            userPermissions,
            required.resource,
            required.action,
            required.resourceId,
          ),
        ).toBe(expected);
        expect(hasAnyPermission(userPermissions, [requiredPermission])).toBe(expected);
        expect(hasAllPermissions(userPermissions, [requiredPermission])).toBe(expected);
      },
    );
  });

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

    it("should reject an empty resource id", () => {
      expect(() => parsePermission("posts:write:")).toThrow("Invalid permission format");
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

    it("should reject an empty resource id instead of formatting a global permission", () => {
      const permission = { resource: "posts", action: "write" as const, resourceId: "" };
      expect(() => formatPermission(permission)).toThrow("Invalid permission format");
    });
  });

  describe("hasPermission", () => {
    it("should reject an empty resource id before an exact match", () => {
      expect(() => hasPermission(["posts:write:"], "posts:write:")).toThrow(
        "Invalid permission format",
      );
    });

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

    it("should enforce manage implication within resource scope for every action", () => {
      const scopeCases = [
        { grantedId: undefined, requiredId: undefined, matches: true },
        { grantedId: undefined, requiredId: "document-1", matches: true },
        { grantedId: "document-1", requiredId: "document-1", matches: true },
        { grantedId: "document-1", requiredId: "document-2", matches: false },
        { grantedId: "document-1", requiredId: undefined, matches: false },
      ];

      for (const requiredAction of REQUIRED_ACTIONS) {
        for (const { grantedId, requiredId, matches } of scopeCases) {
          expect(
            hasPermission(
              [permission("manage", grantedId)],
              permission(requiredAction, requiredId),
            ),
            `${permission("manage", grantedId)} -> ${permission(requiredAction, requiredId)}`,
          ).toBe(matches);
        }
      }
    });

    it("should return false for mismatch", () => {
      const userPermissions = ["billing:read"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(false);
    });

    it("should return false for different resource", () => {
      const userPermissions = ["users:write"];
      expect(hasPermission(userPermissions, "billing:write")).toBe(false);
    });

    it("should warn and handle invalid permissions in user list gracefully", () => {
      const userPermissions = ["invalid-format", "billing:manage"];
      expect(hasPermission(userPermissions, "billing:read")).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith("Malformed permission string:", "invalid-format");
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
    it("should reject an empty resource id", () => {
      expect(() => hasResourcePermission(["posts:write:"], "posts", "write", "")).toThrow(
        "Invalid permission format",
      );
    });

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

    it("should warn for malformed permission strings in getResourcePermissions", () => {
      const userPermissions = ["posts:read", "bad-permission"];
      const result = getResourcePermissions(userPermissions, "posts");
      expect(result).toEqual([{ action: "read" }]);
      expect(warnSpy).toHaveBeenCalledWith("Malformed permission string:", "bad-permission");
    });
  });

  describe("hasAnyPermission", () => {
    it("should reject a required permission with an empty resource id", () => {
      expect(() => hasAnyPermission(["posts:write:"], ["posts:write:"])).toThrow(
        "Invalid permission format",
      );
    });

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
    it("should reject a required permission with an empty resource id", () => {
      expect(() => hasAllPermissions(["posts:write:"], ["posts:write:"])).toThrow(
        "Invalid permission format",
      );
    });

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
