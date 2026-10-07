import { describe, expect, it } from "vitest";
import {
  ChallengeService,
  InMemoryChallengeStore,
  ChallengeAccessDeniedProblem,
  ChallengeConflictProblem,
  ChallengeEvidenceProblem,
  ChallengeEvidenceUnavailableProblem,
  ChallengeInvalidProblem,
  ChallengeNotFoundProblem,
} from "../index";
import type {
  ChallengeAccess,
  ChallengeDefinition,
  ChallengeEvidence,
  ChallengeStore,
} from "../index";
const scope = { app: "test", environment: "test", tenantId: "team" };
function fixture(store: ChallengeStore = new InMemoryChallengeStore()) {
  let time = new Date("2026-01-01T00:00:00Z");
  let authorized = true;
  const events = new Map<string, ChallengeEvidence>();
  const options = {
    store,
    clock: () => time,
    authorize: async () => authorized,
    isMember: async () => authorized,
    sources: {
      activity: async (_access: ChallengeAccess, id: string) => {
        const event = events.get(id);
        if (!event) throw new ChallengeEvidenceProblem("Missing event");
        return event;
      },
    },
  };
  const service = new ChallengeService(options);
  const access = (subjectId = "a") => ({
    scope,
    challengeId: "challenge",
    subjectId,
    actor: { id: subjectId, reason: "test" },
  });
  const command = (idempotencyKey: string, subjectId = "a") => ({
    ...access(subjectId),
    idempotencyKey,
  });
  const definition: ChallengeDefinition = {
    id: "challenge",
    version: 1,
    scope,
    start: new Date("2026-01-01T00:00:01Z"),
    end: new Date("2026-01-01T00:00:10Z"),
    goal: 10,
    memberCap: 10,
    minMembers: 1,
    lateAllowanceMs: 1000,
    visibility: "consented",
    leavePolicy: "retain",
  };
  const create = (patch: Partial<ChallengeDefinition> = {}) =>
    service.create({ ...command("create"), definition: { ...definition, ...patch } });
  const join = (subject = "a", key = `join-${subject}`) =>
    service.join({
      ...command(key, subject),
      consentVersion: 1,
      leavePolicy: definition.leavePolicy,
      publicConsent: true,
    });
  const evidence = (
    id: string,
    amount: number,
    subjectId = "a",
    correctionOf: string | null = null,
    revision = 1,
  ) => {
    events.set(id, { subjectId, amount, occurredAt: time, correctionOf, revision });
    return service.contribute({ ...command(id, subjectId), sourceId: "activity", eventId: id });
  };
  return {
    service,
    store,
    options,
    access,
    command,
    definition,
    create,
    join,
    evidence,
    events,
    setTime: (ms: number) => {
      time = new Date(Date.parse("2026-01-01T00:00:00Z") + ms);
    },
    deny: () => {
      authorized = false;
    },
  };
}
describe("ChallengeService", () => {
  it("settles one durable completion only after the late window and survives restart", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    expect((await f.evidence("one", 12)).challenge).toMatchObject({
      state: "active",
      progress: 10,
    });
    await expect(f.service.close(f.command("early"))).rejects.toBeInstanceOf(
      ChallengeConflictProblem,
    );
    f.setTime(10000);
    expect((await f.service.read(f.access())).challenge.state).toBe("closing");
    f.setTime(11000);
    await Promise.all([f.service.close(f.command("close1")), f.service.close(f.command("close2"))]);
    expect((await new ChallengeService(f.options).read(f.access())).challenge.state).toBe(
      "completed",
    );
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.completion?.progress).toBe(10);
    });
    await f.service.leave(f.command("leave"));
    await f.service.eraseSubject(f.command("erase"));
    expect((await f.service.read(f.access())).challenge).toMatchObject({
      state: "completed",
      progress: 10,
      memberCount: 1,
    });
  });
  it("rejects forged, cross-subject, duplicate and unknown-source events", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    await f.evidence("one", 3);
    await expect(
      f.service.contribute({ ...f.command("different"), sourceId: "activity", eventId: "one" }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await expect(
      f.service.contribute({ ...f.command("unknown"), sourceId: "constructor", eventId: "one" }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    f.events.set("forged", {
      subjectId: "b",
      amount: 100,
      occurredAt: new Date("2026-01-01T00:00:02Z"),
      revision: 1,
      correctionOf: null,
    });
    await expect(
      f.service.contribute({ ...f.command("forged"), sourceId: "activity", eventId: "forged" }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
  });
  it("applies corrections deterministically and rejects stale revisions", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    await f.evidence("one", 10);
    expect((await f.evidence("correction", 3, "a", "one", 2)).challenge.progress).toBe(3);
    await expect(f.evidence("stale", 9, "a", "one", 2)).rejects.toBeInstanceOf(
      ChallengeEvidenceProblem,
    );
    f.setTime(11000);
    expect((await f.service.close(f.command("close"))).challenge.state).toBe("expired");
  });
  it("requires consent and never credits activity before joining or in membership gaps", async () => {
    const f = fixture();
    await f.create();
    f.setTime(2000);
    await expect(f.evidence("before", 1)).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    await expect(
      f.service.join({ ...f.command("badconsent"), consentVersion: 9, leavePolicy: "retain" }),
    ).rejects.toBeInstanceOf(ChallengeInvalidProblem);
    await f.join();
    f.setTime(3000);
    await f.service.leave(f.command("leave"));
    f.setTime(4000);
    await expect(f.evidence("gap", 1)).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    await f.join("a", "rejoin");
    f.setTime(5000);
    expect((await f.evidence("after", 1)).selfProgress).toBe(1);
  });
  it("removes prior interval credit permanently under remove policy", async () => {
    const f = fixture();
    await f.create({ leavePolicy: "remove" });
    await f.service.join({ ...f.command("join"), consentVersion: 1, leavePolicy: "remove" });
    f.setTime(2000);
    await f.evidence("one", 8);
    f.setTime(3000);
    expect((await f.service.leave(f.command("leave"))).challenge.progress).toBe(0);
    f.setTime(4000);
    expect(
      (await f.service.join({ ...f.command("rejoin"), consentVersion: 1, leavePolicy: "remove" }))
        .challenge.progress,
    ).toBe(0);
    expect((await f.evidence("two", 2)).challenge.progress).toBe(2);
  });
  it("enforces current authorization on cached retries and isolates tenants", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    await expect(
      f.service.read({ ...f.access(), scope: { ...scope, tenantId: "other" } }),
    ).rejects.toBeInstanceOf(ChallengeNotFoundProblem);
    f.deny();
    await expect(f.join()).rejects.toBeInstanceOf(ChallengeAccessDeniedProblem);
  });
  it("erases raw history without cached response resurrection and fences cap resets", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    await f.evidence("one", 10);
    await f.service.eraseSubject(f.command("erase"));
    const retry = await f.join();
    expect(retry.self).toBeNull();
    expect(retry.selfProgress).toBe(0);
    expect(retry.challenge.progress).toBe(10);
    await expect(f.join("a", "newjoin")).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.members).toEqual([]);
      expect(tx.contributions).toEqual([]);
      expect(
        tx.receipts.every((r) => r.subjectHash === null && r.actor === "" && r.reason === ""),
      ).toBe(true);
      expect(tx.erasedEventIds).toHaveLength(1);
    });
  });
  it("bounds consented participant pages and hides all other raw activity", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    await f.join("b");
    f.setTime(2000);
    await f.evidence("one", 1);
    const view = await f.service.read({ ...f.access(), participantLimit: 1 });
    expect(view.participants).toEqual([{ subjectId: "a", progress: 1 }]);
    expect("contributions" in view).toBe(false);
    await expect(f.service.read({ ...f.access(), participantLimit: 101 })).rejects.toBeInstanceOf(
      ChallengeInvalidProblem,
    );
  });
  it("serializes duplicate delivery and rolls back failed operations", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    const results = await Promise.all([f.evidence("one", 3), f.evidence("one", 3)]);
    expect(results.map((r) => r.challenge.progress)).toEqual([3, 3]);
    await expect(
      f.store.transact(scope, "challenge", async (tx) => {
        tx.eraseSubject("a", "a");
        throw new ChallengeInvalidProblem("abort");
      }),
    ).rejects.toBeInstanceOf(ChallengeInvalidProblem);
    expect((await f.service.read(f.access())).selfProgress).toBe(3);
  });
  it("rejects unsafe numeric totals and policy changes after start", async () => {
    const f = fixture();
    await f.create({ memberCap: null });
    await f.join();
    f.setTime(2000);
    await f.evidence("one", Number.MAX_SAFE_INTEGER);
    await expect(f.evidence("two", 1)).rejects.toBeInstanceOf(ChallengeInvalidProblem);
    await expect(
      f.service.updateDefinition({
        ...f.command("update"),
        expectedVersion: 1,
        definition: { ...f.definition, version: 2 },
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    expect((await f.service.read(f.access())).selfProgress).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("accepts late verified activity and requires minimum members at settlement", async () => {
    const f = fixture();
    await f.create({ minMembers: 2 });
    await f.join();
    f.setTime(2000);
    f.events.set("late", {
      subjectId: "a",
      amount: 10,
      occurredAt: new Date("2026-01-01T00:00:02Z"),
      revision: 1,
      correctionOf: null,
    });
    f.setTime(10500);
    expect(
      (await f.service.contribute({ ...f.command("late"), sourceId: "activity", eventId: "late" }))
        .challenge.progress,
    ).toBe(10);
    f.setTime(11000);
    expect((await f.service.close(f.command("close"))).challenge.state).toBe("expired");
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.completion).toBeNull();
    });
  });
  it("serializes creation and aggregates concurrent capped contributors", async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.create(),
      f.service.create({ ...f.command("other-create"), definition: f.definition }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await f.join();
    await f.join("b");
    f.setTime(2000);
    await Promise.all([
      f.evidence("a-one", 8),
      f.evidence("a-two", 8),
      f.evidence("b-one", 5, "b"),
    ]);
    expect((await f.service.read(f.access())).challenge.progress).toBe(15);
  });
  it("updates only an unconsented future definition with its expected revision", async () => {
    const f = fixture();
    await f.create();
    await expect(
      f.service.updateDefinition({
        ...f.command("stale-update"),
        expectedVersion: 2,
        definition: { ...f.definition, version: 2 },
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    expect(
      (
        await f.service.updateDefinition({
          ...f.command("update"),
          expectedVersion: 1,
          definition: { ...f.definition, version: 2, goal: 20 },
        })
      ).challenge.version,
    ).toBe(2);
    await expect(f.join()).rejects.toBeInstanceOf(ChallengeInvalidProblem);
    await f.service.join({ ...f.command("join2"), consentVersion: 2, leavePolicy: "retain" });
    await expect(
      f.service.updateDefinition({
        ...f.command("update3"),
        expectedVersion: 2,
        definition: { ...f.definition, version: 3 },
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
  });
  it("keeps aggregate visibility private and rejects conflicting retries", async () => {
    const f = fixture();
    await f.create({ visibility: "aggregate" });
    await f.join();
    await f.join("b");
    f.setTime(2000);
    await f.evidence("one", 5);
    const view = await f.service.read(f.access());
    expect(view.participants).toEqual([]);
    expect(view.selfProgress).toBe(5);
    await expect(
      f.service.join({
        ...f.command("join-a"),
        consentVersion: 1,
        leavePolicy: "retain",
        publicConsent: false,
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
  });
  it("reports invalid dates as a stable validation Problem", async () => {
    const f = fixture();
    await expect(f.create({ start: new Date(Number.NaN) })).rejects.toBeInstanceOf(
      ChallengeInvalidProblem,
    );
  });
  it("permits privileged erasure after tenant membership ends and rejects unauthorized actors", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    await f.evidence("one", 4);
    const removedMemberService = new ChallengeService({
      ...f.options,
      isMember: async () => false,
      authorize: async (access, action) =>
        action === "eraseSubject" &&
        access.actor.id === "privacy-admin" &&
        access.subjectId === "a" &&
        access.scope.tenantId === scope.tenantId,
    });
    await expect(
      removedMemberService.eraseSubject({
        ...f.command("denied-erase"),
        actor: { id: "outsider", reason: "erase" },
      }),
    ).rejects.toBeInstanceOf(ChallengeAccessDeniedProblem);
    const result = await removedMemberService.eraseSubject({
      ...f.command("admin-erase"),
      actor: { id: "privacy-admin", reason: "authorized deletion" },
    });
    expect(result.self).toBeNull();
    expect(result.challenge.progress).toBe(4);
    await expect(removedMemberService.read(f.access())).rejects.toBeInstanceOf(
      ChallengeAccessDeniedProblem,
    );
  });
  it("records action and definition version for policy changes and preserves them through erasure", async () => {
    const f = fixture();
    await f.create();
    await f.service.updateDefinition({
      ...f.command("update"),
      expectedVersion: 1,
      definition: { ...f.definition, version: 2 },
    });
    await f.service.eraseSubject(f.command("erase"));
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(
        tx.receipts.map(({ action, definitionVersion }) => ({ action, definitionVersion })),
      ).toEqual([
        { action: "create", definitionVersion: 1 },
        { action: "updateDefinition", definitionVersion: 2 },
        { action: "eraseSubject", definitionVersion: 2 },
      ]);
      expect(
        tx.receipts.every(
          (item) => item.subjectHash === null && item.actor === "" && item.reason === "",
        ),
      ).toBe(true);
    });
  });
  it("only exposes consented participants to an actively joined reader", async () => {
    const f = fixture();
    await f.create();
    await f.join("a");
    await f.join("b");
    await f.service.join({
      ...f.command("private-c", "c"),
      consentVersion: 1,
      leavePolicy: "retain",
      publicConsent: false,
    });
    expect((await f.service.read(f.access("outsider"))).participants).toEqual([]);
    expect((await f.service.read(f.access("a"))).participants.map((p) => p.subjectId)).toEqual([
      "a",
      "b",
    ]);
    await f.service.leave(f.command("leave-a"));
    const former = await f.service.read(f.access("a"));
    expect(former.participants).toEqual([]);
    expect(former.self).not.toBeNull();
  });
  it("turns unavailable and malformed external evidence into stable Problems", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    const cause = new Error("provider disconnected");
    const unavailable = new ChallengeService({
      ...f.options,
      sources: {
        unavailable: async () => {
          throw cause;
        },
      },
    });
    await expect(
      unavailable.contribute({
        ...f.command("unavailable"),
        sourceId: "unavailable",
        eventId: "event",
      }),
    ).rejects.toMatchObject({ code: "gamification-core/challenge-evidence-unavailable", cause });
    await expect(
      unavailable.contribute({
        ...f.command("unavailable"),
        sourceId: "unavailable",
        eventId: "event",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceUnavailableProblem);
    const malformed = new ChallengeService({
      ...f.options,
      sources: { malformed: async () => null as unknown as ChallengeEvidence },
    });
    await expect(
      malformed.contribute({
        ...f.command("malformed"),
        sourceId: "malformed",
        eventId: "malformed-event",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    expect((await f.service.read(f.access())).challenge.progress).toBe(0);
  });
  it("keeps unavailable evidence durable and blocks settlement until explicit retry after cutoff", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    let available = false;
    const options = {
      ...f.options,
      sources: {
        activity: async () => {
          if (!available) throw new Error("offline");
          return {
            subjectId: "a",
            amount: 10,
            occurredAt: new Date("2026-01-01T00:00:02Z"),
            revision: 1,
            correctionOf: null,
          };
        },
      },
    };
    const service = new ChallengeService(options);
    const command = { ...f.command("pending"), sourceId: "activity", eventId: "event" };
    await expect(service.contribute(command)).rejects.toBeInstanceOf(
      ChallengeEvidenceUnavailableProblem,
    );
    expect((await service.read(f.access())).pendingEvidenceCount).toBe(1);
    f.setTime(11000);
    const restarted = new ChallengeService(options);
    await expect(restarted.close(f.command("close"))).rejects.toBeInstanceOf(
      ChallengeConflictProblem,
    );
    expect((await restarted.read(f.access())).challenge.state).toBe("closing");
    await expect(
      restarted.contribute({ ...command, idempotencyKey: "new", eventId: "new" }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await expect(restarted.leave(f.command("pending"))).rejects.toBeInstanceOf(
      ChallengeConflictProblem,
    );
    available = true;
    const retries = await Promise.all([
      restarted.contribute(command),
      restarted.contribute(command),
    ]);
    expect(
      retries.every((item) => item.pendingEvidenceCount === 0 && item.challenge.progress === 10),
    ).toBe(true);
    expect((await restarted.close(f.command("close"))).challenge.state).toBe("completed");
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.evidenceAttempts).toHaveLength(1);
      expect(tx.evidenceAttempts[0]?.state).toBe("accepted");
      expect(tx.contributions).toHaveLength(1);
    });
  });
  it("records invalid evidence as rejected and erasure explicitly removes unresolved attempts", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    const invalid = new ChallengeService({
      ...f.options,
      sources: { invalid: async () => null as unknown as ChallengeEvidence },
    });
    await expect(
      invalid.contribute({ ...f.command("invalid"), sourceId: "invalid", eventId: "invalid" }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.evidenceAttempts[0]?.state).toBe("rejected");
    });
    const unavailable = new ChallengeService({
      ...f.options,
      sources: {
        offline: async () => {
          throw new Error("offline");
        },
      },
    });
    await expect(
      unavailable.contribute({ ...f.command("pending"), sourceId: "offline", eventId: "pending" }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceUnavailableProblem);
    expect((await unavailable.read(f.access())).pendingEvidenceCount).toBe(1);
    await unavailable.eraseSubject(f.command("erase"));
    expect((await unavailable.read(f.access())).pendingEvidenceCount).toBe(0);
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.evidenceAttempts).toEqual([]);
    });
    f.setTime(11000);
    expect((await unavailable.close(f.command("close"))).challenge.state).toBe("expired");
  });
  it("does not let stale rejection overwrite a concurrently accepted attempt", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    let announce = () => {};
    const started = new Promise<void>((resolve) => {
      announce = resolve;
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const rejected = new ChallengeService({
      ...f.options,
      sources: {
        activity: async () => {
          announce();
          await gate;
          throw new ChallengeEvidenceProblem("stale response");
        },
      },
    });
    const accepted = new ChallengeService({
      ...f.options,
      sources: {
        activity: async () => ({
          subjectId: "a",
          amount: 10,
          occurredAt: new Date("2026-01-01T00:00:02Z"),
          revision: 1,
          correctionOf: null,
        }),
      },
    });
    const command = { ...f.command("race"), sourceId: "activity", eventId: "race" };
    const stale = rejected.contribute(command);
    await started;
    expect((await accepted.contribute(command)).challenge.progress).toBe(10);
    release();
    await expect(stale).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.evidenceAttempts[0]?.state).toBe("accepted");
      expect(tx.contributions).toHaveLength(1);
    });
    expect((await accepted.read(f.access())).pendingEvidenceCount).toBe(0);
  });
  it("deduplicates event identity across sources and preserves correction source ownership", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    const event = {
      subjectId: "a",
      amount: 3,
      occurredAt: new Date("2026-01-01T00:00:02Z"),
      revision: 1,
      correctionOf: null,
    };
    const service = new ChallengeService({
      ...f.options,
      sources: {
        first: async () => event,
        second: async (_access, eventId) =>
          eventId === "shared"
            ? event
            : { ...event, amount: 9, revision: 2, correctionOf: "shared" },
      },
    });
    await service.contribute({ ...f.command("first"), sourceId: "first", eventId: "shared" });
    await expect(
      service.contribute({ ...f.command("duplicate"), sourceId: "second", eventId: "shared" }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await expect(
      service.contribute({
        ...f.command("wrong-source-correction"),
        sourceId: "second",
        eventId: "correction",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    expect((await service.read(f.access())).challenge.progress).toBe(3);
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.contributions).toHaveLength(1);
      expect(tx.evidenceAttempts.filter((item) => item.state === "unknown")).toHaveLength(0);
    });
  });
  it("does not let a rejected subject or source claim reserve legitimate event identity", async () => {
    const f = fixture();
    await f.create();
    await f.join("a");
    await f.join("b");
    f.setTime(2000);
    const verified = {
      subjectId: "b",
      amount: 4,
      occurredAt: new Date("2026-01-01T00:00:02Z"),
      revision: 1,
      correctionOf: null,
    };
    const service = new ChallengeService({
      ...f.options,
      sources: {
        trusted: async () => verified,
        invalid: async () => {
          throw new ChallengeEvidenceProblem("Source does not own this event");
        },
      },
    });
    await expect(
      service.contribute({
        ...f.command("wrong-subject", "a"),
        sourceId: "trusted",
        eventId: "shared",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    await expect(
      service.contribute({
        ...f.command("wrong-source", "b"),
        sourceId: "invalid",
        eventId: "shared",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    expect(
      (
        await service.contribute({
          ...f.command("owner", "b"),
          sourceId: "trusted",
          eventId: "shared",
        })
      ).challenge.progress,
    ).toBe(4);
    await expect(
      service.contribute({
        ...f.command("duplicate", "a"),
        sourceId: "invalid",
        eventId: "shared",
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.evidenceAttempts).toHaveLength(3);
      expect(new Set(tx.evidenceAttempts.map((item) => item.id)).size).toBe(3);
      expect(new Set(tx.evidenceAttempts.map((item) => item.eventId)).size).toBe(1);
      expect(tx.contributions).toHaveLength(1);
    });
  });
  it("settles after acceptance proves another unavailable delivery cannot contribute", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    const verified = {
      subjectId: "a",
      amount: 10,
      occurredAt: new Date("2026-01-01T00:00:02Z"),
      revision: 1,
      correctionOf: null,
    };
    const service = new ChallengeService({
      ...f.options,
      sources: {
        pending: async () => {
          throw new Error("offline");
        },
        trusted: async () => verified,
      },
    });
    const pending = { ...f.command("pending-other"), sourceId: "pending", eventId: "shared" };
    await expect(service.contribute(pending)).rejects.toBeInstanceOf(
      ChallengeEvidenceUnavailableProblem,
    );
    await service.contribute({ ...f.command("owner"), sourceId: "trusted", eventId: "shared" });
    f.setTime(11000);
    await expect(service.contribute(pending)).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    expect((await service.read(f.access())).pendingEvidenceCount).toBe(0);
    expect((await service.close(f.command("close"))).challenge.state).toBe("completed");
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.contributions).toHaveLength(1);
      expect(tx.evidenceAttempts.map((item) => item.state).sort()).toEqual([
        "accepted",
        "rejected",
      ]);
    });
  });
  it("releases the transaction during verification and rechecks membership intervals before accepting", async () => {
    const f = fixture();
    await f.create();
    await f.join("a");
    await f.join("b");
    f.setTime(2000);
    let announceStarted = () => {};
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });
    let deliver: (value: ChallengeEvidence) => void = () => {};
    const result = new Promise<ChallengeEvidence>((resolve) => {
      deliver = resolve;
    });
    const service = new ChallengeService({
      ...f.options,
      sources: {
        slow: async () => {
          announceStarted();
          return result;
        },
      },
    });
    const contribution = service.contribute({
      ...f.command("slow"),
      sourceId: "slow",
      eventId: "slow",
    });
    await started;
    f.setTime(3000);
    expect(
      (await service.leave(f.command("leave-b", "b"))).self?.intervals[0]?.leftAt,
    ).not.toBeNull();
    await service.leave(f.command("leave-a"));
    f.setTime(4000);
    deliver({
      subjectId: "a",
      amount: 10,
      occurredAt: new Date("2026-01-01T00:00:04Z"),
      revision: 1,
      correctionOf: null,
    });
    await expect(contribution).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    const view = await service.read(f.access());
    expect(view.challenge.progress).toBe(0);
    expect(view.pendingEvidenceCount).toBe(0);
  });
  it("replays an accepted receipt without invoking an unavailable provider again", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    await f.evidence("accepted", 3);
    const restarted = new ChallengeService({
      ...f.options,
      sources: {
        activity: async () => {
          throw new Error("must not call");
        },
      },
    });
    expect(
      (
        await restarted.contribute({
          ...f.command("accepted"),
          sourceId: "activity",
          eventId: "accepted",
        })
      ).challenge.progress,
    ).toBe(3);
  });
  it.each(["authorization", "membership"] as const)(
    "retains a pending attempt when %s is revoked during verification and accepts the same-key retry",
    async (boundary) => {
      const f = fixture();
      await f.create();
      await f.join();
      f.setTime(2000);
      let permitted = true;
      let announce = () => {};
      const started = new Promise<void>((resolve) => {
        announce = resolve;
      });
      let deliver: (value: ChallengeEvidence) => void = () => {};
      const result = new Promise<ChallengeEvidence>((resolve) => {
        deliver = resolve;
      });
      const service = new ChallengeService({
        ...f.options,
        authorize: async () => boundary !== "authorization" || permitted,
        isMember: async () => boundary !== "membership" || permitted,
        sources: {
          deferred: async () => {
            announce();
            return result;
          },
        },
      });
      const command = {
        ...f.command("retry-preserved"),
        sourceId: "deferred",
        eventId: "deferred",
      };
      const contribution = service.contribute(command);
      await started;
      permitted = false;
      deliver({
        subjectId: "a",
        amount: 10,
        occurredAt: new Date("2026-01-01T00:00:02Z"),
        revision: 1,
        correctionOf: null,
      });
      await expect(contribution).rejects.toBeInstanceOf(ChallengeAccessDeniedProblem);
      await f.store.transact(scope, "challenge", async (tx) => {
        expect(tx.evidenceAttempts[0]?.state).toBe("unknown");
        expect(tx.contributions).toHaveLength(0);
      });
      permitted = true;
      f.setTime(11000);
      expect((await service.contribute(command)).challenge.progress).toBe(10);
      expect((await service.close(f.command("close"))).challenge.state).toBe("completed");
    },
  );
  it("resolves timely historical retain-policy evidence after voluntary leave and cutoff", async () => {
    const f = fixture();
    await f.create();
    await f.join();
    f.setTime(2000);
    let available = false;
    const service = new ChallengeService({
      ...f.options,
      sources: {
        historical: async () => {
          if (!available) throw new Error("temporarily unavailable");
          return {
            subjectId: "a",
            amount: 4,
            occurredAt: new Date("2026-01-01T00:00:02Z"),
            revision: 1,
            correctionOf: null,
          };
        },
      },
    });
    const command = {
      ...f.command("historical-retry"),
      sourceId: "historical",
      eventId: "historical",
    };
    await expect(service.contribute(command)).rejects.toBeInstanceOf(
      ChallengeEvidenceUnavailableProblem,
    );
    f.setTime(3000);
    const left = await service.leave(f.command("leave"));
    expect(left.self?.intervals[0]?.leftAt).toEqual(new Date("2026-01-01T00:00:03Z"));
    expect(left.pendingEvidenceCount).toBe(1);
    f.setTime(12000);
    available = true;
    const resolved = await service.contribute(command);
    expect(resolved.challenge.progress).toBe(4);
    expect(resolved.selfProgress).toBe(4);
    expect(resolved.pendingEvidenceCount).toBe(0);
    expect(resolved.self?.intervals[0]?.leftAt).toEqual(new Date("2026-01-01T00:00:03Z"));
    await f.store.transact(scope, "challenge", async (tx) => {
      expect(tx.evidenceAttempts[0]?.state).toBe("accepted");
      expect(tx.contributions).toHaveLength(1);
    });
  });
});
