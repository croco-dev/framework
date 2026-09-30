import {
  ContactPolicy,
  ContactPolicyConflictProblem,
  type ContactPolicyConfig,
} from "@croco/engagement-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleContactPolicyAdminStore,
  DrizzleContactPolicyStore,
  engagementContactPolicyReservations,
  createEngagementSchema,
  dropEngagementSchema,
  engagementContactPolicyAudit,
  engagementContactPolicyBuckets,
  engagementContactPolicySettings,
  engagementDispatches,
} from "../index";

const connectionString = process.env.ENGAGEMENT_POSTGRES_URL ?? "";
const describePostgres = connectionString.length === 0 ? describe.skip : describe;
const target = {
  scope: { app: "app", environment: "test", tenantId: "tenant" },
  subject: "recipient",
};
const schema = {
  engagementContactPolicyAudit,
  engagementContactPolicyBuckets,
  engagementContactPolicySettings,
};
const config: ContactPolicyConfig = {
  version: "v1",
  reservationTtlMs: 1000,
  rules: [{ id: "daily", limit: 1, windowMs: 86400000 }],
};
const edit = {
  target,
  edit: {
    limits: { daily: 1 },
    priorities: {},
    expectedRevision: 0,
    reason: "Adjust budget",
    idempotencyKey: "edit-1",
  },
  policy: {
    revision: 1,
    config,
    topics: [{ id: "marketing", kind: "marketing" as const, priority: 1, messageIds: ["message"] }],
  },
  expectedRevision: 0,
  actorId: "actor",
  reason: "Adjust budget",
  idempotencyKey: "edit-1",
};

