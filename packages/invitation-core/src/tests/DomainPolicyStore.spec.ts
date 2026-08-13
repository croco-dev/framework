import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryDomainPolicyStore } from "../libs/InMemoryDomainPolicyStore";
import type { DomainAutoJoinIntentInput, DomainPolicy } from "../libs/types";

describe("InMemoryDomainPolicyStore", () => {
  let store!: InMemoryDomainPolicyStore;

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

  const createAutoJoinIntent = (
    overrides: Partial<DomainAutoJoinIntentInput> = {},
  ): DomainAutoJoinIntentInput => ({
    idempotencyKey: overrides.idempotencyKey ?? "auto-join-key",
    tenantId: overrides.tenantId ?? "tenant-1",
    userId: overrides.userId ?? "user-1",
    email: overrides.email ?? "user@croco.dev",
    domain: overrides.domain ?? "croco.dev",
    role: overrides.role ?? "member",
    membership: overrides.membership ?? null,
    eventStatus: overrides.eventStatus ?? "pending",
    eventClaimId: overrides.eventClaimId ?? null,
    eventClaimExpiresAt: overrides.eventClaimExpiresAt ?? null,
    eventId: overrides.eventId ?? "event-1",
    eventOccurredAt: overrides.eventOccurredAt ?? new Date("2026-01-01T00:00:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  });

  beforeEach(() => {
    store = new InMemoryDomainPolicyStore();
  });

  it("should save and find policy by tenant and domain", async () => {
    await store.save(createPolicy({ id: "dp-1", tenantId: "tenant-1", domain: "croco.dev" }));

    const policy = await store.findByTenantAndDomain("tenant-1", "croco.dev");

    expect(policy).not.toBeNull();
    expect(policy?.id).toBe("dp-1");
  });

  it("should return all policies by tenant", async () => {
    await store.save(createPolicy({ id: "dp-1", tenantId: "tenant-1", domain: "croco.dev" }));
    await store.save(createPolicy({ id: "dp-2", tenantId: "tenant-1", domain: "example.com" }));
    await store.save(createPolicy({ id: "dp-3", tenantId: "tenant-2", domain: "other.dev" }));

    const policies = await store.findAllByTenant("tenant-1");

    expect(policies).toHaveLength(2);
    expect(policies.map((policy: DomainPolicy) => policy.id).sort()).toEqual(["dp-1", "dp-2"]);
  });

  it("should update existing policy when saving same tenant and domain", async () => {
    await store.save(
      createPolicy({ id: "dp-1", tenantId: "tenant-1", domain: "croco.dev", role: "member" }),
    );
    await store.save(
      createPolicy({ id: "dp-2", tenantId: "tenant-1", domain: "croco.dev", role: "viewer" }),
    );

    const policy = await store.findByTenantAndDomain("tenant-1", "croco.dev");

    expect(policy?.id).toBe("dp-2");
    expect(policy?.role).toBe("viewer");
  });

  it("should delete policy by tenant and domain", async () => {
    await store.save(createPolicy({ id: "dp-1", tenantId: "tenant-1", domain: "croco.dev" }));

    await store.delete("tenant-1", "croco.dev");

    const policy = await store.findByTenantAndDomain("tenant-1", "croco.dev");
    expect(policy).toBeNull();
  });

  it.each([
    [
      createPolicy({ id: "dp-delimiter-left", tenantId: "tenant:segment", domain: "example.com" }),
      createPolicy({ id: "dp-delimiter-right", tenantId: "tenant", domain: "segment:example.com" }),
    ],
    [
      createPolicy({ id: "dp-delimiter-right", tenantId: "tenant", domain: "segment:example.com" }),
      createPolicy({ id: "dp-delimiter-left", tenantId: "tenant:segment", domain: "example.com" }),
    ],
    [
      createPolicy({ id: "dp-unicode-left", tenantId: "조직:개발", domain: "例子.测试" }),
      createPolicy({ id: "dp-unicode-right", tenantId: "조직", domain: "개발:例子.测试" }),
    ],
  ])(
    "should keep delimiter-containing tuples distinct regardless of save order",
    async (first, second) => {
      await store.save(first);
      await store.save(second);

      await expect(store.findByTenantAndDomain(first.tenantId, first.domain)).resolves.toEqual(
        first,
      );
      await expect(store.findByTenantAndDomain(second.tenantId, second.domain)).resolves.toEqual(
        second,
      );

      await store.delete(first.tenantId, first.domain);

      await expect(store.findByTenantAndDomain(first.tenantId, first.domain)).resolves.toBeNull();
      await expect(store.findByTenantAndDomain(second.tenantId, second.domain)).resolves.toEqual(
        second,
      );
    },
  );

  it("should persist one semantic auto-join intent and replay its committed membership", async () => {
    const input = createAutoJoinIntent();
    const membership = {
      id: "membership-1",
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date("2026-01-01T00:01:00.000Z"),
      updatedAt: new Date("2026-01-01T00:01:00.000Z"),
    };

    await expect(store.createAutoJoinIntent(input)).resolves.toMatchObject({ created: true });
    await expect(store.createAutoJoinIntent(input)).resolves.toMatchObject({ created: false });
    await expect(
      store.completeAutoJoinMembership(input.tenantId, input.idempotencyKey, membership),
    ).resolves.toMatchObject({ membership });
    await expect(
      store.findAutoJoinIntent(input.tenantId, input.idempotencyKey),
    ).resolves.toMatchObject({ membership });
  });

  it("should lease, release, reclaim, and complete auto-join event delivery", async () => {
    const input = createAutoJoinIntent({
      membership: {
        id: "membership-1",
        tenantId: "tenant-1",
        userId: "user-1",
        role: "member",
        createdAt: new Date("2026-01-01T00:01:00.000Z"),
        updatedAt: new Date("2026-01-01T00:01:00.000Z"),
      },
    });
    await store.createAutoJoinIntent(input);

    await expect(
      store.claimAutoJoinEvent(
        input.tenantId,
        input.idempotencyKey,
        "claim-1",
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toMatchObject({ eventStatus: "processing", eventClaimId: "claim-1" });
    await expect(
      store.claimAutoJoinEvent(
        input.tenantId,
        input.idempotencyKey,
        "claim-2",
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toBeNull();

    await store.releaseAutoJoinEvent(input.tenantId, input.idempotencyKey, "claim-1");
    await expect(
      store.claimAutoJoinEvent(
        input.tenantId,
        input.idempotencyKey,
        "claim-2",
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toMatchObject({ eventClaimId: "claim-2" });
    await expect(
      store.completeAutoJoinEvent(input.tenantId, input.idempotencyKey, "claim-2"),
    ).resolves.toMatchObject({ eventStatus: "completed", eventClaimId: null });
  });

  it("should delete only auto-join intents without a committed membership", async () => {
    const pending = createAutoJoinIntent({ idempotencyKey: "pending" });
    const committed = createAutoJoinIntent({
      idempotencyKey: "committed",
      membership: {
        id: "membership-1",
        tenantId: "tenant-1",
        userId: "user-1",
        role: "member",
        createdAt: new Date("2026-01-01T00:01:00.000Z"),
        updatedAt: new Date("2026-01-01T00:01:00.000Z"),
      },
    });
    await store.createAutoJoinIntent(pending);
    await store.createAutoJoinIntent(committed);

    await store.deleteUncommittedAutoJoinIntent(pending.tenantId, pending.idempotencyKey);
    await store.deleteUncommittedAutoJoinIntent(committed.tenantId, committed.idempotencyKey);

    await expect(
      store.findAutoJoinIntent(pending.tenantId, pending.idempotencyKey),
    ).resolves.toBeNull();
    await expect(
      store.findAutoJoinIntent(committed.tenantId, committed.idempotencyKey),
    ).resolves.toMatchObject({ membership: committed.membership });
  });
});
