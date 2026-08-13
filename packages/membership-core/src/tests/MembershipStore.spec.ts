import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryMembershipStore } from "../libs/InMemoryMembershipStore";
import { createMembershipStoreConformanceSuite } from "../libs/conformance";
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

  it("should timestamp a removal intent when the removal command executes", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      await store.save(createInput({ role: "member" }));
      vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

      await store.execute({
        operation: "remove",
        idempotencyKey: "remove-member-1",
        tenantId: "tenant-1",
        userId: "user-1",
      });

      const intent = await store.getPendingEventIntent("remove-member-1");
      expect(intent?.events[0]?.occurredAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    } finally {
      vi.useRealTimers();
    }
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

  it("should preserve the final owner across atomic removals", async () => {
    await store.save(createInput({ id: "mem-1", userId: "user-1", role: "owner" }));
    await store.save(createInput({ id: "mem-2", userId: "user-2", role: "owner" }));

    await expect(
      store.mutateOwner({ tenantId: "tenant-1", userId: "user-1", operation: "remove" }),
    ).resolves.toMatchObject({ status: "applied" });
    await expect(
      store.mutateOwner({ tenantId: "tenant-1", userId: "user-2", operation: "remove" }),
    ).resolves.toEqual({ status: "last_owner" });

    expect(await store.countByRole("tenant-1", "owner")).toBe(1);
  });

  it("should apply owner demotion with the same final-owner invariant", async () => {
    await store.save(createInput({ id: "mem-1", userId: "user-1", role: "owner" }));
    await store.save(createInput({ id: "mem-2", userId: "user-2", role: "owner" }));

    await expect(
      store.mutateOwner({
        tenantId: "tenant-1",
        userId: "user-1",
        operation: "demote",
        role: "admin",
      }),
    ).resolves.toMatchObject({ status: "applied", membership: { role: "admin" } });
    await expect(
      store.mutateOwner({
        tenantId: "tenant-1",
        userId: "user-2",
        operation: "demote",
        role: "member",
      }),
    ).resolves.toEqual({ status: "last_owner" });
  });

  it("should transfer ownership as one invariant-preserving transition", async () => {
    await store.save(createInput({ id: "mem-1", userId: "user-1", role: "owner" }));
    await store.save(createInput({ id: "mem-2", userId: "user-2", role: "admin" }));

    await expect(
      store.transferOwnership({
        tenantId: "tenant-1",
        fromUserId: "user-1",
        toUserId: "user-2",
      }),
    ).resolves.toMatchObject({
      status: "applied",
      fromMembership: { role: "admin" },
      toMembership: { role: "owner" },
      previousToRole: "admin",
    });
    expect(await store.countByRole("tenant-1", "owner")).toBe(1);
  });
});

describe("in-memory membership command conformance", () => {
  for (const testCase of createMembershipStoreConformanceSuite({
    createStore: () => new InMemoryMembershipStore(),
  }).cases) {
    // oxlint-disable-next-line jest/valid-title -- provider contract supplies stable case names
    it(testCase.name, testCase.run);
  }
});
