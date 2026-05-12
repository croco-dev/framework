import "reflect-metadata";
import type { DomainPolicy } from "@croco/invitation-core";
import type { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DrizzleDomainPolicyClient,
  DrizzleDomainPolicyStore,
} from "../libs/DrizzleDomainPolicyStore";

const createPolicy = (overrides: Partial<DomainPolicy> = {}): DomainPolicy => {
  return {
    id: overrides.id ?? "dp-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    domain: overrides.domain ?? "croco.dev",
    role: overrides.role ?? "member",
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  };
};

describe("DrizzleDomainPolicyStore", () => {
  let store!: DrizzleDomainPolicyStore;

  let mockDb!: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };

    const mockTxManager = {
      getClient: vi.fn().mockReturnValue(null),
    };

    store = new DrizzleDomainPolicyStore(
      mockDb as unknown as DrizzleDomainPolicyClient,
      mockTxManager as unknown as TxManager<DrizzleDomainPolicyClient>,
    );
  });

  it("should save and find policy by tenant and domain", async () => {
    const policy = createPolicy();

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([policy]),
        }),
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([policy]),
        }),
      }),
    });

    await store.save(policy);
    const found = await store.findByTenantAndDomain("tenant-1", "croco.dev");

    expect(found).not.toBeNull();
    expect(found?.id).toBe("dp-1");
  });

  it("should return all policies by tenant", async () => {
    const rows = [
      createPolicy({ id: "dp-1", tenantId: "tenant-1", domain: "croco.dev" }),
      createPolicy({ id: "dp-2", tenantId: "tenant-1", domain: "example.com" }),
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });

    const found = await store.findAllByTenant("tenant-1");

    expect(found).toHaveLength(2);
    expect(found.map((policy) => policy.id).sort()).toEqual(["dp-1", "dp-2"]);
  });

  it("should update existing policy when saving same tenant and domain", async () => {
    const initial = createPolicy({ id: "dp-1", role: "member" });
    const updated = createPolicy({ id: "dp-2", role: "viewer" });

    mockDb.insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([initial]),
          }),
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

    const first = await store.save(initial);
    const second = await store.save(updated);

    expect(first.role).toBe("member");
    expect(second.id).toBe("dp-2");
    expect(second.role).toBe("viewer");
  });

  it("should delete policy by tenant and domain", async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await expect(store.delete("tenant-1", "croco.dev")).resolves.toBeUndefined();
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
