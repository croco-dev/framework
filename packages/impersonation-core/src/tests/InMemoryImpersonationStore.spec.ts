import { Container } from "@croco/framework-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImpersonationEndedEventIntent,
  createImpersonationStartedEventIntent,
} from "../libs/eventIntent";
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

function mutableClock(initialTime: Date): { now: () => Date; set: (time: Date) => void } {
  let currentTime = initialTime;
  return {
    now: () => new Date(currentTime),
    set: (time) => {
      currentTime = time;
    },
  };
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
        candidates.map((candidate) =>
          store.commitStart(createImpersonationStartedEventIntent(candidate)),
        ),
      );

      expect(results.filter((result) => result === "committed")).toHaveLength(1);
      expect(results.filter((result) => result === "impersonator-active")).toHaveLength(1);
      expect(candidates).toContainEqual(await store.findByImpersonator("admin-1"));
    });

    it("allows different actors to claim sessions independently", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();

      const results = await Promise.all(
        [session("imp-admin-1", "admin-1"), session("imp-admin-2", "admin-2")].map((candidate) =>
          store.commitStart(createImpersonationStartedEventIntent(candidate)),
        ),
      );

      expect(results).toEqual(["committed", "committed"]);
      expect((await store.findByImpersonator("admin-1"))?.sessionId).toBe("imp-admin-1");
      expect((await store.findByImpersonator("admin-2"))?.sessionId).toBe("imp-admin-2");
    });

    it("reports a conflicting lifecycle event identity", async () => {
      const store = createStore();
      const intent = createImpersonationStartedEventIntent(session("imp-conflict", "admin-1"));

      await expect(
        store.commitStart({ ...intent, eventId: "impersonation.session.started:other-session" }),
      ).rejects.toMatchObject({
        category: "Conflict",
        detail:
          "Impersonation lifecycle event intent 'impersonation.session.started:other-session' conflicts with the stored session state",
      });
    });

    it("replaces an expired session without allowing a stale end to remove the replacement", async () => {
      vi.useFakeTimers();
      const store = createStore();
      const expiresAt = new Date("2026-01-01T00:01:00.000Z");
      const expired = session("imp-expired", "admin-1", expiresAt);
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      await expect(store.commitStart(createImpersonationStartedEventIntent(expired))).resolves.toBe(
        "committed",
      );

      vi.setSystemTime(expiresAt);
      const replacements = [
        session("imp-replacement-1", "admin-1"),
        session("imp-replacement-2", "admin-1"),
      ];
      const results = await Promise.all(
        replacements.map((candidate) =>
          store.commitStart(createImpersonationStartedEventIntent(candidate)),
        ),
      );
      const winnerIndex = results.findIndex((result) => result === "committed");

      expect(winnerIndex).not.toBe(-1);
      expect(results.filter((result) => result === "committed")).toHaveLength(1);
      await expect(
        store.commitEnd(
          createImpersonationEndedEventIntent(expired, expiresAt),
          expired.impersonatorId,
        ),
      ).resolves.toBe("session-not-found");
      expect(await store.findByImpersonator("admin-1")).toEqual(replacements[winnerIndex]);
    });

    it("does not commit an end intent for a different actor", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const activeSession = session("imp-owner", "admin-1");
      const intent = createImpersonationStartedEventIntent(activeSession);
      await store.commitStart(intent);

      await expect(
        store.commitEnd(createImpersonationEndedEventIntent(activeSession, new Date()), "admin-2"),
      ).resolves.toBe("actor-mismatch");
      await expect(store.find(activeSession.sessionId)).resolves.toEqual(activeSession);
      await expect(store.findByImpersonator(activeSession.impersonatorId)).resolves.toEqual(
        activeSession,
      );
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([intent]);
    });

    it("returns one committed result when authorized endings race", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const activeSession = session("imp-race", "admin-1");
      const started = createImpersonationStartedEventIntent(activeSession);
      await store.commitStart(started);
      await store.markLifecycleEventPublished(started.eventId);
      const ended = createImpersonationEndedEventIntent(activeSession, new Date());

      const results = await Promise.all([
        store.commitEnd(ended, activeSession.impersonatorId),
        store.commitEnd(ended, activeSession.impersonatorId),
      ]);

      expect(results).toContain("committed");
      expect(results).toContain("session-not-found");
      await expect(store.find(activeSession.sessionId)).resolves.toBeNull();
      await expect(store.findByImpersonator(activeSession.impersonatorId)).resolves.toBeNull();
      await expect(store.listPendingLifecycleEventIntents()).resolves.toEqual([ended]);
    });

    it("treats an expired session as not found", async () => {
      vi.useFakeTimers();
      const expiresAt = new Date("2026-01-01T00:01:00.000Z");
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const store = createStore();
      const expiredSession = session("imp-expired", "admin-1", expiresAt);
      await store.commitStart(createImpersonationStartedEventIntent(expiredSession));

      vi.setSystemTime(expiresAt);
      await expect(
        store.commitEnd(
          createImpersonationEndedEventIntent(expiredSession, expiresAt),
          expiredSession.impersonatorId,
        ),
      ).resolves.toBe("session-not-found");
      await expect(store.find(expiredSession.sessionId)).resolves.toBeNull();
      await expect(store.findByImpersonator(expiredSession.impersonatorId)).resolves.toBeNull();
    });
  });
}

