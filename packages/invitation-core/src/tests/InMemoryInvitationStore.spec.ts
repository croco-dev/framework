import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryInvitationStore } from "../libs/InMemoryInvitationStore";
import type { Invitation } from "../libs/types";

describe("InMemoryInvitationStore compareAndSetStatus", () => {
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    store = new InMemoryInvitationStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should count issued invitations across statuses with inclusive time and tenant boundaries", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    const statuses = ["creating", "pending", "accepted", "revoked", "declined", "expired"] as const;
    for (const status of statuses) {
      await store.save(createInvitation({ id: status, status, createdAt: since }));
    }
    await store.save(createInvitation({ id: "old", createdAt: new Date(since.getTime() - 1) }));
    await store.save(createInvitation({ id: "other", tenantId: "tenant-2", createdAt: since }));
    await store.save(createInvitation({ id: "new", createdAt: new Date(since.getTime() + 1) }));

    expect(await store.countIssuedByTenant("tenant-1", since)).toBe(7);
    expect(await store.countIssuedByTenant("tenant-2", since)).toBe(1);
    expect(await store.countIssuedByTenant("missing", since)).toBe(0);
    expect(await store.countPendingByTenant("tenant-1", since)).toBe(2);
  });

  it("should allow only one concurrent status transition from the expected status", async () => {
    const acceptedAt = new Date("2026-01-02T00:00:00.000Z");
    await store.save(createInvitation({ id: "inv-1", status: "pending" }));

    const results = await Promise.all([
      store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted", { acceptedAt }),
      store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted", { acceptedAt }),
    ]);

    const successful = results.filter((result): result is Invitation => result !== null);
    const failed = results.filter((result) => result === null);

    expect(successful).toHaveLength(1);
    expect(successful[0].status).toBe("accepted");
    expect(successful[0].acceptedAt).toEqual(acceptedAt);
    expect(failed).toHaveLength(1);
  });

  it("should reject acceptance at or after the invitation expiry", async () => {
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");
    await store.save(createInvitation({ expiresAt }));

    const result = await store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted", {
      acceptedAt: new Date(expiresAt),
    });

    expect(result).toBeNull();
    expect((await store.findById("inv-1"))?.status).toBe("pending");
  });

  it("should use the transition time when acceptedAt is omitted", async () => {
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    await store.save(createInvitation({ expiresAt: new Date("2026-01-02T00:00:00.000Z") }));

    await expect(
      store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted"),
    ).resolves.toBeNull();
  });

  it("should not let a supplied acceptance time bypass the transition time", async () => {
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");
    await store.save(createInvitation({ expiresAt }));
    vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));

    const result = await store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted", {
      acceptedAt: new Date("2026-01-01T23:59:59.999Z"),
    });

    expect(result).toBeNull();
    expect((await store.findById("inv-1"))?.status).toBe("pending");
  });

  it("should accept an invitation before its expiry", async () => {
    await store.save(createInvitation({ expiresAt: new Date("2026-01-02T00:00:00.000Z") }));
    const acceptedAt = new Date("2026-01-01T23:59:59.999Z");

    const result = await store.compareAndSetStatus("tenant-1", "inv-1", "pending", "accepted", {
      acceptedAt,
    });

    expect(result?.status).toBe("accepted");
    expect(result?.acceptedAt).toEqual(acceptedAt);
  });

  it("should revoke a pending invitation with the supplied revocation time", async () => {
    await store.save(createInvitation());
    const revokedAt = new Date("2026-01-05T00:00:00.000Z");

    const result = await store.compareAndSetStatus("tenant-1", "inv-1", "pending", "revoked", {
      revokedAt,
    });

    expect(result?.status).toBe("revoked");
    expect(result?.revokedAt).toEqual(revokedAt);
    expect(result?.acceptedAt).toBeNull();
  });

  it("should default revocation time to the transition time", async () => {
    await store.save(createInvitation());

    const result = await store.compareAndSetStatus("tenant-1", "inv-1", "pending", "revoked");

    expect(result?.status).toBe("revoked");
    expect(result?.revokedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("should preserve terminal invitations when sweeping expired creations", async () => {
    const acceptedAt = new Date("2025-12-30T12:00:00.000Z");
    const revokedAt = new Date("2025-12-30T13:00:00.000Z");
    const expiredAt = new Date("2025-12-31T00:00:00.000Z");
    const creationInput = (id: string, status: "creating" | "pending" = "creating") => ({
      invitation: createInvitation({ id, status, expiresAt: expiredAt }),
      token: `token-${id}`,
      idempotencyKey: id,
      requestFingerprint: "fingerprint",
      notificationIdempotencyKey: `notification-${id}`,
      notificationStatus: "completed" as const,
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "completed" as const,
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: `event-${id}`,
      eventOccurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await store.createEmailInvitation(creationInput("accepted"));
    await store.createEmailInvitation(creationInput("revoked"));
    await store.createEmailInvitation(creationInput("declined", "pending"));
    await store.save(
      createInvitation({
        id: "accepted",
        status: "accepted",
        expiresAt: expiredAt,
        acceptedAt,
      }),
    );
    await store.save(
      createInvitation({
        id: "revoked",
        status: "revoked",
        expiresAt: expiredAt,
        revokedAt,
      }),
    );
    await store.save(
      createInvitation({ id: "declined", status: "declined", expiresAt: expiredAt }),
    );

    const deleted = await store.deleteExpiredEmailInvitationCreations(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(deleted).toBe(3);
    expect((await store.findById("accepted"))?.status).toBe("accepted");
    expect((await store.findById("accepted"))?.acceptedAt).toEqual(acceptedAt);
    expect((await store.findById("revoked"))?.status).toBe("revoked");
    expect((await store.findById("revoked"))?.revokedAt).toEqual(revokedAt);
    expect((await store.findById("declined"))?.status).toBe("declined");
  });

  it("should expire pending creations while deleting their creation records", async () => {
    await store.createEmailInvitation({
      invitation: createInvitation({
        id: "pending",
        status: "pending",
        expiresAt: new Date("2025-12-31T00:00:00.000Z"),
      }),
      token: "token-pending",
      idempotencyKey: "pending",
      requestFingerprint: "fingerprint",
      notificationIdempotencyKey: "notification-pending",
      notificationStatus: "completed",
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "completed",
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: "event-pending",
      eventOccurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const deleted = await store.deleteExpiredEmailInvitationCreations(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(deleted).toBe(1);
    expect((await store.findById("pending"))?.status).toBe("expired");
    expect(await store.findEmailInvitationCreation("tenant-1", "pending")).toBeNull();
  });

  it("should expire creating invitations while deleting their creation records", async () => {
    await store.createEmailInvitation({
      invitation: createInvitation({
        id: "creating",
        status: "creating",
        expiresAt: new Date("2025-12-31T00:00:00.000Z"),
      }),
      token: "token-creating",
      idempotencyKey: "creating",
      requestFingerprint: "fingerprint",
      notificationIdempotencyKey: "notification-creating",
      notificationStatus: "completed",
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "completed",
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: "event-creating",
      eventOccurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const deleted = await store.deleteExpiredEmailInvitationCreations(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(deleted).toBe(1);
    expect((await store.findById("creating"))?.status).toBe("expired");
    expect(await store.findEmailInvitationCreation("tenant-1", "creating")).toBeNull();
  });

  it("should preserve a terminal invitation when creating a new invitation after expiry", async () => {
    const acceptedAt = new Date("2025-12-30T12:00:00.000Z");
    const expiredAt = new Date("2025-12-31T00:00:00.000Z");
    await store.createEmailInvitation({
      invitation: createInvitation({ id: "terminal", status: "creating", expiresAt: expiredAt }),
      token: "token-terminal",
      idempotencyKey: "terminal",
      requestFingerprint: "fingerprint",
      notificationIdempotencyKey: "notification-terminal",
      notificationStatus: "completed",
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "completed",
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: "event-terminal",
      eventOccurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await store.save(
      createInvitation({
        id: "terminal",
        status: "accepted",
        expiresAt: expiredAt,
        acceptedAt,
      }),
    );

    await store.createEmailInvitation({
      invitation: createInvitation({ id: "fresh", status: "creating" }),
      token: "token-fresh",
      idempotencyKey: "fresh",
      requestFingerprint: "fingerprint",
      notificationIdempotencyKey: "notification-fresh",
      notificationStatus: "completed",
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "completed",
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: "event-fresh",
      eventOccurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const deleted = await store.deleteExpiredEmailInvitationCreations(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(deleted).toBe(1);
    expect((await store.findById("terminal"))?.status).toBe("accepted");
    expect((await store.findById("terminal"))?.acceptedAt).toEqual(acceptedAt);
    expect((await store.findById("fresh"))?.status).toBe("creating");
  });

  it("should not overwrite a terminal invitation when reusing an expired idempotency key", async () => {
    const acceptedAt = new Date("2025-12-30T12:00:00.000Z");
    const expiredAt = new Date("2025-12-31T00:00:00.000Z");
    const creationInput = {
      invitation: createInvitation({ id: "reused", status: "creating", expiresAt: expiredAt }),
      token: "token-reused",
      idempotencyKey: "reused",
      requestFingerprint: "fingerprint",
      notificationIdempotencyKey: "notification-reused",
      notificationStatus: "completed" as const,
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
      eventStatus: "completed" as const,
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: "event-reused",
      eventOccurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    await store.createEmailInvitation(creationInput);
    await store.save(
      createInvitation({
        id: "reused",
        status: "accepted",
        expiresAt: expiredAt,
        acceptedAt,
      }),
    );

    await store.createEmailInvitation({
      ...creationInput,
      invitation: createInvitation({ id: "reused-retry", status: "creating" }),
      token: "token-reused-retry",
    });

    expect((await store.findById("reused"))?.status).toBe("accepted");
    expect((await store.findById("reused"))?.acceptedAt).toEqual(acceptedAt);
    expect((await store.findById("reused-retry"))?.status).toBe("creating");
  });
});
