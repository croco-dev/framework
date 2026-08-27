import { afterEach, describe, expect, it, vi } from "vitest";
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
      await store.revoke("imp-expired");
      expect(await store.findByImpersonator("admin-1")).toEqual(replacements[winnerIndex]);
    });
  });
}

impersonationStoreConformance(() => {
  return new InMemoryImpersonationStore();
});
