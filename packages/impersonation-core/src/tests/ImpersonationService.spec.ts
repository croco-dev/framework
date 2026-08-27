import "reflect-metadata";
import type { RequestContext } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImpersonationEndedEventIntent,
  createImpersonationStartedEventIntent,
} from "../libs/eventIntent";
import type {
  ImpersonationEndedEventIntent,
  ImpersonationStartedEventIntent,
} from "../libs/eventIntent";
import { ImpersonationEndedEvent, ImpersonationStartedEvent } from "../libs/events";
import { InMemoryImpersonationStore } from "../libs/InMemoryImpersonationStore";
import { ImpersonationService } from "../libs/ImpersonationService";
import {
  AuthProvider,
  ImpersonationLifecycleEventPublisher,
  type ImpersonationPrincipal,
} from "../libs/interfaces";
import { InvalidImpersonationConfigurationProblem } from "../libs/problems/ImpersonationProblems";
import type { ImpersonationConfig, ImpersonationState } from "../libs/types";

type ImpersonationLifecycleEvent = ImpersonationStartedEvent | ImpersonationEndedEvent;

class MockLifecycleEventPublisher extends ImpersonationLifecycleEventPublisher {
  readonly attempts: ImpersonationLifecycleEvent[] = [];
  readonly events: ImpersonationLifecycleEvent[] = [];
  readonly deliveredIds = new Set<string>();
  nextFailure: Error | undefined;

  async publishIdempotently(event: ImpersonationLifecycleEvent): Promise<void> {
    this.attempts.push(event);
    if (this.nextFailure) {
      const failure = this.nextFailure;
      this.nextFailure = undefined;
      throw failure;
    }
    if (this.deliveredIds.has(event.eventId)) return;
    this.deliveredIds.add(event.eventId);
    this.events.push(event);
  }

  clear(): void {
    this.events.length = 0;
  }
}

class MockImpersonationStore extends InMemoryImpersonationStore {
  commitStartCount = 0;
  commitEndAttemptCount = 0;
  commitEndCount = 0;

  override async commitStart(intent: ImpersonationStartedEventIntent) {
    this.commitStartCount += 1;
    return super.commitStart(intent);
  }

