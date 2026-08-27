import "reflect-metadata";
import type { DomainEvent, EventBus, EventSubscription } from "@croco/events-core";
import { EventBusConfig } from "@croco/events-core";
import type { RequestContext } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImpersonationStartedEvent } from "../libs/events";
import { ImpersonationService } from "../libs/ImpersonationService";
import { AuthProvider, type ImpersonationPrincipal, ImpersonationStore } from "../libs/interfaces";
import { InvalidImpersonationConfigurationProblem } from "../libs/problems/ImpersonationProblems";
import type { ImpersonationConfig, ImpersonationState } from "../libs/types";

class MockEventBus implements EventBus {
  readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }

  subscribe(_subscription: EventSubscription): void {}

  unsubscribe(_subscription: EventSubscription): void {}

  clear(): void {
    this.events.length = 0;
  }
}

class MockImpersonationStore extends ImpersonationStore {
  private readonly sessions = new Map<string, ImpersonationState>();
  saveCount = 0;

  async save(session: ImpersonationState): Promise<void> {
    this.saveCount++;
    this.sessions.set(session.sessionId, session);
  }

  async find(sessionId: string): Promise<ImpersonationState | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null> {
    for (const session of this.sessions.values()) {
      if (session.impersonatorId === impersonatorId) {
        return session;
      }
    }
    return null;
  }

