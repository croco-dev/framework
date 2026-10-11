import { randomUUID } from "node:crypto";
import {
  RewardConflictProblem,
  RewardService,
  RewardAccessDeniedProblem,
  RewardEvidenceInvalidProblem,
  InvalidRewardPolicyProblem,
  RewardUnavailableProblem,
  selectReward,
} from "@croco/gamification-core";
import type { RewardKey, RewardPolicy, RewardPublication } from "@croco/gamification-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRewardSchema, DrizzleRewardStore, RewardPersistenceProblem } from "../index";

const scope = { appId: "app", environmentId: "test", tenantId: "tenant" };
const policy: RewardPolicy = {
  id: "reward",
  version: "v1",
  title: "Achievement",
  mode: "fixed",
  rewardEntries: [
    { id: "points", kind: "points", unit: "achievement-point", amount: 10, title: "Ten points" },
  ],
  budgetUnit: "achievement-grant",
  cap: 2,
  fallback: { kind: "no-reward" },
  effectiveFrom: "2020-01-01T00:00:00Z",
  effectiveUntil: "2100-01-01T00:00:00Z",
};
const publication = (overrides: Partial<RewardPublication> = {}): RewardPublication => ({
  scope,
  policy,
  expectedRevision: 0,
  actorId: "admin",
  reason: "publish",
  idempotencyKey: "publish-1",
  ...overrides,
});
const key = (evidenceRef: string, subject = "alice"): RewardKey => ({
  scope,
  policyId: policy.id,
  policyVersion: policy.version,
  subject,
  evidenceRef,
});
const selection = (published: Parameters<typeof selectReward>[0], depleted: boolean) =>
  selectReward(published, depleted, () => 0);

