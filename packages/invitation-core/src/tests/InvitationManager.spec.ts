import "reflect-metadata";
import { inspect } from "node:util";
import type { EventPublisher } from "@croco/events-core";
import type { Membership, MembershipManager } from "@croco/membership-core";
import {
  createNotificationIdempotencyKey,
  NotificationChannel,
  type NotificationService,
} from "@croco/notifications-core";
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
  InvitationCreationFailedProblem,
  InvitationEmailMismatchProblem,
  InvitationExpiredProblem,
  InvitationIdempotencyConflictProblem,
  InvitationInvalidStatusProblem,
  InvitationNotFoundProblem,
} from "../libs/problems/InvitationProblems";
import { hashToken } from "../libs/token";
import type { Invitation } from "../libs/types";

describe("InvitationManager", () => {
  let manager!: InvitationManager;
  let store!: InMemoryInvitationStore;
  let publishNow!: ReturnType<typeof vi.fn>;
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
    publishNow = vi.fn();
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
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher,
      txManager as TxManager<unknown>,
    );
  });

  it("should create email invitation with hashed token and send notification", async () => {
    const token = await manager.createEmailInvitation({
      idempotencyKey: "create-member-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "Member@Croco.Dev",
      role: "member",
    });

    const invitation = await store.findByTenantAndEmail("tenant-1", "member@croco.dev");

    expect(invitation).not.toBeNull();
    if (invitation === null) {
      throw new Error("Invitation was not created");
    }

    const preferenceContext = {
      tenantId: "tenant-1",
      userId: "member@croco.dev",
      channel: NotificationChannel.EMAIL,
      topic: "invitation.created",
    };

    expect(invitation?.tokenHash).toBe(hashToken(token));
    expect(invitation?.tokenHash).not.toBe(token);
    expect(send).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      expect.objectContaining({
        to: "member@croco.dev",
      }),
      {
        idempotencyKey: createNotificationIdempotencyKey({
          ...preferenceContext,
          recipient: "member@croco.dev",
          semanticKey: "create-member-1",
        }),
        preferenceContext,
        requireProviderIdempotency: true,
      },
    );
    expect(publishNow).toHaveBeenCalledWith(expect.any(InvitationCreatedEvent));
  });

  it("should retry the durable event intent without sending the notification again", async () => {
    send.mockResolvedValue(undefined);
    publishNow.mockRejectedValueOnce(new Error("publish failed"));

    const input = {
      idempotencyKey: "event-failure-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "member@croco.dev",
      role: "member" as const,
    };

    await expect(manager.createEmailInvitation(input)).rejects.toMatchObject({
      extensions: { phase: "event", retrySafe: true },
    });
    const token = await manager.createEmailInvitation(input);

    const invitation = await store.findByTokenHash(hashToken(token));
    expect(invitation?.status).toBe("pending");
    expect(send).toHaveBeenCalledTimes(1);
    expect(publishNow).toHaveBeenCalledTimes(2);
    const firstEvent = publishNow.mock.calls[0]?.[0] as InvitationCreatedEvent;
    const secondEvent = publishNow.mock.calls[1]?.[0] as InvitationCreatedEvent;
    expect(secondEvent.eventId).toBe(firstEvent.eventId);
  });

  it("should stop before notification when a stale event owner cannot complete its claim", async () => {
    vi.spyOn(store, "completeEmailInvitationEvent").mockResolvedValueOnce(null);

    await expect(
      manager.createEmailInvitation({
        idempotencyKey: "stale-event-owner-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "member@croco.dev",
        role: "member",
      }),
    ).rejects.toMatchObject({
      extensions: { phase: "event", retrySafe: true },
    });

    expect(publishNow).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    expect((await store.findAllByTenant("tenant-1"))[0]?.status).toBe("creating");
  });

  it("should keep a retryable delivery intent without exposing the token in its Problem", async () => {
    send.mockImplementationOnce(async (_channel, payload) => {
      throw new Error(`delivery failed for ${payload.content}`);
    });

    const result = manager.createEmailInvitation({
      idempotencyKey: "notification-failure-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "member@croco.dev",
      role: "member",
    });

    const error = await result.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(InvitationCreationFailedProblem);

    const invitations = await store.findAllByTenant("tenant-1");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.status).toBe("creating");
    expect(JSON.stringify(error)).not.toContain("Use this invitation token");
    expect(inspect(error)).not.toContain("Use this invitation token");
    expect(error).toMatchObject({
      cause: undefined,
      code: "INVITATION_CREATION_FAILED",
      extensions: {
        phase: "notification",
        retrySafe: true,
      },
    });
  });

  it("should replay the same token and notification key when delivery acknowledgement is lost", async () => {
    let firstContent = "";
    send
      .mockImplementationOnce(async (_channel, payload) => {
        firstContent = payload.content;
        const deliveredToken = payload.content.replace("Use this invitation token: ", "");
        await expect(
          manager.acceptInvitation({
            token: deliveredToken,
            userId: "recipient-1",
            email: "member@croco.dev",
          }),
        ).rejects.toBeInstanceOf(InvitationInvalidStatusProblem);
        throw new Error("delivery acknowledgement lost");
      })
      .mockResolvedValue(undefined);

    const input = {
      idempotencyKey: "retry-member-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "member@croco.dev",
      role: "member" as const,
    };

    await expect(manager.createEmailInvitation(input)).rejects.toBeInstanceOf(
      InvitationCreationFailedProblem,
    );
    const token = await manager.createEmailInvitation(input);

    const invitations = await store.findAllByTenant("tenant-1");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.tokenHash).toBe(hashToken(token));
    expect(invitations[0]?.status).toBe("pending");
    expect(send).toHaveBeenCalledTimes(2);
    expect(firstContent).toContain(token);
    expect(send.mock.calls[1]?.[1].content).toBe(firstContent);
    expect(send.mock.calls[1]?.[2].idempotencyKey).toBe(send.mock.calls[0]?.[2].idempotencyKey);
    expect(addMember).not.toHaveBeenCalled();
  });

  it("should replay a completed creation after a successful response is lost", async () => {
    const input = {
      idempotencyKey: "successful-response-lost-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "member@croco.dev",
      role: "member" as const,
    };

    const firstToken = await manager.createEmailInvitation(input);
    const replayedToken = await manager.createEmailInvitation(input);

    expect(replayedToken).toBe(firstToken);
    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(publishNow).toHaveBeenCalledTimes(1);
  });

  it("should claim concurrent delivery so only one caller executes side effects", async () => {
    let releaseDelivery!: () => void;
    const delivery = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    send.mockImplementation(() => delivery);
    const input = {
      idempotencyKey: "concurrent-create-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "member@croco.dev",
      role: "member" as const,
    };

    const firstRequest = manager.createEmailInvitation(input);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const secondRequest = manager.createEmailInvitation(input);
    await expect(secondRequest).rejects.toMatchObject({
      extensions: { phase: "notification", retrySafe: true },
    });
    releaseDelivery();
    const firstToken = await firstRequest;

    expect(firstToken).toBeTypeOf("string");
    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    const eventIds = publishNow.mock.calls.map(
      ([event]) => (event as InvitationCreatedEvent).eventId,
    );
    expect(new Set(eventIds)).toEqual(new Set([eventIds[0]]));
  });

  it("should recover an atomically persisted creation after its acknowledgement is lost", async () => {
    const create = store.createEmailInvitation.bind(store);
    vi.spyOn(store, "createEmailInvitation")
      .mockImplementationOnce(async (input) => {
        await create(input);
        throw new Error("commit acknowledgement lost");
      })
      .mockImplementation(create);
    const input = {
      idempotencyKey: "persistence-ack-lost-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "member@croco.dev",
      role: "member" as const,
    };

    await expect(manager.createEmailInvitation(input)).rejects.toMatchObject({
      cause: undefined,
      extensions: { phase: "persistence", retrySafe: true },
    });
    const token = await manager.createEmailInvitation(input);

    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
    expect(await store.findByTokenHash(hashToken(token))).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("should atomically retire an expired replay even when best-effort cleanup fails", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const input = {
        idempotencyKey: "expired-replay-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "member@croco.dev",
        role: "member" as const,
        expiresInDays: 1,
      };
      const firstToken = await manager.createEmailInvitation(input);
      const firstInvitation = await store.findByTokenHash(hashToken(firstToken));

      vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));
      vi.spyOn(store, "deleteExpiredEmailInvitationCreations").mockRejectedValueOnce(
        new Error("cleanup unavailable"),
      );
      const replacementToken = await manager.createEmailInvitation(input);

      expect(replacementToken).not.toBe(firstToken);
      expect((await store.findById(firstInvitation?.id ?? ""))?.status).toBe("expired");
      expect((await store.findByTokenHash(hashToken(replacementToken)))?.status).toBe("pending");
    } finally {
      vi.useRealTimers();
    }
  });

  it("should reject reuse of an idempotency key for different invitation input", async () => {
    await manager.createEmailInvitation({
      idempotencyKey: "conflicting-request-1",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "first@croco.dev",
      role: "member",
    });

    await expect(
      manager.createEmailInvitation({
        idempotencyKey: "conflicting-request-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "second@croco.dev",
        role: "member",
      }),
    ).rejects.toBeInstanceOf(InvitationIdempotencyConflictProblem);
    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
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
    expect(publishNow).toHaveBeenCalledWith(expect.any(InvitationAcceptedEvent));
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
    publishNow.mockRejectedValueOnce(new Error("accept publish failed"));

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

  it("should not expose an unknown bearer token in the serialized Problem", async () => {
    const token = "missing-secret-bearer-token";

    const problem = await manager
      .acceptInvitation({
        token,
        userId: "user-1",
        email: "user@croco.dev",
      })
      .catch((error: unknown) => error);

    expect(problem).toBeInstanceOf(InvitationNotFoundProblem);
    if (!(problem instanceof InvitationNotFoundProblem)) {
      throw problem;
    }

    expect(problem.message).toBe("Invitation not found");
    expect(problem.detail).toBe("Invitation not found");
    expect(problem.extensions).toBeUndefined();
    expect(problem.toJSON()).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Invitation not found",
      code: "INVITATION_NOT_FOUND",
    });
    expect(problem.stack ?? "").not.toContain(token);
    expect(JSON.stringify(problem)).not.toContain(token);
    expect(inspect(problem)).not.toContain(token);
  });

  it("should ignore identifiers passed to InvitationNotFoundProblem by legacy callers", () => {
    const identifier = "legacy-secret-bearer-token";
    const problem = new InvitationNotFoundProblem(identifier);

    expect(problem.message).toBe("Invitation not found");
    expect(problem.extensions).toBeUndefined();
    expect(JSON.stringify(problem)).not.toContain(identifier);
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
    expect(publishNow).toHaveBeenCalledWith(expect.any(InvitationDeclinedEvent));
  });

  it("should revoke invitation by id", async () => {
    await store.save(createInvitation("revoke-token", { id: "inv-revoke" }));

    const revoked = await manager.revokeInvitation("inv-revoke");

    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedAt).not.toBeNull();
    expect(publishNow).toHaveBeenCalledWith(expect.any(InvitationRevokedEvent));
  });

  it("should resend invitation by revoking old one and issuing a new token", async () => {
    await store.save(createInvitation("old-token", { id: "inv-old" }));

    const newToken = await manager.resendInvitation("inv-old");
    const oldInvitation = await store.findById("inv-old");
    const newInvitation = await store.findByTokenHash(hashToken(newToken));

    expect(oldInvitation?.status).toBe("revoked");
    expect(newInvitation).not.toBeNull();
    if (newInvitation === null) {
      throw new Error("Resent invitation was not created");
    }

    const preferenceContext = {
      tenantId: "tenant-1",
      userId: "member@croco.dev",
      channel: NotificationChannel.EMAIL,
      topic: "invitation.created",
    };

    expect(newInvitation.id).not.toBe("inv-old");
    expect(send).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      expect.objectContaining({
        to: "member@croco.dev",
      }),
      {
        idempotencyKey: expect.stringContaining(
          "notification:tenant-1:member%40croco.dev:EMAIL:invitation.created",
        ),
        preferenceContext,
        requireProviderIdempotency: true,
      },
    );
    expect(publishNow).toHaveBeenCalledWith(expect.any(InvitationRevokedEvent));
    expect(publishNow).toHaveBeenCalledWith(expect.any(InvitationCreatedEvent));
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
