import {
  ContactPolicy,
  ContactPolicyConflictProblem,
  ContactPolicyInvalidProblem,
  type ContactPolicyRequest,
} from "@croco/engagement-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleContactPolicyStore,
  createEngagementSchema,
  dropEngagementSchema,
  engagementContactPolicyBuckets,
  engagementContactPolicyReservations,
} from "../index";

const connectionString = process.env.ENGAGEMENT_POSTGRES_URL ?? "";
const describePostgres = connectionString.length === 0 ? describe.skip : describe;
const scope = { app: "app", environment: "test", tenantId: "tenant" };
const schema = { engagementContactPolicyBuckets, engagementContactPolicyReservations };
const request = (logicalSendId: string): ContactPolicyRequest => ({
  scope,
  recipient: "recipient",
  channel: "email",
  topic: "marketing",
  messageId: "message",
  logicalSendId,
  payloadFingerprint: "sha256:opaque",
  now: new Date("2026-01-01T00:00:00Z"),
});
function policy(store: DrizzleContactPolicyStore) {
  return new ContactPolicy({
    store,
    config: {
      version: "v1",
      reservationTtlMs: 1000,
      rules: [{ id: "daily", limit: 1, windowMs: 86400000 }],
    },
    topics: [{ id: "marketing", kind: "marketing", priority: 1, messageIds: ["message"] }],
  });
}

