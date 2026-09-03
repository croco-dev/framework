import {
  CampaignSnapshotIncompleteProblem,
  CampaignStoreConflictProblem,
  CampaignStoreValidationProblem,
  encodeCampaignSnapshotData,
  type CampaignScopeRef,
  type CampaignSnapshotMember,
} from "@croco/engagement-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createEngagementSchema,
  type DrizzleCampaignTxManager,
  DrizzleCampaignStore,
  dropEngagementSchema,
  engagementCampaignMemberOutcomes,
  engagementCampaignSnapshotMembers,
  engagementCampaignSnapshots,
} from "../index";

const connectionString = process.env.ENGAGEMENT_POSTGRES_URL ?? "";
const describePostgres = connectionString.length === 0 ? describe.skip : describe;
type DrizzleCampaignTransaction = NonNullable<ReturnType<DrizzleCampaignTxManager["getClient"]>>;

const schema = {
  engagementCampaignMemberOutcomes,
  engagementCampaignSnapshotMembers,
  engagementCampaignSnapshots,
};

describePostgres("DrizzleCampaignStore PostgreSQL", () => {
  const pool = new Pool({ connectionString, max: 8 });
  const db = drizzle(pool, { schema });
  const txManager = new TxManager(
    createDrizzleTxAdapter(db as unknown as Parameters<typeof createDrizzleTxAdapter>[0]),
  ) as unknown as TxManager<DrizzleCampaignTransaction>;
  const store = new DrizzleCampaignStore(db, txManager);
  const tenantA = { kind: "tenant", tenantId: "tenant-a" } as const;
  const tenantB = { kind: "tenant", tenantId: "tenant-b" } as const;

  beforeAll(async () => {
    await dropEngagementSchema(db);
    await createEngagementSchema(db);
  });

  afterAll(async () => {
    await dropEngagementSchema(db);
    await pool.end();
  });

  async function reset(): Promise<void> {
    await db.execute(sql`
      truncate table
        engagement_campaign_member_outcomes,
        engagement_campaign_snapshot_members,
        engagement_campaign_snapshots
    `);
  }

  async function create(scope: CampaignScopeRef, id = "snapshot") {
    return store.createSnapshot({
      id,
      scope,
      audienceId: "audience",
      campaignId: "campaign",
      campaignVersion: "v1",
      messageId: "message",
      descriptorFingerprint: "sha256:fingerprint",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  function member(
    scope: CampaignScopeRef,
    ordinal: number,
    memberKey = `member-${ordinal}`,
  ): CampaignSnapshotMember {
    return {
      snapshotId: "snapshot",
      scope,
      ordinal,
      memberKey,
      recipient: {
        tenantId: scope.kind === "tenant" ? scope.tenantId : `tenant-${ordinal}`,
        userId: `user-${ordinal}`,
      },
      state: "ready",
      data: encodeCampaignSnapshotData({ ordinal, sentAt: new Date("2026-01-01T00:00:00.000Z") }),
    };
  }

  it("isolates identical snapshot ids by tenant scope", async () => {
    await reset();
    await create(tenantA);
    await create(tenantB);

    await store.appendSnapshotMembers({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedStartOrdinal: 0,
      members: [member(tenantA, 0)],
    });

    await expect(store.getSnapshot(tenantA, "snapshot")).resolves.toMatchObject({ memberCount: 1 });
    await expect(store.getSnapshot(tenantB, "snapshot")).resolves.toMatchObject({ memberCount: 0 });
  });

  it("enforces contiguous unique assembly and immutable completed membership", async () => {
    await reset();
    await create(tenantA);

    await expect(store.listSnapshotMembers(tenantA, "snapshot", { limit: 1 })).rejects.toThrow(
      CampaignSnapshotIncompleteProblem,
    );
    await expect(
      store.appendSnapshotMembers({
        scope: tenantA,
        snapshotId: "snapshot",
        expectedStartOrdinal: 1,
        members: [member(tenantA, 1)],
      }),
    ).rejects.toThrow(CampaignStoreConflictProblem);

    await store.appendSnapshotMembers({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedStartOrdinal: 0,
      members: [member(tenantA, 0), member(tenantA, 1, "private-member-key")],
    });
    const duplicateFailure = await store
      .appendSnapshotMembers({
        scope: tenantA,
        snapshotId: "snapshot",
        expectedStartOrdinal: 2,
        members: [member(tenantA, 2, "private-member-key")],
      })
      .catch((error: unknown) => error);
    expect(duplicateFailure).toBeInstanceOf(CampaignStoreConflictProblem);
    expect(
      JSON.stringify((duplicateFailure as CampaignStoreConflictProblem).toJSON()),
    ).not.toContain("private-member-key");

    await store.completeSnapshot({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedMemberCount: 2,
      completedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const firstPage = await store.listSnapshotMembers(tenantA, "snapshot", { limit: 1 });
    expect(firstPage).toMatchObject({ members: [{ ordinal: 0 }], nextOrdinal: 0 });
    await expect(
      store.listSnapshotMembers(tenantA, "snapshot", {
        afterOrdinal: firstPage.nextOrdinal,
        limit: 1,
      }),
    ).resolves.toMatchObject({ members: [{ ordinal: 1 }] });
    await expect(
      store.appendSnapshotMembers({
        scope: tenantA,
        snapshotId: "snapshot",
        expectedStartOrdinal: 2,
        members: [member(tenantA, 2)],
      }),
    ).rejects.toThrow(CampaignStoreConflictProblem);
  });

  it("preserves the first terminal outcome while allowing failed work to retry", async () => {
    await reset();
    await create(tenantA);
    await store.appendSnapshotMembers({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedStartOrdinal: 0,
      members: [member(tenantA, 0), member(tenantA, 1)],
    });
    await store.completeSnapshot({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedMemberCount: 2,
      completedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const missingMemberFailure = await store
      .recordMemberOutcome({
        scope: tenantA,
        snapshotId: "snapshot",
        memberKey: "private-missing-member-key",
        status: "skipped",
        recordedAt: new Date("2026-01-02T12:00:00.000Z"),
      })
      .catch((error: unknown) => error);
    expect(missingMemberFailure).toBeInstanceOf(CampaignStoreValidationProblem);
    expect(
      JSON.stringify((missingMemberFailure as CampaignStoreValidationProblem).toJSON()),
    ).not.toContain("private-missing-member-key");

    await store.recordMemberOutcome({
      scope: tenantA,
      snapshotId: "snapshot",
      memberKey: "member-0",
      status: "failed",
      failureCode: "transient",
      retryable: true,
      recordedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    const queued = await store.recordMemberOutcome({
      scope: tenantA,
      snapshotId: "snapshot",
      memberKey: "member-0",
      status: "queued",
      executionIds: ["execution-1"],
      recordedAt: new Date("2026-01-04T00:00:00.000Z"),
    });
    const repeated = await store.recordMemberOutcome({
      scope: tenantA,
      snapshotId: "snapshot",
      memberKey: "member-0",
      status: "suppressed",
      reason: "preference",
      recordedAt: new Date("2026-01-05T00:00:00.000Z"),
    });
    const terminalFailure = await store.recordMemberOutcome({
      scope: tenantA,
      snapshotId: "snapshot",
      memberKey: "member-1",
      status: "failed",
      failureCode: "provider-rejected",
      retryable: false,
      recordedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    const ignoredTerminalRetry = await store.recordMemberOutcome({
      scope: tenantA,
      snapshotId: "snapshot",
      memberKey: "member-1",
      status: "queued",
      executionIds: ["execution-2"],
      recordedAt: new Date("2026-01-04T00:00:00.000Z"),
    });

    expect(repeated).toEqual(queued);
    expect(ignoredTerminalRetry).toEqual(terminalFailure);
    await expect(store.summarizeSnapshot(tenantA, "snapshot")).resolves.toEqual({
      total: 2,
      completed: 2,
      queued: 1,
      suppressed: 0,
      failed: 1,
      skipped: 0,
      pending: 0,
    });
  });

  it("persists mapper failures that have no recipient identity", async () => {
    await reset();
    await create(tenantA);
    await store.appendSnapshotMembers({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedStartOrdinal: 0,
      members: [
        {
          snapshotId: "snapshot",
          scope: tenantA,
          ordinal: 0,
          memberKey: "@croco/internal/mapping-failed/0",
          state: "mapping-failed",
          failureCode: "engagement-core/campaign-operation-failed",
        },
      ],
    });
    await store.completeSnapshot({
      scope: tenantA,
      snapshotId: "snapshot",
      expectedMemberCount: 1,
      completedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await expect(store.listSnapshotMembers(tenantA, "snapshot", { limit: 1 })).resolves.toEqual({
      members: [
        {
          snapshotId: "snapshot",
          scope: tenantA,
          ordinal: 0,
          memberKey: "@croco/internal/mapping-failed/0",
          state: "mapping-failed",
          failureCode: "engagement-core/campaign-operation-failed",
        },
      ],
    });
  });

  it("serializes competing appends at the same ordinal", async () => {
    await reset();
    await create(tenantA);
    const results = await Promise.allSettled([
      store.appendSnapshotMembers({
        scope: tenantA,
        snapshotId: "snapshot",
        expectedStartOrdinal: 0,
        members: [member(tenantA, 0, "first")],
      }),
      store.appendSnapshotMembers({
        scope: tenantA,
        snapshotId: "snapshot",
        expectedStartOrdinal: 0,
        members: [member(tenantA, 0, "second")],
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(store.getSnapshot(tenantA, "snapshot")).resolves.toMatchObject({ memberCount: 1 });
  });
});
