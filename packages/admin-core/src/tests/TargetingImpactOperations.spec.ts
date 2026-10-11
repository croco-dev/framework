import { describe, expect, it, vi } from "vitest";
import { encodeCampaignSnapshotData, InMemoryCampaignStore } from "@croco/engagement-core";
import {
  InMemoryTargetingImpactReportStore,
  TargetingImpactOperations,
} from "../libs/TargetingImpactOperations";
import type { PolicyReplayInput } from "@croco/metrics-core";
import type { CampaignStore } from "@croco/engagement-core";

const scope = { appId: "app", environment: "test", tenantId: "tenant", subjectKind: "user" };
function input(): PolicyReplayInput {
  return {
    scope,
    snapshotRef: "snapshot",
    currency: "USD",
    unit: "send",
    observationWindow: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
      completed: true,
    },
    attributionWindowMs: 86400000,
    definition: {
      revision: "1",
      existingPredicate: { op: "all" },
      newPredicate: { op: "eq", trait: "email", value: "private@example.test" },
      unknownPolicy: "preserve",
      scenarios: ["click-only"],
      changes: ["filter"],
    },
    rows: [
      {
        subjectId: "private-subject",
        atDecision: "2026-01-02T00:00:00.000Z",
        traitsAtDecision: { email: "other@example.test" },
        dispatch: { dispatchId: "message", at: "2026-01-02T00:00:01.000Z" },
        cost: { amount: 2, currency: "USD" },
        touchpoints: [],
        outcomes: [],
      },
    ],
  };
}
async function campaign(withEnvelope: boolean): Promise<InMemoryCampaignStore> {
  const store = new InMemoryCampaignStore();
  const tenant = { kind: "tenant", tenantId: scope.tenantId } as const;
  await store.createSnapshot({
    id: "snapshot",
    scope: tenant,
    audienceId: "audience",
    campaignId: "campaign",
    campaignVersion: "1",
    messageId: "message",
    descriptorFingerprint: "hash",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
  });
  await store.appendSnapshotMembers({
    scope: tenant,
    snapshotId: "snapshot",
    expectedStartOrdinal: 0,
    members: [0, 1].map((ordinal) => ({
      snapshotId: "snapshot",
      scope: tenant,
      ordinal,
      memberKey: `key-${ordinal}`,
      state: "ready",
      recipient: { tenantId: scope.tenantId, userId: ordinal ? "missing" : "private-subject" },
      data: encodeCampaignSnapshotData(
        withEnvelope && ordinal === 0
          ? { policyReplayRow: input().rows[0] }
          : { message: "ordinary payload" },
      ),
    })),
  });
  await store.completeSnapshot({
    scope: tenant,
    snapshotId: "snapshot",
    expectedMemberCount: 2,
    completedAt: new Date("2026-01-02T00:01:00.000Z"),
  });
  await store.recordMemberOutcome({
    scope: tenant,
    snapshotId: "snapshot",
    memberKey: "key-1",
    status: "queued",
    recordedAt: new Date("2026-01-02T00:02:00.000Z"),
  });
  return store;
}
function request() {
  const { scope: _scope, snapshotRef: _snapshot, rows: _rows, ...configuration } = input();
  return {
    scope,
    snapshotId: "snapshot",
    configuration,
    bounds: { pageSize: 1, maxPages: 2, maxMembers: 2 },
  };
}
describe("TargetingImpactOperations", () => {
  it("saves immutable verified evidence, reloads equally and exposes no rows or predicate PII", async () => {
    const reports = new InMemoryTargetingImpactReportStore();
    const operations = new TargetingImpactOperations({ reports, authorize: async () => true });
    const replay = await operations.replay(JSON.stringify(input()));
    const saved = await operations.save(input());
    expect(await operations.load(scope, saved.inputHash)).toEqual(replay);
    const exported = await operations.export(scope, saved.inputHash);
    expect(JSON.parse(exported)).toEqual(saved);
    expect(exported).not.toContain("private-subject");
    expect(exported).not.toContain("example.test");
    expect(exported).not.toContain("traitsAtDecision");
    await expect(operations.save(input())).resolves.toEqual(saved);
    await expect(reports.put(scope, saved.inputHash, "{}")).rejects.toThrow("immutable");
  });
  it("authorizes before any read or write and does not accept client permissions", async () => {
    const reports = { get: vi.fn(), put: vi.fn() };
    const operations = new TargetingImpactOperations({ reports, authorize: async () => false });
    await expect(operations.load(scope, "id")).rejects.toThrow("denied");
    await expect(operations.export(scope, "id")).rejects.toThrow("denied");
    await expect(operations.save(input())).rejects.toThrow("denied");
    await expect(
      operations.replay({ ...input(), grantedPermissions: ["replay"] }),
    ).rejects.toThrow();
    expect(reports.get).not.toHaveBeenCalled();
    expect(reports.put).not.toHaveBeenCalled();
  });
  it("rejects missing tenant before authorization, malformed JSON and changed saved reports", async () => {
    const authorize = vi.fn(async () => true);
    const reports = new InMemoryTargetingImpactReportStore();
    const operations = new TargetingImpactOperations({ reports, authorize });
    await expect(operations.load({ ...scope, tenantId: "" }, "id")).rejects.toThrow("Explicit");
    expect(authorize).not.toHaveBeenCalled();
    await expect(operations.replay("{")).rejects.toThrow("JSON");
    const saved = await operations.save(input());
    const original = await reports.get(scope, saved.inputHash);
    const tampered = JSON.parse(original!);
    tampered.result.excludedN = 999;
    const corrupt = new TargetingImpactOperations({
      authorize,
      reports: { put: async () => {}, get: async () => JSON.stringify(tampered) },
    });
    await expect(corrupt.load(scope, saved.inputHash)).rejects.toThrow("hashes");
    await expect(corrupt.save(input())).rejects.toThrow("hashes");
  });
  it("reads bounded real campaign pages and reports missing history without promoting queued to sent", async () => {
    const store = await campaign(true);
    const pages = vi.spyOn(store, "listSnapshotMembers");
    const operations = new TargetingImpactOperations({
      reports: new InMemoryTargetingImpactReportStore(),
      authorize: async () => true,
      campaignStore: store,
      campaignScope: scope,
    });
    const result = await operations.replayCampaign(request());
    expect(result.status).toBe("partial");
    expect(result.sourceCoverage).toEqual({ memberN: 2, replayedMemberN: 1, missingHistoryN: 1 });
    expect(result.report?.result.sourceCoverage.dispatchN).toBe(1);
    expect(pages).toHaveBeenCalledTimes(2);
    expect(pages.mock.calls[1]?.[2]).toEqual({ limit: 1, afterOrdinal: 0 });
    await expect(
      operations.replayCampaign({
        ...request(),
        bounds: { pageSize: 1, maxPages: 1, maxMembers: 2 },
      }),
    ).rejects.toThrow("page limit");
    await expect(
      operations.replayCampaign({
        ...request(),
        bounds: { pageSize: 1, maxPages: 2, maxMembers: 1 },
      }),
    ).rejects.toThrow("member limit");
  });
  it("reports wholly missing campaign evidence as unavailable", async () => {
    const operations = new TargetingImpactOperations({
      reports: new InMemoryTargetingImpactReportStore(),
      authorize: async () => true,
      campaignStore: await campaign(false),
      campaignScope: scope,
    });
    expect(await operations.replayCampaign(request())).toEqual({
      status: "unavailable",
      sourceCoverage: { memberN: 2, replayedMemberN: 0, missingHistoryN: 2 },
    });
  });
  it("rejects unauthorized campaign access before reading and rejects cross-scope registration", async () => {
    const store = await campaign(false);
    const read = vi.spyOn(store, "getSnapshot");
    const reports = new InMemoryTargetingImpactReportStore();
    await expect(
      new TargetingImpactOperations({
        reports,
        authorize: async () => false,
        campaignStore: store,
        campaignScope: scope,
      }).replayCampaign(request()),
    ).rejects.toThrow("denied");
    await expect(
      new TargetingImpactOperations({
        reports,
        authorize: async () => true,
        campaignStore: store,
        campaignScope: { ...scope, environment: "production" },
      }).replayCampaign(request()),
    ).rejects.toThrow("registered");
    expect(read).not.toHaveBeenCalled();
  });
  it("rejects noncontiguous and cross-tenant pages and preserves provider failures", async () => {
    const store = await campaign(false);
    const original = store.listSnapshotMembers.bind(store);
    const reports = new InMemoryTargetingImpactReportStore();
    const options = {
      reports,
      authorize: async () => true,
      campaignStore: store,
      campaignScope: scope,
    };
    vi.spyOn(store, "listSnapshotMembers").mockImplementation(
      async (...args: Parameters<CampaignStore["listSnapshotMembers"]>) => {
        const page = await original(...args);
        return { ...page, members: page.members.map((member) => ({ ...member, ordinal: 5 })) };
      },
    );
    await expect(new TargetingImpactOperations(options).replayCampaign(request())).rejects.toThrow(
      "contiguous",
    );
    vi.mocked(store.listSnapshotMembers).mockImplementation(async (...args) => {
      const page = await original(...args);
      return {
        ...page,
        members: page.members.map((member) => ({
          ...member,
          scope: { kind: "tenant", tenantId: "other" },
        })),
      };
    });
    await expect(new TargetingImpactOperations(options).replayCampaign(request())).rejects.toThrow(
      "tenant scoped",
    );
    vi.mocked(store.listSnapshotMembers).mockRejectedValue(new Error("database failed"));
    await expect(
      new TargetingImpactOperations(options).replayCampaign(request()),
    ).rejects.toMatchObject({
      code: "admin-core/targeting-impact-provider-failed",
      cause: { message: "database failed" },
    });
  });
});