describePostgres("DrizzleContactPolicyStore PostgreSQL", () => {
  const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
  const databases = pools.map((pool) => drizzle(pool, { schema }));
  const stores = databases.map((db) => new DrizzleContactPolicyStore(db));
  const policies = stores.map((store) => policy(store));
  beforeAll(async () => {
    await dropEngagementSchema(databases[0]);
    await createEngagementSchema(databases[0]);
  });
  beforeEach(async () => {
    await databases[0].execute(
      sql`truncate engagement_contact_policy_reservations, engagement_contact_policy_buckets`,
    );
  });
  afterAll(async () => {
    await dropEngagementSchema(databases[0]);
    await Promise.all(pools.map((pool) => pool.end()));
  });

  it("allows exactly one of ten workers through two independent database connections", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        policies[index % 2].reserve(request(`send-${index}`)),
      ),
    );
    expect(results.filter((result) => result.decision.allowed)).toHaveLength(1);
    const winner = results.find((result) => result.reservation)?.reservation;
    expect(winner).toBeDefined();
    if (!winner) return;
    const repeated = await Promise.all(
      policies.map((item) => item.reserve(request(winner.logicalSendId))),
    );
    expect(repeated.every((result) => result.replay)).toBe(true);
    expect(await stores[0].read(scope, winner.subject)).toHaveLength(1);
    await expect(
      policies[1].reserve({ ...request(winner.logicalSendId), payloadFingerprint: "changed" }),
    ).rejects.toThrow(ContactPolicyConflictProblem);
  });

  it("preserves unknown budget and commit results after a new connection", async () => {
    const result = await policies[0].reserve(request("unknown"));
    const ref = result.reservation!;
    await policies[0].markUnknown(ref);
    const restartPool = new Pool({ connectionString, max: 1 });
    try {
      const restarted = policy(new DrizzleContactPolicyStore(drizzle(restartPool, { schema })));
      expect(
        await restarted.reserve({ ...request("unknown"), now: new Date("2026-01-02T00:00:00Z") }),
      ).toMatchObject({
        replay: true,
        reservation: { state: "unknown" },
        decision: { allowed: false, reason: "unknown" },
      });
      await expect(restarted.release(ref)).rejects.toThrow(ContactPolicyConflictProblem);
      await restarted.commit(ref, ["execution"]);
      expect(await restarted.reserve(request("unknown"))).toMatchObject({
        replay: true,
        reservation: { state: "committed", executionIds: ["execution"] },
      });
    } finally {
      await restartPool.end();
    }
  });

  it.each(["accepted", "not-accepted"] as const)(
    "persists %s reconciliation evidence for another connection and restart",
    async (outcome) => {
      const reserved = await policies[0].reserve(request("reconciled"));
      const ref = reserved.reservation!;
      await policies[0].markUnknown(ref);
      const resolution =
        outcome === "accepted"
          ? {
              outcome,
              executionIds: ["execution"],
              evidence: {
                reference: "proof-id",
                actor: "operator",
                reason: "Provider evidence verified",
              },
            }
          : {
              outcome,
              evidence: {
                reference: "proof-id",
                actor: "operator",
                reason: "Provider evidence verified",
              },
            };
      const reconciled = await policies[1].reconcile(ref, resolution);
      expect(reconciled).toMatchObject({
        state: outcome === "accepted" ? "committed" : "released",
        reconciliation: resolution,
      });
      const restartPool = new Pool({ connectionString, max: 1 });
      try {
        const restartedStore = new DrizzleContactPolicyStore(drizzle(restartPool, { schema }));
        const restarted = policy(restartedStore);
        expect(await restartedStore.read(scope, ref.subject)).toMatchObject([
          { reconciliation: resolution },
        ]);
        expect(await restarted.reconcile(ref, resolution)).toEqual(reconciled);
        await expect(
          restarted.reconcile(ref, {
            ...resolution,
            evidence: { ...resolution.evidence, reference: "different-proof" },
          }),
        ).rejects.toThrow(ContactPolicyConflictProblem);
      } finally {
        await restartPool.end();
      }
    },
  );

  it("keeps campaign attribution across connections and restart", async () => {
    const campaignRequest = { ...request("campaign-send"), campaignId: "campaign-a" };
    const first = await policies[0].reserve(campaignRequest);
    expect(await stores[1].read(scope, first.reservation!.subject)).toMatchObject([
      { campaignId: "campaign-a" },
    ]);
    const restarted = policy(new DrizzleContactPolicyStore(databases[1]));
    expect(await restarted.reserve(campaignRequest)).toMatchObject({
      replay: true,
      reservation: { campaignId: "campaign-a" },
    });
    expect(
      await restarted.reserve({ ...request("blocked"), campaignId: "campaign-b" }),
    ).toMatchObject({ decision: { allowed: false, blockingCampaignIds: ["campaign-a"] } });
    await expect(
      restarted.reserve({ ...campaignRequest, campaignId: "campaign-b" }),
    ).rejects.toThrow(ContactPolicyConflictProblem);
  });

  it("releases a pre-dispatch reservation and isolates app, environment, tenant and subject", async () => {
    const reserved = await policies[0].reserve(request("release"));
    await policies[0].release(reserved.reservation!);
    expect(await policies[1].reserve(request("next"))).toMatchObject({
      decision: { allowed: true },
    });
    for (const other of [
      { ...scope, app: "other" },
      { ...scope, environment: "other" },
      { ...scope, tenantId: "other" },
    ]) {
      expect(await policies[1].reserve({ ...request("next"), scope: other })).toMatchObject({
        decision: { allowed: true },
      });
    }
    expect(await policies[1].reserve({ ...request("next"), recipient: "other" })).toMatchObject({
      decision: { allowed: true },
    });
  });

  it("rolls back pending writes and rejects mutations across locked subjects", async () => {
    const reserved = await policies[0].reserve(request("rollback"));
    const row = reserved.reservation!;
    await expect(
      stores[0].transact(scope, row.subject, async (tx) => {
        tx.save({ ...row, state: "released" });
        throw new ContactPolicyInvalidProblem("abort");
      }),
    ).rejects.toThrow(ContactPolicyInvalidProblem);
    expect(await stores[1].read(scope, row.subject)).toMatchObject([{ state: "reserved" }]);
    await expect(
      stores[0].transact(scope, row.subject, async (tx) => {
        tx.save({ ...row, subject: "other" });
      }),
    ).rejects.toThrow(ContactPolicyInvalidProblem);
    expect(await stores[1].read(scope, "other")).toEqual([]);
  });

  it("creates idempotently and drops the new migration tables", async () => {
    await createEngagementSchema(databases[0]);
    await dropEngagementSchema(databases[0]);
    const result = await databases[0].execute(
      sql`select to_regclass('engagement_contact_policy_buckets') as bucket, to_regclass('engagement_contact_policy_reservations') as reservation`,
    );
    expect(result.rows[0]).toEqual({ bucket: null, reservation: null });
    await createEngagementSchema(databases[0]);
  });
});
