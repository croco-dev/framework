import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClerkTenantMapper,
  InMemoryTenantMappingStore,
  type ClerkTenantRequest,
  type TenantMappingClaimResult,
  type TenantMappingStore,
} from "../libs/ClerkTenantMapper";
import { createTenantMappingStoreConformanceSuite } from "../libs/conformance";
import {
  DuplicateTenantMappingProblem,
  UnexpectedTenantMappingClaimProblem,
} from "../libs/problems/ClerkProblems";

describe("TenantMappingStore conformance", () => {
  const conformance = createTenantMappingStoreConformanceSuite({
    createStores: () => {
      const mappings = new Map<string, string>();
      return [new InMemoryTenantMappingStore(mappings), new InMemoryTenantMappingStore(mappings)];
    },
  });

  it.each(conformance.cases.map((testCase) => [testCase.name, testCase.run] as const))(
    "%s",
    async (_name, run) => run(),
  );
});

describe("ClerkTenantMapper", () => {
  describe("InMemory Store", () => {
    let mapper!: ClerkTenantMapper;

    beforeEach(() => {
      mapper = new ClerkTenantMapper();
    });

    it("should register and resolve tenant", async () => {
      await mapper.register("org_123", "tenant_abc");
      const tenantId = await mapper.resolve("org_123");
      expect(tenantId).toBe("tenant_abc");
    });

    it("should return null for unknown org", async () => {
      const tenantId = await mapper.resolve("org_unknown");
      expect(tenantId).toBeNull();
    });

    it("should remove tenant mapping", async () => {
      await mapper.register("org_123", "tenant_abc");
      await mapper.remove("org_123");
      const tenantId = await mapper.resolve("org_123");
      expect(tenantId).toBeNull();
    });

    it("should resolve by request with auth user", async () => {
      await mapper.register("org_123", "tenant_abc");

      const request: ClerkTenantRequest = {
        user: {
          id: "user-1",
          roles: [],
          permissions: [],
          metadata: {
            orgId: "org_123",
          },
        },
      };

      const tenantId = await mapper.resolve(request);
      expect(tenantId).toBe("tenant_abc");
    });

    it("should allow idempotent registration for the same tenant mapping", async () => {
      await mapper.register("org_123", "tenant_abc");

      await expect(mapper.register("org_123", "tenant_abc")).resolves.toBeUndefined();
      await expect(mapper.resolve("org_123")).resolves.toBe("tenant_abc");
    });

    it("should fail fast when an org is remapped to a different tenant", async () => {
      await mapper.register("org_123", "tenant_abc");

      await expect(mapper.register("org_123", "tenant_xyz")).rejects.toBeInstanceOf(
        DuplicateTenantMappingProblem,
      );
      await expect(mapper.resolve("org_123")).resolves.toBe("tenant_abc");
    });

    it("should keep one winner under conflicting concurrent registrations", async () => {
      const results = await Promise.allSettled([
        mapper.register("org_123", "tenant_abc"),
        mapper.register("org_123", "tenant_xyz"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected?.status).toBe("rejected");
      if (rejected?.status === "rejected") {
        expect(rejected.reason).toBeInstanceOf(DuplicateTenantMappingProblem);
      }

      const authoritativeTenantId = await mapper.resolve("org_123");
      expect(["tenant_abc", "tenant_xyz"]).toContain(authoritativeTenantId);
      const conflictingTenantId =
        authoritativeTenantId === "tenant_abc" ? "tenant_xyz" : "tenant_abc";
      await expect(mapper.register("org_123", conflictingTenantId)).rejects.toBeInstanceOf(
        DuplicateTenantMappingProblem,
      );
      await expect(mapper.resolve("org_123")).resolves.toBe(authoritativeTenantId);
    });

    it("should keep concurrent same-tenant registrations idempotent", async () => {
      await expect(
        Promise.all([
          mapper.register("org_123", "tenant_abc"),
          mapper.register("org_123", "tenant_abc"),
        ]),
      ).resolves.toEqual([undefined, undefined]);
      await expect(mapper.resolve("org_123")).resolves.toBe("tenant_abc");
    });

    it("should return null if request has no orgId", async () => {
      const request: ClerkTenantRequest = {
        user: {
          id: "user-2",
          roles: [],
          permissions: [],
          metadata: {},
        },
      };

      const tenantId = await mapper.resolve(request);
      expect(tenantId).toBeNull();
    });
  });

  describe("Custom Store", () => {
    let mapper!: ClerkTenantMapper;
    let mockStore!: TenantMappingStore;

    beforeEach(() => {
      mockStore = {
        get: vi.fn(),
        claim: vi.fn(),
        delete: vi.fn(),
      };
      mapper = new ClerkTenantMapper(mockStore);
    });

    it("should use custom store for get", async () => {
      vi.mocked(mockStore.get).mockResolvedValue("tenant_xyz");
      const result = await mapper.resolve("org_xyz");
      expect(result).toBe("tenant_xyz");
      expect(mockStore.get).toHaveBeenCalledWith("org_xyz");
    });

    it("should use custom store for an atomic claim", async () => {
      vi.mocked(mockStore.claim).mockResolvedValue({
        outcome: "created",
      });

      await mapper.register("org_xyz", "tenant_xyz");

      expect(mockStore.claim).toHaveBeenCalledWith("org_xyz", "tenant_xyz");
    });

    it("should use custom store for delete", async () => {
      await mapper.remove("org_xyz");
      expect(mockStore.delete).toHaveBeenCalledWith("org_xyz");
    });

    it("should allow idempotent registration for an existing custom store mapping", async () => {
      vi.mocked(mockStore.claim).mockResolvedValue({
        outcome: "existing",
        tenantId: "tenant_xyz",
      });

      await expect(mapper.register("org_xyz", "tenant_xyz")).resolves.toBeUndefined();
    });

    it("should fail fast when a custom store mapping would be overwritten", async () => {
      vi.mocked(mockStore.claim).mockResolvedValue({
        outcome: "existing",
        tenantId: "tenant_abc",
      });

      await expect(mapper.register("org_xyz", "tenant_xyz")).rejects.toBeInstanceOf(
        DuplicateTenantMappingProblem,
      );
    });

    it("should fail fast when a custom store returns an invalid claim result", async () => {
      vi.mocked(mockStore.claim).mockResolvedValue({
        outcome: "invalid",
      } as unknown as TenantMappingClaimResult);

      await expect(mapper.register("org_xyz", "tenant_xyz")).rejects.toBeInstanceOf(
        UnexpectedTenantMappingClaimProblem,
      );
    });
  });
});
