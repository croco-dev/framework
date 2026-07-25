import "reflect-metadata";
import type { EntitlementQuotaStatus } from "@croco/entitlements-core";
import type { EventPublisher } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipUpdatedEvent } from "../libs/events/MembershipUpdatedEvent";
import { InMemoryMembershipStore } from "../libs/InMemoryMembershipStore";
import { MembershipService } from "../libs/MembershipService";
import { LastOwnerCannotBeRemovedProblem } from "../libs/problems/LastOwnerCannotBeRemovedProblem";
import {
  InvalidRoleProblem,
  LastOwnerProblem,
  MembershipNotFoundProblem,
  OwnershipTransferRequiredProblem,
  SeatLimitExceededProblem,
} from "../libs/problems/MembershipProblems";
import type { SeatLimitChecker } from "../libs/SeatLimitChecker";
import type {
  Membership,
  MembershipCreateInput,
  MembershipOwnerMutationInput,
  MembershipOwnerMutationResult,
} from "../libs/types";

class BarrierMembershipStore extends InMemoryMembershipStore {
  private arrivals = 0;
  private release: (() => void) | undefined;
  private readonly barrier = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  override async mutateOwner(
    input: MembershipOwnerMutationInput,
  ): Promise<MembershipOwnerMutationResult> {
    this.arrivals += 1;
    if (this.arrivals === 2) {
      this.release?.();
    }
    await this.barrier;
    return super.mutateOwner(input);
  }
}

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

