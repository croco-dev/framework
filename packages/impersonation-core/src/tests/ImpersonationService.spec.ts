import "reflect-metadata";
import { type EventBus, EventBusConfig } from "@croco/events-core";
import type { RequestContext } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { ImpersonationService } from "../libs/ImpersonationService";
import { AuthProvider, ImpersonationStore } from "../libs/interfaces";
import type { ImpersonationConfig, ImpersonationState } from "../libs/types";

class MockEventBus implements EventBus {
  private subscriptions = new Set<import("@croco/events-core").EventSubscription>();

  async publish(event: any): Promise<void> {
    const eventName = event.constructor.eventName;
    for (const sub of this.subscriptions) {
      if (sub.eventName === eventName && sub.handler) {
        await sub.handler.handle(event);
      }
    }
  }

  subscribe(subscription: import("@croco/events-core").EventSubscription): void {
    this.subscriptions.add(subscription);
  }

  unsubscribe(subscription: import("@croco/events-core").EventSubscription): void {
    this.subscriptions.delete(subscription);
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

class MockImpersonationStore extends ImpersonationStore {
  private sessions = new Map<string, ImpersonationState>();

  async save(session: ImpersonationState): Promise<void> {
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

  clear(): void {
    this.sessions.clear();
  }
}

class MockAuthProvider extends AuthProvider {
  getCurrentUserId(): string | null {
    return null;
  }
}

describe("ImpersonationService", () => {
  let service!: ImpersonationService;
  let store!: MockImpersonationStore;
  let authProvider!: MockAuthProvider;
  let config: ImpersonationConfig;

  beforeEach(() => {
    Container.reset();

    const eventBus = new MockEventBus();
    const eventBusConfig = EventBusConfig.getInstance();
    eventBusConfig.setEventBus(eventBus);

    store = new MockImpersonationStore();
    authProvider = new MockAuthProvider();
    config = {
      maxDurationMs: 30 * 60 * 1000,
      requireReason: false,
      blockedActions: [],
    };

    service = new ImpersonationService(store, authProvider, config);
  });

  describe("start", () => {
    it("should create impersonation session", async () => {
      const result = await service.start("admin-1", "user-123", "Support request");

      expect(result.sessionId).toBeDefined();
      expect(result.impersonatorId).toBe("admin-1");
      expect(result.targetUserId).toBe("user-123");
      expect(result.reason).toBe("Support request");
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should throw error when impersonating self", async () => {
      await expect(service.start("user-1", "user-1")).rejects.toThrow(
        "Cannot impersonate yourself",
      );
    });

    it("should throw error when nested impersonation attempted", async () => {
      await service.start("admin-1", "user-123");

      await expect(service.start("admin-1", "user-456")).rejects.toThrow(
        "Nested impersonation is not allowed",
      );
    });

    it("should throw error when reason is required but not provided", async () => {
      config = { maxDurationMs: 30 * 60 * 1000, requireReason: true, blockedActions: [] };
      service = new ImpersonationService(store, authProvider, config);

      await expect(service.start("admin-1", "user-123")).rejects.toThrow(
        "Impersonation reason is required",
      );
    });

    it("should allow impersonation without reason when not required", async () => {
      const result = await service.start("admin-1", "user-123");

      expect(result.reason).toBeUndefined();
    });

    it("should save session to store", async () => {
      const result = await service.start("admin-1", "user-123", "Testing");

      const saved = await store.find(result.sessionId);
      expect(saved).toEqual(result);
    });

    it("should set expiration time based on config", async () => {
      config = { maxDurationMs: 60 * 1000, requireReason: false, blockedActions: [] };
      service = new ImpersonationService(store, authProvider, config);

      const result = await service.start("admin-1", "user-123");
      const expectedExpiresAt = new Date(result.startedAt.getTime() + 60 * 1000);

      expect(result.expiresAt.getTime()).toBe(expectedExpiresAt.getTime());
    });
  });

  describe("end", () => {
    it("should revoke existing session", async () => {
      const session = await service.start("admin-1", "user-123");

      await service.end(session.sessionId);

      const revoked = await store.find(session.sessionId);
      expect(revoked).toBeNull();
    });

    it("should throw error when session not found", async () => {
      await expect(service.end("non-existent-session")).rejects.toThrow(
        "Impersonation session not found: non-existent-session",
      );
    });
  });

  describe("isImpersonating", () => {
    it("should return true when context has impersonation", () => {
      const session: ImpersonationState = {
        sessionId: "imp-123",
        impersonatorId: "admin-1",
        targetUserId: "user-123",
        reason: "Support request",
        startedAt: new Date(),
        expiresAt: new Date(),
      };
      const context: RequestContext = {
        requestId: "req-1",
        impersonation: session,
      } as any;

      const result = service.isImpersonating(context);

      expect(result).toBe(true);
    });

    it("should return false when context has no impersonation", () => {
      const context: RequestContext = {
        requestId: "req-1",
      };

      const result = service.isImpersonating(context);

      expect(result).toBe(false);
    });
  });

  describe("getImpersonator", () => {
    it("should return impersonatorId when context has impersonation", () => {
      const session: ImpersonationState = {
        sessionId: "imp-123",
        impersonatorId: "admin-1",
        targetUserId: "user-123",
        reason: "Support request",
        startedAt: new Date(),
        expiresAt: new Date(),
      };
      const context: RequestContext = {
        requestId: "req-1",
        impersonation: session,
      } as any;

      const result = service.getImpersonator(context);

      expect(result).toBe("admin-1");
    });

    it("should return null when context has no impersonation", () => {
      const context: RequestContext = {
        requestId: "req-1",
      };

      const result = service.getImpersonator(context);

      expect(result).toBeNull();
    });
  });

  describe("getTargetUser", () => {
    it("should return targetUserId when context has impersonation", () => {
      const session: ImpersonationState = {
        sessionId: "imp-123",
        impersonatorId: "admin-1",
        targetUserId: "user-123",
        reason: "Support request",
        startedAt: new Date(),
        expiresAt: new Date(),
      };
      const context: RequestContext = {
        requestId: "req-1",
        impersonation: session,
      } as any;

      const result = service.getTargetUser(context);

      expect(result).toBe("user-123");
    });

    it("should return null when context has no impersonation", () => {
      const context: RequestContext = {
        requestId: "req-1",
      };

      const result = service.getTargetUser(context);

      expect(result).toBeNull();
    });
  });
});
