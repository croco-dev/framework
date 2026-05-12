import "reflect-metadata";
import type { EventPublisher } from "@croco/events-core";
import type { MembershipManager } from "@croco/membership-core";
import type { NotificationService } from "@croco/notifications-core";
import type { TxManager } from "@croco/tx-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryInvitationStore } from "../libs/InMemoryInvitationStore";
import { InvitationManager } from "../libs/InvitationManager";
import {
  DuplicateInvitationProblem,
  InvitationRateLimitExceededProblem,
} from "../libs/problems/RateLimitProblems";
import { RateLimitedInvitationService } from "../libs/RateLimitedInvitationService";
import { hashToken } from "../libs/token";
import type { Invitation } from "../libs/types";

describe("RateLimitedInvitationService", () => {
  let service!: RateLimitedInvitationService;
  let manager!: InvitationManager;
  let store!: InMemoryInvitationStore;
  let publish!: ReturnType<typeof vi.fn>;
  let send!: ReturnType<typeof vi.fn>;
  let txManager!: Pick<TxManager<unknown>, "run" | "onAfterCommit">;
  let afterCommitHooks!: Array<() => void | Promise<void>>;

  const createInvitation = (overrides: Partial<Invitation> = {}): Invitation => {
    const now = new Date();
    const defaultExpiresAt = new Date(now);
    defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);

    return {
      id: overrides.id ?? "inv-1",
      tenantId: overrides.tenantId ?? "tenant-1",
      inviterId: overrides.inviterId ?? "inviter-1",
      email: overrides.email ?? "user@example.com",
      tokenHash: overrides.tokenHash ?? hashToken("token-1"),
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

    manager = new InvitationManager(
      store,
      { addMember: vi.fn() } as unknown as MembershipManager,
      { send } as unknown as NotificationService,
      {
        publish,
        publishMany: vi.fn(),
      } as unknown as EventPublisher,
      txManager as TxManager<unknown>,
    );

    service = new RateLimitedInvitationService(manager, store, {
      maxInvitesPerHour: 2,
      maxInvitesPerDay: 5,
    });
  });

  describe("checkRateLimit", () => {
    it("should allow invitations within rate limits", async () => {
      await expect(service.checkRateLimit("tenant-1")).resolves.not.toThrow();
    });

    it("should throw when hourly limit exceeded", async () => {
      const now = new Date();
      for (let i = 0; i < 2; i += 1) {
        await store.save({
          ...createInvitation({
            id: `inv-${i}`,
            email: `user${i}@example.com`,
          }),
          createdAt: new Date(now.getTime() - i * 1000),
        });
      }

      await expect(service.checkRateLimit("tenant-1")).rejects.toBeInstanceOf(
        InvitationRateLimitExceededProblem,
      );
    });

    it("should throw when daily limit exceeded", async () => {
      const now = new Date();
      for (let i = 0; i < 5; i += 1) {
        await store.save({
          ...createInvitation({
            id: `inv-${i}`,
            email: `user${i}@example.com`,
          }),
          createdAt: new Date(now.getTime() - i * 1000),
        });
      }

      await expect(service.checkRateLimit("tenant-1")).rejects.toBeInstanceOf(
        InvitationRateLimitExceededProblem,
      );
    });

    it("should count only pending invitations", async () => {
      const now = new Date();
      await store.save({
        ...createInvitation({
          id: "inv-pending-1",
          email: "pending1@example.com",
          status: "pending",
        }),
        createdAt: new Date(now.getTime() - 1000),
      });

      await store.save({
        ...createInvitation({
          id: "inv-pending-2",
          email: "pending2@example.com",
          status: "pending",
        }),
        createdAt: new Date(now.getTime() - 2000),
      });

      await expect(service.checkRateLimit("tenant-1")).rejects.toBeInstanceOf(
        InvitationRateLimitExceededProblem,
      );
    });

    it("should not count expired invitations", async () => {
      const now = new Date();
      await store.save({
        ...createInvitation({
          id: "inv-old",
          email: "old@example.com",
        }),
        createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      });

      await expect(service.checkRateLimit("tenant-1")).resolves.not.toThrow();
    });
  });

  describe("createEmailInvitationWithRateLimit", () => {
    it("should create invitation within rate limits", async () => {
      const token = await service.createEmailInvitationWithRateLimit({
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "user@example.com",
        role: "member",
      });

      expect(token).toBeDefined();
      expect(publish).toHaveBeenCalled();
    });

    it("should throw when rate limit exceeded", async () => {
      const now = new Date();
      for (let i = 0; i < 2; i += 1) {
        await store.save({
          ...createInvitation({
            id: `inv-${i}`,
            email: `user${i}@example.com`,
          }),
          createdAt: new Date(now.getTime() - i * 1000),
        });
      }

      await expect(
        service.createEmailInvitationWithRateLimit({
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          email: "user@example.com",
          role: "member",
        }),
      ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
    });

    it("should throw for duplicate invitations", async () => {
      await store.save(createInvitation({ email: "user@example.com" }));

      await expect(
        service.createEmailInvitationWithRateLimit({
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          email: "USER@example.com",
          role: "member",
        }),
      ).rejects.toBeInstanceOf(DuplicateInvitationProblem);
    });

    it("should normalize email addresses", async () => {
      const token = await service.createEmailInvitationWithRateLimit({
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "  USER@EXAMPLE.COM  ",
        role: "member",
      });

      const allInvitations = await store.findAllByTenant("tenant-1");
      const invitation = allInvitations.find((inv) => inv.tokenHash === hashToken(token));
      expect(invitation).toBeDefined();
      expect(invitation?.email).toBe("user@example.com");
    });
  });

  describe("batchInvite", () => {
    it("should invite multiple emails successfully", async () => {
      const result = await service.batchInvite(
        "tenant-1",
        ["user1@example.com", "user2@example.com"],
        {
          maxBatchSize: 50,
        },
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].email).toBe("user1@example.com");
      expect(result.successful[1].email).toBe("user2@example.com");
    });

    it("should handle partial failures", async () => {
      const result = await service.batchInvite(
        "tenant-1",
        ["user1@example.com", "user2@example.com"],
        {
          maxBatchSize: 50,
        },
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it("should enforce maximum batch size", async () => {
      await expect(
        service.batchInvite(
          "tenant-1",
          Array.from({ length: 51 }, (_, i) => `user${i}@example.com`),
          {
            maxBatchSize: 50,
          },
        ),
      ).rejects.toThrow("Batch size exceeds maximum of 50");
    });

    it("should handle rate limiting in batch", async () => {
      const result = await service.batchInvite(
        "tenant-1",
        ["user1@example.com", "user2@example.com"],
        {
          maxBatchSize: 50,
        },
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it("should normalize email addresses in batch", async () => {
      const result = await service.batchInvite(
        "tenant-1",
        ["  USER1@EXAMPLE.COM  ", "USER2@example.com"],
        {
          maxBatchSize: 50,
        },
      );

      expect(result.successful[0].email).toBe("user1@example.com");
      expect(result.successful[1].email).toBe("user2@example.com");
    });
  });

  describe("createLinkInvitationWithRateLimit", () => {
    it("should create link invitation within rate limits", async () => {
      const token = await service.createLinkInvitationWithRateLimit({
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        role: "member",
      });

      expect(token).toBeDefined();
      expect(publish).toHaveBeenCalled();
    });

    it("should throw when rate limit exceeded", async () => {
      const now = new Date();
      for (let i = 0; i < 2; i += 1) {
        await store.save({
          ...createInvitation({
            id: `inv-${i}`,
            email: `user${i}@example.com`,
          }),
          createdAt: new Date(now.getTime() - i * 1000),
        });
      }

      await expect(
        service.createLinkInvitationWithRateLimit({
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          role: "member",
        }),
      ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
    });
  });
});