  async revoke(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class MockAuthProvider extends AuthProvider {
  principal: ImpersonationPrincipal | null = {
    id: "admin-1",
    permissions: ["impersonation:manage"],
  };
  readonly targets = new Set(["user-123", "user-456"]);
  targetLookupCount = 0;

  async resolvePrincipal(_context: RequestContext): Promise<ImpersonationPrincipal | null> {
    return this.principal;
  }

  async targetExists(_context: RequestContext, targetUserId: string): Promise<boolean> {
    this.targetLookupCount++;
    return this.targets.has(targetUserId);
  }
}

describe("ImpersonationService", () => {
  let service!: ImpersonationService;
  let store!: MockImpersonationStore;
  let authProvider!: MockAuthProvider;
  let eventBus!: MockEventBus;
  let config!: ImpersonationConfig;
  const context = (userId?: string): RequestContext => ({
    requestId: "req-1",
    ...(userId ? { user: { id: userId } } : {}),
  });

  beforeEach(() => {
    Container.reset();
    eventBus = new MockEventBus();
    EventBusConfig.getInstance().setEventBus(eventBus);
    store = new MockImpersonationStore();
    authProvider = new MockAuthProvider();
    config = {
      maxDurationMs: 30 * 60 * 1000,
      requireReason: false,
      blockedActions: [],
    };
    service = new ImpersonationService(store, authProvider, config);
  });

  const expectNoStartSideEffects = (): void => {
    expect(store.saveCount).toBe(0);
    expect(eventBus.events).toHaveLength(0);
  };

  describe("configuration", () => {
    it.each([
      [0, 0],
      [-1, -1],
      [0.5, 0.5],
      [Number.NaN, "NaN"],
      [Number.POSITIVE_INFINITY, "Infinity"],
      [Number.NEGATIVE_INFINITY, "-Infinity"],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1],
      ["60000" as unknown as number, "non-number-string"],
    ])("rejects invalid maxDurationMs %s before use", (maxDurationMs, receivedValue) => {
      expect(
        () =>
          new ImpersonationService(store, authProvider, {
            ...config,
            maxDurationMs,
          }),
      ).toThrowError(
        expect.objectContaining({
          code: "IMPERSONATION_CONFIGURATION_INVALID",
          category: ProblemCategory.InternalServerError,
          field: "maxDurationMs",
          constraint: "positive-safe-integer-with-representable-expiration",
          receivedValue,
        }),
      );
      expectNoStartSideEffects();
    });

    it.each(["", "   "])("rejects a blank blocked action %# before use", (blockedAction) => {
      expect(
        () =>
          new ImpersonationService(store, authProvider, {
            ...config,
            blockedActions: ["deleteUser", blockedAction],
          }),
      ).toThrowError(InvalidImpersonationConfigurationProblem);
      expectNoStartSideEffects();
    });

    it.each([["deleteUser" as unknown as string[]], [["deleteUser", 42] as unknown as string[]]])(
      "rejects malformed blockedActions %# before use",
      (blockedActions) => {
        expect(
          () =>
            new ImpersonationService(store, authProvider, {
              ...config,
              blockedActions,
            }),
        ).toThrowError(
          expect.objectContaining({
            code: "IMPERSONATION_CONFIGURATION_INVALID",
            field: "blockedActions",
            constraint: "array-of-non-blank-strings",
          }),
        );
        expectNoStartSideEffects();
      },
    );
  });

  describe("start", () => {
    it("rejects anonymous direct calls before target lookup or side effects", async () => {
      authProvider.principal = null;

      await expect(service.start(context(), "user-123")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      expect(authProvider.targetLookupCount).toBe(0);
      expectNoStartSideEffects();
    });

    it("rejects contradictory context identity before target lookup or side effects", async () => {
      await expect(service.start(context("forged-admin"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_IDENTITY_CONFLICT",
      });

      expect(authProvider.targetLookupCount).toBe(0);
      expectNoStartSideEffects();
    });

    it("rejects an explicitly present empty context identity", async () => {
      await expect(
        service.start({ requestId: "req-1", user: { id: "" } }, "user-123"),
      ).rejects.toMatchObject({
        code: "IMPERSONATION_IDENTITY_CONFLICT",
      });

      expect(authProvider.targetLookupCount).toBe(0);
      expectNoStartSideEffects();
    });

    it("rejects missing permission before target lookup or side effects", async () => {
      authProvider.principal = {
        id: "admin-1",
        permissions: ["impersonation:read"],
      };

      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(authProvider.targetLookupCount).toBe(0);
      expectNoStartSideEffects();
    });

    it("rejects scoped manage permission before target lookup or side effects", async () => {
      authProvider.principal = {
        id: "admin-1",
        permissions: ["impersonation:manage:tenant-1"],
      };

      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(authProvider.targetLookupCount).toBe(0);
      expectNoStartSideEffects();
    });

    it("rejects self-targeting before target lookup or side effects", async () => {
      await expect(service.start(context("admin-1"), "admin-1")).rejects.toMatchObject({
        code: "SELF_IMPERSONATION_NOT_ALLOWED",
      });

      expect(authProvider.targetLookupCount).toBe(0);
      expectNoStartSideEffects();
    });

    it("rejects a missing target without persistence or publication", async () => {
      await expect(service.start(context("admin-1"), "missing-user")).rejects.toMatchObject({
        code: "IMPERSONATION_TARGET_NOT_FOUND",
      });

      expect(authProvider.targetLookupCount).toBe(1);
      expectNoStartSideEffects();
    });

    it("stores and publishes only the verified principal identity", async () => {
      const result = await service.start(context(), "user-123", "Support request");

      expect(result).toMatchObject({
        impersonatorId: "admin-1",
        targetUserId: "user-123",
        reason: "Support request",
      });
      expect(await store.find(result.sessionId)).toEqual(result);
      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(ImpersonationStartedEvent);
      expect((eventBus.events[0] as ImpersonationStartedEvent).session).toEqual(result);
    });

    it("keeps the verified actor immutable in returned, stored, and published session data", async () => {
      const result = await service.start(context("admin-1"), "user-123");

      expect(Object.isFrozen(result)).toBe(true);
      expect(Reflect.set(result, "impersonatorId", "forged-admin")).toBe(false);
      expect((await store.find(result.sessionId))?.impersonatorId).toBe("admin-1");
      expect((eventBus.events[0] as ImpersonationStartedEvent).session.impersonatorId).toBe(
        "admin-1",
      );
    });

    it("accepts matching context identity and global manage permission", async () => {
      authProvider.principal = {
        id: "admin-1",
        permissions: ["impersonation:manage"],
      };

      const result = await service.start(context("admin-1"), "user-123");

      expect(result.impersonatorId).toBe("admin-1");
    });

    it("rejects nested impersonation for the verified principal", async () => {
      await service.start(context("admin-1"), "user-123");
      eventBus.clear();
      store.saveCount = 0;

      await expect(service.start(context("admin-1"), "user-456")).rejects.toMatchObject({
        code: "NESTED_IMPERSONATION_NOT_ALLOWED",
      });

      expectNoStartSideEffects();
    });

    it("rejects a missing required reason without persistence or publication", async () => {
      config = { ...config, requireReason: true };
      service = new ImpersonationService(store, authProvider, config);

      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_REASON_REQUIRED",
      });

      expectNoStartSideEffects();
    });

    it("rejects a whitespace-only required reason without persistence or publication", async () => {
      config = { ...config, requireReason: true };
      service = new ImpersonationService(store, authProvider, config);

      await expect(service.start(context("admin-1"), "user-123", " \t\n ")).rejects.toMatchObject({
        code: "IMPERSONATION_REASON_REQUIRED",
      });

      expectNoStartSideEffects();
    });

    it("stores and publishes a normalized required reason", async () => {
      config = { ...config, requireReason: true };
      service = new ImpersonationService(store, authProvider, config);

      const result = await service.start(context("admin-1"), "user-123", "  Support request  ");

      expect(result.reason).toBe("Support request");
      expect((await store.find(result.sessionId))?.reason).toBe("Support request");
      expect((eventBus.events[0] as ImpersonationStartedEvent).session.reason).toBe(
        "Support request",
      );
    });

    it("rejects a duration that becomes unrepresentable before persistence or publication", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date(0));
        service = new ImpersonationService(store, authProvider, {
          ...config,
          maxDurationMs: 8_640_000_000_000_000,
        });
        vi.setSystemTime(new Date(1));

        await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
          code: "IMPERSONATION_CONFIGURATION_INVALID",
          field: "maxDurationMs",
        });

        expectNoStartSideEffects();
      } finally {
        vi.useRealTimers();
      }
    });

    it("allows an optional reason to remain absent", async () => {
      const result = await service.start(context("admin-1"), "user-123");

      expect(result.reason).toBeUndefined();
    });

    it("preserves a supplied optional reason in returned, stored, and published session data", async () => {
      const reason = "  Optional support note  ";

      const result = await service.start(context("admin-1"), "user-123", reason);

      expect(result.reason).toBe(reason);
      expect((await store.find(result.sessionId))?.reason).toBe(reason);
      expect((eventBus.events[0] as ImpersonationStartedEvent).session.reason).toBe(reason);
    });

    it("preserves a supplied empty optional reason in returned, stored, and published session data", async () => {
      const result = await service.start(context("admin-1"), "user-123", "");

      expect(result.reason).toBe("");
      expect((await store.find(result.sessionId))?.reason).toBe("");
      expect((eventBus.events[0] as ImpersonationStartedEvent).session.reason).toBe("");
    });

    it("calculates the exact configured duration", async () => {
      config = { ...config, maxDurationMs: 60_000 };
      service = new ImpersonationService(store, authProvider, config);

      const result = await service.start(context("admin-1"), "user-123");

      expect(result.expiresAt.getTime() - result.startedAt.getTime()).toBe(60_000);
    });
  });

  describe("end", () => {
    it("revokes an existing session", async () => {
      const session = await service.start(context("admin-1"), "user-123");

      await service.end(session.sessionId);

      expect(await store.find(session.sessionId)).toBeNull();
    });

    it("rejects a missing session", async () => {
      await expect(service.end("non-existent-session")).rejects.toMatchObject({
        code: "IMPERSONATION_SESSION_NOT_FOUND",
      });
    });
  });

  describe("context helpers", () => {
    const now = Date.now();
    const session: ImpersonationState = {
      sessionId: "imp-123",
      impersonatorId: "admin-1",
      targetUserId: "user-123",
      reason: "Support request",
      startedAt: new Date(now - 1_000),
      expiresAt: new Date(now + 60_000),
    };

    it("identifies impersonation contexts", () => {
      const impersonationContext = {
        requestId: "req-1",
        impersonation: session,
      } as RequestContext;

      expect(service.isImpersonating(impersonationContext)).toBe(true);
      expect(service.isImpersonating(context())).toBe(false);
    });

    it("returns the actor and target only during impersonation", () => {
      const impersonationContext = {
        requestId: "req-1",
        impersonation: session,
      } as RequestContext;

      expect(service.getImpersonator(impersonationContext)).toBe("admin-1");
      expect(service.getTargetUser(impersonationContext)).toBe("user-123");
      expect(service.getImpersonator(context())).toBeNull();
      expect(service.getTargetUser(context())).toBeNull();
    });

    it.each([
      ["a boolean", true],
      ["a string", "active"],
      ["a partial object", { sessionId: "imp-123" }],
      ["a blank identifier", { ...session, impersonatorId: "   " }],
      ["a non-string reason", { ...session, reason: 42 }],
      ["a serialized timestamp", { ...session, startedAt: session.startedAt.toISOString() }],
      ["an invalid start date", { ...session, startedAt: new Date("invalid") }],
      ["an invalid expiration date", { ...session, expiresAt: new Date("invalid") }],
      [
        "an expiration before the start",
        { ...session, expiresAt: new Date(session.startedAt.getTime() - 1) },
      ],
      [
        "a session that has not started",
        {
          ...session,
          startedAt: new Date(now + 60_000),
          expiresAt: new Date(now + 120_000),
        },
      ],
      ["an expired session", { ...session, expiresAt: new Date(now - 1) }],
    ])("rejects %s as impersonation context", (_description, impersonation) => {
      const malformedContext = {
        requestId: "req-1",
        impersonation,
      } as RequestContext;

      expect(service.isImpersonating(malformedContext)).toBe(false);
      expect(service.getImpersonator(malformedContext)).toBeNull();
      expect(service.getTargetUser(malformedContext)).toBeNull();
    });

    it("rejects a context with a throwing impersonation accessor", () => {
      const malformedContext = Object.defineProperty({ requestId: "req-1" }, "impersonation", {
        get: () => {
          throw new Error("untrusted context accessor");
        },
      }) as RequestContext;

      expect(service.isImpersonating(malformedContext)).toBe(false);
      expect(service.getImpersonator(malformedContext)).toBeNull();
      expect(service.getTargetUser(malformedContext)).toBeNull();
    });
  });
});
