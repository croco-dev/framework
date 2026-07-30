import "reflect-metadata";
import type { EntitlementQuotaStatus } from "@croco/entitlements-core";
import { EventAfterCommitRequiresActiveTransactionProblem } from "@croco/events-core";
import type { EventPublisher } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipCreatedEvent } from "../libs/events/MembershipCreatedEvent";
import { MembershipRemovedEvent } from "../libs/events/MembershipRemovedEvent";
import { MembershipUpdatedEvent } from "../libs/events/MembershipUpdatedEvent";
import { InMemoryMembershipStore } from "../libs/InMemoryMembershipStore";
import { MembershipManager } from "../libs/MembershipManager";
import { LastOwnerCannotBeRemovedProblem } from "../libs/problems/LastOwnerCannotBeRemovedProblem";
import {
  AlreadyMemberProblem,
  InvalidRoleProblem,
  LastOwnerProblem,
  MembershipNotFoundProblem,
  OwnershipTransferRequiredProblem,
  SeatLimitExceededProblem,
} from "../libs/problems/MembershipProblems";
import type { SeatLimitChecker } from "../libs/SeatLimitChecker";
import type { Membership, MembershipCreateInput, MembershipRole } from "../libs/types";

class StaleRoleReadStore extends InMemoryMembershipStore {
  private pauseNextRoleRead = true;
  private release: (() => void) | undefined;
  private readonly barrier = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  private signalRead: (() => void) | undefined;
  private readonly readReached = new Promise<void>((resolve) => {
    this.signalRead = resolve;
  });

  override async findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null> {
    const membership = await super.findByTenantAndUser(tenantId, userId);
    if (userId === "user-2" && this.pauseNextRoleRead) {
      this.pauseNextRoleRead = false;
      this.signalRead?.();
      await this.barrier;
    }
    return membership;
  }

  waitForRoleRead(): Promise<void> {
    return this.readReached;
  }

  releaseRoleRead(): void {
    this.release?.();
  }
}

