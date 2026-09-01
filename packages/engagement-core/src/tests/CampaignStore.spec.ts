import { describe, expect, it } from "vitest";

import {
  CampaignSnapshotIncompleteProblem,
  CampaignSnapshotPayloadProblem,
  CampaignStoreConflictProblem,
  InMemoryCampaignStore,
  campaignScopeForTenant,
  decodeCampaignSnapshotData,
  encodeCampaignSnapshotData,
  type CampaignScopeRef,
  type CampaignSnapshotMember,
} from "../libs/CampaignStore";

const TENANT_SCOPE = campaignScopeForTenant("tenant-1");
const OTHER_SCOPE = campaignScopeForTenant("tenant-2");

function readyMember(
  ordinal: number,
  memberKey = `member-${ordinal}`,
  scope: CampaignScopeRef = TENANT_SCOPE,
): CampaignSnapshotMember {
  return {
    snapshotId: "snapshot-1",
    scope,
    ordinal,
    memberKey,
    recipient: {
      tenantId: scope.kind === "tenant" ? scope.tenantId : "tenant-1",
      userId: `user-${ordinal}`,
    },
    state: "ready",
    data: encodeCampaignSnapshotData({
      firstName: `Member ${ordinal}`,
      trialEndsAt: new Date("2026-09-30T00:00:00.000Z"),
    }),
  };
}

async function createBuildingSnapshot(store: InMemoryCampaignStore): Promise<void> {
  await store.createSnapshot({
    id: "snapshot-1",
    scope: TENANT_SCOPE,
    audienceId: "inactive-trials",
    campaignId: "trial-reminder",
    campaignVersion: "2026-09-01",
    messageId: "trial-ending",
    descriptorFingerprint: "sha256:test",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
  });
}

