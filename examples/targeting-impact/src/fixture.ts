import { InMemoryCampaignStore, encodeCampaignSnapshotData } from "@croco/engagement-core";
import {
  InMemoryTargetingImpactReportStore,
  TargetingImpactOperations,
  TargetingImpactProblem,
} from "@croco/admin-core/targeting-impact-operations";
import type { PolicyReplayInput, ReplayRow, ReplayScope } from "@croco/metrics-core";

export const scope: ReplayScope = {
  appId: "synthetic-shop",
  environment: "local",
  tenantId: "demo",
  subjectKind: "user",
};
export const fixtureStates = [
  "ready",
  "empty",
  "partial",
  "denied",
  "error",
  "unavailable",
] as const;
export type FixtureState = (typeof fixtureStates)[number];
const at = (hour: number) => `2026-09-01T${String(hour).padStart(2, "0")}:00:00.000Z`;
export function fixtureInput(
  state: FixtureState,
  unknownPolicy: "preserve" | "exclude",
): PolicyReplayInput {
  const rows: ReplayRow[] = Array.from({ length: state === "empty" ? 0 : 100 }, (_, index) => ({
    subjectId: `synthetic-${index}`,
    atDecision: at(0),
    ...(state === "partial" && index >= 90 ? {} : { traitsAtDecision: { eligible: index >= 20 } }),
    dispatch: { dispatchId: `message-${index}`, at: at(2) },
    ...(state === "partial" && index === 0 ? {} : { cost: { amount: 10, currency: "KRW" } }),
    touchpoints: index % 2 === 0 ? [{ kind: "click", at: at(3) }] : [],
    outcomes: [
      { kind: "visit", eventId: `before-${index}`, at: at(1) },
      { kind: "visit", eventId: `after-${index}`, at: at(4) },
      { kind: "financial", eventId: `purchase-${index}`, at: at(4), amount: 1000, currency: "KRW" },
    ],
  }));
  return {
    scope,
    snapshotRef: `synthetic-${state}`,
    currency: "KRW",
    unit: "KRW",
    observationWindow: { start: at(0), end: "2026-09-02T00:00:00.000Z", completed: true },
    attributionWindowMs: 21600000,
    definition: {
      revision: `eligible-v1-${unknownPolicy}`,
      existingPredicate: { op: "all" },
      newPredicate: { op: "eq", trait: "eligible", value: true },
      unknownPolicy,
      scenarios: ["click-only", "post-send-inclusive"],
      changes: ["filter"],
    },
    rows,
  };
}
export async function createFixture(state: FixtureState) {
  const store = new InMemoryCampaignStore();
  const input = fixtureInput(state, "preserve");
  const tenant = { kind: "tenant", tenantId: scope.tenantId } as const;
  await store.createSnapshot({
    id: input.snapshotRef,
    scope: tenant,
    audienceId: "synthetic-audience",
    campaignId: "synthetic-campaign",
    campaignVersion: "1",
    messageId: "synthetic-message",
    descriptorFingerprint: "synthetic-v1",
    createdAt: new Date(at(0)),
  });
  if (input.rows.length)
    await store.appendSnapshotMembers({
      scope: tenant,
      snapshotId: input.snapshotRef,
      expectedStartOrdinal: 0,
      members: input.rows.map((row, ordinal) => ({
        snapshotId: input.snapshotRef,
        scope: tenant,
        ordinal,
        memberKey: row.subjectId,
        state: "ready" as const,
        recipient: { tenantId: scope.tenantId, userId: row.subjectId },
        data: encodeCampaignSnapshotData(state === "unavailable" ? {} : { policyReplayRow: row }),
      })),
    });
  await store.completeSnapshot({
    scope: tenant,
    snapshotId: input.snapshotRef,
    expectedMemberCount: input.rows.length,
    completedAt: new Date(at(1)),
  });
  const service = new TargetingImpactOperations({
    reports: new InMemoryTargetingImpactReportStore(),
    campaignStore: store,
    campaignScope: scope,
    authorize: async (requested) =>
      state !== "denied" &&
      Object.keys(scope).every(
        (key) => requested[key as keyof ReplayScope] === scope[key as keyof ReplayScope],
      ),
  });
  return {
    service,
    async compare(unknownPolicy: "preserve" | "exclude") {
      if (state === "error")
        throw new TargetingImpactProblem("synthetic-source-failure", "Synthetic source failure");
      const {
        rows: _rows,
        scope: _scope,
        snapshotRef,
        ...configuration
      } = fixtureInput(state, unknownPolicy);
      return service.replayCampaign({
        scope,
        snapshotId: snapshotRef,
        configuration,
        bounds: { pageSize: 25, maxPages: 4, maxMembers: 100 },
      });
    },
  };
}
