import { Container } from "@croco/framework-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryImpersonationStore } from "../libs/InMemoryImpersonationStore";
import type { ImpersonationStore } from "../libs/interfaces";
import type { ImpersonationState } from "../libs/types";

function session(
  sessionId: string,
  impersonatorId: string,
  expiresAt = new Date("2026-01-01T01:00:00.000Z"),
): ImpersonationState {
  return Object.freeze({
    sessionId,
    impersonatorId,
    targetUserId: `target-${sessionId}`,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt,
  });
}

function impersonationStoreConformance(createStore: () => ImpersonationStore): void {
  describe("ImpersonationStore conformance", () => {
    beforeEach(() => {
      Container.reset();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("creates exactly one active session for concurrent claims by one actor", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const candidates = [session("imp-first", "admin-1"), session("imp-second", "admin-1")];

      const results = await Promise.all(
        candidates.map((candidate) => store.createIfNoActiveSession(candidate)),
      );

      expect(results.filter(({ status }) => status === "created")).toHaveLength(1);
      expect(results.filter(({ status }) => status === "active-session-exists")).toHaveLength(1);
      expect(candidates).toContainEqual(await store.findByImpersonator("admin-1"));
    });

    it("allows different actors to claim sessions independently", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();

      const results = await Promise.all([
        store.createIfNoActiveSession(session("imp-admin-1", "admin-1")),
        store.createIfNoActiveSession(session("imp-admin-2", "admin-2")),
      ]);

      expect(results).toEqual([{ status: "created" }, { status: "created" }]);
      expect((await store.findByImpersonator("admin-1"))?.sessionId).toBe("imp-admin-1");
      expect((await store.findByImpersonator("admin-2"))?.sessionId).toBe("imp-admin-2");
    });

    it("replaces an expired session without allowing stale revocation to remove the replacement", async () => {
      vi.useFakeTimers();
      const store = createStore();
      const expiresAt = new Date("2026-01-01T00:01:00.000Z");
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      await expect(
        store.createIfNoActiveSession(session("imp-expired", "admin-1", expiresAt)),
      ).resolves.toEqual({ status: "created" });

      vi.setSystemTime(expiresAt);
      const replacements = [
        session("imp-replacement-1", "admin-1"),
        session("imp-replacement-2", "admin-1"),
      ];
      const results = await Promise.all(
        replacements.map((candidate) => store.createIfNoActiveSession(candidate)),
      );
      const winnerIndex = results.findIndex(({ status }) => status === "created");

      expect(winnerIndex).not.toBe(-1);
      expect(results.filter(({ status }) => status === "created")).toHaveLength(1);
      await expect(store.revoke("imp-expired", "admin-1")).resolves.toEqual({
        outcome: "not-found",
      });
      expect(await store.findByImpersonator("admin-1")).toEqual(replacements[winnerIndex]);
    });

    it("does not revoke a session for a different actor", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const activeSession = session("imp-owner", "admin-1");
      await store.createIfNoActiveSession(activeSession);

      await expect(store.revoke(activeSession.sessionId, "admin-2")).resolves.toEqual({
        outcome: "actor-mismatch",
      });
      await expect(store.find(activeSession.sessionId)).resolves.toEqual(activeSession);
      await expect(store.findByImpersonator(activeSession.impersonatorId)).resolves.toEqual(
        activeSession,
      );
    });

    it("returns one revoked result when authorized revocations race", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const activeSession = session("imp-race", "admin-1");
      await store.createIfNoActiveSession(activeSession);

      const results = await Promise.all([
        store.revoke(activeSession.sessionId, activeSession.impersonatorId),
        store.revoke(activeSession.sessionId, activeSession.impersonatorId),
      ]);

      expect(results).toContainEqual({ outcome: "revoked", session: activeSession });
      expect(results).toContainEqual({ outcome: "not-found" });
      await expect(store.find(activeSession.sessionId)).resolves.toBeNull();
      await expect(store.findByImpersonator(activeSession.impersonatorId)).resolves.toBeNull();
    });

    it("treats an expired session as not found", async () => {
      vi.useFakeTimers();
      const expiresAt = new Date("2026-01-01T00:01:00.000Z");
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const expiredSession = session("imp-expired", "admin-1", expiresAt);
      await store.createIfNoActiveSession(expiredSession);

      vi.setSystemTime(expiresAt);
      await expect(
        store.revoke(expiredSession.sessionId, expiredSession.impersonatorId),
      ).resolves.toEqual({ outcome: "not-found" });
      await expect(store.find(expiredSession.sessionId)).resolves.toBeNull();
      await expect(store.findByImpersonator(expiredSession.impersonatorId)).resolves.toBeNull();
    });
  });
}

impersonationStoreConformance(() => {
  return new InMemoryImpersonationStore();
});
