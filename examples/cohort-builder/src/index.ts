import { randomUUID } from "node:crypto";
import {
  cohortContentHash,
  CohortAudienceSource,
  CohortInvalidProblem,
  PublishedCohortReader,
} from "@croco/cohort-core";
import type { CohortRun, CohortSnapshot } from "@croco/cohort-core";
import { createExample, pool } from "./fixture";

async function main(): Promise<void> {
  const { store, definition, registration, context, mapping, sourceSnapshotId, scope, asOf } =
    await createExample();
  const run: CohortRun = {
    id: randomUUID(),
    definitionVersion: definition.version,
    asOf,
    sourceSnapshotRefs: [sourceSnapshotId],
    sourceWatermarks: { reports: asOf },
    status: "running",
  };
  const input = { definition, registration, context, mapping, snapshotId: sourceSnapshotId };
  await store.saveDefinition(definition, registration, context);
  await store.start(input, run);
  let revision = 0;
  let complete = false;
  while (!complete) {
    const page = await store.materializePage(input, run.id, revision, 2);
    revision = page.revision;
    complete = page.complete;
  }

  const now = new Date();
  const subjectIds = ["inactive-trial"];
  const snapshot: CohortSnapshot = {
    snapshotId: randomUUID(),
    scope,
    subjectKind: "customer",
    definitionId: definition.id,
    definitionVersion: definition.version,
    schemaVersion: 1,
    sourceSnapshotRefs: [sourceSnapshotId],
    asOf,
    generatedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 3_600_000).toISOString(),
    contentHash: cohortContentHash(subjectIds),
    publicationRevision: 1,
    privacyVersion: "demo-v1",
    membershipRef: run.id,
  };
  await store.publish(run.id, snapshot, 0, {
    actor: "demo-operator",
    reason: "example",
    idempotencyKey: randomUUID(),
  });
  const reader = new PublishedCohortReader(store, {
    currentVersion: async () => "demo-v1",
    isAllowed: async () => true,
  });
  const audience = new CohortAudienceSource(
    reader,
    snapshot.snapshotId,
    scope,
    "customer",
    () => new Date(),
  );
  const members = [];
  for await (const member of audience.members({ tenantId: scope.tenantId })) members.push(member);
  if (members.length !== 1 || members[0]?.subjectId !== "inactive-trial") {
    throw new CohortInvalidProblem(
      "Published audience did not contain exactly the fully observed inactive trial",
    );
  }
  process.stdout.write(
    `${JSON.stringify({ runId: run.id, snapshotId: snapshot.snapshotId, members })}\n`,
  );
}

void main().finally(() => pool.end());
