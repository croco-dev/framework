import "reflect-metadata";
import type { EventPublisher } from "@croco/events-core";
import type { Membership, MembershipManager } from "@croco/membership-core";
import { NotificationChannel, type NotificationService } from "@croco/notifications-core";
import type { TxManager } from "@croco/tx-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvitationAcceptedEvent,
  InvitationCreatedEvent,
  InvitationDeclinedEvent,
  InvitationRevokedEvent,
} from "../libs/events/InvitationEvents";
import { InMemoryInvitationStore } from "../libs/InMemoryInvitationStore";
import { InvitationManager } from "../libs/InvitationManager";
import {
  InvitationAlreadyAcceptedProblem,
  InvitationEmailMismatchProblem,
  InvitationExpiredProblem,
  InvitationInvalidStatusProblem,
  InvitationNotFoundProblem,
} from "../libs/problems/InvitationProblems";
import { hashToken } from "../libs/token";
import type { Invitation } from "../libs/types";

describe("InvitationManager", () => {
  let manager!: InvitationManager;
  let store!: InMemoryInvitationStore;
  let publish!: ReturnType<typeof vi.fn>;
  let addMember!: ReturnType<typeof vi.fn>;
  let send!: ReturnType<typeof vi.fn>;
  let txManager!: Pick<TxManager<unknown>, "run" | "onAfterCommit">;
  let afterCommitHooks!: Array<() => void | Promise<void>>;
  let sequence = 0;

  const createInvitation = (token: string, overrides: Partial<Invitation> = {}): Invitation => {
    sequence += 1;
    const now = new Date();
    const defaultExpiresAt = new Date(now);
    defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);

    return {
      id: overrides.id ?? `inv-${sequence}`,
      tenantId: overrides.tenantId ?? "tenant-1",
      inviterId: overrides.inviterId ?? "inviter-1",
      email: overrides.email ?? "member@croco.dev",
      tokenHash: overrides.tokenHash ?? hashToken(token),
      type: overrides.type ?? "email",
      role: overrides.role ?? "member",
      status: overrides.status ?? "pending",
      expiresAt: overrides.expiresAt ?? defaultExpiresAt,
      acceptedAt: overrides.acceptedAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
      createdAt: overrides.createdAt ?? now,
    };
  };

  beforeEach(() => {
    store = new InMemoryInvitationStore();
    publish = vi.fn();
    addMember = vi.fn();
    send = vi.fn();
    afterCommitHooks = [];
    txManager = {
      async run<T>(fn: () => Promise<T>): Promise<T> {
        afterCommitHooks = [];
        const result = await fn();
        for (const hook of afterCommitHooks) {
          await hook();
        }
        return result;
      },
      onAfterCommit: vi.fn((hook: () => void | Promise<void>) => {
        afterCommitHooks.push(hook);
      }),
    };
    sequence = 0;

    manager = new InvitationManager(
      store,
      { addMember } as unknown as MembershipManager,
      { send } as unknown as NotificationService,
      {
        publish,
        publishMany: vi.fn(),
      } as unknown as EventPublisher,
      txManager as TxManager<unknown>,
    );
  });

  it("should create email invitation with hashed token and send notification", async () => {
    const token = await manager.createEmailInvitation({
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "Member@Croco.Dev",
      role: "member",
    });

    const invitation = await store.findByTenantAndEmail("tenant-1", "member@croco.dev");

    expect(invitation).not.toBeNull();
    expect(invitation?.tokenHash).toBe(hashToken(token));
    expect(invitation?.tokenHash).not.toBe(token);
    expect(send).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      expect.objectContaining({
        to: "member@croco.dev",
      }),
    );
    expect(publish).toHaveBeenCalledWith(expect.any(InvitationCreatedEvent));
  });

  it("should propagate event publication failures when creating email invitation", async () => {
    send.mockResolvedValue(undefined);
    publish.mockRejectedValueOnce(new Error("publish failed"));

    await expect(
      manager.createEmailInvitation({
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "member@croco.dev",
        role: "member",
      }),
    ).rejects.toThrow("publish failed");
  });

  it("should create link invitation without sending notification", async () => {
    const token = await manager.createLinkInvitation({
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      role: "member",
    });

    const invitation = await store.findByTokenHash(hashToken(token));

    expect(invitation).not.toBeNull();
    expect(invitation?.type).toBe("link");
    expect(invitation?.email).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("should accept email invitation and create membership", async () => {
    await store.save(createInvitation("accept-email-token"));

    const membership: Membership = {
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    addMember.mockResolvedValue(membership);

    const accepted = await manager.acceptInvitation({
      token: "accept-email-token",
      userId: "user-1",
      email: "MEMBER@CROCO.DEV",
    });

    expect(addMember).toHaveBeenCalledWith("tenant-1", "user-1", "member");
    expect(accepted.status).toBe("accepted");
    expect(accepted.acceptedAt).not.toBeNull();
    expect(publish).toHaveBeenCalledWith(expect.any(InvitationAcceptedEvent));
  });

  it("should propagate event publication failures when accepting invitation", async () => {
    await store.save(createInvitation("accept-fail-token"));

    const membership: Membership = {
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    addMember.mockResolvedValue(membership);
    publish.mockRejectedValueOnce(new Error("accept publish failed"));

    await expect(
      manager.acceptInvitation({
        token: "accept-fail-token",
        userId: "user-1",
        email: "member@croco.dev",
      }),
    ).rejects.toThrow("accept publish failed");
  });

  it("should accept link invitation without email match check", async () => {
    await store.save(
      createInvitation("accept-link-token", {
        type: "link",
        email: null,
      }),
    );

    addMember.mockResolvedValue({
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-2",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as Membership);

    const accepted = await manager.acceptInvitation({
      token: "accept-link-token",
      userId: "user-2",
    });

    expect(addMember).toHaveBeenCalledWith("tenant-1", "user-2", "member");
    expect(accepted.status).toBe("accepted");
  });

  it("should throw InvitationNotFoundProblem when token is unknown", async () => {
    await expect(
      manager.acceptInvitation({
        token: "missing-token",
        userId: "user-1",
        email: "user@croco.dev",
      }),
    ).rejects.toBeInstanceOf(InvitationNotFoundProblem);
  });

  it("should mark invitation expired and throw InvitationExpiredProblem", async () => {
    const invitation = createInvitation("expired-token", {
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await store.save(invitation);

    await expect(
      manager.acceptInvitation({
        token: "expired-token",
        userId: "user-1",
        email: "member@croco.dev",
      }),
    ).rejects.toBeInstanceOf(InvitationExpiredProblem);

    const expired = await store.findById(invitation.id);
    expect(expired?.status).toBe("expired");
  });

  it("should throw InvitationAlreadyAcceptedProblem for accepted invitation", async () => {
    await store.save(
      createInvitation("accepted-token", {
        status: "accepted",
        acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );

    await expect(
      manager.acceptInvitation({
        token: "accepted-token",
        userId: "user-1",
        email: "member@croco.dev",
      }),
    ).rejects.toBeInstanceOf(InvitationAlreadyAcceptedProblem);
  });

  it("should allow only one concurrent accept attempt to create membership", async () => {
    await store.save(createInvitation("concurrent-token"));

    addMember.mockResolvedValue({
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as Membership);

    const results = await Promise.allSettled([
      manager.acceptInvitation({
        token: "concurrent-token",
        userId: "user-1",
        email: "member@croco.dev",
      }),
      manager.acceptInvitation({
        token: "concurrent-token",
        userId: "user-2",
        email: "member@croco.dev",
      }),
    ]);

    const accepted = results.find((result) => result.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(accepted?.status === "fulfilled" ? accepted.value.status : null).toBe("accepted");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toBeInstanceOf(
      InvitationAlreadyAcceptedProblem,
    );
    expect(addMember).toHaveBeenCalledTimes(1);
  });

  it("should throw InvitationEmailMismatchProblem when email does not match", async () => {
    await store.save(createInvitation("mismatch-token", { email: "member@croco.dev" }));

    await expect(
      manager.acceptInvitation({
        token: "mismatch-token",
        userId: "user-1",
        email: "other@croco.dev",
      }),
    ).rejects.toBeInstanceOf(InvitationEmailMismatchProblem);
  });

  it("should throw InvitationInvalidStatusProblem when invitation is revoked", async () => {
    await store.save(
      createInvitation("revoked-token", {
        status: "revoked",
        revokedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );

    await expect(
      manager.acceptInvitation({
        token: "revoked-token",
        userId: "user-1",
        email: "member@croco.dev",
      }),
    ).rejects.toBeInstanceOf(InvitationInvalidStatusProblem);
  });

  it("should decline pending invitation", async () => {
    await store.save(createInvitation("decline-token"));

    const declined = await manager.declineInvitation("decline-token");

    expect(declined.status).toBe("declined");
    expect(publish).toHaveBeenCalledWith(expect.any(InvitationDeclinedEvent));
  });

  it("should revoke invitation by id", async () => {
    await store.save(createInvitation("revoke-token", { id: "inv-revoke" }));

    const revoked = await manager.revokeInvitation("inv-revoke");

    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedAt).not.toBeNull();
    expect(publish).toHaveBeenCalledWith(expect.any(InvitationRevokedEvent));
  });

  it("should resend invitation by revoking old one and issuing a new token", async () => {
    await store.save(createInvitation("old-token", { id: "inv-old" }));

    const newToken = await manager.resendInvitation("inv-old");
    const oldInvitation = await store.findById("inv-old");
    const newInvitation = await store.findByTokenHash(hashToken(newToken));

    expect(oldInvitation?.status).toBe("revoked");
    expect(newInvitation).not.toBeNull();
    expect(newInvitation?.id).not.toBe("inv-old");
    expect(send).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      expect.objectContaining({
        to: "member@croco.dev",
      }),
    );
    expect(publish).toHaveBeenCalledWith(expect.any(InvitationRevokedEvent));
    expect(publish).toHaveBeenCalledWith(expect.any(InvitationCreatedEvent));
  });

  it("should throw InvitationInvalidStatusProblem when resending accepted invitation", async () => {
    await store.save(
      createInvitation("accepted-resend-token", {
        id: "inv-accepted",
        status: "accepted",
        acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );

    await expect(manager.resendInvitation("inv-accepted")).rejects.toBeInstanceOf(
      InvitationInvalidStatusProblem,
    );
  });
});