  override async commitEnd(intent: ImpersonationEndedEventIntent, impersonatorId: string) {
    this.commitEndAttemptCount += 1;
    const result = await super.commitEnd(intent, impersonatorId);
    if (result === "committed" || result === "committed-start-pending") {
      this.commitEndCount += 1;
    }
    return result;
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
  let eventPublisher!: MockLifecycleEventPublisher;
  let config!: ImpersonationConfig;
  const context = (userId?: string): RequestContext => ({
    requestId: "req-1",
    ...(userId ? { user: { id: userId } } : {}),
  });

  beforeEach(() => {
    Container.reset();
    eventPublisher = new MockLifecycleEventPublisher();
    store = new MockImpersonationStore();
    authProvider = new MockAuthProvider();
    config = {
      maxDurationMs: 30 * 60 * 1000,
      requireReason: false,
      blockedActions: [],
    };
    service = new ImpersonationService(store, authProvider, config, eventPublisher);
  });

  const expectNoStartSideEffects = (): void => {
    expect(store.commitStartCount).toBe(0);
    expect(eventPublisher.events).toHaveLength(0);
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
          new ImpersonationService(
            store,
            authProvider,
            {
              ...config,
              maxDurationMs,
            },
            eventPublisher,
          ),
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
          new ImpersonationService(
            store,
            authProvider,
            {
              ...config,
              blockedActions: ["deleteUser", blockedAction],
            },
            eventPublisher,
          ),
      ).toThrowError(InvalidImpersonationConfigurationProblem);
      expectNoStartSideEffects();
    });

    it.each([
      {
        blockedActions: ["delete User"],
        constraint: "normalized-action-identifiers",
        receivedValue: "invalid-item-at-index-0",
      },
      {
        blockedActions: ["deleteUser", "deleteUser"],
        constraint: "unique-action-identifiers",
        receivedValue: "duplicate-item-at-index-1",
      },
    ])("rejects invalid action identifiers %# before use", (invalidConfig) => {
      expect(
        () =>
          new ImpersonationService(
            store,
            authProvider,
            {
              ...config,
              blockedActions: invalidConfig.blockedActions,
            },
            eventPublisher,
          ),
      ).toThrowError(
        expect.objectContaining({
          code: "IMPERSONATION_CONFIGURATION_INVALID",
          field: "blockedActions",
          constraint: invalidConfig.constraint,
          receivedValue: invalidConfig.receivedValue,
        }),
      );
      expectNoStartSideEffects();
    });

    it.each([
      [undefined, "non-boolean-undefined"],
      [null, "non-boolean-null"],
      [0, "non-boolean-number"],
      ["true", "non-boolean-string"],
    ])("rejects invalid requireReason %# before use", (requireReason, receivedValue) => {
      expect(
        () =>
          new ImpersonationService(
            store,
            authProvider,
            {
              ...config,
              requireReason: requireReason as unknown as boolean,
            },
            eventPublisher,
          ),
      ).toThrowError(
        expect.objectContaining({
          code: "IMPERSONATION_CONFIGURATION_INVALID",
          field: "requireReason",
          constraint: "boolean",
          receivedValue,
        }),
      );
      expectNoStartSideEffects();
    });

    it.each([["deleteUser" as unknown as string[]], [["deleteUser", 42] as unknown as string[]]])(
      "rejects malformed blockedActions %# before use",
      (blockedActions) => {
        expect(
          () =>
            new ImpersonationService(
              store,
              authProvider,
              {
                ...config,
                blockedActions,
              },
              eventPublisher,
            ),
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
      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0]).toBeInstanceOf(ImpersonationStartedEvent);
      expect((eventPublisher.events[0] as ImpersonationStartedEvent).session).toEqual(result);
    });

    it("keeps a recoverable started-event intent when publication fails", async () => {
      eventPublisher.nextFailure = new Error("publisher unavailable");

      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING",
        lifecycle: "started",
        reconciliationState: "pending",
        stage: "publish",
      });

      const active = await store.findByImpersonator("admin-1");
      expect(active).not.toBeNull();
      const pending = await store.listPendingLifecycleEventIntents();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        eventId: `impersonation.session.started:${active?.sessionId}`,
        kind: "started",
        session: active,
      });
      await expect(service.getLifecycleDiagnostics()).resolves.toMatchObject({
        status: "reconciliation_required",
        pendingEvents: [
          {
            code: "impersonation-core/lifecycle-event-pending",
            lifecycle: "started",
            sessionId: active?.sessionId,
          },
        ],
      });

      await expect(service.publishPendingEvents()).resolves.toBe(1);
      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0]?.eventId).toBe(pending[0]?.eventId);
      expect(eventPublisher.events[0]?.timestamp).toEqual(pending[0]?.occurredAt);
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([]);
      await expect(service.getLifecycleDiagnostics()).resolves.toMatchObject({
        status: "healthy",
        pendingEvents: [],
      });
    });

    it("reuses event identity when acknowledgement fails after publication", async () => {
      const acknowledge = vi.spyOn(store, "markLifecycleEventPublished");
      acknowledge.mockRejectedValueOnce(new Error("acknowledgement unavailable"));

      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING",
        lifecycle: "started",
        stage: "acknowledge",
      });
      const firstAttempt = eventPublisher.attempts[0];
      expect(eventPublisher.events).toHaveLength(1);

      acknowledge.mockRestore();
      await expect(service.publishPendingEvents()).resolves.toBe(1);

      const retried = eventPublisher.attempts[1];
      expect(retried?.eventId).toBe(firstAttempt?.eventId);
      expect(retried?.timestamp).toEqual(firstAttempt?.timestamp);
      expect(eventPublisher.events).toHaveLength(1);
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([]);
    });

    it("deduplicates concurrent pending-event dispatch by stable event identity", async () => {
      eventPublisher.nextFailure = new Error("publisher unavailable");
      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING",
      });

      const results = await Promise.all([
        service.publishPendingEvents(),
        service.publishPendingEvents(),
      ]);

      expect(results).toEqual([1, 1]);
      expect(eventPublisher.attempts).toHaveLength(3);
      expect(new Set(eventPublisher.attempts.map(({ eventId }) => eventId)).size).toBe(1);
      expect(eventPublisher.events).toHaveLength(1);
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([]);
    });

    it("keeps the verified actor immutable in returned, stored, and published session data", async () => {
      const result = await service.start(context("admin-1"), "user-123");

      expect(Object.isFrozen(result)).toBe(true);
      expect(Reflect.set(result, "impersonatorId", "forged-admin")).toBe(false);
      expect((await store.find(result.sessionId))?.impersonatorId).toBe("admin-1");
      expect((eventPublisher.events[0] as ImpersonationStartedEvent).session.impersonatorId).toBe(
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
      eventPublisher.clear();
      store.commitStartCount = 0;

      await expect(service.start(context("admin-1"), "user-456")).rejects.toMatchObject({
        code: "NESTED_IMPERSONATION_NOT_ALLOWED",
      });

      expect(store.commitStartCount).toBe(1);
      expect(eventPublisher.events).toHaveLength(0);
    });

    it("allows only one concurrent start for the same verified principal", async () => {
      const concurrentStore = new InMemoryImpersonationStore();
      const concurrentPublisher = new MockLifecycleEventPublisher();
      service = new ImpersonationService(
        concurrentStore,
        authProvider,
        config,
        concurrentPublisher,
      );

      const results = await Promise.allSettled([
        service.start(context("admin-1"), "user-123"),
        service.start(context("admin-1"), "user-456"),
      ]);

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<ImpersonationState> =>
          result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toMatchObject({
        code: "NESTED_IMPERSONATION_NOT_ALLOWED",
      });
      expect(await concurrentStore.findByImpersonator("admin-1")).toEqual(fulfilled[0]?.value);
      expect(concurrentPublisher.events).toHaveLength(1);
    });

    it("rejects a missing required reason without persistence or publication", async () => {
      config = { ...config, requireReason: true };
      service = new ImpersonationService(store, authProvider, config, eventPublisher);

      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_REASON_REQUIRED",
      });

      expectNoStartSideEffects();
    });

    it("rejects a whitespace-only required reason without persistence or publication", async () => {
      config = { ...config, requireReason: true };
      service = new ImpersonationService(store, authProvider, config, eventPublisher);

      await expect(service.start(context("admin-1"), "user-123", " \t\n ")).rejects.toMatchObject({
        code: "IMPERSONATION_REASON_REQUIRED",
      });

      expectNoStartSideEffects();
    });

    it("stores and publishes a normalized required reason", async () => {
      config = { ...config, requireReason: true };
      service = new ImpersonationService(store, authProvider, config, eventPublisher);

      const result = await service.start(context("admin-1"), "user-123", "  Support request  ");

      expect(result.reason).toBe("Support request");
      expect((await store.find(result.sessionId))?.reason).toBe("Support request");
      expect((eventPublisher.events[0] as ImpersonationStartedEvent).session.reason).toBe(
        "Support request",
      );
    });

    it("rejects a duration that becomes unrepresentable before persistence or publication", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date(0));
        service = new ImpersonationService(
          store,
          authProvider,
          {
            ...config,
            maxDurationMs: 8_640_000_000_000_000,
          },
          eventPublisher,
        );
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
      expect((eventPublisher.events[0] as ImpersonationStartedEvent).session.reason).toBe(reason);
    });

    it("preserves a supplied empty optional reason in returned, stored, and published session data", async () => {
      const result = await service.start(context("admin-1"), "user-123", "");

      expect(result.reason).toBe("");
      expect((await store.find(result.sessionId))?.reason).toBe("");
      expect((eventPublisher.events[0] as ImpersonationStartedEvent).session.reason).toBe("");
    });

    it("calculates the exact configured duration", async () => {
      config = { ...config, maxDurationMs: 60_000 };
      service = new ImpersonationService(store, authProvider, config, eventPublisher);

      const result = await service.start(context("admin-1"), "user-123");

      expect(result.expiresAt.getTime() - result.startedAt.getTime()).toBe(60_000);
    });
  });

  describe("end", () => {
    const startSession = async (): Promise<ImpersonationState> => {
      const session = await service.start(context("admin-1"), "user-123");
      eventPublisher.clear();
      return session;
    };

    const expectNoEndSideEffects = async (sessionId: string): Promise<void> => {
      expect(store.commitEndCount).toBe(0);
      expect(await store.find(sessionId)).not.toBeNull();
      expect(eventPublisher.events).toHaveLength(0);
    };

    it("rejects unauthenticated callers before a store revocation attempt", async () => {
      const session = await startSession();
      authProvider.principal = null;

      await expect(service.end(context(), session.sessionId)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      expect(store.commitEndAttemptCount).toBe(0);
      await expectNoEndSideEffects(session.sessionId);
    });

    it("rejects callers without global manage permission before a store revocation attempt", async () => {
      const session = await startSession();
      authProvider.principal = {
        id: "admin-1",
        permissions: ["impersonation:read"],
      };

      await expect(service.end(context("admin-1"), session.sessionId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(store.commitEndAttemptCount).toBe(0);
      await expectNoEndSideEffects(session.sessionId);
    });

    it("rejects scoped manage permission before a store revocation attempt", async () => {
      const session = await startSession();
      authProvider.principal = {
        id: "admin-1",
        permissions: ["impersonation:manage:tenant-1"],
      };

      await expect(service.end(context("admin-1"), session.sessionId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(store.commitEndAttemptCount).toBe(0);
      await expectNoEndSideEffects(session.sessionId);
    });

    it("rejects contradictory context identity before a store revocation attempt", async () => {
      const session = await startSession();

      await expect(service.end(context("forged-admin"), session.sessionId)).rejects.toMatchObject({
        code: "IMPERSONATION_IDENTITY_CONFLICT",
      });

      expect(store.commitEndAttemptCount).toBe(0);
      await expectNoEndSideEffects(session.sessionId);
    });

    it("rejects a different privileged actor without revoking or publishing", async () => {
      const session = await startSession();
      authProvider.principal = {
        id: "admin-2",
        permissions: ["impersonation:manage"],
      };

      await expect(service.end(context("admin-2"), session.sessionId)).rejects.toMatchObject({
        code: "IMPERSONATION_SESSION_ACTOR_MISMATCH",
      });

      expect(store.commitEndAttemptCount).toBe(1);
      await expectNoEndSideEffects(session.sessionId);
    });

    it("revokes once and publishes for the authenticated impersonator", async () => {
      const session = await startSession();

      await service.end(context("admin-1"), session.sessionId);

      expect(store.commitEndCount).toBe(1);
      expect(await store.find(session.sessionId)).toBeNull();
      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0]).toBeInstanceOf(ImpersonationEndedEvent);
      expect((eventPublisher.events[0] as ImpersonationEndedEvent).session).toEqual(session);
    });

    it("revokes and publishes once when authorized endings race", async () => {
      const session = await startSession();

      const results = await Promise.allSettled([
        service.end(context("admin-1"), session.sessionId),
        service.end(context("admin-1"), session.sessionId),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toEqual([
        expect.objectContaining({
          reason: expect.objectContaining({ code: "IMPERSONATION_SESSION_NOT_FOUND" }),
        }),
      ]);
      expect(store.commitEndAttemptCount).toBe(2);
      expect(store.commitEndCount).toBe(1);
      expect(await store.find(session.sessionId)).toBeNull();
      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0]).toBeInstanceOf(ImpersonationEndedEvent);
    });

    it("retains recoverable termination evidence when publication fails", async () => {
      const session = await service.start(context("admin-1"), "user-123");
      eventPublisher.clear();
      eventPublisher.nextFailure = new Error("publisher unavailable");

      await expect(service.end(context("admin-1"), session.sessionId)).rejects.toMatchObject({
        code: "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING",
        eventId: `impersonation.session.ended:${session.sessionId}`,
        lifecycle: "ended",
        reconciliationState: "pending",
        sessionId: session.sessionId,
        stage: "publish",
      });

      await expect(store.find(session.sessionId)).resolves.toBeNull();
      const pending = await store.listPendingLifecycleEventIntents();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({ kind: "ended", session });

      await expect(service.publishPendingEvents()).resolves.toBe(1);
      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0]).toBeInstanceOf(ImpersonationEndedEvent);
      expect(eventPublisher.events[0]?.eventId).toBe(pending[0]?.eventId);
      expect((eventPublisher.events[0] as ImpersonationEndedEvent).session).toEqual(session);
      await expect(store.find(session.sessionId)).resolves.toBeNull();
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([]);
    });

    it("publishes a recovered start before an end committed while start is pending", async () => {
      eventPublisher.nextFailure = new Error("publisher unavailable");
      await expect(service.start(context("admin-1"), "user-123")).rejects.toMatchObject({
        code: "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING",
        lifecycle: "started",
        stage: "publish",
      });
      const active = await store.findByImpersonator("admin-1");

      await expect(
        service.end(context("admin-1"), active?.sessionId ?? "missing-session"),
      ).rejects.toMatchObject({
        code: "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING",
        lifecycle: "ended",
        stage: "predecessor",
      });
      await expect(store.listPendingLifecycleEventIntents()).resolves.toMatchObject([
        { kind: "started", session: { sessionId: active?.sessionId } },
        { kind: "ended", session: { sessionId: active?.sessionId } },
      ]);

      await expect(service.publishPendingEvents()).resolves.toBe(2);

      expect(eventPublisher.events.map((event) => event.eventName)).toEqual([
        "impersonation.session.started",
        "impersonation.session.ended",
      ]);
      expect(new Set(eventPublisher.events.map((event) => event.eventId)).size).toBe(2);
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([]);
    });

    it("rejects a missing session", async () => {
      await expect(service.end(context("admin-1"), "non-existent-session")).rejects.toMatchObject({
        code: "IMPERSONATION_SESSION_NOT_FOUND",
      });

      expect(store.commitEndAttemptCount).toBe(0);
      expect(store.commitEndCount).toBe(0);
      expect(eventPublisher.events).toHaveLength(0);
    });
  });

  describe("atomic lifecycle transitions", () => {
    const session = (sessionId: string, impersonatorId = "admin-1"): ImpersonationState =>
      Object.freeze({
        sessionId,
        impersonatorId,
        targetUserId: "user-123",
        startedAt: new Date("2026-08-28T00:00:00.000Z"),
        expiresAt: new Date("2026-08-28T01:00:00.000Z"),
      });

    it("commits only one concurrent start for an impersonator", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-08-28T00:30:00.000Z"));
        const first = createImpersonationStartedEventIntent(session("imp-first"));
        const second = createImpersonationStartedEventIntent(session("imp-second"));

        const results = await Promise.all([store.commitStart(first), store.commitStart(second)]);

        expect(results.sort()).toEqual(["committed", "impersonator-active"]);
        expect(await store.findByImpersonator("admin-1")).toMatchObject({
          sessionId: "imp-first",
        });
        await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([first]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("commits only one concurrent end and retains one intent", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-08-28T00:30:00.000Z"));
        const active = session("imp-active");
        await store.commitStart(createImpersonationStartedEventIntent(active));
        await store.markLifecycleEventPublished(
          `impersonation.session.started:${active.sessionId}`,
        );
        const ended = createImpersonationEndedEventIntent(
          active,
          new Date("2026-08-28T00:45:00.000Z"),
        );

        const results = await Promise.all([
          store.commitEnd(ended, active.impersonatorId),
          store.commitEnd(ended, active.impersonatorId),
        ]);

        expect(results.sort()).toEqual(["committed", "session-not-found"]);
        await expect(store.find(active.sessionId)).resolves.toBeNull();
        await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([ended]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("publishes each start before its end when the clock moves backwards", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-08-28T00:30:00.000Z"));
        const later = session("imp-later", "admin-later");
        const earlier = Object.freeze({
          ...session("imp-earlier", "admin-earlier"),
          startedAt: new Date("2026-08-27T23:59:00.000Z"),
        });
        await store.commitStart(createImpersonationStartedEventIntent(later));
        await store.commitStart(createImpersonationStartedEventIntent(earlier));
        await store.commitEnd(
          createImpersonationEndedEventIntent(later, new Date("2026-08-27T23:58:00.000Z")),
          later.impersonatorId,
        );

        await service.publishPendingEvents(1);
        await service.publishPendingEvents(1);
        await service.publishPendingEvents(1);

        expect(eventPublisher.events.map((event) => event.eventId)).toEqual([
          "impersonation.session.started:imp-earlier",
          "impersonation.session.started:imp-later",
          "impersonation.session.ended:imp-later",
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejects a duplicate session ID without corrupting either actor claim", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-08-28T00:30:00.000Z"));
        const first = session("imp-shared", "admin-first");
        const conflicting = session("imp-shared", "admin-second");
        await store.commitStart(createImpersonationStartedEventIntent(first));

        await expect(
          store.commitStart(createImpersonationStartedEventIntent(conflicting)),
        ).rejects.toMatchObject({ code: "impersonation-core/event-intent-conflict" });

        await expect(store.find("imp-shared")).resolves.toEqual(first);
        await expect(store.findByImpersonator("admin-first")).resolves.toEqual(first);
        await expect(store.findByImpersonator("admin-second")).resolves.toBeNull();

        await store.commitEnd(
          createImpersonationEndedEventIntent(first, new Date("2026-08-28T00:45:00.000Z")),
          first.impersonatorId,
        );
        await expect(
          store.commitStart(createImpersonationStartedEventIntent(conflicting)),
        ).rejects.toMatchObject({ code: "impersonation-core/event-intent-conflict" });

        const second = session("imp-second", "admin-second");
        await expect(
          store.commitStart(createImpersonationStartedEventIntent(second)),
        ).resolves.toBe("committed");
        await expect(store.findByImpersonator("admin-first")).resolves.toBeNull();
        await expect(store.findByImpersonator("admin-second")).resolves.toEqual(second);
      } finally {
        vi.useRealTimers();
      }
    });

    it("uses idempotent acknowledgement and validates pending-list bounds", async () => {
      await expect(store.markLifecycleEventPublished("missing-event")).resolves.toBeUndefined();
      await expect(store.listPendingLifecycleEventIntents(0)).rejects.toMatchObject({
        code: "impersonation-core/event-intent-limit-invalid",
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
