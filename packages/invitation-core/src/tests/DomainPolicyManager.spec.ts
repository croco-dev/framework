import "reflect-metadata";
import type { EventPublisher } from "@croco/events-core";
import type { Membership } from "@croco/membership-core";
import { AlreadyMemberProblem, type MembershipManager } from "@croco/membership-core";
import { TxManager, type TxAdapter } from "@croco/tx-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainPolicyManager } from "../libs/DomainPolicyManager";
import {
  DomainAutoJoinedEvent,
  DomainPolicyAddedEvent,
  DomainPolicyRemovedEvent,
} from "../libs/events/DomainPolicyEvents";
import { InMemoryDomainPolicyStore } from "../libs/InMemoryDomainPolicyStore";
import {
  DomainAutoJoinRecoveryProblem,
  InvalidAutoJoinRoleProblem,
  PublicEmailDomainNotAllowedProblem,
} from "../libs/problems/DomainPolicyProblems";

describe("DomainPolicyManager", () => {
  let manager!: DomainPolicyManager;
  let store!: InMemoryDomainPolicyStore;
  let publishNow!: ReturnType<typeof vi.fn>;
  let addMemberCommand!: ReturnType<typeof vi.fn>;
  let getMember!: ReturnType<typeof vi.fn>;
  let txManager!: TxManager<unknown>;

  beforeEach(() => {
    store = new InMemoryDomainPolicyStore();
    publishNow = vi.fn();
    addMemberCommand = vi.fn();
    getMember = vi.fn();
    const txAdapter: TxAdapter<unknown> = {
      async transaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
        return fn({});
      },
      async savepoint<T>(_client: unknown, fn: (client: unknown) => Promise<T>): Promise<T> {
        return fn({});
      },
      supportsSavepoint: () => false,
    };
    txManager = new TxManager(txAdapter);

    manager = new DomainPolicyManager(
      store,
      { addMemberCommand, getMember } as unknown as MembershipManager,
      {
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher,
      txManager,
    );
  });

  it("should add domain policy with normalized domain", async () => {
    const policy = await manager.addDomainPolicy("tenant-1", "  Croco.Dev  ", "member");

    expect(policy.tenantId).toBe("tenant-1");
    expect(policy.domain).toBe("croco.dev");
    expect(policy.role).toBe("member");
    expect(policy.enabled).toBe(true);
    expect(publishNow).toHaveBeenCalledWith(expect.any(DomainPolicyAddedEvent));

    const [event] = publishNow.mock.calls[0] as [DomainPolicyAddedEvent];
    expect(event.data).toEqual({ tenantId: "tenant-1", domain: "croco.dev", role: "member" });
  });

  it("should propagate event publication failures when adding domain policy", async () => {
    publishNow.mockRejectedValueOnce(new Error("publish failed"));

    await expect(manager.addDomainPolicy("tenant-1", "croco.dev", "member")).rejects.toThrow(
      "publish failed",
    );
  });

  it("should reject public email domains", async () => {
    await expect(manager.addDomainPolicy("tenant-1", "gmail.com", "member")).rejects.toBeInstanceOf(
      PublicEmailDomainNotAllowedProblem,
    );
  });

  it("should reject admin and owner role for auto-join", async () => {
    await expect(manager.addDomainPolicy("tenant-1", "croco.dev", "admin")).rejects.toBeInstanceOf(
      InvalidAutoJoinRoleProblem,
    );

    await expect(manager.addDomainPolicy("tenant-1", "croco.dev", "owner")).rejects.toBeInstanceOf(
      InvalidAutoJoinRoleProblem,
    );
  });

  it("should list policies by tenant", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");
    await manager.addDomainPolicy("tenant-1", "example.com", "viewer");
    await manager.addDomainPolicy("tenant-2", "other.dev", "member");

    const policies = await manager.listDomainPolicies("tenant-1");

    expect(policies).toHaveLength(2);
    expect(policies.map((policy) => policy.domain).sort()).toEqual(["croco.dev", "example.com"]);
  });

  it("should remove domain policy with normalized domain", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");

    await manager.removeDomainPolicy("tenant-1", " Croco.Dev ");

    const policy = await store.findByTenantAndDomain("tenant-1", "croco.dev");
    expect(policy).toBeNull();
    expect(publishNow).toHaveBeenCalledWith(expect.any(DomainPolicyRemovedEvent));
  });

  it("should auto-join member when email domain matches policy", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");

    const membership: Membership = {
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    addMemberCommand.mockResolvedValue({ operation: "add", membership, replayed: false });

    const result = await manager.tryAutoJoin("tenant-1", "user-1", "  User@Croco.Dev  ");

    expect(addMemberCommand).toHaveBeenCalledWith(
      "tenant-1",
      "user-1",
      "member",
      "domain-auto-join:tenant-1:user-1:croco.dev",
    );
    expect(result).toEqual(membership);
    expect(publishNow).toHaveBeenCalledWith(expect.any(DomainAutoJoinedEvent));
  });

  it("should auto-join member when an internationalized domain matches its registered form", async () => {
    await manager.addDomainPolicy("tenant-1", "例え.テスト", "member");

    const membership: Membership = {
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    addMemberCommand.mockResolvedValue({ operation: "add", membership, replayed: false });

    const result = await manager.tryAutoJoin("tenant-1", "user-1", "User@例え.テスト");

    expect(result).toEqual(membership);
    expect(addMemberCommand).toHaveBeenCalledWith(
      "tenant-1",
      "user-1",
      "member",
      "domain-auto-join:tenant-1:user-1:例え.テスト",
    );
  });

  it.each([
    "attacker@croco.dev@evil.example",
    "@croco.dev",
    "user@",
    "   @croco.dev",
    "user@   ",
    "user name@croco.dev",
    "user@croco .dev",
  ])("should reject malformed email %j without side effects", async (email) => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");
    publishNow.mockClear();

    const result = await manager.tryAutoJoin("tenant-1", "user-1", email);

    expect(result).toBeNull();
    expect(addMemberCommand).not.toHaveBeenCalled();
    expect(publishNow).not.toHaveBeenCalled();
  });

  it("should propagate event publication failures after auto-join", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");

    const membership: Membership = {
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    addMemberCommand.mockResolvedValue({ operation: "add", membership, replayed: false });
    publishNow.mockClear();
    publishNow.mockRejectedValueOnce(new Error("auto join publish failed"));

    await expect(manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev")).rejects.toMatchObject(
      {
        extensions: {
          committed: true,
          failures: [{ message: "auto join publish failed" }],
        },
      },
    );
  });

  it("should replay a committed auto-join and publish its missing event on retry", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");

    const membership: Membership = {
      id: "mem-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    addMemberCommand.mockResolvedValueOnce({ operation: "add", membership, replayed: false });
    publishNow.mockClear();
    publishNow
      .mockRejectedValueOnce(new Error("auto join publish failed"))
      .mockResolvedValueOnce(undefined);

    await expect(manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev")).rejects.toMatchObject(
      {
        extensions: {
          committed: true,
          failures: [{ message: "auto join publish failed" }],
        },
      },
    );

    await expect(manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev")).resolves.toEqual(
      membership,
    );
    expect(addMemberCommand).toHaveBeenCalledTimes(1);
    expect(publishNow).toHaveBeenCalledTimes(2);
    const [firstEvent] = publishNow.mock.calls[0] as [DomainAutoJoinedEvent];
    const [retriedEvent] = publishNow.mock.calls[1] as [DomainAutoJoinedEvent];
    expect(retriedEvent.eventId).toBe(firstEvent.eventId);
    expect(retriedEvent.timestamp).toEqual(firstEvent.timestamp);
  });

  it("should fence concurrent auto-joins to one membership result and one event", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "member");
    const membership: Membership = {
      id: "mem-concurrent",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    addMemberCommand.mockResolvedValue({ operation: "add", membership, replayed: false });
    publishNow.mockClear();
    let releasePublish!: () => void;
    publishNow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releasePublish = resolve;
        }),
    );

    const firstAttempt = manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev");
    await vi.waitFor(() => expect(publishNow).toHaveBeenCalledTimes(1));

    await expect(
      manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev"),
    ).rejects.toBeInstanceOf(DomainAutoJoinRecoveryProblem);
    expect(addMemberCommand).toHaveBeenCalledTimes(1);
    expect(publishNow).toHaveBeenCalledTimes(1);
    expect(publishNow).toHaveBeenCalledWith(expect.any(DomainAutoJoinedEvent));

    releasePublish();
    await expect(firstAttempt).resolves.toEqual(membership);
    await expect(manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev")).resolves.toEqual(
      membership,
    );
    expect(publishNow).toHaveBeenCalledTimes(1);
  });

  it("should return null when no matching policy exists", async () => {
    const result = await manager.tryAutoJoin("tenant-1", "user-1", "user@unknown.dev");

    expect(result).toBeNull();
    expect(addMemberCommand).not.toHaveBeenCalled();
  });

  it("should return null when user is already a member", async () => {
    await manager.addDomainPolicy("tenant-1", "croco.dev", "viewer");
    addMemberCommand.mockRejectedValue(new AlreadyMemberProblem("tenant-1", "user-1"));

    const result = await manager.tryAutoJoin("tenant-1", "user-1", "user@croco.dev");

    expect(result).toBeNull();
    expect(getMember).not.toHaveBeenCalled();
  });
});
