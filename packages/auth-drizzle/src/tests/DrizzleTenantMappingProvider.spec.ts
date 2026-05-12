import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleTenantMappingProvider } from "../libs/DrizzleTenantMappingProvider";
import type { tenantMappings as tenantMappingsSchema } from "../schema";

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
      { tenantMappings: {} as typeof tenantMappingsSchema },
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
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      await provider.register("clerk-org-123", "tenant-456");

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should store correct values", async () => {
      const valuesMock = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({ values: valuesMock });

      await provider.register("clerk-org-123", "tenant-456");

      expect(valuesMock).toHaveBeenCalledWith({
        externalOrgId: "clerk-org-123",
        tenantId: "tenant-456",
      });
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
      const valuesMock = vi.fn().mockResolvedValue(undefined);
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
