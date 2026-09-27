import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createExample } from "./fixture";

async function main() {
  const fixture = await createExample();
  try {
    const captures = await fixture.state("captures");
    const search = await fixture.state("search");
    assert.equal(captures.sample?.rows[0]?.amount, "9223372036854775807");
    assert.equal(search.sample?.rows[0]?.rate, "12.30");
    assert.equal(
      captures.dataset.candidates.some((candidate) => candidate.state === "failed"),
      true,
    );
    assert.equal(
      captures.dataset.candidates.some((candidate) => candidate.state === "sealed"),
      true,
    );
    const replacement = captures.dataset.candidates.find(
      (candidate) => candidate.state === "sealed",
    );
    assert.ok(replacement);
    const service = fixture.capture;
    const published = await service.catalog.publishCandidate({
      access: service.access,
      candidateId: replacement.id,
      fence: replacement.fence,
      audit: {
        reason: "Smoke replacement",
        expectedRevision: captures.dataset.revision,
        idempotencyKey: randomUUID(),
      },
    });
    assert.equal((await fixture.state("captures")).dataset.head?.id, published.id);
    await assert.rejects(
      service.catalog.removePublication({
        access: service.access,
        snapshotId: published.id,
        audit: {
          reason: "Stale revision",
          expectedRevision: captures.dataset.revision,
          idempotencyKey: randomUUID(),
        },
      }),
    );
    const current = await fixture.state("captures");
    const removed = await service.catalog.removePublication({
      access: service.access,
      snapshotId: published.id,
      audit: {
        reason: "Smoke removal",
        expectedRevision: current.dataset.revision,
        idempotencyKey: randomUUID(),
      },
    });
    service.setPrivacyEpoch(removed.privacyEpoch);
    assert.equal((await fixture.state("captures")).dataset.head, null);
    console.log("Real PostgreSQL capture and search publication smoke passed.");
  } finally {
    await fixture.dispose();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
