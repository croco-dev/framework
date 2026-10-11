import {
  ChallengeConflictProblem,
  ChallengeInvalidProblem,
  type Challenge,
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
const scope = { app: "fixture", environment: "test", tenantId: "tenant" };
const now = new Date("2026-10-08T00:00:00Z");
const challenge: Challenge = {
  id: "challenge",
  scope,
  version: 1,
  start: now,
  end: new Date(now.getTime() + 10000),
  goal: 2,
  memberCap: 2,
  minMembers: 1,
  lateAllowanceMs: 0,
  visibility: "aggregate",
  leavePolicy: "retain",
  state: "active",
  progress: 0,
  memberCount: 1,
  erasedProgress: 0,
  finalizedAt: null,
};
const member = {
  subjectId: "synthetic-member",
  intervals: [{ joinedAt: now, leftAt: null }],
  publicConsent: false,
  consentVersion: 1,
};
(connectionString ? describe : describe.skip)("DrizzleChallengeStore PostgreSQL", () => {
  const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
  const dbs = pools.map((pool) => drizzle(pool, { schema: challengeSchema }));
  const stores = dbs.map((db) => new DrizzleChallengeStore(db));
  beforeAll(async () => {
    await dropChallengeSchema(dbs[0]);
    await createChallengeSchema(dbs[0]);
  });
  beforeEach(async () => {
    await dbs[0].execute(
      sql`truncate gamification_challenge_evidence_attempts, gamification_challenge_buckets, gamification_challenges, gamification_challenge_members, gamification_challenge_contributions, gamification_challenge_receipts, gamification_challenge_completions, gamification_challenge_erased_events, gamification_challenge_erased_subjects`,
    );
  });
  afterAll(async () => {
    await dropChallengeSchema(dbs[0]);
    await Promise.all(pools.map((pool) => pool.end()));
  });
  const seed = () =>
    stores[0].transact(scope, challenge.id, async (tx) => {
      tx.saveChallenge(challenge);
      tx.saveMember(member);
    });
  it("serializes initially empty creation across two connections", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        stores[i % 2].transact(scope, challenge.id, async (tx) => {
          if (tx.challenge) return false;
          tx.saveChallenge(challenge);
          return true;
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("commits concurrent final contributions with one durable completion and duplicate-close replay", async () => {
    await seed();
    await Promise.all(
      stores.map((store, i) =>
        store.transact(scope, challenge.id, async (tx) => {
          if (!tx.challenge) throw new ChallengeInvalidProblem("missing");
          const progress = tx.challenge.progress + 1;
          tx.saveContribution({
            eventId: `event-${i}`,
            sourceId: "fixture-source",
            subjectId: member.subjectId,
            occurredAt: now,
            acceptedAt: now,
            amount: 1,
            revision: 1,
            correctionOf: null,
          });
          tx.saveReceipt({
            action: "contribute",
            definitionVersion: 1,
            idempotencyKey: `receipt-${i}`,
            fingerprint: `hash-${i}`,
            subjectHash: "opaque-subject",
            actor: "operator",
            reason: "fixture",
            recordedAt: now,
          });
          tx.saveChallenge({
            ...tx.challenge,
            progress,
            state: progress === 2 ? "completed" : "active",
            finalizedAt: progress === 2 ? now : null,
          });
          if (progress === 2)
            tx.saveCompletion({
              id: "completion",
              challengeId: challenge.id,
              definitionVersion: 1,
              progress,
              memberCount: 1,
              completedAt: now,
            });
        }),
      ),
    );
    await Promise.all(
      stores.map((store) =>
        store.transact(scope, challenge.id, async (tx) => {
          if (tx.completion) tx.saveCompletion(tx.completion);
        }),
      ),
    );
    const freshPool = new Pool({ connectionString, max: 1 });
    try {
      const restarted = new DrizzleChallengeStore(drizzle(freshPool, { schema: challengeSchema }));
      await restarted.transact(scope, challenge.id, async (tx) => {
        expect(tx.challenge?.progress).toBe(2);
        expect(tx.contributions).toHaveLength(2);
        expect(tx.receipts).toHaveLength(2);
        expect(tx.completion?.id).toBe("completion");
      });
    } finally {
      await freshPool.end();
    }
    const result = await dbs[0].execute(
      sql`select count(*)::int as count from gamification_challenge_completions`,
    );
    expect(result.rows[0].count).toBe(1);
  });
  it("rolls back aggregate, membership, receipt and foreign scope writes", async () => {
    await expect(
      stores[0].transact(scope, challenge.id, async (tx) => {
        tx.saveChallenge(challenge);
        tx.saveMember(member);
        tx.saveReceipt({
          action: "contribute",
          definitionVersion: 1,
          idempotencyKey: "r",
          fingerprint: "f",
          subjectHash: "h",
          actor: "actor",
          reason: "reason",
          recordedAt: now,
        });
        throw new ChallengeConflictProblem("rollback");
      }),
    ).rejects.toBeInstanceOf(ChallengeConflictProblem);
    await stores[1].transact(scope, challenge.id, async (tx) => {
      expect(tx.challenge).toBeNull();
      expect(tx.members).toEqual([]);
      expect(tx.receipts).toEqual([]);
    });
    await expect(
      stores[0].transact(scope, challenge.id, async (tx) => {
        tx.saveChallenge({ ...challenge, scope: { ...scope, tenantId: "foreign" } });
      }),
    ).rejects.toBeInstanceOf(ChallengeInvalidProblem);
    await seed();
    await stores[1].transact({ ...scope, tenantId: "foreign" }, challenge.id, async (tx) => {
      expect(tx.challenge).toBeNull();
      expect(tx.members).toEqual([]);
    });
    await expect(
      stores[0].transact(scope, challenge.id, async (tx) => {
        tx.saveCompletion({
          id: "foreign",
          challengeId: "foreign",
          definitionVersion: 1,
          progress: 2,
          memberCount: 1,
          completedAt: now,
        });
      }),
    ).rejects.toBeInstanceOf(ChallengeInvalidProblem);
  });
  it("erases identifying records while preserving anonymous aggregates and opaque replay tombstones", async () => {
    await seed();
    await stores[0].transact(scope, challenge.id, async (tx) => {
      tx.saveContribution({
        eventId: "opaque-event",
        sourceId: "source",
        subjectId: member.subjectId,
        occurredAt: now,
        acceptedAt: now,
        amount: 2,
        revision: 1,
        correctionOf: null,
      });
      tx.saveReceipt({
        action: "contribute",
        definitionVersion: 1,
        idempotencyKey: "opaque-receipt",
        fingerprint: "opaque-fingerprint",
        subjectHash: "opaque-subject",
        actor: member.subjectId,
        reason: "personal fixture",
        recordedAt: now,
      });
      tx.saveChallenge({ ...challenge, progress: 2 });
    });
    await stores[1].transact(scope, challenge.id, async (tx) => {
      tx.eraseSubject(member.subjectId, "opaque-subject");
      tx.saveChallenge({ ...challenge, progress: 2, erasedProgress: 2, memberCount: 0 });
    });
    await stores[0].transact(scope, challenge.id, async (tx) => {
      expect(tx.challenge?.progress).toBe(2);
      expect(tx.members).toEqual([]);
      expect(tx.contributions).toEqual([]);
      expect(tx.erasedEventIds).toEqual(["opaque-event"]);
      expect(tx.erasedSubjectHashes).toEqual(["opaque-subject"]);
      expect(tx.receipts[0]).toMatchObject({ subjectHash: null, actor: "", reason: "" });
      expect(JSON.stringify(tx.receipts)).not.toContain(member.subjectId);
    });
  });
  it("roundtrips safe integers beyond int32 and preserves receipt audit fields after erasure", async () => {
    const large = 2 ** 31 + 17;
    await stores[0].transact(scope, challenge.id, async (tx) => {
      tx.saveChallenge({
        ...challenge,
        version: large,
        goal: large,
        memberCap: large,
        minMembers: large,
        lateAllowanceMs: large,
        progress: large,
        memberCount: large,
        erasedProgress: large,
      });
      tx.saveMember({ ...member, consentVersion: large });
      tx.saveContribution({
        eventId: "large-event",
        sourceId: "source",
        subjectId: member.subjectId,
        occurredAt: now,
        acceptedAt: now,
        amount: large,
        revision: large,
        correctionOf: null,
      });
      tx.saveReceipt({
        idempotencyKey: "large-receipt",
        fingerprint: "opaque-fingerprint",
        action: "contribute",
        definitionVersion: large,
        subjectHash: "subject-hash",
        actor: member.subjectId,
        reason: "fixture",
        recordedAt: now,
      });
      tx.saveCompletion({
        id: "large-completion",
        challengeId: challenge.id,
        definitionVersion: large,
        progress: large,
        memberCount: large,
        completedAt: now,
      });
    });
    await stores[1].transact(scope, challenge.id, async (tx) => {
      expect(tx.challenge).toMatchObject({
        version: large,
        goal: large,
        memberCap: large,
        minMembers: large,
        lateAllowanceMs: large,
        progress: large,
        memberCount: large,
        erasedProgress: large,
      });
      expect(tx.members[0].consentVersion).toBe(large);
      expect(tx.contributions[0]).toMatchObject({ amount: large, revision: large });
      expect(tx.completion).toMatchObject({
        definitionVersion: large,
        progress: large,
        memberCount: large,
      });
      expect(tx.receipts[0]).toMatchObject({ action: "contribute", definitionVersion: large });
      tx.eraseSubject(member.subjectId, "subject-hash");
    });
    await stores[0].transact(scope, challenge.id, async (tx) => {
      expect(tx.receipts[0]).toMatchObject({
        action: "contribute",
        definitionVersion: large,
        subjectHash: null,
        actor: "",
        reason: "",
      });
    });
  });
  it("reapplies explicit migration without losing persisted records", async () => {
    await seed();
    await createChallengeSchema(dbs[0]);
    await stores[1].transact(scope, challenge.id, async (tx) => {
      expect(tx.challenge?.id).toBe(challenge.id);
      expect(tx.members).toHaveLength(1);
    });
  });
});
