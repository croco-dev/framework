import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryInvitationStore } from "../libs/InMemoryInvitationStore";
import type { Invitation } from "../libs/types";

describe("InMemoryInvitationStore", () => {
  let store!: InMemoryInvitationStore;

  const createInvitation = (overrides: Partial<Invitation> = {}): Invitation => {
    return {
      id: overrides.id ?? "inv-1",
      tenantId: overrides.tenantId ?? "tenant-1",
      inviterId: overrides.inviterId ?? "user-1",
      email: overrides.email ?? "member@croco.dev",
      tokenHash: overrides.tokenHash ?? "hash-1",
      type: overrides.type ?? "email",
      role: overrides.role ?? "member",
      status: overrides.status ?? "pending",
      expiresAt: overrides.expiresAt ?? new Date("2026-01-10T00:00:00.000Z"),
      acceptedAt: overrides.acceptedAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
      createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    };
  };

  beforeEach(() => {
    store = new InMemoryInvitationStore();
  });

  it("should save and find invitation by id", async () => {
    await store.save(createInvitation());

    const invitation = await store.findById("inv-1");

    expect(invitation).not.toBeNull();
    expect(invitation?.id).toBe("inv-1");
    expect(invitation?.tokenHash).toBe("hash-1");
  });

  it("should find invitation by token hash", async () => {
    await store.save(createInvitation({ id: "inv-1", tokenHash: "token-hash-1" }));
    await store.save(createInvitation({ id: "inv-2", tokenHash: "token-hash-2" }));

    const invitation = await store.findByTokenHash("token-hash-2");

    expect(invitation?.id).toBe("inv-2");
  });

  it("should find invitation by tenant and email", async () => {
    await store.save(
      createInvitation({ id: "inv-1", tenantId: "tenant-1", email: "member-1@croco.dev" }),
    );
    await store.save(
      createInvitation({ id: "inv-2", tenantId: "tenant-2", email: "member-1@croco.dev" }),
    );

    const invitation = await store.findByTenantAndEmail("tenant-1", "member-1@croco.dev");

    expect(invitation?.id).toBe("inv-1");
  });

  it("should return all invitations by tenant", async () => {
    await store.save(createInvitation({ id: "inv-1", tenantId: "tenant-1" }));
    await store.save(createInvitation({ id: "inv-2", tenantId: "tenant-1" }));
    await store.save(createInvitation({ id: "inv-3", tenantId: "tenant-2" }));

    const invitations = await store.findAllByTenant("tenant-1");

    expect(invitations).toHaveLength(2);
    expect(invitations.map((invitation: Invitation) => invitation.id).sort()).toEqual([
      "inv-1",
      "inv-2",
    ]);
  });

  it("should update status of existing invitation", async () => {
    await store.save(createInvitation({ id: "inv-1", status: "pending" }));

    const updated = await store.updateStatus("tenant-1", "inv-1", "accepted");

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("accepted");
  });

  it("should return null when updating status of missing invitation", async () => {
    const updated = await store.updateStatus("tenant-1", "unknown", "revoked");

    expect(updated).toBeNull();
  });

  it("should preserve existing fields when updating status", async () => {
    await store.save(createInvitation({ id: "inv-1", email: "keep@croco.dev", status: "pending" }));

    const updated = await store.updateStatus("tenant-1", "inv-1", "declined");

    expect(updated?.email).toBe("keep@croco.dev");
    expect(updated?.status).toBe("declined");
  });

  it("should update existing invitation when saving same id", async () => {
    await store.save(createInvitation({ id: "inv-1", status: "pending" }));
    await store.save(createInvitation({ id: "inv-1", status: "revoked" }));

    const invitation = await store.findById("inv-1");

    expect(invitation?.status).toBe("revoked");
  });
});
