import { ExperimentOperations } from "@croco/admin-core";
import { ExperimentRuntime, InMemoryExperimentStore } from "@croco/features-core";
import {
  cohortContentHash,
  createCohortPublication,
  PublishedCohortReader,
} from "@croco/cohort-core";
import { cohortExperimentEligibility } from "./cohortEligibility";
import type { ExperimentAdminAccess } from "@croco/admin-core";
import type { ExperimentDefinition, ExperimentScope } from "@croco/features-core";

export const scope: ExperimentScope & { tenantId: string } = {
  app: "checkout",
  environment: "local",
  tenantId: "demo-tenant",
};
export const actor = "local-operator";
export const definition: ExperimentDefinition = {
  id: "checkout-assurance",
  revision: "v1",
  unit: "user",
  loginPolicy: "preserve-unit",
  salt: "local-checkout-assurance-v1",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [
    { id: "control", value: false, weight: 5000 },
    { id: "assurance", value: true, weight: 5000 },
  ],
  hypothesis: "Clear payment assurance increases checkout completion.",
  observationPlan:
    "Compare completed checkouts per admitted subject over seven days. No automatic winner promotion.",
  eligibility: "all-demo-subjects",
};
export async function createDemo() {
  const store = new InMemoryExperimentStore();
  const samples = [
    {
      id: "buyer",
      label: "Signed-in demo buyer",
      subject: { kind: "user" as const, id: "demo-user" },
    },
    {
      id: "tenant",
      label: "Demo tenant",
      subject: { kind: "tenant" as const, id: scope.tenantId },
    },
    {
      id: "anonymous",
      label: "Stable anonymous visitor",
      subject: { kind: "anonymous" as const, id: "demo-anonymous" },
    },
    { id: "missing", label: "Missing stable identity", subject: { kind: "user" as const, id: "" } },
  ];
  const runtime = new ExperimentRuntime({
    store,
    authorization: {
      authorize: (request) =>
        request.actor === actor &&
        request.scope.app === scope.app &&
        request.scope.environment === scope.environment &&
        request.scope.tenantId === scope.tenantId &&
        (request.experimentId === definition.id || request.experimentId === "*") &&
        (!request.subject ||
          samples.some(
            (sample) =>
              sample.subject.kind === request.subject?.kind &&
              sample.subject.id === request.subject.id,
          )),
    },
  });
  await runtime.register(
    {
      definition,
      eligibility: () => ({ status: "eligible" }),
      handlers: {
        control: () => "Standard checkout processed",
        assurance: () => "Checkout processed with payment assurance",
      },
    },
    scope,
    actor,
  );
  runtime.registerEligibility("signed-in-demo-buyers", (input) =>
    input.subject.kind === "user"
      ? { status: "eligible" }
      : { status: "ineligible", reason: "signed_in_required" },
  );
  const generatedAt = new Date();
  const publication = createCohortPublication(
    {
      snapshotId: "published-demo-buyers-v1",
      scope: { appId: scope.app, environment: scope.environment, tenantId: scope.tenantId },
      subjectKind: "user",
      definitionId: "demo-buyers",
      definitionVersion: 1,
      schemaVersion: 1,
      sourceSnapshotRefs: ["local-demo-subjects-v1"],
      asOf: generatedAt.toISOString(),
      generatedAt: generatedAt.toISOString(),
      validUntil: new Date(generatedAt.getTime() + 86400000).toISOString(),
      contentHash: cohortContentHash(["demo-user"]),
      publicationRevision: 1,
      privacyVersion: "local-demo-privacy-v1",
      membershipRef: "local-demo-members-v1",
    },
    ["demo-user"],
  );
  const reader = new PublishedCohortReader(
    { read: async () => publication },
    {
      currentVersion: async () => "local-demo-privacy-v1",
      isAllowed: async (_scope, subjectId) => subjectId === "demo-user",
    },
  );
  runtime.registerEligibility(
    "published-demo-buyers",
    cohortExperimentEligibility(reader, publication.snapshot.snapshotId),
  );
  const access: ExperimentAdminAccess = {
    scope,
    actor,
    permissions: [
      "experiment.read",
      "experiment.preview",
      "experiment.operate",
      "experiment.configure",
    ],
  };
  const operations = new ExperimentOperations(runtime, () => samples, runtime.getEligibilityIds());
  return { runtime, store, operations, access, samples };
}