describe("DrizzleRewardStore live PostgreSQL", () => {
  const connectionString = process.env.REWARDS_POSTGRES_URL;
  const schemaName = `rewards_test_${randomUUID().replaceAll("-", "")}`;
  const setupPool = new Pool({ connectionString });
  const poolOptions = { connectionString, options: `-c search_path=${schemaName}` };
  const poolA = new Pool(poolOptions);
  const poolB = new Pool(poolOptions);
  let ownsSchema = false;
  const db = drizzle(poolA);
  const first = new DrizzleRewardStore(db);
  const second = new DrizzleRewardStore(drizzle(poolB));
  beforeAll(async () => {
    expect(
      connectionString,
      "REWARDS_POSTGRES_URL is required for PostgreSQL verification",
    ).toBeTruthy();
    await setupPool.query(`create schema "${schemaName}"`);
    ownsSchema = true;
    await createRewardSchema(db);
  });
  beforeEach(async () => {
    await db.execute(
      sql`truncate reward_points, reward_badges, reward_grants, reward_publications, reward_families cascade`,
    );
  });
  afterAll(async () => {
    await Promise.all([poolA.end(), poolB.end()]);
    try {
      if (ownsSchema) await setupPool.query(`drop schema "${schemaName}" cascade`);
    } finally {
      await setupPool.end();
    }
  });
  it("serializes simultaneous pools at the family cap and replays keys without another selection", async () => {
    await first.publish(publication({ policy: { ...policy, cap: 1 } }));
    const select = vi.fn(selection);
    const grants = await Promise.all(
      Array.from({ length: 16 }, async (_, i) => {
        const store = i % 2 ? first : second;
        await store.reserve(key(`e${i}`), select);
        return store.settle(key(`e${i}`));
      }),
    );
    expect(grants.filter((grant) => grant.state === "granted")).toHaveLength(1);
    expect(grants.filter((grant) => grant.rejection === "no-reward")).toHaveLength(15);
    const duplicate = await Promise.all([
      first.reserve(key("e0"), select),
      second.reserve(key("e0"), select),
    ]);
    expect(duplicate[0]).toEqual(duplicate[1]);
    expect(select).toHaveBeenCalledTimes(16);
    expect((await first.getAccount(scope, "alice")).points).toHaveLength(1);
  });
  it("serializes a new logical key across pools and allows only one publication CAS winner", async () => {
    const candidates = await Promise.allSettled([
      first.publish(publication()),
      second.publish(
        publication({
          policy: { ...policy, version: "other" },
          idempotencyKey: "other-publication",
        }),
      ),
    ]);
    expect(candidates.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(candidates.filter((result) => result.status === "rejected")).toHaveLength(1);
    const current = await first.getPolicy(scope, policy.id);
    expect(current).not.toBeNull();
    if (!current) return;
    const select = vi.fn(selection);
    const logicalKey = { ...key("simultaneous"), policyVersion: current.policy.version };
    const results = await Promise.all([
      first.reserve(logicalKey, select),
      second.reserve(logicalKey, select),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(select).toHaveBeenCalledTimes(1);
    expect((await first.getAccount(scope, "alice")).grants).toHaveLength(1);
  });
  it("persists selection across a terminated pool and recovers settlement once", async () => {
    await first.publish(
      publication({
        policy: {
          ...policy,
          mode: "weighted",
          weightedEnabled: true,
          weights: [1, 1],
          rewardEntries: [
            ...policy.rewardEntries,
            { id: "badge", kind: "badge", badgeId: "winner", title: "Winner" },
          ],
        },
      }),
    );
    const transientPool = new Pool(poolOptions);
    const reserved = await new DrizzleRewardStore(drizzle(transientPool)).reserve(
      key("restart"),
      (published, depleted) => selectReward(published, depleted, () => 0.9),
    );
    await transientPool.end();
    const noRedraw = vi.fn(selection);
    expect(await second.reserve(key("restart"), noRedraw)).toEqual(reserved);
    expect(noRedraw).not.toHaveBeenCalled();
    const settled = await Promise.all([
      first.settle(key("restart")),
      second.settle(key("restart")),
    ]);
    expect(settled[0]).toEqual(settled[1]);
    expect(settled[0].selection.receipt.bucket).toBe(1);
    expect((await second.getAccount(scope, "alice")).badges).toHaveLength(1);
  });
  it("preserves primary and fallback consumption across revisions and enforces immutable publication CAS", async () => {
    const bounded: RewardPolicy = {
      ...policy,
      cap: 1,
      fallback: {
        kind: "fixed",
        cap: 1,
        entry: {
          id: "fallback",
          kind: "points",
          unit: "achievement-point",
          amount: 1,
          title: "One point",
        },
      },
    };
    const input = publication({ policy: bounded });
    expect(await second.publish(input)).toEqual(await first.publish(input));
    await expect(first.publish({ ...input, actorId: "other" })).rejects.toBeInstanceOf(
      RewardConflictProblem,
    );
    await first.reserve(key("primary"), selection);
    await first.reserve(key("fallback"), selection);
    const next = publication({
      policy: { ...bounded, version: "v2" },
      expectedRevision: 1,
      idempotencyKey: "publish-2",
    });
    await first.publish(next);
    const old = await second.reserve({ ...key("primary"), policyVersion: "v2" }, () => {
      throw new Error("must not draw");
    });
    expect(old.policyVersion).toBe("v1");
    const exhausted = await second.reserve({ ...key("exhausted"), policyVersion: "v2" }, selection);
    expect(exhausted.selection.entry).toBeNull();
    expect(exhausted.selection.receipt.fallback).toBe(true);
    await expect(
      first.publish(
        publication({
          policy: { ...bounded, version: "v3", cap: 0 },
          expectedRevision: 2,
          idempotencyKey: "shrink",
        }),
      ),
    ).rejects.toBeInstanceOf(RewardConflictProblem);
    await expect(
      first.publish(
        publication({
          policy: { ...bounded, version: "v3" },
          expectedRevision: 1,
          idempotencyKey: "stale",
        }),
      ),
    ).rejects.toBeInstanceOf(RewardConflictProblem);
    await expect(
      first.publish(
        publication({ policy: bounded, expectedRevision: 2, idempotencyKey: "immutable" }),
      ),
    ).rejects.toBeInstanceOf(RewardConflictProblem);
  });
  it("atomically rejects duplicate badge ownership with no reroll, while other subjects and scopes remain independent", async () => {
    const badgePolicy: RewardPolicy = {
      ...policy,
      cap: 10,
      rewardEntries: [{ id: "badge", kind: "badge", badgeId: "achiever", title: "Achiever" }],
    };
    await first.publish(publication({ policy: badgePolicy }));
    await Promise.all([
      first.reserve(key("badge-1"), selection),
      second.reserve(key("badge-2"), selection),
    ]);
    const settled = await Promise.all([
      first.settle(key("badge-1")),
      second.settle(key("badge-2")),
    ]);
    expect(settled.filter((grant) => grant.state === "granted")).toHaveLength(1);
    expect(settled.filter((grant) => grant.rejection === "badge-owned")).toHaveLength(1);
    await first.reserve(key("badge-1", "bob"), selection);
    expect((await first.settle(key("badge-1", "bob"))).state).toBe("granted");
    expect((await second.getAccount({ ...scope, tenantId: "other" }, "alice")).badges).toEqual([]);
    expect(await first.getPolicy({ ...scope, appId: "other" }, policy.id)).toBeNull();
  });
  it("fails closed for stale versions, missing policies, expired windows and selection errors without consuming cap", async () => {
    await expect(first.reserve(key("missing"), selection)).rejects.toBeInstanceOf(
      RewardUnavailableProblem,
    );
    await first.publish(publication());
    await expect(
      first.reserve({ ...key("stale"), policyVersion: "old" }, selection),
    ).rejects.toBeInstanceOf(RewardConflictProblem);
    const failure = new Error("random source failed");
    await expect(
      first.reserve(key("failed"), () => {
        throw failure;
      }),
    ).rejects.toMatchObject({ cause: failure });
    expect((await first.getAccount(scope, "alice")).grants).toEqual([]);
    await first.reserve(key("good-1"), selection);
    expect((await first.reserve(key("good-2"), selection)).selection.entry).not.toBeNull();
    await first.publish(
      publication({
        policy: { ...policy, version: "expired", effectiveUntil: "2021-01-01T00:00:00Z" },
        expectedRevision: 1,
        idempotencyKey: "expired",
      }),
    );
    await expect(
      first.reserve({ ...key("expired"), policyVersion: "expired" }, selection),
    ).rejects.toBeInstanceOf(RewardUnavailableProblem);
  });
  it("runs the service through real persistence with evidence denial, bounded distinct grants and version replay", async () => {
    const evidence = new Map([
      ["mission:completed:1", { subject: "alice", tenantId: "tenant", source: "mission" }],
      ["mission:completed:2", { subject: "alice", tenantId: "tenant", source: "mission" }],
      ["mission:completed:3", { subject: "alice", tenantId: "tenant", source: "mission" }],
      ["mission:foreign", { subject: "bob", tenantId: "tenant", source: "mission" }],
      ["mission:other-tenant", { subject: "alice", tenantId: "other", source: "mission" }],
      ["client:claimed", { subject: "alice", tenantId: "tenant", source: "client" }],
    ]);
    const service = new RewardService(
      first,
      {
        verify: async (candidate) => {
          const fact = evidence.get(candidate.evidenceRef);
          return (
            fact?.subject === candidate.subject &&
            fact.tenantId === candidate.scope.tenantId &&
            fact.source === "mission"
          );
        },
      },
      {
        authorizeSubject: async (candidate, subject) =>
          candidate.appId === scope.appId &&
          candidate.environmentId === scope.environmentId &&
          candidate.tenantId === scope.tenantId &&
          subject === "alice",
        authorizePublication: async (candidate) => candidate.actorId === "admin",
      },
    );
    await expect(service.publish(publication({ actorId: "foreign" }))).rejects.toBeInstanceOf(
      RewardAccessDeniedProblem,
    );
    await service.publish(publication());
    for (const evidenceRef of [
      "mission:foreign",
      "mission:other-tenant",
      "client:claimed",
      "missing",
    ]) {
      await expect(service.grantForEvidence(key(evidenceRef))).rejects.toBeInstanceOf(
        RewardEvidenceInvalidProblem,
      );
    }
    await expect(
      service.grantForEvidence(key("mission:completed:1", "bob")),
    ).rejects.toBeInstanceOf(RewardAccessDeniedProblem);
    expect((await service.getAccount(scope, "alice")).grants).toEqual([]);
    const firstGrant = await service.grantForEvidence(key("mission:completed:1"));
    expect(firstGrant.state).toBe("granted");
    expect((await service.grantForEvidence(key("mission:completed:2"))).state).toBe("granted");
    expect((await service.grantForEvidence(key("mission:completed:3"))).rejection).toBe(
      "no-reward",
    );
    await service.publish(
      publication({
        policy: { ...policy, version: "v2", effectiveUntil: "2021-01-01T00:00:00Z" },
        expectedRevision: 1,
        idempotencyKey: "expired-v2",
      }),
    );
    expect(
      await service.grantForEvidence({ ...key("mission:completed:1"), policyVersion: "v2" }),
    ).toEqual(firstGrant);
    expect((await service.getAccount(scope, "alice")).points).toHaveLength(2);
    await service.publish(
      publication({
        policy: { ...policy, id: "explicit-additional-family", cap: 1 },
        idempotencyKey: "new-family",
      }),
    );
    expect(
      (
        await service.grantForEvidence({
          ...key("mission:completed:1"),
          policyId: "explicit-additional-family",
        })
      ).state,
    ).toBe("granted");
    expect((await service.getAccount(scope, "alice")).points).toHaveLength(3);
  });
  it("rejects callback entries and receipts inconsistent with the published policy without consuming cap", async () => {
    await first.publish(publication({ policy: { ...policy, cap: 1 } }));
    await expect(
      first.reserve(key("bad-entry"), (published, depleted) => ({
        ...selection(published, depleted),
        entry: {
          id: "injected",
          kind: "points",
          unit: "achievement-point",
          amount: 999,
          title: "Injected",
        },
      })),
    ).rejects.toBeInstanceOf(InvalidRewardPolicyProblem);
    await expect(
      first.reserve(key("bad-receipt"), (published, depleted) => {
        const selected = selection(published, depleted);
        return { ...selected, receipt: { ...selected.receipt, revision: 99 } };
      }),
    ).rejects.toBeInstanceOf(InvalidRewardPolicyProblem);
    expect((await first.reserve(key("valid"), selection)).selection.entry).toEqual(
      policy.rewardEntries[0],
    );
    expect((await first.getAccount(scope, "alice")).grants).toHaveLength(1);
  });
  it("preserves persistence failure causes after connection loss", async () => {
    const closed = new Pool(poolOptions);
    const store = new DrizzleRewardStore(drizzle(closed));
    await closed.end();
    await expect(store.getAccount(scope, "alice")).rejects.toBeInstanceOf(RewardPersistenceProblem);
    await expect(store.getAccount(scope, "alice")).rejects.toMatchObject({
      cause: expect.any(Error),
    });
  });
});