describe("CampaignStore", () => {
  it("round-trips safe snapshot payloads and rejects unsafe values", () => {
    const source = {
      name: "Ada",
      trialEndsAt: new Date("2026-09-30T00:00:00.000Z"),
      flags: [true, 3, null],
      omitted: undefined,
    };

    expect(decodeCampaignSnapshotData(encodeCampaignSnapshotData(source))).toEqual({
      name: "Ada",
      trialEndsAt: new Date("2026-09-30T00:00:00.000Z"),
      flags: [true, 3, null],
    });
    expect(() => encodeCampaignSnapshotData(Number.POSITIVE_INFINITY)).toThrow(
      CampaignSnapshotPayloadProblem,
    );
    expect(() => encodeCampaignSnapshotData(new Map())).toThrow(CampaignSnapshotPayloadProblem);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => encodeCampaignSnapshotData(cyclic)).toThrow(CampaignSnapshotPayloadProblem);
  });

  it("publishes only complete immutable snapshots with contiguous unique members", async () => {
    const store = new InMemoryCampaignStore();
    await createBuildingSnapshot(store);

    await expect(
      store.listSnapshotMembers(TENANT_SCOPE, "snapshot-1", { limit: 1 }),
    ).rejects.toThrow(CampaignSnapshotIncompleteProblem);

    await store.appendSnapshotMembers({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedStartOrdinal: 0,
      members: [readyMember(0), readyMember(1)],
    });
    const completed = await store.completeSnapshot({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedMemberCount: 2,
      completedAt: new Date("2026-09-01T00:01:00.000Z"),
    });

    expect(completed).toMatchObject({ state: "complete", memberCount: 2 });
    expect(Object.isFrozen(completed)).toBe(true);
    await expect(
      store.appendSnapshotMembers({
        scope: TENANT_SCOPE,
        snapshotId: "snapshot-1",
        expectedStartOrdinal: 2,
        members: [readyMember(2)],
      }),
    ).rejects.toThrow(CampaignStoreConflictProblem);

    const firstPage = await store.listSnapshotMembers(TENANT_SCOPE, "snapshot-1", { limit: 1 });
    const secondPage = await store.listSnapshotMembers(TENANT_SCOPE, "snapshot-1", {
      afterOrdinal: firstPage.nextOrdinal,
      limit: 1,
    });
    expect(firstPage.members.map((member) => member.memberKey)).toEqual(["member-0"]);
    expect(secondPage.members.map((member) => member.memberKey)).toEqual(["member-1"]);
  });

  it("rejects duplicate identities and cross-tenant members before completion", async () => {
    const duplicateStore = new InMemoryCampaignStore();
    await createBuildingSnapshot(duplicateStore);
    await expect(
      duplicateStore.appendSnapshotMembers({
        scope: TENANT_SCOPE,
        snapshotId: "snapshot-1",
        expectedStartOrdinal: 0,
        members: [readyMember(0, "same"), readyMember(1, "same")],
      }),
    ).rejects.toThrow(CampaignStoreConflictProblem);

    const crossTenantStore = new InMemoryCampaignStore();
    await createBuildingSnapshot(crossTenantStore);
    await expect(
      crossTenantStore.appendSnapshotMembers({
        scope: TENANT_SCOPE,
        snapshotId: "snapshot-1",
        expectedStartOrdinal: 0,
        members: [readyMember(0, "foreign", OTHER_SCOPE)],
      }),
    ).rejects.toMatchObject({ code: "engagement-core/campaign-store-invalid" });
    await expect(crossTenantStore.getSnapshot(OTHER_SCOPE, "snapshot-1")).resolves.toBeUndefined();
  });

  it("isolates identical snapshot ids by tenant scope", async () => {
    const store = new InMemoryCampaignStore();
    await createBuildingSnapshot(store);
    await store.createSnapshot({
      id: "snapshot-1",
      scope: OTHER_SCOPE,
      audienceId: "inactive-trials",
      campaignId: "trial-reminder",
      campaignVersion: "2026-09-01",
      messageId: "trial-ending",
      descriptorFingerprint: "sha256:test",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    await store.appendSnapshotMembers({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedStartOrdinal: 0,
      members: [readyMember(0)],
    });

    await expect(store.getSnapshot(TENANT_SCOPE, "snapshot-1")).resolves.toMatchObject({
      memberCount: 1,
    });
    await expect(store.getSnapshot(OTHER_SCOPE, "snapshot-1")).resolves.toMatchObject({
      memberCount: 0,
    });
  });

  it("keeps outcomes separate and exposes exact progress categories", async () => {
    const store = new InMemoryCampaignStore();
    await createBuildingSnapshot(store);
    await store.appendSnapshotMembers({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedStartOrdinal: 0,
      members: [readyMember(0), readyMember(1), readyMember(2), readyMember(3)],
    });
    await store.completeSnapshot({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedMemberCount: 4,
      completedAt: new Date("2026-09-01T00:01:00.000Z"),
    });

    await store.recordMemberOutcome({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      memberKey: "member-0",
      status: "queued",
      recordedAt: new Date("2026-09-01T00:02:00.000Z"),
    });
    await store.recordMemberOutcome({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      memberKey: "member-1",
      status: "suppressed",
      recordedAt: new Date("2026-09-01T00:02:00.000Z"),
    });
    await store.recordMemberOutcome({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      memberKey: "member-2",
      status: "failed",
      failureCode: "provider-rejected",
      retryable: false,
      recordedAt: new Date("2026-09-01T00:02:00.000Z"),
    });

    await expect(store.summarizeSnapshot(TENANT_SCOPE, "snapshot-1")).resolves.toEqual({
      total: 4,
      completed: 3,
      queued: 1,
      suppressed: 1,
      failed: 1,
      skipped: 0,
      pending: 1,
    });
  });

  it("allows retryable failures to become terminal without reopening terminal outcomes", async () => {
    const store = new InMemoryCampaignStore();
    await createBuildingSnapshot(store);
    await store.appendSnapshotMembers({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedStartOrdinal: 0,
      members: [readyMember(0)],
    });
    await store.completeSnapshot({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      expectedMemberCount: 1,
      completedAt: new Date("2026-09-01T00:01:00.000Z"),
    });

    await store.recordMemberOutcome({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      memberKey: "member-0",
      status: "failed",
      failureCode: "network-unavailable",
      retryable: true,
      recordedAt: new Date("2026-09-01T00:02:00.000Z"),
    });
    const terminal = await store.recordMemberOutcome({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      memberKey: "member-0",
      status: "failed",
      failureCode: "provider-rejected",
      retryable: false,
      recordedAt: new Date("2026-09-01T00:03:00.000Z"),
    });
    const ignored = await store.recordMemberOutcome({
      scope: TENANT_SCOPE,
      snapshotId: "snapshot-1",
      memberKey: "member-0",
      status: "queued",
      executionIds: ["late-execution"],
      recordedAt: new Date("2026-09-01T00:04:00.000Z"),
    });

    expect(terminal).toMatchObject({
      status: "failed",
      failureCode: "provider-rejected",
      retryable: false,
    });
    expect(ignored).toEqual(terminal);
  });
});
