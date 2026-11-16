import "reflect-metadata";
import type { EventPublisher } from "@croco/events-core";
import type { MembershipManager } from "@croco/membership-core";
import type { NotificationService } from "@croco/notifications-core";
import { TransactionOutcomeUnknownProblem, TransactionTimeoutProblem } from "@croco/tx-core";
import type { TxManager } from "@croco/tx-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryInvitationStore } from "../libs/InMemoryInvitationStore";
import { InvitationManager } from "../libs/InvitationManager";
import { InvitationCreationFailedProblem } from "../libs/problems/InvitationProblems";
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
  let publishNow!: ReturnType<typeof vi.fn>;
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
    publishNow = vi.fn();
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
        publishNow,
        publishMany: vi.fn(),
      } as unknown as EventPublisher,
      txManager as TxManager<unknown>,
    );

    service = new RateLimitedInvitationService(manager, store, {
      maxInvitesPerHour: 2,
      maxInvitesPerDay: 5,
    });
  });

  it("keeps both ordinary manager methods usable as unary callbacks", async () => {
    const input = {
      idempotencyKey: "ordinary-email",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "ordinary@example.com",
      role: "member" as const,
    };
    const [emailToken] = await Promise.all(
      [input].map(manager.createEmailInvitation.bind(manager)),
    );
    const [linkToken] = await Promise.all(
      [{ ...input, idempotencyKey: "ordinary-link" }].map(
        manager.createLinkInvitation.bind(manager),
      ),
    );
    expect(await store.findByTokenHash(hashToken(emailToken))).toMatchObject({ type: "email" });
    expect(await store.findByTokenHash(hashToken(linkToken))).toMatchObject({ type: "link" });
  });

  it.each(["email", "link"])(
    "keeps ordinary %s clock failures within the creation contract",
    async (type) => {
      const input = {
        idempotencyKey: "ordinary-clock-failure",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "ordinary@example.com",
        role: "member" as const,
      };
      const issue = type === "email" ? manager.createEmailInvitation : manager.createLinkInvitation;
      const clock = vi
        .fn()
        .mockRejectedValueOnce(new Error("Failed query: select clock_timestamp()"))
        .mockImplementation(async () => new Date());
      Object.defineProperty(store, "currentTime", { value: clock });

      await expect(issue.call(manager, { ...input, expiresInDays: 0 })).rejects.toMatchObject({
        code: "INVALID_INVITATION_EXPIRY_DURATION",
      });
      expect(clock).not.toHaveBeenCalled();
      await expect(issue.call(manager, input)).rejects.toMatchObject({
        code: "INVITATION_CREATION_FAILED",
        extensions: { invitationId: expect.any(String), phase: "persistence", retrySafe: true },
      });
      expect(await store.findAllByTenant(input.tenantId)).toEqual([]);
      expect(publishNow).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();

      await expect(issue.call(manager, input)).resolves.toEqual(expect.any(String));
    },
  );

  it.each([undefined, null, { maxInvitesPerHour: 1, maxInvitesPerDay: NaN }])(
    "rejects an unusable quota policy before either rate-limited manager method can write",
    async (policy) => {
      const input = {
        idempotencyKey: "invalid-policy",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "one@example.com",
        role: "member" as const,
      };
      await expect(
        manager.createEmailInvitationWithRateLimit(input, policy as never),
      ).rejects.toMatchObject({
        code: "INVITATION_RATE_LIMIT_UNAVAILABLE",
      });
      await expect(
        manager.createLinkInvitationWithRateLimit(input, policy as never),
      ).rejects.toMatchObject({
        code: "INVITATION_RATE_LIMIT_UNAVAILABLE",
      });
      expect(await store.findAllByTenant(input.tenantId)).toEqual([]);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each([
    { maxInvitesPerHour: 1, maxInvitesPerDay: 10, period: "hour" },
    { maxInvitesPerHour: 10, maxInvitesPerDay: 1, period: "day" },
  ])("admits only one concurrent new email at the $period limit", async (limits) => {
    service = new RateLimitedInvitationService(manager, store, limits);
    const start = Promise.resolve();
    const inputs = ["one", "two"].map((name) => ({
      idempotencyKey: name,
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: `${name}@example.com`,
      role: "member" as const,
    }));
    const attempts = inputs.map(async (input) => {
      await start;
      return service.createEmailInvitationWithRateLimit(input);
    });
    const results = await Promise.allSettled(attempts);
    const winner = results.findIndex((result) => result.status === "fulfilled");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results[1 - winner]).toMatchObject({
      status: "rejected",
      reason: {
        code: "INVITATION_RATE_LIMIT_EXCEEDED",
        message: expect.stringContaining(limits.period),
      },
    });
    await expect(service.createEmailInvitationWithRateLimit(inputs[winner])).resolves.toBe(
      await attempts[winner],
    );
    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    await expect(
      service.createEmailInvitationWithRateLimit({ ...inputs[1 - winner], tenantId: "tenant-2" }),
    ).resolves.toEqual(expect.any(String));
  });

  it("replays a full-quota batch entry and rejects a new entry", async () => {
    service = new RateLimitedInvitationService(manager, store, {
      maxInvitesPerHour: 1,
      maxInvitesPerDay: 5,
    });
    const options = { idempotencyKey: "batch" };
    const first = await service.batchInvite("tenant-1", ["one@example.com"], options);
    expect(first.successful).toHaveLength(1);
    const retry = await service.batchInvite(
      "tenant-1",
      ["one@example.com", "two@example.com"],
      options,
    );
    expect(retry.successful).toEqual(first.successful);
    expect(retry.failed).toEqual([
      { email: "two@example.com", error: "Invitation rate limit exceeded: 1 per hour" },
    ]);
    expect(await store.countIssuedByTenant("tenant-1", new Date(0))).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("replays a revoked batch invitation at quota without reactivating it", async () => {
    service = new RateLimitedInvitationService(manager, store, {
      maxInvitesPerHour: 1,
      maxInvitesPerDay: 1,
    });
    const emails = ["revoked@example.com"];
    const options = { idempotencyKey: "revoked-batch" };
    const issued = await service.batchInvite("tenant-1", emails, options);
    expect(issued.successful).toHaveLength(1);
    const [invitation] = await store.findAllByTenant("tenant-1");
    await manager.revokeInvitation(invitation.id);

    await expect(service.batchInvite("tenant-1", emails, options)).resolves.toEqual(issued);
    expect(await store.findById(invitation.id)).toMatchObject({ status: "revoked" });
    expect(await store.countIssuedByTenant("tenant-1", new Date(0))).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps replacement delivery identities distinct from ordinary resend keys", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
      const payloads = new Map<string, string>();
      send.mockImplementation(
        async (_channel: unknown, payload: unknown, options: { idempotencyKey: string }) => {
          const next = JSON.stringify(payload);
          const previous = payloads.get(options.idempotencyKey);
          if (previous !== undefined && previous !== next) {
            throw new Error("A persisted notification task already uses that key");
          }
          payloads.set(options.idempotencyKey, next);
        },
      );
      const input = {
        idempotencyKey: "reused-email-key",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "one@example.com",
        role: "member" as const,
        expiresInDays: 1,
      };
      const first = await service.createEmailInvitationWithRateLimit(input);
      vi.setSystemTime(new Date("2026-03-02T12:00:00.001Z"));
      const replacement = await service.createEmailInvitationWithRateLimit(input);

      expect(replacement).not.toBe(first);
      expect(payloads.size).toBe(2);
      await expect(service.createEmailInvitationWithRateLimit(input)).resolves.toBe(replacement);
      expect(send).toHaveBeenCalledTimes(2);
      const current = await store.findByTokenHash(hashToken(replacement));
      if (!current) {
        throw new Error("Replacement invitation is missing");
      }
      const ordinary = await manager.resendInvitation(current.id, current.id);
      expect(ordinary).not.toBe(replacement);
      expect(payloads.size).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never returns a replacement token when an earlier creation resumes after key expiry", async () => {
    vi.useFakeTimers();
    let resumeActivation!: () => void;
    const resume = new Promise<void>((resolve) => {
      resumeActivation = resolve;
    });
    let signalActivation!: () => void;
    const reachedActivation = new Promise<void>((resolve) => {
      signalActivation = resolve;
    });
    try {
      const issuedAt = new Date("2026-03-01T00:00:00.000Z");
      vi.setSystemTime(issuedAt);
      const activate = store.activateEmailInvitation.bind(store);
      vi.spyOn(store, "activateEmailInvitation").mockImplementationOnce(async (...args) => {
        signalActivation();
        await resume;
        return activate(...args);
      });
      const input = {
        idempotencyKey: "reused-key",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        role: "member" as const,
        expiresInDays: 1,
      };
      const first = service.createLinkInvitationWithRateLimit(input);
      const outcome = Promise.allSettled([first]);
      await reachedActivation;
      vi.setSystemTime(issuedAt.getTime() + 24 * 60 * 60 * 1000 + 1);
      await expect(
        service.createLinkInvitationWithRateLimit({ ...input, role: "viewer" }),
      ).resolves.toEqual(expect.any(String));
      resumeActivation();
      await expect(outcome).resolves.toMatchObject([
        { status: "rejected", reason: { code: "INVITATION_CREATION_FAILED" } },
      ]);
    } finally {
      resumeActivation();
      vi.useRealTimers();
    }
  });

  it.each([
    { hour: 1, day: 5, windowMs: 60 * 60 * 1000 },
    { hour: 5, day: 1, windowMs: 24 * 60 * 60 * 1000 },
  ])(
    "counts the exact rolling cutoff for a new link ($windowMs ms)",
    async ({ hour, day, windowMs }) => {
      vi.useFakeTimers();
      try {
        const now = new Date("2026-03-01T12:00:00.000Z");
        vi.setSystemTime(now);
        service = new RateLimitedInvitationService(manager, store, {
          maxInvitesPerHour: hour,
          maxInvitesPerDay: day,
        });
        await store.save(
          createInvitation({ createdAt: new Date(now.getTime() - windowMs), status: "revoked" }),
        );
        const input = {
          idempotencyKey: "new-link",
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          role: "member" as const,
        };
        await expect(service.createLinkInvitationWithRateLimit(input)).rejects.toBeInstanceOf(
          InvitationRateLimitExceededProblem,
        );
        vi.setSystemTime(new Date(now.getTime() + 1));
        await expect(service.createLinkInvitationWithRateLimit(input)).resolves.toEqual(
          expect.any(String),
        );
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("dates a new invitation at admission after pre-creation work", async () => {
    vi.useFakeTimers();
    try {
      const admittedAt = new Date("2026-03-01T12:00:00.000Z");
      vi.setSystemTime(admittedAt.getTime() - 61 * 60 * 1000);
      const create = store.createRateLimitedInvitation.bind(store);
      vi.spyOn(store, "createRateLimitedInvitation").mockImplementationOnce((...args) => {
        vi.setSystemTime(admittedAt);
        return create(...args);
      });
      service = new RateLimitedInvitationService(manager, store, {
        maxInvitesPerHour: 1,
        maxInvitesPerDay: 5,
      });
      const input = {
        idempotencyKey: "delayed",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        role: "member" as const,
      };
      await service.createLinkInvitationWithRateLimit(input);
      await expect(
        service.createLinkInvitationWithRateLimit({
          ...input,
          idempotencyKey: "fresh",
        }),
      ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
      expect(await store.findAllByTenant(input.tenantId)).toMatchObject([
        { createdAt: admittedAt },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("omits the operator detail from batch errors when quota checks are unavailable", async () => {
    Object.defineProperty(store, "createRateLimitedInvitation", { value: undefined });
    const result = await service.batchInvite("tenant-1", ["one@example.com"]);
    expect(result).toEqual({
      successful: [],
      failed: [{ email: "one@example.com", error: "Invitation issuance quota is unavailable" }],
    });
    expect(await store.findAllByTenant("tenant-1")).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    new TransactionTimeoutProblem(123),
    new TransactionOutcomeUnknownProblem(345, new Error("driver timeout")),
  ])("omits the operator deadline for $code in a batch", async (problem) => {
    vi.spyOn(store, "createRateLimitedInvitation").mockRejectedValue(problem);
    const result = await service.batchInvite("tenant-1", ["one@example.com"], {
      idempotencyKey: "batch",
    });
    expect(result).toEqual({
      successful: [],
      failed: [{ email: "one@example.com", error: "Invitation creation could not be confirmed" }],
    });
  });

  it("rejects an explicit null service policy while allowing the default policy", async () => {
    const input = {
      idempotencyKey: "null-policy",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      role: "member" as const,
    };
    const invalid = new RateLimitedInvitationService(manager, store, null as never);
    await expect(invalid.checkRateLimit(input.tenantId)).rejects.toMatchObject({
      code: "INVITATION_RATE_LIMIT_UNAVAILABLE",
    });
    await expect(invalid.createLinkInvitationWithRateLimit(input)).rejects.toMatchObject({
      code: "INVITATION_RATE_LIMIT_UNAVAILABLE",
    });
    expect(await store.findAllByTenant(input.tenantId)).toHaveLength(0);

    const defaultPolicy = new RateLimitedInvitationService(manager, store);
    await expect(defaultPolicy.createLinkInvitationWithRateLimit(input)).resolves.toEqual(
      expect.any(String),
    );
  });

  it("reports a retryable event failure when the clock is unavailable after persistence", async () => {
    const input = {
      idempotencyKey: "event-clock-failure",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      role: "member" as const,
    };
    const failure = new Error("Failed query: select clock_timestamp()");
    const clock = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockImplementation(async () => new Date());
    Object.defineProperty(store, "currentTime", { value: clock });

    const outcome = await Promise.allSettled([service.createLinkInvitationWithRateLimit(input)]);
    const creation = await store.findEmailInvitationCreation(input.tenantId, input.idempotencyKey);
    expect(creation?.invitation.status).toBe("creating");
    expect(outcome).toMatchObject([
      {
        status: "rejected",
        reason: {
          code: "INVITATION_CREATION_FAILED",
          extensions: { invitationId: creation?.invitation.id, phase: "event", retrySafe: true },
        },
      },
    ]);
    expect(publishNow).not.toHaveBeenCalled();

    await expect(service.createLinkInvitationWithRateLimit(input)).resolves.toBe(creation?.token);
    expect(await store.findAllByTenant(input.tenantId)).toHaveLength(1);
    expect(publishNow).toHaveBeenCalledOnce();
  });

  it("returns a safe batch error for a failed claim and retries the committed creation", async () => {
    const options = { idempotencyKey: "claim-failure" };
    const email = "one@example.com";
    vi.spyOn(store, "claimEmailInvitationNotification").mockRejectedValueOnce(
      new Error("Failed query: update invitation_email_creation_intents\nparams: invitation-id"),
    );
    await expect(service.batchInvite("tenant-1", [email], options)).resolves.toEqual({
      successful: [],
      failed: [{ email, error: "Invitation creation did not complete; retry with the same key" }],
    });
    const creation = await store.findEmailInvitationCreation(
      "tenant-1",
      `${options.idempotencyKey}:${email}`,
    );
    expect(creation).toMatchObject({
      invitation: { status: "creating" },
      token: expect.any(String),
    });

    await expect(service.batchInvite("tenant-1", [email], options)).resolves.toEqual({
      successful: [{ email, token: creation?.token }],
      failed: [],
    });
    expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
    expect(send).toHaveBeenCalledOnce();
  });

  it("counts a committed invitation even if notification fails and resumes it at the limit", async () => {
    service = new RateLimitedInvitationService(manager, store, {
      maxInvitesPerHour: 1,
      maxInvitesPerDay: 5,
    });
    const input = {
      idempotencyKey: "notification-retry",
      tenantId: "tenant-1",
      inviterId: "inviter-1",
      email: "one@example.com",
      role: "member" as const,
    };
    send.mockRejectedValueOnce(new Error("delivery acknowledgement lost"));
    await expect(service.createEmailInvitationWithRateLimit(input)).rejects.toBeInstanceOf(
      InvitationCreationFailedProblem,
    );
    expect(await store.countIssuedByTenant("tenant-1", new Date(0))).toBe(1);
    const persisted = await store.findEmailInvitationCreation(input.tenantId, input.idempotencyKey);
    expect(persisted).toMatchObject({
      token: expect.any(String),
      invitation: { status: "creating" },
      notificationIdempotencyKey: expect.any(String),
    });
    await expect(
      service.createLinkInvitationWithRateLimit({ ...input, idempotencyKey: "new-link" }),
    ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
    await expect(service.createEmailInvitationWithRateLimit(input)).resolves.toBe(persisted?.token);
    expect(await store.countIssuedByTenant("tenant-1", new Date(0))).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0]);
    await expect(
      store.findEmailInvitationCreation(input.tenantId, input.idempotencyKey),
    ).resolves.toMatchObject({
      invitation: { id: persisted?.invitation.id, status: "pending" },
      notificationIdempotencyKey: persisted?.notificationIdempotencyKey,
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

    it.each(["accepted", "revoked", "declined", "expired"] as const)(
      "should retain hourly quota after invitations become %s",
      async (status) => {
        for (let i = 0; i < 2; i += 1) {
          await store.save(createInvitation({ id: `inv-${i}` }));
          await store.compareAndSetStatus("tenant-1", `inv-${i}`, "pending", status);
        }
        expect(await store.countPendingByTenant("tenant-1", new Date(0))).toBe(0);
        await expect(
          service.createEmailInvitationWithRateLimit({
            idempotencyKey: "blocked-email",
            tenantId: "tenant-1",
            inviterId: "inviter-1",
            email: "new@example.com",
            role: "member",
          }),
        ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
        await expect(
          service.createLinkInvitationWithRateLimit({
            idempotencyKey: "blocked-link",
            tenantId: "tenant-1",
            inviterId: "inviter-1",
            role: "member",
          }),
        ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
        expect(send).not.toHaveBeenCalled();
        expect(publishNow).not.toHaveBeenCalled();
      },
    );

    it.each(["accepted", "revoked"] as const)(
      "should retain daily quota after invitations become %s outside the hourly window",
      async (status) => {
        for (let i = 0; i < 5; i += 1) {
          await store.save(
            createInvitation({
              id: `inv-${i}`,
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            }),
          );
          await store.compareAndSetStatus("tenant-1", `inv-${i}`, "pending", status);
        }
        await expect(service.checkRateLimit("tenant-1")).rejects.toThrow("5 per day");
        await expect(service.checkRateLimit("tenant-2")).resolves.toBeUndefined();
      },
    );

    it("should not count invitations issued before the daily window", async () => {
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
        idempotencyKey: "rate-limit-create-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "user@example.com",
        role: "member",
      });

      expect(token).toBeDefined();
      expect(publishNow).toHaveBeenCalled();
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
          idempotencyKey: "rate-limit-exceeded-1",
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
          idempotencyKey: "duplicate-invitation-1",
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          email: "USER@example.com",
          role: "member",
        }),
      ).rejects.toBeInstanceOf(DuplicateInvitationProblem);
    });

    it("should re-invite an email after its pending invitation expires", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      try {
        const firstToken = await service.createEmailInvitationWithRateLimit({
          idempotencyKey: "expired-invitation-1",
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          email: "user@example.com",
          role: "member",
          expiresInDays: 1,
        });

        vi.setSystemTime(new Date("2026-01-02T00:00:00.001Z"));

        const secondToken = await service.createEmailInvitationWithRateLimit({
          idempotencyKey: "expired-invitation-2",
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          email: "user@example.com",
          role: "member",
          expiresInDays: 1,
        });

        const invitations = await store.findAllByTenant("tenant-1");
        const expiredInvitation = invitations.find(
          (invitation) => invitation.tokenHash === hashToken(firstToken),
        );
        const newInvitation = invitations.find(
          (invitation) => invitation.tokenHash === hashToken(secondToken),
        );

        expect(secondToken).not.toBe(firstToken);
        expect(expiredInvitation?.status).toBe("expired");
        expect(newInvitation?.status).toBe("pending");

        await expect(
          service.createEmailInvitationWithRateLimit({
            idempotencyKey: "expired-invitation-3",
            tenantId: "tenant-1",
            inviterId: "inviter-1",
            email: "user@example.com",
            role: "member",
            expiresInDays: 1,
          }),
        ).rejects.toBeInstanceOf(DuplicateInvitationProblem);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should normalize email addresses", async () => {
      const token = await service.createEmailInvitationWithRateLimit({
        idempotencyKey: "normalize-email-1",
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

    it("should replay the same request before duplicate and rate-limit checks", async () => {
      const input = {
        idempotencyKey: "rate-limited-replay-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        email: "user@example.com",
        role: "member" as const,
      };

      const firstToken = await service.createEmailInvitationWithRateLimit(input);
      const replayedToken = await service.createEmailInvitationWithRateLimit(input);

      expect(replayedToken).toBe(firstToken);
      expect(await store.findAllByTenant("tenant-1")).toHaveLength(1);
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe("batchInvite", () => {
    it.each([0, 1])(
      "should re-invite an email %i ms after expiry without a prior sweep",
      async (offset) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

        try {
          const first = await service.batchInvite("tenant-1", ["user@example.com"], {
            idempotencyKey: "expired-batch-1",
            expiresInDays: 1,
          });
          expect(first.failed).toEqual([]);
          expect(first.successful).toHaveLength(1);
          const firstToken = first.successful[0].token;

          vi.setSystemTime(new Date(new Date("2026-01-02T00:00:00.000Z").getTime() + offset));
          const previous = await store.findByTenantAndEmail("tenant-1", "user@example.com");
          expect(previous?.status).toBe("pending");

          const second = await service.batchInvite("tenant-1", ["  USER@EXAMPLE.COM  "], {
            idempotencyKey: "expired-batch-2",
            expiresInDays: 1,
          });

          expect(second.failed).toEqual([]);
          expect(second.successful).toHaveLength(1);
          expect(second.successful[0].email).toBe("user@example.com");
          expect(second.successful[0].token).not.toBe(firstToken);
          const invitations = await store.findAllByTenant("tenant-1");
          expect(
            invitations.find((invitation) => invitation.tokenHash === hashToken(firstToken))
              ?.status,
          ).toBe("expired");
          expect(
            invitations.find(
              (invitation) => invitation.tokenHash === hashToken(second.successful[0].token),
            )?.status,
          ).toBe("pending");
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it("should reject an email with an unexpired pending invitation", async () => {
      await store.save(createInvitation());

      const result = await service.batchInvite("tenant-1", ["  USER@EXAMPLE.COM  "], {
        idempotencyKey: "active-batch",
      });

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([
        { email: "user@example.com", error: "Invitation already pending" },
      ]);
      expect(send).not.toHaveBeenCalled();
      expect(publishNow).not.toHaveBeenCalled();
    });

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
        idempotencyKey: "rate-limited-link-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        role: "member",
      });

      expect(token).toBeDefined();
      expect(publishNow).toHaveBeenCalled();
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
          idempotencyKey: "rate-limited-link-exceeded-1",
          tenantId: "tenant-1",
          inviterId: "inviter-1",
          role: "member",
        }),
      ).rejects.toBeInstanceOf(InvitationRateLimitExceededProblem);
    });

    it("should resume a durable link creation before applying the rate limit", async () => {
      publishNow.mockRejectedValueOnce(new Error("publish failed"));
      const input = {
        idempotencyKey: "rate-limited-link-replay-1",
        tenantId: "tenant-1",
        inviterId: "inviter-1",
        role: "member" as const,
      };

      await expect(service.createLinkInvitationWithRateLimit(input)).rejects.toBeInstanceOf(
        InvitationCreationFailedProblem,
      );
      for (let i = 0; i < 2; i += 1) {
        await store.save(
          createInvitation({ id: `rate-limit-${i}`, email: `member-${i}@croco.dev` }),
        );
      }

      await expect(service.createLinkInvitationWithRateLimit(input)).resolves.toBeTypeOf("string");
      expect(publishNow).toHaveBeenCalledTimes(2);
    });
  });
});