describe("MembershipManager", () => {
  let manager!: MembershipManager;
  let store!: InMemoryMembershipStore;
  let publishNow!: ReturnType<typeof vi.fn>;

  const createInput = (overrides: Partial<MembershipCreateInput> = {}): MembershipCreateInput => {
    return {
      id: overrides.id ?? "mem-1",
      tenantId: overrides.tenantId ?? "tenant-1",
      userId: overrides.userId ?? "user-1",
      role: overrides.role ?? "member",
    };
  };

  const seedMembership = async (overrides: Partial<MembershipCreateInput> = {}): Promise<void> => {
    await store.save(createInput(overrides));
  };

  beforeEach(() => {
    Container.reset();

    store = new InMemoryMembershipStore();
    publishNow = vi.fn();

    manager = new MembershipManager(store, {
      publishAfterCommit: vi.fn(() => {
        throw new EventAfterCommitRequiresActiveTransactionProblem();
      }),
      publishNow,
      publishMany: vi.fn(),
    } as unknown as EventPublisher);
  });

  describe("addMember", () => {
    it("should add member and publish MembershipCreatedEvent", async () => {
      const membership = await manager.addMember("tenant-1", "user-1", "member");

      expect(membership.tenantId).toBe("tenant-1");
      expect(membership.userId).toBe("user-1");
      expect(membership.role).toBe("member");
      expect(publishNow).toHaveBeenCalledWith(expect.any(MembershipCreatedEvent));

      const [event] = publishNow.mock.calls[0] as [MembershipCreatedEvent];
      expect(event.data).toEqual({ tenantId: "tenant-1", userId: "user-1", role: "member" });
    });

    it("should throw AlreadyMemberProblem when adding duplicate member", async () => {
      await seedMembership();

      await expect(manager.addMember("tenant-1", "user-1", "member")).rejects.toBeInstanceOf(
        AlreadyMemberProblem,
      );
    });

    it("should throw InvalidRoleProblem when role is invalid", async () => {
      await expect(
        manager.addMember("tenant-1", "user-1", "invalid" as MembershipRole),
      ).rejects.toBeInstanceOf(InvalidRoleProblem);
    });

    it("should propagate event publication failures", async () => {
      publishNow.mockRejectedValueOnce(new Error("publish failed"));

      await expect(manager.addMember("tenant-1", "user-1", "member")).rejects.toThrow(
        "publish failed",
      );
    });

    it("should defer the membership-created event until commit when a transaction is active", async () => {
      const afterCommitEvents: MembershipCreatedEvent[] = [];
      manager = new MembershipManager(store, {
        publishAfterCommit: (event: MembershipCreatedEvent) => {
          afterCommitEvents.push(event);
        },
        publishNow,
      } as unknown as EventPublisher);

      await manager.addMember("tenant-1", "user-1", "member");

      expect(afterCommitEvents).toHaveLength(1);
      expect(afterCommitEvents[0]?.data).toEqual({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "member",
      });
      expect(publishNow).not.toHaveBeenCalled();
    });
  });

  describe("seat limit", () => {
    it("should throw SeatLimitExceededProblem when seat limit is exceeded", async () => {
      const seatLimitChecker: SeatLimitChecker = {
        checkSeatAvailability: vi.fn().mockResolvedValue({
          usage: 10,
          quota: 10,
          exceeded: true,
          remaining: 0,
        } as EntitlementQuotaStatus),
        getCurrentMemberCount: vi.fn().mockResolvedValue(10),
        getMaxSeats: vi.fn().mockResolvedValue(10),
      };

      manager = new MembershipManager(
        store,
        {
          publishAfterCommit: vi.fn(() => {
            throw new EventAfterCommitRequiresActiveTransactionProblem();
          }),
          publishNow,
          publishMany: vi.fn(),
        } as unknown as EventPublisher,
        seatLimitChecker,
      );

      await expect(manager.addMember("tenant-1", "user-1", "member")).rejects.toBeInstanceOf(
        SeatLimitExceededProblem,
      );
    });

    it("should allow adding member when seat limit is not exceeded", async () => {
      const seatLimitChecker: SeatLimitChecker = {
        checkSeatAvailability: vi.fn().mockResolvedValue({
          usage: 5,
          quota: 10,
          exceeded: false,
          remaining: 5,
        } as EntitlementQuotaStatus),
        getCurrentMemberCount: vi.fn().mockResolvedValue(5),
        getMaxSeats: vi.fn().mockResolvedValue(10),
      };

      manager = new MembershipManager(
        store,
        {
          publishAfterCommit: vi.fn(() => {
            throw new EventAfterCommitRequiresActiveTransactionProblem();
          }),
          publishNow,
          publishMany: vi.fn(),
        } as unknown as EventPublisher,
        seatLimitChecker,
      );

      const membership = await manager.addMember("tenant-1", "user-1", "member");
      expect(membership).toBeDefined();
    });
  });

  describe("removeMember", () => {
    it("should remove member and publish MembershipRemovedEvent", async () => {
      await seedMembership({ role: "member" });

      await manager.removeMember("tenant-1", "user-1");

      const membership = await store.findByTenantAndUser("tenant-1", "user-1");
      expect(membership).toBeNull();
      expect(publishNow).toHaveBeenCalledWith(expect.any(MembershipRemovedEvent));

      const [event] = publishNow.mock.calls[0] as [MembershipRemovedEvent];
      expect(event.data).toEqual({ tenantId: "tenant-1", userId: "user-1", role: "member" });
    });

    it("should defer the membership-removed event until commit when a transaction is active", async () => {
      const afterCommitEvents: MembershipRemovedEvent[] = [];
      manager = new MembershipManager(store, {
        publishAfterCommit: (event: MembershipRemovedEvent) => {
          afterCommitEvents.push(event);
        },
        publishNow,
      } as unknown as EventPublisher);
      await seedMembership({ role: "member" });

      await manager.removeMember("tenant-1", "user-1");

      expect(afterCommitEvents).toHaveLength(1);
      expect(afterCommitEvents[0]?.data).toEqual({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "member",
      });
      expect(publishNow).not.toHaveBeenCalled();
    });

    it("should prevent removing the last owner", async () => {
      await seedMembership({ role: "owner" });

      await expect(manager.removeMember("tenant-1", "user-1")).rejects.toBeInstanceOf(
        LastOwnerCannotBeRemovedProblem,
      );
    });

    it("should allow removing owner when there are multiple owners", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "owner" });

      await manager.removeMember("tenant-1", "user-1");

      const membership = await store.findByTenantAndUser("tenant-1", "user-1");
      expect(membership).toBeNull();
    });
  });

  describe("updateRole", () => {
    it("should update role and publish MembershipUpdatedEvent", async () => {
      await seedMembership({ role: "member" });

      const membership = await manager.updateRole("tenant-1", "user-1", "admin");

      expect(membership.role).toBe("admin");
      expect(publishNow).toHaveBeenCalledWith(expect.any(MembershipUpdatedEvent));

      const [event] = publishNow.mock.calls[0] as [MembershipUpdatedEvent];
      expect(event.data).toEqual({
        tenantId: "tenant-1",
        userId: "user-1",
        oldRole: "member",
        newRole: "admin",
      });
    });

    it("should defer the membership-updated event until commit when a transaction is active", async () => {
      const afterCommitEvents: MembershipUpdatedEvent[] = [];
      manager = new MembershipManager(store, {
        publishAfterCommit: (event: MembershipUpdatedEvent) => {
          afterCommitEvents.push(event);
        },
        publishNow,
      } as unknown as EventPublisher);
      await seedMembership({ role: "member" });

      await manager.updateRole("tenant-1", "user-1", "admin");

      expect(afterCommitEvents).toHaveLength(1);
      expect(afterCommitEvents[0]?.data).toEqual({
        tenantId: "tenant-1",
        userId: "user-1",
        oldRole: "member",
        newRole: "admin",
      });
      expect(publishNow).not.toHaveBeenCalled();
    });

    it("should return same membership when role is unchanged", async () => {
      await seedMembership({ role: "member" });

      const membership = await manager.updateRole("tenant-1", "user-1", "member");

      expect(membership.role).toBe("member");
      expect(publishNow).not.toHaveBeenCalled();
    });

    it("should prevent demoting the last owner", async () => {
      await seedMembership({ role: "owner" });

      await expect(manager.updateRole("tenant-1", "user-1", "member")).rejects.toBeInstanceOf(
        LastOwnerProblem,
      );
    });

    it("should reject a stale non-owner update after ownership transfers to that member", async () => {
      const staleStore = new StaleRoleReadStore();
      store = staleStore;
      manager = new MembershipManager(store, {
        publishAfterCommit: vi.fn(() => {
          throw new EventAfterCommitRequiresActiveTransactionProblem();
        }),
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher);
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      const staleUpdate = manager.updateRole("tenant-1", "user-2", "member");
      await staleStore.waitForRoleRead();
      await manager.transferOwnership("tenant-1", "user-1", "user-2");
      staleStore.releaseRoleRead();

      await expect(staleUpdate).rejects.toBeInstanceOf(LastOwnerProblem);
      expect(await store.countByRole("tenant-1", "owner")).toBe(1);
      expect((await store.findByTenantAndUser("tenant-1", "user-2"))?.role).toBe("owner");
    });

    it("should throw MembershipNotFoundProblem when update target is missing", async () => {
      await expect(manager.updateRole("tenant-1", "missing-user", "member")).rejects.toBeInstanceOf(
        MembershipNotFoundProblem,
      );
    });

    it("should throw InvalidRoleProblem when updating to invalid role", async () => {
      await seedMembership({ role: "member" });

      await expect(
        manager.updateRole("tenant-1", "user-1", "invalid" as MembershipRole),
      ).rejects.toBeInstanceOf(InvalidRoleProblem);
    });
  });

  describe("role hierarchy", () => {
    it("should allow promoting member to admin", async () => {
      await seedMembership({ role: "member" });

      const membership = await manager.updateRole("tenant-1", "user-1", "admin");
      expect(membership.role).toBe("admin");
    });

    it("should allow promoting member to owner", async () => {
      await seedMembership({ role: "member" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "owner" });

      const membership = await manager.updateRole("tenant-1", "user-1", "owner");
      expect(membership.role).toBe("owner");
    });

    it("should allow demoting admin to member", async () => {
      await seedMembership({ role: "admin" });

      const membership = await manager.updateRole("tenant-1", "user-1", "member");
      expect(membership.role).toBe("member");
    });

    it("should allow demoting admin to viewer", async () => {
      await seedMembership({ role: "admin" });

      const membership = await manager.updateRole("tenant-1", "user-1", "viewer");
      expect(membership.role).toBe("viewer");
    });
  });

  describe("transferOwnership", () => {
    it("should transfer ownership from one user to another", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      await manager.transferOwnership("tenant-1", "user-1", "user-2");

      const fromMembership = await store.findByTenantAndUser("tenant-1", "user-1");
      const toMembership = await store.findByTenantAndUser("tenant-1", "user-2");

      expect(fromMembership?.role).toBe("admin");
      expect(toMembership?.role).toBe("owner");
    });

    it("should publishNow events for both users", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      await manager.transferOwnership("tenant-1", "user-1", "user-2");

      expect(publishNow).toHaveBeenCalledTimes(2);
      expect(publishNow).toHaveBeenCalledWith(expect.any(MembershipUpdatedEvent));
    });

    it("should defer ownership events when after-commit publication is available", async () => {
      const afterCommitHooks: Array<() => void | Promise<void>> = [];
      const publishCommittedEvent = vi.fn(async (_event: MembershipUpdatedEvent) => {});
      manager = new MembershipManager(store, {
        publishAfterCommit: (event: MembershipUpdatedEvent) => {
          afterCommitHooks.push(() => publishCommittedEvent(event));
        },
        publishNow: publishCommittedEvent,
        publishMany: vi.fn(),
      } as unknown as EventPublisher);
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      await manager.transferOwnership("tenant-1", "user-1", "user-2");

      expect(afterCommitHooks).toHaveLength(2);
      expect(publishCommittedEvent).not.toHaveBeenCalled();

      for (const hook of afterCommitHooks) {
        await hook();
      }
      expect(publishCommittedEvent).toHaveBeenCalledTimes(2);
    });

    it("should throw OwnershipTransferRequiredProblem when from user is not owner", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "admin" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "member" });

      await expect(
        manager.transferOwnership("tenant-1", "user-1", "user-2"),
      ).rejects.toBeInstanceOf(OwnershipTransferRequiredProblem);
    });

    it("should throw MembershipNotFoundProblem when to user is not a member", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });

      await expect(
        manager.transferOwnership("tenant-1", "user-1", "user-2"),
      ).rejects.toBeInstanceOf(MembershipNotFoundProblem);
    });
  });

  describe("getMember", () => {
    it("should return member with getMember", async () => {
      await seedMembership();

      const membership = await manager.getMember("tenant-1", "user-1");

      expect(membership.id).toBe("mem-1");
      expect(membership.role).toBe("member");
    });

    it("should throw MembershipNotFoundProblem when getMember target is missing", async () => {
      await expect(manager.getMember("tenant-1", "missing-user")).rejects.toBeInstanceOf(
        MembershipNotFoundProblem,
      );
    });
  });

  describe("listMembers", () => {
    it("should list members by tenant", async () => {
      await seedMembership({ id: "mem-1", tenantId: "tenant-1", userId: "user-1" });
      await seedMembership({ id: "mem-2", tenantId: "tenant-1", userId: "user-2" });
      await seedMembership({ id: "mem-3", tenantId: "tenant-2", userId: "user-3" });

      const memberships = await manager.listMembers("tenant-1");

      expect(memberships).toHaveLength(2);
      expect(memberships.map((m) => m.id).sort()).toEqual(["mem-1", "mem-2"]);
    });
  });

  describe("listTenants", () => {
    it("should list tenants by user", async () => {
      await seedMembership({ id: "mem-1", tenantId: "tenant-1", userId: "user-1" });
      await seedMembership({ id: "mem-2", tenantId: "tenant-2", userId: "user-1" });
      await seedMembership({ id: "mem-3", tenantId: "tenant-2", userId: "user-2" });

      const memberships = await manager.listTenants("user-1");

      expect(memberships).toHaveLength(2);
      expect(memberships.map((m) => m.id).sort()).toEqual(["mem-1", "mem-2"]);
    });
  });
});
