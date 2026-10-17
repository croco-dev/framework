import { describe, expect, it } from "vitest";
import { PublishedCohortReader, cohortContentHash } from "@croco/cohort-core";
import type { CohortPublication } from "@croco/cohort-core";
import {
  ExperimentDeliveryBridge,
  InMemoryExperimentDeliveryStore,
  ExperimentRuntime,
  InMemoryExperimentStore,
} from "@croco/features-core";
import { cohortExperimentEligibility } from "../cohortEligibility";
import type { ExperimentDefinition } from "@croco/features-core";
const scope = { app: "checkout", environment: "test", tenantId: "tenant-a" };
const identity = { scope, actor: "server", subject: { kind: "user" as const, id: "buyer-a" } };
const target = { scope, experimentId: "banner", experimentRevision: "1" };
const definition: ExperimentDefinition = {
  id: "banner",
  revision: "1",
  unit: "user",
  loginPolicy: "preserve-unit",
  salt: "salt",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [{ id: "banner", value: "Protected payment", weight: 10000 }],
  hypothesis: "assurance",
  observationPlan: "purchases",
  eligibility: "published-cohort",
};
async function fixture() {
  let now = new Date("2026-10-01T10:00:00Z");
  let privacy = "privacy-1";
  let publication: CohortPublication = {
    snapshot: {
      snapshotId: "source-1",
      scope: { appId: scope.app, environment: scope.environment, tenantId: scope.tenantId },
      subjectKind: "user",
      definitionId: "eligible-buyers",
      definitionVersion: 1,
      schemaVersion: 1,
      sourceSnapshotRefs: ["warehouse-job-completed"],
      asOf: "2026-10-01T08:00:00Z",
      generatedAt: "2026-10-01T09:00:00Z",
      validUntil: "2026-10-01T11:00:00Z",
      contentHash: cohortContentHash(["buyer-a"]),
      publicationRevision: 1,
      privacyVersion: privacy,
      membershipRef: "members-1",
    },
    subjectIds: ["buyer-a"],
    withdrawn: false,
  };
  const reader = new PublishedCohortReader(
    { read: async () => publication },
    { currentVersion: async () => privacy, isAllowed: async () => true },
  );
  const store = new InMemoryExperimentStore();
  const clock = { now: () => now };
  const runtime = new ExperimentRuntime({ store, clock, authorization: { authorize: () => true } });
  await runtime.register(
    {
      definition,
      eligibility: cohortExperimentEligibility(reader, "source-1"),
      handlers: { banner: () => "done" },
    },
    scope,
    "server",
  );
  await runtime.start({
    ...target,
    actor: "server",
    expectedRevision: 0,
    reason: "fixture",
    idempotencyKey: "start",
  });
  const bridge = new ExperimentDeliveryBridge({
    reader: runtime,
    store: new InMemoryExperimentDeliveryStore(),
    clock,
    regions: [{ id: "hero", target, policyRevision: "p1" }],
    ttlMs: 3600000,
    evaluationTimeoutMs: 1000,
  });
  return {
    bridge,
    clock,
    setPublication: (next: CohortPublication) => {
      publication = next;
    },
    getPublication: () => publication,
    expire: () => {
      now = new Date("2026-10-01T11:00:00Z");
    },
    revokePrivacy: () => {
      privacy = "privacy-2";
    },
  };
}
describe("delivery with the published cohort reader", () => {
  it("serves prepared membership independently of source availability and keeps source identity private", async () => {
    // No warehouse/provider client is present: only an already-published serving envelope can be read.
    const { bridge } = await fixture();
    const [decision] = await bridge.prepare(["hero"], identity, "admitted");
    expect(decision?.status).toBe("assigned");
    for (const privateValue of ["source-1", "warehouse-job-completed", "privacy-1", "buyer-a"])
      expect(JSON.stringify(decision)).not.toContain(privateValue);
  });
  for (const fault of ["withdrawn", "schema", "hash", "scope", "privacy", "expiry"] as const) {
    it(`does not count ${fault} as a control assignment or consume stale prefetch`, async () => {
      const f = await fixture();
      const [prefetch] = await f.bridge.prepare(["hero"], identity, "speculative");
      const [shown] = await f.bridge.prepare(["hero"], identity, "admitted");
      const occurredAt = f.clock.now().toISOString();
      const original = f.getPublication();
      if (fault === "withdrawn") f.setPublication({ ...original, withdrawn: true });
      if (fault === "schema")
        f.setPublication({
          ...original,
          snapshot: { ...original.snapshot, schemaVersion: 2 as 1 },
        });
      if (fault === "hash") f.setPublication({ ...original, subjectIds: ["buyer-b"] });
      if (fault === "scope")
        f.setPublication({
          ...original,
          snapshot: {
            ...original.snapshot,
            scope: { ...original.snapshot.scope, tenantId: "tenant-b" },
          },
        });
      if (fault === "privacy") f.revokePrivacy();
      if (fault === "expiry") f.expire();
      expect((await f.bridge.admit(prefetch?.receipt ?? "", identity)).status).toBe("fallback");
      const [decision] = await f.bridge.prepare(["hero"], identity, "admitted");
      expect(decision?.status).toBe("fallback");
      expect(decision?.receipt).toBeUndefined();
      expect(decision?.variant).toBeUndefined();
      // Already displayed history is resolved against the original assignment, without re-reading source membership.
      expect(
        await f.bridge.expose(shown?.receipt ?? "", identity, "historical-display", occurredAt),
      ).toMatchObject({ kind: "display" });
    });
  }
  it("a compatible republished snapshot does not reinterpret past delivery while current privacy still gates new admission", async () => {
    const f = await fixture();
    const [shown] = await f.bridge.prepare(["hero"], identity, "admitted");
    const original = f.getPublication();
    f.setPublication({
      ...original,
      snapshot: {
        ...original.snapshot,
        publicationRevision: 2,
        sourceSnapshotRefs: ["older-compatible-source"],
      },
    });
    const historical = await f.bridge.expose(
      shown?.receipt ?? "",
      identity,
      "old-display",
      f.clock.now().toISOString(),
    );
    const admitted = await f.bridge.admit(shown?.receipt ?? "", identity);
    expect(admitted.deliveryId).toBe(shown?.deliveryId);
    expect(historical.assignmentId).toBeTruthy();
    f.revokePrivacy();
    expect((await f.bridge.admit(shown?.receipt ?? "", identity)).status).toBe("fallback");
  });
});
