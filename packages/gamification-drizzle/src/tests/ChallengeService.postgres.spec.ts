import {
  ChallengeService,
  ChallengeAccessDeniedProblem,
  ChallengeConflictProblem,
  ChallengeEvidenceProblem,
  ChallengeEvidenceUnavailableProblem,
  type ChallengeAccess,
  type ChallengeDefinition,
  type ChallengeEvidence,
} from "@croco/gamification-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleChallengeStore,
  challengeSchema,
  createChallengeSchema,
  dropChallengeSchema,
} from "../index";

const connectionString = process.env.GAMIFICATION_POSTGRES_URL ?? "";
const scope = { app: "service-fixture", environment: "test", tenantId: "team" };
const epoch = Date.parse("2026-10-08T00:00:00Z");
const date = (ms: number) => new Date(epoch + ms);
(connectionString ? describe : describe.skip)("ChallengeService with PostgreSQL", () => {
  const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
  const dbs = pools.map((pool) => drizzle(pool, { schema: challengeSchema }));
  // Evidence readers use their own connection while a challenge transaction holds its lock.
  const evidencePool = new Pool({ connectionString, max: 2 });
  const evidenceDb = drizzle(evidencePool);
  let time = date(0);
  const unavailableEvents = new Set<string>();
  const access = (subjectId = "a"): ChallengeAccess => ({
    scope,
    challengeId: "challenge",
    subjectId,
    actor: { id: subjectId, reason: "synthetic fixture" },
  });
  const command = (key: string, subjectId = "a") => ({ ...access(subjectId), idempotencyKey: key });
  const options = {
    clock: () => time,
    authorize: async (value: ChallengeAccess) =>
      value.scope.app === scope.app &&
      value.scope.environment === scope.environment &&
      value.scope.tenantId === scope.tenantId,
    isMember: async (value: ChallengeAccess) => {
      const result = await evidenceDb.execute(
        sql`select subject_id from challenge_test_memberships where app = ${value.scope.app} and environment = ${value.scope.environment} and tenant_id = ${value.scope.tenantId} and subject_id = ${value.subjectId}`,
      );
      return result.rows.length === 1;
    },
    sources: {
      activity: async (value: ChallengeAccess, eventId: string): Promise<ChallengeEvidence> => {
        if (unavailableEvents.has(eventId))
          throw new ChallengeEvidenceUnavailableProblem("Synthetic source outage");
        const result = await evidenceDb.execute(
          sql`select subject_id, occurred_at, amount, revision, correction_of from challenge_test_events where app = ${value.scope.app} and environment = ${value.scope.environment} and tenant_id = ${value.scope.tenantId} and event_id = ${eventId} and subject_id = ${value.subjectId}`,
        );
        const row = result.rows[0];
        if (!row)
          throw new ChallengeEvidenceProblem(
            "Verified event does not exist for this scope and member",
          );
        return {
          subjectId: String(row.subject_id),
          occurredAt: new Date(String(row.occurred_at)),
          amount: Number(row.amount),
          revision: Number(row.revision),
          correctionOf: row.correction_of === null ? null : String(row.correction_of),
        };
      },
    },
  };
  const stores = dbs.map((db) => new DrizzleChallengeStore(db));
  const services = stores.map((store) => new ChallengeService({ ...options, store }));
  const definition: ChallengeDefinition = {
    id: "challenge",
    scope,
    version: 1,
    start: date(1000),
    end: date(10000),
    goal: 10,
    memberCap: 5,
    minMembers: 2,
    lateAllowanceMs: 1000,
    visibility: "consented",
    leavePolicy: "retain",
  };
  const create = (patch: Partial<ChallengeDefinition> = {}) =>
    services[0].create({ ...command("create"), definition: { ...definition, ...patch } });
  const join = (
    subjectId: string,
    key = `join-${subjectId}`,
    leavePolicy: "retain" | "remove" = "retain",
    publicConsent = true,
  ) =>
    services[0].join({ ...command(key, subjectId), consentVersion: 1, leavePolicy, publicConsent });
  const event = async (
    id: string,
    subjectId: string,
    amount: number,
    occurredMs: number,
    revision = 1,
    correctionOf: string | null = null,
  ) => {
    await evidenceDb.execute(
      sql`insert into challenge_test_events (app, environment, tenant_id, event_id, subject_id, occurred_at, amount, revision, correction_of) values (${scope.app}, ${scope.environment}, ${scope.tenantId}, ${id}, ${subjectId}, ${date(occurredMs)}, ${amount}, ${revision}, ${correctionOf})`,
    );
  };
  const contribute = (index: number, id: string, subjectId = "a", key = id) =>
    services[index].contribute({ ...command(key, subjectId), sourceId: "activity", eventId: id });
  beforeAll(async () => {
    await dropChallengeSchema(dbs[0]);
    await createChallengeSchema(dbs[0]);
    await evidenceDb.execute(
      sql`create table challenge_test_memberships (app text, environment text, tenant_id text, subject_id text, primary key(app, environment, tenant_id, subject_id))`,
    );
    await evidenceDb.execute(
      sql`create table challenge_test_events (app text, environment text, tenant_id text, event_id text, subject_id text, occurred_at timestamptz, amount integer, revision integer, correction_of text, primary key(app, environment, tenant_id, event_id))`,
    );
  });
  beforeEach(async () => {
    time = date(0);
    unavailableEvents.clear();
    await dbs[0].execute(
      sql`truncate gamification_challenge_evidence_attempts, gamification_challenge_buckets, gamification_challenges, gamification_challenge_members, gamification_challenge_contributions, gamification_challenge_receipts, gamification_challenge_completions, gamification_challenge_erased_events, gamification_challenge_erased_subjects, challenge_test_memberships, challenge_test_events`,
    );
    for (const subject of ["a", "b"])
      await evidenceDb.execute(
        sql`insert into challenge_test_memberships values (${scope.app}, ${scope.environment}, ${scope.tenantId}, ${subject})`,
      );
  });
  afterAll(async () => {
    await evidenceDb.execute(sql`drop table challenge_test_events, challenge_test_memberships`);
    await dropChallengeSchema(dbs[0]);
    await Promise.all([...pools, evidencePool].map((pool) => pool.end()));
  });
  it("serializes capped service contributions and duplicate events, settles once and survives a new pool", async () => {
    await create();
    await join("a");
    await join("b", "join-b", "retain", false);
    time = date(2000);
    await event("a-first", "a", 4, 2000);
    await event("a-last-1", "a", 4, 2000);
    await event("a-last-2", "a", 4, 2000);
    await event("b-first", "b", 5, 2000);
    await contribute(0, "a-first");
    await contribute(1, "b-first", "b");
    const raced = await Promise.all([contribute(0, "a-last-1"), contribute(1, "a-last-2")]);
    expect(raced.map((view) => view.challenge.progress)).toEqual([10, 10]);
    const beforeReplay = await stores[0].transact(scope, "challenge", async (tx) => ({
      receipts: tx.receipts.length,
      events: tx.contributions.length,
    }));
    expect((await contribute(1, "a-last-1")).challenge.progress).toBe(10);
    await expect(contribute(0, "a-last-1", "a", "different-key")).rejects.toBeInstanceOf(
      ChallengeConflictProblem,
    );
    expect(
      await stores[1].transact(scope, "challenge", async (tx) => ({
        receipts: tx.receipts.length,
        events: tx.contributions.length,
      })),
    ).toEqual(beforeReplay);
    await expect(
      services[0].contribute({
        ...command("unverified"),
        sourceId: "client-claim",
        eventId: "fabricated",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    const view = await services[1].read(access());
    expect(view.participants).toEqual([{ subjectId: "a", progress: 5 }]);
    await expect(
      services[0].read({ ...access(), scope: { ...scope, tenantId: "other-team" } }),
    ).rejects.toBeInstanceOf(ChallengeAccessDeniedProblem);
    time = date(11000);
    const finals = await Promise.all(
      services.map((service, index) => service.close(command(`close-${index}`))),
    );
    expect(finals.map((result) => result.challenge.state)).toEqual(["completed", "completed"]);
    const freshPool = new Pool({ connectionString, max: 1 });
    try {
      const freshStore = new DrizzleChallengeStore(drizzle(freshPool, { schema: challengeSchema }));
      const restarted = new ChallengeService({ ...options, store: freshStore });
      expect((await restarted.close(command("close-restarted"))).challenge).toEqual(
        finals[0].challenge,
      );
      await freshStore.transact(scope, "challenge", async (tx) => {
        expect(tx.completion).toMatchObject({ progress: 10, memberCount: 2, definitionVersion: 1 });
        expect(tx.contributions).toHaveLength(4);
      });
    } finally {
      await freshPool.end();
    }
    const count = await dbs[0].execute(
      sql`select count(*)::integer as count from gamification_challenge_completions`,
    );
    expect(count.rows[0].count).toBe(1);
    await services[0].eraseSubject(command("erase-a"));
    const erasedReplay = await contribute(1, "a-last-1");
    expect(erasedReplay.self).toBeNull();
    expect(erasedReplay.participants).toEqual([]);
    expect(erasedReplay.challenge.progress).toBe(10);
    await stores[0].transact(scope, "challenge", async (tx) => {
      expect(tx.members.map((member) => member.subjectId)).toEqual(["b"]);
      expect(tx.contributions.every((item) => item.subjectId === "b")).toBe(true);
      expect(tx.receipts.every((receipt) => receipt.actor !== "a")).toBe(true);
      expect(tx.erasedEventIds).toHaveLength(3);
      expect(tx.evidenceAttempts.every((item) => item.subjectId !== "a")).toBe(true);
      expect(tx.completion?.progress).toBe(10);
    });
  });
  it("rejects the same event through another source and corrections to another source", async () => {
    await create({ minMembers: 1, memberCap: null });
    await join("a");
    time = date(2000);
    await event("shared-event", "a", 4, 2000);
    await contribute(0, "shared-event");
    const otherSource = new ChallengeService({
      ...options,
      store: stores[1],
      sources: { ...options.sources, alternate: options.sources.activity },
    });
    await expect(
      otherSource.contribute({
        ...command("duplicate-other-source"),
        sourceId: "alternate",
        eventId: "shared-event",
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await event("foreign-source-correction", "a", 9, 2000, 2, "shared-event");
    await expect(
      otherSource.contribute({
        ...command("foreign-correction"),
        sourceId: "alternate",
        eventId: "foreign-source-correction",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    const view = await services[0].read(access());
    expect(view.challenge.progress).toBe(4);
    expect(view.pendingEvidenceCount).toBe(0);
    await stores[0].transact(scope, "challenge", async (tx) => {
      expect(tx.contributions).toHaveLength(1);
      expect(tx.evidenceAttempts.filter((item) => item.state === "rejected")).toHaveLength(1);
    });
  });
  it("allows a valid delivery after another subject or source has a rejected claim", async () => {
    await create({ minMembers: 1, memberCap: null });
    await join("a");
    await join("b");
    time = date(2000);
    await event("subject-owned", "a", 4, 2000);
    await expect(contribute(0, "subject-owned", "b", "wrong-subject")).rejects.toBeInstanceOf(
      ChallengeEvidenceProblem,
    );
    expect((await contribute(1, "subject-owned", "a", "valid-subject")).challenge.progress).toBe(4);
    await event("source-owned", "a", 3, 2000);
    const wrongSource = new ChallengeService({
      ...options,
      store: stores[0],
      sources: {
        alternate: async () => {
          throw new ChallengeEvidenceProblem("Not an event from this source");
        },
      },
    });
    await expect(
      wrongSource.contribute({
        ...command("wrong-source"),
        sourceId: "alternate",
        eventId: "source-owned",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    expect((await contribute(1, "source-owned", "a", "valid-source")).challenge.progress).toBe(7);
    await expect(
      contribute(0, "source-owned", "a", "duplicate-after-accept"),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await stores[1].transact(scope, "challenge", async (tx) => {
      expect(tx.contributions).toHaveLength(2);
      expect(tx.evidenceAttempts).toHaveLength(4);
      expect(new Set(tx.evidenceAttempts.map((item) => item.id)).size).toBe(4);
      expect(new Set(tx.evidenceAttempts.map((item) => item.eventId)).size).toBe(2);
      expect(tx.evidenceAttempts.filter((item) => item.state === "accepted")).toHaveLength(2);
      expect(tx.evidenceAttempts.filter((item) => item.state === "rejected")).toHaveLength(2);
    });
    expect((await services[0].read(access())).pendingEvidenceCount).toBe(0);
  });
  it("settles after another source accepts a global event while the first source stays offline", async () => {
    await create({ goal: 5, minMembers: 1, memberCap: null });
    await join("a");
    time = date(2000);
    await event("global-delivery", "a", 5, 2000);
    let unavailableCalls = 0;
    const offline = new ChallengeService({
      ...options,
      store: stores[0],
      sources: {
        offline: async () => {
          unavailableCalls++;
          throw new ChallengeEvidenceUnavailableProblem("Source remains offline");
        },
      },
    });
    await expect(
      offline.contribute({
        ...command("offline-global"),
        sourceId: "offline",
        eventId: "global-delivery",
      }),
    ).rejects.toBeInstanceOf(ChallengeEvidenceUnavailableProblem);
    expect((await services[1].read(access())).pendingEvidenceCount).toBe(1);
    const accepted = await contribute(1, "global-delivery", "a", "authoritative-global");
    expect(accepted.challenge.progress).toBe(5);
    expect(accepted.pendingEvidenceCount).toBe(0);
    time = date(11000);
    const freshPool = new Pool({ connectionString, max: 1 });
    try {
      const freshStore = new DrizzleChallengeStore(drizzle(freshPool, { schema: challengeSchema }));
      const restarted = new ChallengeService({ ...options, store: freshStore });
      const final = await restarted.close(command("close-global"));
      expect(final.challenge.state).toBe("completed");
      expect(final.challenge.progress).toBe(5);
      await freshStore.transact(scope, "challenge", async (tx) => {
        expect(tx.contributions).toHaveLength(1);
        expect(tx.evidenceAttempts).toHaveLength(2);
        expect(tx.evidenceAttempts.find((attempt) => attempt.sourceId === "offline")?.state).toBe(
          "rejected",
        );
        expect(tx.evidenceAttempts.find((attempt) => attempt.sourceId === "activity")?.state).toBe(
          "accepted",
        );
        expect(tx.completion?.progress).toBe(5);
      });
      const count = await dbs[0].execute(
        sql`select count(*)::integer as count from gamification_challenge_completions`,
      );
      expect(count.rows[0].count).toBe(1);
      expect(unavailableCalls).toBe(1);
    } finally {
      await freshPool.end();
    }
  });
  it("verifies evidence with the same single-connection pool used by the challenge store", async () => {
    await create({ goal: 2, minMembers: 1, memberCap: 2 });
    await join("a");
    time = date(2000);
    await event("shared-pool-event", "a", 9, 2000);
    // Bound a regression failure in this test harness; production does not gain timeout behavior.
    const sharedPool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 1000 });
    try {
      const sharedStore = new DrizzleChallengeStore(
        drizzle(sharedPool, { schema: challengeSchema }),
      );
      const service = new ChallengeService({
        ...options,
        store: sharedStore,
        sources: {
          activity: async (value, eventId) => {
            const result = await sharedPool.query<{
              subject_id: string;
              occurred_at: Date;
              amount: number;
              revision: number;
              correction_of: string | null;
            }>(
              "select subject_id, occurred_at, amount, revision, correction_of from challenge_test_events where app = $1 and environment = $2 and tenant_id = $3 and event_id = $4 and subject_id = $5",
              [
                value.scope.app,
                value.scope.environment,
                value.scope.tenantId,
                eventId,
                value.subjectId,
              ],
            );
            const row = result.rows[0];
            if (!row) throw new ChallengeEvidenceProblem("Missing shared-pool fixture");
            return {
              subjectId: row.subject_id,
              occurredAt: row.occurred_at,
              amount: row.amount,
              revision: row.revision,
              correctionOf: row.correction_of,
            };
          },
        },
      });
      const result = await service.contribute({
        ...command("shared-pool"),
        sourceId: "activity",
        eventId: "shared-pool-event",
      });
      expect(result.challenge.progress).toBe(2);
      expect(result.pendingEvidenceCount).toBe(0);
      time = date(11000);
      expect((await service.close(command("shared-pool-close"))).challenge.state).toBe("completed");
      await stores[1].transact(scope, "challenge", async (tx) => {
        expect(tx.evidenceAttempts).toHaveLength(1);
        expect(tx.evidenceAttempts[0].state).toBe("accepted");
        expect(tx.contributions).toHaveLength(1);
        expect(tx.contributions[0].amount).toBe(9);
        expect(tx.challenge?.progress).toBe(2);
        expect(tx.completion?.progress).toBe(2);
      });
    } finally {
      await sharedPool.end();
    }
  });
  it.each(["contribution", "correction"] as const)(
    "persists unavailable %s through restart and blocks close until explicit recovery",
    async (kind) => {
      await create({ goal: 5, minMembers: 1, memberCap: null });
      await join("a");
      time = date(2000);
      if (kind === "correction") {
        await event("original", "a", 8, 2000);
        await contribute(0, "original");
      }
      const eventId = `unavailable-${kind}`;
      await event(
        eventId,
        "a",
        5,
        2000,
        kind === "correction" ? 2 : 1,
        kind === "correction" ? "original" : null,
      );
      unavailableEvents.add(eventId);
      await expect(contribute(0, eventId)).rejects.toBeInstanceOf(
        ChallengeEvidenceUnavailableProblem,
      );
      expect((await services[1].read(access())).pendingEvidenceCount).toBe(1);
      time = date(11000);
      const freshPool = new Pool({ connectionString, max: 1 });
      try {
        const freshStore = new DrizzleChallengeStore(
          drizzle(freshPool, { schema: challengeSchema }),
        );
        const restarted = new ChallengeService({ ...options, store: freshStore });
        expect((await restarted.read(access())).pendingEvidenceCount).toBe(1);
        await expect(restarted.close(command("blocked-close"))).rejects.toBeInstanceOf(
          ChallengeConflictProblem,
        );
        await freshStore.transact(scope, "challenge", async (tx) => {
          expect(tx.completion).toBeNull();
          expect(tx.challenge?.finalizedAt).toBeNull();
          expect(tx.evidenceAttempts.filter((attempt) => attempt.state === "unknown")).toHaveLength(
            1,
          );
        });
        unavailableEvents.delete(eventId);
        const recovered = await Promise.all([
          restarted.contribute({ ...command(eventId), sourceId: "activity", eventId }),
          contribute(1, eventId),
        ]);
        expect(
          recovered.map((view) => [view.challenge.progress, view.pendingEvidenceCount]),
        ).toEqual([
          [5, 0],
          [5, 0],
        ]);
        await expect(
          freshStore.transact(scope, "challenge", async (tx) => {
            const accepted = tx.evidenceAttempts.find((attempt) => attempt.state === "accepted");
            if (!accepted) throw new ChallengeEvidenceProblem("Missing accepted fixture");
            tx.saveEvidenceAttempt({ ...accepted, state: "unknown" });
          }),
        ).rejects.toBeInstanceOf(ChallengeConflictProblem);
        const settled = await Promise.all([
          restarted.close(command("close-recovered")),
          services[1].close(command("close-other")),
        ]);
        expect(settled.map((view) => view.challenge.state)).toEqual(["completed", "completed"]);
        await freshStore.transact(scope, "challenge", async (tx) => {
          expect(tx.completion?.progress).toBe(5);
          expect(tx.evidenceAttempts.every((attempt) => attempt.state === "accepted")).toBe(true);
        });
        const count = await dbs[0].execute(
          sql`select count(*)::integer as count from gamification_challenge_completions`,
        );
        expect(count.rows[0].count).toBe(1);
      } finally {
        await freshPool.end();
      }
    },
  );
  it("persists membership intervals and correction revisions across restart without restoring removed credits", async () => {
    await create({ goal: 20, memberCap: null, minMembers: 1, leavePolicy: "remove" });
    time = date(2000);
    await join("a", "join-a", "remove");
    await event("prejoin", "a", 9, 1000);
    await expect(contribute(0, "prejoin")).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    await event("original", "a", 8, 2000);
    await contribute(0, "original");
    time = date(3000);
    await services[0].leave(command("leave"));
    await event("postleave", "a", 9, 3000);
    await expect(contribute(1, "postleave")).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
    time = date(4000);
    const rejoined = await join("a", "rejoin-a", "remove");
    expect(rejoined.challenge.progress).toBe(0);
    await event("current", "a", 8, 4000);
    await contribute(1, "current");
    await event("correction-z", "a", 3, 4000, 2, "current");
    await contribute(0, "correction-z");
    await event("correction-a", "a", 6, 4000, 3, "current");
    await contribute(1, "correction-a");
    const freshPool = new Pool({ connectionString, max: 1 });
    try {
      const freshStore = new DrizzleChallengeStore(drizzle(freshPool, { schema: challengeSchema }));
      const restarted = new ChallengeService({ ...options, store: freshStore });
      expect((await restarted.read(access())).challenge.progress).toBe(6);
      await event("stale-correction", "a", 100, 4000, 2, "current");
      await expect(
        restarted.contribute({
          ...command("stale"),
          sourceId: "activity",
          eventId: "stale-correction",
        }),
      ).rejects.toBeInstanceOf(ChallengeEvidenceProblem);
      await restarted.eraseSubject(command("erase"));
      expect((await restarted.read(access())).challenge.progress).toBe(0);
      await expect(
        restarted.join({ ...command("post-erase-join"), consentVersion: 1, leavePolicy: "remove" }),
      ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    } finally {
      await freshPool.end();
    }
  });
});
