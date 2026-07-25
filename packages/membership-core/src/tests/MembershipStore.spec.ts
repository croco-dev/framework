import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryMembershipStore } from "../libs/InMemoryMembershipStore";
import type { MembershipCreateInput } from "../libs/types";

describe("InMemoryMembershipStore", () => {
  let store!: InMemoryMembershipStore;

  const createInput = (overrides: Partial<MembershipCreateInput> = {}): MembershipCreateInput => {
    return {
      id: overrides.id ?? "mem-1",
      tenantId: overrides.tenantId ?? "tenant-1",
      userId: overrides.userId ?? "user-1",
      role: overrides.role ?? "member",
    };
  };

  beforeEach(() => {
    store = new InMemoryMembershipStore();
  });

  it("should save and find membership by tenant and user", async () => {
    await store.save(createInput());

    const membership = await store.findByTenantAndUser("tenant-1", "user-1");

    expect(membership).not.toBeNull();
    expect(membership?.id).toBe("mem-1");
    expect(membership?.role).toBe("member");
  });

  it("should return all memberships by tenant", async () => {
    await store.save(createInput({ id: "mem-1", tenantId: "tenant-1", userId: "user-1" }));
    await store.save(createInput({ id: "mem-2", tenantId: "tenant-1", userId: "user-2" }));
    await store.save(createInput({ id: "mem-3", tenantId: "tenant-2", userId: "user-3" }));

    const memberships = await store.findAllByTenant("tenant-1");

    expect(memberships).toHaveLength(2);
    expect(memberships.map((membership) => membership.id).sort()).toEqual(["mem-1", "mem-2"]);
  });

  it("should return all memberships by user", async () => {
    await store.save(createInput({ id: "mem-1", tenantId: "tenant-1", userId: "user-1" }));
    await store.save(createInput({ id: "mem-2", tenantId: "tenant-2", userId: "user-1" }));
    await store.save(createInput({ id: "mem-3", tenantId: "tenant-2", userId: "user-2" }));

    const memberships = await store.findAllByUser("user-1");

    expect(memberships).toHaveLength(2);
    expect(memberships.map((membership) => membership.id).sort()).toEqual(["mem-1", "mem-2"]);
  });

  it("should delete membership", async () => {
    await store.save(createInput());

    await store.delete("tenant-1", "user-1");

    const membership = await store.findByTenantAndUser("tenant-1", "user-1");
    expect(membership).toBeNull();
  });

  it("should count memberships by role in tenant", async () => {
    await store.save(
      createInput({ id: "mem-1", tenantId: "tenant-1", userId: "user-1", role: "admin" }),
    );
    await store.save(
      createInput({ id: "mem-2", tenantId: "tenant-1", userId: "user-2", role: "admin" }),
    );
    await store.save(
      createInput({ id: "mem-3", tenantId: "tenant-1", userId: "user-3", role: "member" }),
    );
    await store.save(
      createInput({ id: "mem-4", tenantId: "tenant-2", userId: "user-4", role: "admin" }),
    );

    const count = await store.countByRole("tenant-1", "admin");

    expect(count).toBe(2);
  });

  it("should update membership when saving same tenant and user", async () => {
    await store.save(createInput({ id: "mem-1", role: "member" }));
    await store.save(createInput({ id: "mem-1", role: "admin" }));

    const membership = await store.findByTenantAndUser("tenant-1", "user-1");

    expect(membership?.role).toBe("admin");
  });

  it.each([
    [
      createInput({
        id: "mem-delimiter-left",
        tenantId: "tenant:segment",
        userId: "user",
        role: "admin",
      }),
      createInput({
        id: "mem-delimiter-right",
        tenantId: "tenant",
        userId: "segment:user",
        role: "member",
      }),
    ],
    [
      createInput({
        id: "mem-delimiter-right",
        tenantId: "tenant",
        userId: "segment:user",
        role: "member",
      }),
      createInput({
        id: "mem-delimiter-left",
        tenantId: "tenant:segment",
        userId: "user",
        role: "admin",
      }),
    ],
  ])(
    "should keep delimiter-containing tuples distinct regardless of save order",
    async (first, second) => {
      await store.save(first);
      await store.save(second);

      await expect(store.findByTenantAndUser(first.tenantId, first.userId)).resolves.toMatchObject(
        first,
      );
      await expect(
        store.findByTenantAndUser(second.tenantId, second.userId),
      ).resolves.toMatchObject(second);
      await expect(store.countByRole("tenant:segment", "admin")).resolves.toBe(1);
      await expect(store.countByRole("tenant", "member")).resolves.toBe(1);

      await store.delete(first.tenantId, first.userId);

      await expect(store.findByTenantAndUser(first.tenantId, first.userId)).resolves.toBeNull();
      await expect(
        store.findByTenantAndUser(second.tenantId, second.userId),
      ).resolves.toMatchObject(second);
    },
  );
});