describePostgres("DrizzleContactPolicyAdminStore PostgreSQL", () => {
  const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
  const databases = pools.map((pool) => drizzle(pool, { schema }));
  const stores = databases.map((db) => new DrizzleContactPolicyAdminStore(db));
  beforeAll(async () => {
    await dropEngagementSchema(databases[0]);
    await createEngagementSchema(databases[0]);
  });
  beforeEach(async () => {
    await databases[0].execute(
      sql`truncate engagement_contact_policy_audit, engagement_contact_policy_settings, engagement_contact_policy_reservations, engagement_contact_policy_buckets, engagement_dispatches cascade`,
    );
  });
  afterAll(async () => {
    await dropEngagementSchema(databases[0]);
    await Promise.all(pools.map((pool) => pool.end()));
  });

  it("serializes competing revisions and persists one audit with replay protection", async () => {
    const result = await Promise.allSettled(
      stores.map((store, index) => store.save({ ...edit, idempotencyKey: `edit-${index}` })),
    );
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((item) => item.status === "rejected")).toHaveLength(1);
    const [audit] = await databases[0].select().from(engagementContactPolicyAudit);
    expect(audit).toMatchObject({
      actorId: "actor",
      reason: "Adjust budget",
      policy: { revision: 1 },
    });
    await expect(
      stores[1].save({ ...edit, idempotencyKey: audit.idempotencyKey }),
    ).resolves.toEqual(edit.policy);
    await expect(
      stores[1].save({ ...edit, idempotencyKey: audit.idempotencyKey, reason: "changed" }),
    ).rejects.toThrow(ContactPolicyConflictProblem);
    expect(await databases[0].select().from(engagementContactPolicyAudit)).toHaveLength(1);
    expect(await new DrizzleContactPolicyAdminStore(databases[1]).load(target)).toMatchObject({
      policy: edit.policy,
    });
    expect((await stores[1].load({ ...target, subject: "other" }))?.policy).toEqual(edit.policy);
    await expect(
      stores[1].load({ ...target, scope: { ...target.scope, environment: "other" } }),
    ).resolves.toBeUndefined();
  });

  it("applies a new scope revision to another recipient without restarting and replays the original edit", async () => {
    await stores[0].save(edit);
    const ledger = new DrizzleContactPolicyStore(
      drizzle(pools[1], {
        schema: { engagementContactPolicyBuckets, engagementContactPolicyReservations },
      }),
    );
    const reserve = async (logicalSendId: string) => {
      const snapshot = await stores[1].loadPolicy(target.scope);
      if (!snapshot) throw new Error("Missing policy fixture");
      const policy = new ContactPolicy({
        store: ledger,
        config: snapshot.config,
        topics: snapshot.topics,
      });
      return policy.reserve({
        scope: target.scope,
        recipient: "another-recipient",
        logicalSendId,
        payloadFingerprint: "sha256:opaque",
        channel: "email",
        topic: "marketing",
        messageId: "message",
        now: new Date("2026-01-01T00:00:00Z"),
      });
    };
    expect(await reserve("first")).toMatchObject({
      decision: { allowed: true },
      reservation: { policyVersion: "v1" },
    });
    expect(await reserve("second")).toMatchObject({ decision: { allowed: false } });
    const nextPolicy = {
      ...edit.policy,
      revision: 2,
      config: { ...config, version: "v2", rules: [{ ...config.rules[0], limit: 2 }] },
    };
    await stores[0].save({
      ...edit,
      policy: nextPolicy,
      expectedRevision: 1,
      idempotencyKey: "edit-next",
      edit: {
        ...edit.edit,
        expectedRevision: 1,
        idempotencyKey: "edit-next",
        limits: { daily: 2 },
      },
    });
    expect(await reserve("second")).toMatchObject({
      decision: { allowed: true },
      reservation: { policyVersion: "v2" },
    });
    expect(
      await stores[1].save({
        ...edit,
        target: { ...target, subject: "another-recipient" },
        policy: { ...edit.policy, config: { ...nextPolicy.config, version: "v1" } },
      }),
    ).toEqual(edit.policy);
    expect((await stores[1].loadPolicy(target.scope))?.revision).toBe(2);
  });

  it("rolls back settings when its audit insert fails", async () => {
    await databases[0].execute(
      sql`alter table engagement_contact_policy_audit add constraint reject_test_actor check (actor_id <> 'rejected')`,
    );
    try {
      await expect(stores[0].save({ ...edit, actorId: "rejected" })).rejects.toThrow();
      expect(await stores[1].load(target)).toBeUndefined();
      expect(await databases[1].select().from(engagementContactPolicyAudit)).toHaveLength(0);
    } finally {
      await databases[0].execute(
        sql`alter table engagement_contact_policy_audit drop constraint reject_test_actor`,
      );
    }
  });

  it("projects only scoped policy denial evidence without endpoint payloads", async () => {
    await stores[0].save(edit);
    const occurredAt = new Date("2026-01-01T00:00:00Z");
    const base = {
      tenantId: target.scope.tenantId,
      recipientId: target.subject,
      messageId: "message",
      channel: "email" as const,
      semanticKey: "send",
      topic: "marketing",
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    await databases[0].insert(engagementDispatches).values([
      {
        ...base,
        id: "visible",
        outcome: {
          kind: "suppressed",
          reason: "suppression",
          contactPolicy: {
            app: "app",
            environment: "test",
            reason: "limit",
            blockingRuleId: "daily",
            campaignId: "denied-campaign",
            blockingCampaignIds: ["blocking-campaign"],
          },
        },
      },
      {
        ...base,
        id: "hidden",
        semanticKey: "other",
        outcome: {
          kind: "suppressed",
          reason: "suppression",
          contactPolicy: {
            app: "app",
            environment: "other",
            reason: "limit",
            blockingRuleId: "private",
          },
        },
      },
    ]);
    const view = await stores[1].load(target);
    expect(view?.recentSuppressions).toEqual([
      {
        logicalSendId: JSON.stringify(["message", "send", "email"]),
        occurredAt,
        campaignId: "denied-campaign",
        decision: {
          allowed: false,
          reason: "limit",
          blockingRuleId: "daily",
          blockingCampaignIds: ["blocking-campaign"],
        },
      },
    ]);
    expect(view?.historyComplete).toBe(true);
  });
});
