import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleTenantMappingProvider } from "../libs/DrizzleTenantMappingProvider";
import {
  DuplicateTenantMappingProblem,
  TenantMappingConflictResolutionProblem,
} from "../libs/problems/DrizzleTenantMappingProblems";
import { tenantMappings } from "../schema";

type MappingValues = {
  externalOrgId: string;
  tenantId: string;
};

function createSerializedMappingFixture(): {
  provider: DrizzleTenantMappingProvider;
  mappings: Map<string, string>;
} {
  const mappings = new Map<string, string>();
  let insertTail: Promise<void> = Promise.resolve();
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((values: MappingValues) => {
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => {
              const result = insertTail.then(() => {
                if (mappings.has(values.externalOrgId)) {
                  return [];
                }

                mappings.set(values.externalOrgId, values.tenantId);
                return [{ tenantId: values.tenantId }];
              });
              insertTail = result.then(() => undefined);
              return result;
            }),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
    query: {
      tenantMappings: {
        findFirst: vi.fn(async () => {
          await insertTail;
          const mapping = mappings.entries().next().value;
          if (!mapping) {
            return null;
          }

          const [externalOrgId, tenantId] = mapping;
          return {
            id: "mapping-1",
            externalOrgId,
            tenantId,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          };
        }),
      },
    },
  };

  return {
    provider: new DrizzleTenantMappingProvider(
      db as unknown as ConstructorParameters<typeof DrizzleTenantMappingProvider>[0],
      { tenantMappings },
    ),
    mappings,
  };
}

describe("DrizzleTenantMappingProvider", () => {
  let provider!: DrizzleTenantMappingProvider;
  let mockDb!: {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: {
      tenantMappings: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(),
      delete: vi.fn(),
      query: {
        tenantMappings: {
          findFirst: vi.fn(),
        },
      },
    };

    provider = new DrizzleTenantMappingProvider(
      mockDb as unknown as ConstructorParameters<typeof DrizzleTenantMappingProvider>[0],
      { tenantMappings },
    );
  });

  describe("resolve", () => {
    it("should return tenantId when mapping exists", async () => {
      const mockMapping = {
        id: "mapping-1",
        externalOrgId: "clerk-org-123",
        tenantId: "tenant-456",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.tenantMappings.findFirst.mockResolvedValue(mockMapping);

      const result = await provider.resolve("clerk-org-123");

      expect(result).toBe("tenant-456");
    });

    it("should return null when mapping not found", async () => {
      mockDb.query.tenantMappings.findFirst.mockResolvedValue(null);

      const result = await provider.resolve("non-existent");

      expect(result).toBeNull();
    });

    it("should return null when row validation fails", async () => {
      mockDb.query.tenantMappings.findFirst.mockResolvedValue({ invalid: "data" });

      const result = await provider.resolve("clerk-org-123");

      expect(result).toBeNull();
    });

    it("should query by externalOrgId", async () => {
      const mockMapping = {
        id: "mapping-1",
        externalOrgId: "clerk-org-123",
        tenantId: "tenant-456",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.tenantMappings.findFirst.mockResolvedValue(mockMapping);

      await provider.resolve("clerk-org-123");

      expect(mockDb.query.tenantMappings.findFirst).toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("should create new mapping", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ tenantId: "tenant-456" }]);
      const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock }),
      });

      await provider.register("clerk-org-123", "tenant-456");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(onConflictDoNothingMock).toHaveBeenCalledWith({
        target: tenantMappings.externalOrgId,
      });
      expect(returningMock).toHaveBeenCalledWith({ tenantId: tenantMappings.tenantId });
    });

    it("should store correct values", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ tenantId: "tenant-456" }]);
      const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock });
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      mockDb.insert.mockReturnValue({ values: valuesMock });

      await provider.register("clerk-org-123", "tenant-456");

      expect(valuesMock).toHaveBeenCalledWith({
        externalOrgId: "clerk-org-123",
        tenantId: "tenant-456",
      });
    });

    it("should allow idempotent registration for the same tenant mapping", async () => {
      const { provider: atomicProvider, mappings } = createSerializedMappingFixture();

      await atomicProvider.register("org_123", "tenant_abc");

      await expect(atomicProvider.register("org_123", "tenant_abc")).resolves.toBeUndefined();
      expect(mappings.get("org_123")).toBe("tenant_abc");
    });

    it("should reject remapping an organization with a stable domain conflict", async () => {
      const { provider: atomicProvider, mappings } = createSerializedMappingFixture();

      await atomicProvider.register("org_123", "tenant_abc");

      const registration = atomicProvider.register("org_123", "tenant_xyz");
      await expect(registration).rejects.toBeInstanceOf(DuplicateTenantMappingProblem);
      await expect(registration).rejects.toMatchObject({
        code: "auth-drizzle/duplicate-tenant-mapping",
      });
      expect(mappings.get("org_123")).toBe("tenant_abc");
    });

    it("should preserve missing conflict evidence as a storage invariant failure", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock }),
      });
      mockDb.query.tenantMappings.findFirst.mockResolvedValue(null);

      const registration = provider.register("org_123", "tenant_abc");

      await expect(registration).rejects.toBeInstanceOf(TenantMappingConflictResolutionProblem);
      await expect(registration).rejects.toMatchObject({
        code: "auth-drizzle/tenant-mapping-conflict-resolution-failed",
      });
    });

    it("should keep concurrent same-tenant registrations idempotent", async () => {
      const { provider: atomicProvider, mappings } = createSerializedMappingFixture();

      await expect(
        Promise.all([
          atomicProvider.register("org_123", "tenant_abc"),
          atomicProvider.register("org_123", "tenant_abc"),
        ]),
      ).resolves.toEqual([undefined, undefined]);
      expect(mappings.get("org_123")).toBe("tenant_abc");
    });

    it("should preserve one authoritative mapping under conflicting concurrent registrations", async () => {
      const { provider: atomicProvider, mappings } = createSerializedMappingFixture();

      const results = await Promise.allSettled([
        atomicProvider.register("org_123", "tenant_abc"),
        atomicProvider.register("org_123", "tenant_xyz"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        status: "rejected",
      });
      if (rejected?.status === "rejected") {
        expect(rejected.reason).toBeInstanceOf(DuplicateTenantMappingProblem);
        expect(rejected.reason).toMatchObject({
          code: "auth-drizzle/duplicate-tenant-mapping",
        });
      }
      expect(["tenant_abc", "tenant_xyz"]).toContain(mappings.get("org_123"));
    });
  });

  describe("remove", () => {
    it("should remove mapping", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await provider.remove("clerk-org-123");

      expect(mockDb.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });

    it("should delete by externalOrgId", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await provider.remove("clerk-org-123");

      expect(mockDb.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });

  describe("integration flow", () => {
    it("should handle full lifecycle", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ tenantId: "tenant-456" }]);
      const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock });
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      mockDb.insert.mockReturnValue({ values: valuesMock });

      const mockMapping = {
        id: "mapping-1",
        externalOrgId: "clerk-org-123",
        tenantId: "tenant-456",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.query.tenantMappings.findFirst.mockResolvedValue(mockMapping);

      const whereMock = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await provider.register("clerk-org-123", "tenant-456");
      expect(valuesMock).toHaveBeenCalledWith({
        externalOrgId: "clerk-org-123",
        tenantId: "tenant-456",
      });

      const tenantId = await provider.resolve("clerk-org-123");
      expect(tenantId).toBe("tenant-456");

      await provider.remove("clerk-org-123");
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
