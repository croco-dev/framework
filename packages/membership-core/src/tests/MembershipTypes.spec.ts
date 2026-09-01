import { describe, expect, expectTypeOf, it } from "vitest";
import type { MembershipStore } from "../libs/MembershipStore";
import type {
  Membership,
  MembershipCreateInput,
  MembershipRole,
  MembershipUpdateInput,
} from "../libs/types";
import {
  canDemote,
  canPromote,
  isHigherRole,
  isLowerRole,
  isMembershipRole,
  ROLE_HIERARCHY,
  VALID_MEMBERSHIP_ROLES,
} from "../libs/types";

type RawMembershipWrite = Extract<
  keyof MembershipStore,
  "save" | "delete" | "mutateOwner" | "transferOwnership"
>;

describe("Membership Types", () => {
  it("should expose only command-based membership writes", () => {
    expectTypeOf<RawMembershipWrite>().toEqualTypeOf<never>();
  });

  describe("MembershipRole", () => {
    it("should accept valid role values", () => {
      const owner: MembershipRole = "owner";
      const admin: MembershipRole = "admin";
      const member: MembershipRole = "member";
      const viewer: MembershipRole = "viewer";

      expect(owner).toBe("owner");
      expect(admin).toBe("admin");
      expect(member).toBe("member");
      expect(viewer).toBe("viewer");
    });

    it("should have exact 4 role values", () => {
      const roles: MembershipRole[] = ["owner", "admin", "member", "viewer"];
      expect(roles).toHaveLength(4);
    });
  });

  describe("VALID_MEMBERSHIP_ROLES", () => {
    it("should contain all valid roles", () => {
      expect(VALID_MEMBERSHIP_ROLES).toEqual(["owner", "admin", "member", "viewer"]);
    });
  });

  describe("isMembershipRole", () => {
    it("should return true for valid roles", () => {
      expect(isMembershipRole("owner")).toBe(true);
      expect(isMembershipRole("admin")).toBe(true);
      expect(isMembershipRole("member")).toBe(true);
      expect(isMembershipRole("viewer")).toBe(true);
    });

    it("should return false for invalid roles", () => {
      expect(isMembershipRole("superadmin")).toBe(false);
      expect(isMembershipRole("")).toBe(false);
      expect(isMembershipRole("guest")).toBe(false);
    });
  });

  describe("ROLE_HIERARCHY", () => {
    it("should have correct hierarchy values", () => {
      expect(ROLE_HIERARCHY.owner).toBe(4);
      expect(ROLE_HIERARCHY.admin).toBe(3);
      expect(ROLE_HIERARCHY.member).toBe(2);
      expect(ROLE_HIERARCHY.viewer).toBe(1);
    });
  });

  describe("isHigherRole", () => {
    it("should return true when roleA is higher than roleB", () => {
      expect(isHigherRole("owner", "admin")).toBe(true);
      expect(isHigherRole("admin", "member")).toBe(true);
      expect(isHigherRole("member", "viewer")).toBe(true);
      expect(isHigherRole("owner", "viewer")).toBe(true);
    });

    it("should return false when roleA is lower or equal to roleB", () => {
      expect(isHigherRole("admin", "owner")).toBe(false);
      expect(isHigherRole("member", "admin")).toBe(false);
      expect(isHigherRole("viewer", "member")).toBe(false);
      expect(isHigherRole("admin", "admin")).toBe(false);
    });
  });

  describe("isLowerRole", () => {
    it("should return true when roleA is lower than roleB", () => {
      expect(isLowerRole("admin", "owner")).toBe(true);
      expect(isLowerRole("member", "admin")).toBe(true);
      expect(isLowerRole("viewer", "member")).toBe(true);
    });

    it("should return false when roleA is higher or equal to roleB", () => {
      expect(isLowerRole("owner", "admin")).toBe(false);
      expect(isLowerRole("admin", "member")).toBe(false);
      expect(isLowerRole("member", "viewer")).toBe(false);
      expect(isLowerRole("admin", "admin")).toBe(false);
    });
  });

  describe("canDemote", () => {
    it("should return true when fromRole is higher than toRole", () => {
      expect(canDemote("owner", "admin")).toBe(true);
      expect(canDemote("owner", "member")).toBe(true);
      expect(canDemote("admin", "member")).toBe(true);
      expect(canDemote("admin", "viewer")).toBe(true);
    });

    it("should return true when roles are equal", () => {
      expect(canDemote("admin", "admin")).toBe(true);
      expect(canDemote("member", "member")).toBe(true);
    });

    it("should return false when fromRole is lower than toRole", () => {
      expect(canDemote("member", "admin")).toBe(false);
      expect(canDemote("viewer", "owner")).toBe(false);
    });
  });

  describe("canPromote", () => {
    it("should return true when fromRole is lower than toRole", () => {
      expect(canPromote("member", "admin")).toBe(true);
      expect(canPromote("viewer", "owner")).toBe(true);
      expect(canPromote("member", "owner")).toBe(true);
    });

    it("should return true when roles are equal", () => {
      expect(canPromote("admin", "admin")).toBe(true);
      expect(canPromote("member", "member")).toBe(true);
    });

    it("should return false when fromRole is higher than toRole", () => {
      expect(canPromote("admin", "member")).toBe(false);
      expect(canPromote("owner", "admin")).toBe(false);
    });
  });

  describe("Membership", () => {
    it("should accept valid membership object", () => {
      const membership: Membership = {
        id: "mem_123",
        tenantId: "tenant_456",
        userId: "user_789",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(membership.id).toBe("mem_123");
      expect(membership.role).toBe("admin");
    });

    it("should require all required fields", () => {
      // @ts-expect-error - missing id field
      void {
        tenantId: "tenant_456",
        userId: "user_789",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Membership;

      // @ts-expect-error - missing tenantId field
      void {
        id: "mem_123",
        userId: "user_789",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Membership;
    });
  });

  describe("MembershipCreateInput", () => {
    it("should accept valid create input", () => {
      const input: MembershipCreateInput = {
        id: "mem_123",
        tenantId: "tenant_456",
        userId: "user_789",
        role: "member",
      };

      expect(input.role).toBe("member");
    });
  });

  describe("MembershipUpdateInput", () => {
    it("should accept valid update input", () => {
      const input: MembershipUpdateInput = {
        role: "owner",
      };

      expect(input.role).toBe("owner");
    });
  });
});
