import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryInvitationStore } from "../libs/InMemoryInvitationStore";
import type { Invitation } from "../libs/types";

type InvitationReader = (store: InMemoryInvitationStore) => Promise<Invitation | null>;

const mutateInvitation = (invitation: Invitation): void => {
  invitation.id = "mutated-invitation";
  invitation.tenantId = "mutated-tenant";
  invitation.inviterId = "mutated-inviter";
  invitation.email = "mutated@croco.dev";
  invitation.tokenHash = "mutated-token-hash";
  invitation.type = "link";
  invitation.role = "admin";
  invitation.status = "revoked";
  invitation.expiresAt.setTime(Date.parse("2040-01-01T00:00:00.000Z"));
  invitation.acceptedAt?.setTime(Date.parse("2040-01-02T00:00:00.000Z"));
  invitation.revokedAt?.setTime(Date.parse("2040-01-03T00:00:00.000Z"));
  invitation.createdAt.setTime(Date.parse("2040-01-04T00:00:00.000Z"));
};

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

  it("should isolate stored invitations from save inputs and outputs", async () => {
    const input = createInvitation({
      acceptedAt: new Date("2026-01-02T00:00:00.000Z"),
      revokedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    const expected = structuredClone(input);

    const saved = await store.save(input);
    mutateInvitation(input);

    expect(await store.findById(expected.id)).toEqual(expected);

    mutateInvitation(saved);

    const stored = await store.findById(expected.id);
    expect(stored).toEqual(expected);
    expect(stored).not.toBe(saved);
    expect(stored?.expiresAt).not.toBe(input.expiresAt);
    expect(stored?.acceptedAt).not.toBe(input.acceptedAt);
    expect(stored?.revokedAt).not.toBe(input.revokedAt);
    expect(stored?.createdAt).not.toBe(input.createdAt);
  });

  const readers: ReadonlyArray<readonly [string, InvitationReader]> = [
    ["findById", (invitationStore) => invitationStore.findById("inv-1")],
    ["findByTokenHash", (invitationStore) => invitationStore.findByTokenHash("hash-1")],
    [
      "findByTenantAndEmail",
      (invitationStore) => invitationStore.findByTenantAndEmail("tenant-1", "member@croco.dev"),
    ],
    [
      "findAllByTenant",
      async (invitationStore) => (await invitationStore.findAllByTenant("tenant-1"))[0] ?? null,
    ],
  ];

  it.each(readers)("should isolate %s outputs from stored invitations", async (_name, read) => {
    const original = createInvitation({
      acceptedAt: new Date("2026-01-02T00:00:00.000Z"),
      revokedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    const expected = structuredClone(original);
    await store.save(original);

    const result = await read(store);
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    mutateInvitation(result);

    expect(await store.findById(expected.id)).toEqual(expected);
  });

  it("should isolate updateStatus outputs from stored invitations", async () => {
    await store.save(
      createInvitation({
        acceptedAt: new Date("2026-01-02T00:00:00.000Z"),
        revokedAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
    );

    const updated = await store.updateStatus("tenant-1", "inv-1", "accepted");
    expect(updated).not.toBeNull();
    if (!updated) {
      return;
    }
    const expected = structuredClone(updated);
    mutateInvitation(updated);

    expect(await store.findById(expected.id)).toEqual(expected);
  });

  it("should isolate compare-and-set inputs and outputs from stored invitations", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));
      await store.save(
        createInvitation({
          acceptedAt: new Date("2026-01-02T00:00:00.000Z"),
          revokedAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
      );
      const acceptedAt = new Date("2026-01-04T00:00:00.000Z");

      const updated = await store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted", {
        acceptedAt,
      });
      expect(updated).not.toBeNull();
      if (!updated) {
        return;
      }
      const expected = structuredClone(updated);

      acceptedAt.setTime(Date.parse("2041-01-01T00:00:00.000Z"));
      mutateInvitation(updated);

      expect(await store.findById(expected.id)).toEqual(expected);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should replay one durable creation for a tenant-scoped idempotency key", async () => {
    const invitation = createInvitation({
      id: "inv-created",
      expiresAt: new Date("2099-01-10T00:00:00.000Z"),
    });
    const input = {
      invitation,
      token: "plaintext-token",
      idempotencyKey: "request-1",
      requestFingerprint: "fingerprint-1",
      notificationIdempotencyKey: "notification-1",
      notificationStatus: "pending" as const,
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "pending" as const,
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: "event-1",
      eventOccurredAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: new Date("2099-01-01T00:00:00.000Z"),
    };

    const first = await store.createEmailInvitation(input);
    const replay = await store.createEmailInvitation({
      ...input,
      invitation: createInvitation({ id: "ignored-invitation" }),
      token: "ignored-token",
    });

    expect(replay).toEqual(first);
    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);

    const notificationClaim = await store.claimEmailInvitationNotification(
      "tenant-1",
      "request-1",
      "notification-claim",
      new Date(Date.now() + 1_000),
    );
    const notificationCompleted = await store.completeEmailInvitationNotification(
      "tenant-1",
      "request-1",
      "notification-claim",
    );
    const eventClaim = await store.claimEmailInvitationEvent(
      "tenant-1",
      "request-1",
      "event-claim",
      new Date(Date.now() + 1_000),
    );
    const eventCompleted = await store.completeEmailInvitationEvent(
      "tenant-1",
      "request-1",
      "event-claim",
    );
    expect(notificationClaim?.notificationStatus).toBe("processing");
    expect(notificationCompleted?.notificationStatus).toBe("completed");
    expect(eventClaim?.eventStatus).toBe("processing");
    expect(eventCompleted?.eventStatus).toBe("completed");
    expect((await store.activateEmailInvitation("tenant-1", "request-1"))?.invitation.status).toBe(
      "pending",
    );
  });
});