impersonationStoreConformance(() => {
  return new InMemoryImpersonationStore();
});

describe("InMemoryImpersonationStore clock", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const expiresAt = new Date("2026-01-01T00:01:00.000Z");

  beforeEach(() => {
    Container.reset();
  });

  it.each([
    ["before", new Date(expiresAt.getTime() - 1), true],
    ["at", expiresAt, false],
    ["after", new Date(expiresAt.getTime() + 1), false],
  ])(
    "evaluates find %s the expiry boundary with the injected clock",
    async (_position, now, active) => {
      const store = new InMemoryImpersonationStore({ now: () => now });
      const storedSession = session(`imp-${_position}`, `admin-${_position}`, expiresAt);
      await store.commitStart(createImpersonationStartedEventIntent(storedSession));

      await expect(store.find(storedSession.sessionId)).resolves.toEqual(
        active ? storedSession : null,
      );
    },
  );

  it("uses the same exact-expiry boundary for actor lookup and revocation", async () => {
    const clock = mutableClock(startedAt);
    const store = new InMemoryImpersonationStore({ now: clock.now });
    const lookupSession = session("imp-lookup", "admin-lookup", expiresAt);
    const revokedSession = session("imp-revoke", "admin-revoke", expiresAt);
    await store.commitStart(createImpersonationStartedEventIntent(lookupSession));
    await store.commitStart(createImpersonationStartedEventIntent(revokedSession));

    clock.set(expiresAt);

    await expect(store.findByImpersonator(lookupSession.impersonatorId)).resolves.toBeNull();
    await expect(
      store.commitEnd(
        createImpersonationEndedEventIntent(revokedSession, expiresAt),
        revokedSession.impersonatorId,
      ),
    ).resolves.toBe("session-not-found");
  });

  it("replaces a session when the injected clock reaches its expiry", async () => {
    const clock = mutableClock(startedAt);
    const store = new InMemoryImpersonationStore({ now: clock.now });
    const expiredSession = session("imp-expired-clock", "admin-clock", expiresAt);
    const replacement = session("imp-replacement-clock", "admin-clock");
    await store.commitStart(createImpersonationStartedEventIntent(expiredSession));

    clock.set(expiresAt);

    await expect(
      store.commitStart(createImpersonationStartedEventIntent(replacement)),
    ).resolves.toBe("committed");
    await expect(store.findByImpersonator(replacement.impersonatorId)).resolves.toEqual(
      replacement,
    );
  });

  it("keeps mutable clock state isolated between store instances", async () => {
    const firstClock = mutableClock(startedAt);
    const secondClock = mutableClock(startedAt);
    const firstStore = new InMemoryImpersonationStore({ now: firstClock.now });
    const secondStore = new InMemoryImpersonationStore({ now: secondClock.now });
    const firstSession = session("imp-first-clock", "admin-first-clock", expiresAt);
    const secondSession = session("imp-second-clock", "admin-second-clock", expiresAt);
    await firstStore.commitStart(createImpersonationStartedEventIntent(firstSession));
    await secondStore.commitStart(createImpersonationStartedEventIntent(secondSession));

    firstClock.set(expiresAt);

    await expect(firstStore.find(firstSession.sessionId)).resolves.toBeNull();
    await expect(secondStore.find(secondSession.sessionId)).resolves.toEqual(secondSession);
  });
});