describe("MembershipService", () => {
  let service!: MembershipService;
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

    service = new MembershipService(store, {
      publishNow,
      publishMany: vi.fn(),
    } as unknown as EventPublisher);
  });

  describe("addMember", () => {
    it("should propagate event publication failures when adding a member", async () => {
      publishNow.mockRejectedValueOnce(new Error("publish failed"));

      await expect(service.addMember("tenant-1", "user-1", "member")).rejects.toThrow(
        "publish failed",
      );
    });

    it("should throw InvalidRoleProblem when adding a member with invalid role", async () => {
      await expect(
        service.addMember("tenant-1", "user-1", "invalid" as never),
      ).rejects.toBeInstanceOf(InvalidRoleProblem);
    });

    it("should add member successfully", async () => {
      const membership = await service.addMember("tenant-1", "user-1", "member");

      expect(membership.tenantId).toBe("tenant-1");
      expect(membership.userId).toBe("user-1");
      expect(membership.role).toBe("member");
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

      service = new MembershipService(
        store,
        { publishNow, publishMany: vi.fn() } as unknown as EventPublisher,
        seatLimitChecker,
      );

      await expect(service.addMember("tenant-1", "user-1", "member")).rejects.toBeInstanceOf(
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

      service = new MembershipService(
        store,
        { publishNow, publishMany: vi.fn() } as unknown as EventPublisher,
        seatLimitChecker,
      );

      const membership = await service.addMember("tenant-1", "user-1", "member");
      expect(membership).toBeDefined();
    });
  });

  describe("removeMember", () => {
    it("BUG-10 마지막 오너는 삭제할 수 없다", async () => {
      await store.save({
        id: "mem-owner",
        tenantId: "tenant-1",
        userId: "user-owner",
        role: "owner",
      });

      await expect(service.removeMember("tenant-1", "user-owner")).rejects.toBeInstanceOf(
        LastOwnerCannotBeRemovedProblem,
      );
    });

    it("should remove member when not last owner", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "owner" });

      await service.removeMember("tenant-1", "user-1");

      const membership = await store.findByTenantAndUser("tenant-1", "user-1");
      expect(membership).toBeNull();
    });

    it("allows only one concurrent owner removal after both mutations reach the barrier", async () => {
      store = new BarrierMembershipStore();
      service = new MembershipService(store, {
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher);
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "owner" });

      const results = await Promise.allSettled([
        service.removeMember("tenant-1", "user-1"),
        service.removeMember("tenant-1", "user-2"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: expect.any(LastOwnerCannotBeRemovedProblem),
      });
      expect(await store.countByRole("tenant-1", "owner")).toBe(1);
    });
  });

  describe("updateRole", () => {
    it("BUG-10 마지막 오너 권한 변경은 제한된다", async () => {
      await store.save({
        id: "mem-owner",
        tenantId: "tenant-1",
        userId: "user-owner",
        role: "owner",
      });

      await expect(service.updateRole("tenant-1", "user-owner", "member")).rejects.toBeInstanceOf(
        LastOwnerProblem,
      );
    });

    it("should throw InvalidRoleProblem when updating to invalid role", async () => {
      await store.save({
        id: "mem-member",
        tenantId: "tenant-1",
        userId: "user-member",
        role: "member",
      });

      await expect(
        service.updateRole("tenant-1", "user-member", "invalid" as never),
      ).rejects.toBeInstanceOf(InvalidRoleProblem);
    });

    it("should reject demoting the last owner", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });

      await expect(service.updateRole("tenant-1", "user-1", "admin")).rejects.toBeInstanceOf(
        LastOwnerProblem,
      );
    });

    it("allows only one concurrent owner demotion after both mutations reach the barrier", async () => {
      store = new BarrierMembershipStore();
      service = new MembershipService(store, {
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher);
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "owner" });

      const results = await Promise.allSettled([
        service.updateRole("tenant-1", "user-1", "admin"),
        service.updateRole("tenant-1", "user-2", "admin"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: expect.any(LastOwnerProblem),
      });
      expect(await store.countByRole("tenant-1", "owner")).toBe(1);
      expect(await store.countByRole("tenant-1", "admin")).toBe(1);
    });

    it("rejects a stale non-owner update after ownership transfers to that member", async () => {
      const staleStore = new StaleRoleReadStore();
      store = staleStore;
      service = new MembershipService(store, {
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher);
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      const staleUpdate = service.updateRole("tenant-1", "user-2", "member");
      await staleStore.waitForRoleRead();
      await service.transferOwnership("tenant-1", "user-1", "user-2");
      staleStore.releaseRoleRead();

      await expect(staleUpdate).rejects.toBeInstanceOf(LastOwnerProblem);
      expect(await store.countByRole("tenant-1", "owner")).toBe(1);
      expect((await store.findByTenantAndUser("tenant-1", "user-2"))?.role).toBe("owner");
    });
  });

  describe("transferOwnership", () => {
    it("should transfer ownership from one user to another", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      await service.transferOwnership("tenant-1", "user-1", "user-2");

      const fromMembership = await store.findByTenantAndUser("tenant-1", "user-1");
      const toMembership = await store.findByTenantAndUser("tenant-1", "user-2");

      expect(fromMembership?.role).toBe("admin");
      expect(toMembership?.role).toBe("owner");
    });

    it("should throw OwnershipTransferRequiredProblem when from user is not owner", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "admin" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "member" });

      await expect(
        service.transferOwnership("tenant-1", "user-1", "user-2"),
      ).rejects.toBeInstanceOf(OwnershipTransferRequiredProblem);
    });

    it("should throw MembershipNotFoundProblem when to user is not a member", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });

      await expect(
        service.transferOwnership("tenant-1", "user-1", "user-2"),
      ).rejects.toBeInstanceOf(MembershipNotFoundProblem);
    });

    it("should publishNow events for both users", async () => {
      await seedMembership({ id: "mem-1", userId: "user-1", role: "owner" });
      await seedMembership({ id: "mem-2", userId: "user-2", role: "admin" });

      await service.transferOwnership("tenant-1", "user-1", "user-2");

      expect(publishNow).toHaveBeenCalledTimes(2);
      expect(publishNow).toHaveBeenCalledWith(expect.any(MembershipUpdatedEvent));
    });
  });

  describe("role hierarchy", () => {
    it("should allow promoting member to admin", async () => {
      await seedMembership({ role: "member" });

      const membership = await service.updateRole("tenant-1", "user-1", "admin");
      expect(membership.role).toBe("admin");
    });

    it("should allow demoting admin to member", async () => {
      await seedMembership({ role: "admin" });

      const membership = await service.updateRole("tenant-1", "user-1", "member");
      expect(membership.role).toBe("member");
    });
  });
});
