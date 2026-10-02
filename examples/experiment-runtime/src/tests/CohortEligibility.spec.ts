import { cohortContentHash, PublishedCohortReader } from "@croco/cohort-core";
import { ExperimentRuntime, InMemoryExperimentStore } from "@croco/features-core";
import { describe, expect, it } from "vitest";
import { cohortExperimentEligibility } from "../cohortEligibility";
import type { CohortPublication } from "@croco/cohort-core";
import type { ExperimentDefinition } from "@croco/features-core";

const scope = { app: "shop", environment: "test", tenantId: "tenant" };
const subject = { kind: "user", id: "member" } as const;
const at = "2026-10-02T00:00:00Z";
const definition: ExperimentDefinition = {
  id: "checkout",
  revision: "r1",
  unit: "user",
  loginPolicy: "switch-unit",
  salt: "s1",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [{ id: "control", value: false, weight: 10000 }],
  hypothesis: "Completion",
  observationPlan: "Orders",
  eligibility: "snapshot-1",
};
const input = {
  scope,
  subject,
  actor: "server",
  experimentId: definition.id,
  experimentRevision: definition.revision,
};

function fixture() {
  let publication: CohortPublication = {
    withdrawn: false,
    subjectIds: ["member"],
    snapshot: {
      snapshotId: "snapshot-1",
      scope: { appId: scope.app, environment: scope.environment, tenantId: scope.tenantId },
      subjectKind: "user",
      definitionId: "audience",
      definitionVersion: 1,
      schemaVersion: 1,
      sourceSnapshotRefs: ["warehouse-r1"],
      asOf: at,
      generatedAt: at,
      validUntil: "2026-10-03T00:00:00Z",
      contentHash: cohortContentHash(["member"]),
      publicationRevision: 1,
      privacyVersion: "privacy-1",
      membershipRef: "members-1",
    },
  };
  let privacy = "privacy-1";
  let privacyUnavailable = false;
  let suppressed = false;
  const reader = new PublishedCohortReader(
    { read: async () => publication },
    {
      currentVersion: async () => {
        if (privacyUnavailable) throw new Error("Privacy reader offline");
        return privacy;
      },
      isAllowed: async () => !suppressed,
    },
  );
  const store = new InMemoryExperimentStore();
  const runtime = new ExperimentRuntime({
    store,
    authorization: { authorize: () => true },
    clock: { now: () => new Date(at) },
  });
  const eligibility = cohortExperimentEligibility(reader, "snapshot-1");
  return {
    runtime,
    eligibility,
    store,
    get publication() {
      return publication;
    },
    setPublication: (next: CohortPublication) => {
      publication = next;
    },
    setPrivacy: (next: string) => {
      privacy = next;
    },
    setPrivacyUnavailable: () => {
      privacyUnavailable = true;
    },
    suppress: () => {
      suppressed = true;
    },
    async start() {
      await runtime.register(
        { definition, handlers: { control: () => false }, eligibility },
        scope,
        "server",
      );
      await runtime.start({
        ...input,
        expectedRevision: 0,
        reason: "test",
        idempotencyKey: "start",
      });
    },
  };
}

describe("published cohort experiment profile", () => {
  it("uses a valid publication during source outage and preserves its exact reference", async () => {
    const f = fixture();
    await f.start();
    const assigned = await f.runtime.assign(input);
    expect(assigned).toMatchObject({
      status: "assigned",
      assignment: { value: false, eligibilitySnapshotRef: f.publication.snapshot },
    });
  });

  it.each([
    "expiry",
    "withdrawal",
    "schema",
    "privacy",
    "privacy-unavailable",
    "scope",
    "hash",
  ] as const)("does not count %s as control", async (failure) => {
    const f = fixture();
    await f.start();
    const p = f.publication;
    if (failure === "expiry")
      f.setPublication({ ...p, snapshot: { ...p.snapshot, validUntil: at } });
    if (failure === "withdrawal") f.setPublication({ ...p, withdrawn: true });
    if (failure === "schema")
      f.setPublication({ ...p, snapshot: { ...p.snapshot, schemaVersion: 2 as 1 } });
    if (failure === "privacy") f.setPrivacy("privacy-2");
    if (failure === "privacy-unavailable") f.setPrivacyUnavailable();
    if (failure === "scope")
      f.setPublication({
        ...p,
        snapshot: { ...p.snapshot, scope: { ...p.snapshot.scope, tenantId: "other" } },
      });
    if (failure === "hash")
      f.setPublication({ ...p, snapshot: { ...p.snapshot, contentHash: "invalid" } });
    expect(await f.runtime.assign(input)).toMatchObject({ status: "unavailable" });
  });

  it("excludes a currently suppressed subject instead of assigning control", async () => {
    const f = fixture();
    await f.start();
    f.suppress();
    expect(await f.runtime.assign(input)).toEqual({
      status: "not_assigned",
      reason: "cohort_subject_not_eligible",
    });
  });

  it("retains the winner and original exposure after rollback publication and pause", async () => {
    const f = fixture();
    await f.start();
    const assigned = await f.runtime.assign(input);
    if (assigned.status !== "assigned") throw new Error("Expected assignment");
    const p = f.publication;
    f.setPublication({
      ...p,
      snapshot: { ...p.snapshot, publicationRevision: 2, sourceSnapshotRefs: ["warehouse-r0"] },
    });
    expect(await f.runtime.assign(input)).toEqual(assigned);
    await f.runtime.pause({
      ...input,
      expectedRevision: 1,
      reason: "pause",
      idempotencyKey: "pause",
    });
    await f.runtime.recordExposure({
      ...input,
      assignmentId: assigned.assignment.id,
      deliveryInstanceId: "delivered-before-pause",
      occurredAt: at,
      kind: "display",
    });
    expect(await f.store.getAssignment(assigned.assignment.id)).toEqual(assigned.assignment);
  });

  it("denies new treatment after withdrawal without redrawing or deleting the original assignment", async () => {
    const f = fixture();
    await f.start();
    const assigned = await f.runtime.assign(input);
    if (assigned.status !== "assigned") throw new Error("Expected assignment");
    f.setPublication({ ...f.publication, withdrawn: true });
    expect(await f.runtime.treat({ ...input, assignmentId: assigned.assignment.id })).toMatchObject(
      { status: "not_assigned" },
    );
    expect(await f.store.getAssignment(assigned.assignment.id)).toEqual(assigned.assignment);
  });
});
