import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CustomerExplorerProblem } from "@croco/admin-core";
import { service, scope, sampleId, pool } from "./fixture";

async function main() {
  const sample = await service.getSample(scope, sampleId);
  assert.equal(sample.sampledSubjects.length, 3);
  for (const candidate of sample.sampledSubjects) {
    const page = await service.timeline(scope, sampleId, candidate.subject, { limit: 50 });
    assert.ok(page.items.length > 0);
    assert.ok(
      page.items.every((item) => !JSON.stringify(item).includes("synthetic@example.invalid")),
    );
    assert.equal(page.sources[0]?.truncated, candidate.subject.id === "busy-customer");
  }
  const subject = { kind: "customer", id: "busy-customer" };
  const id = randomUUID();
  await pool.query(
    "INSERT INTO customer_events VALUES ($1,$2,$3,$4,$5,$6,$7,$7,'page.viewed','{}')",
    [
      scope.appId,
      scope.environment,
      scope.tenantId,
      subject.kind,
      subject.id,
      id,
      "2026-10-05T10:00:00.000Z",
    ],
  );
  const noteId = randomUUID();
  const note = await service.saveNote(scope, sampleId, {
    id: noteId,
    subject,
    kind: "fact",
    eventRefs: [{ source: "normalized", eventId: id, subject }],
    text: "A page view was observed.",
    expectedRevision: 0,
  });
  const results = await Promise.allSettled(
    [1, 2].map((index) =>
      service.saveNote(scope, sampleId, {
        id: noteId,
        subject,
        kind: "hypothesis",
        eventRefs: note.eventRefs,
        text: `Review ${index}`,
        expectedRevision: 1,
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof CustomerExplorerProblem &&
        result.reason.code === "customer-explorer/revision-conflict",
    ).length,
    1,
  );
  await pool.query("DELETE FROM customer_events WHERE event_id=$1", [id]);
  const reread = (await service.notes(scope, sampleId)).find((entry) => entry.id === noteId);
  assert.equal(reread?.references[0]?.status, "unavailable");
  await service.saveNote(scope, sampleId, {
    id: noteId,
    subject,
    kind: "hypothesis",
    eventRefs: note.eventRefs,
    text: "Retain the unavailable evidence reference.",
    expectedRevision: 2,
  });
  assert.equal(
    (await service.notes(scope, sampleId)).find((entry) => entry.id === noteId)?.revision,
    3,
  );
  await service.deleteNote(scope, sampleId, noteId, 3);
  await assert.rejects(
    service.getSample({ ...scope, tenantId: "another-tenant" }, sampleId),
    (error) =>
      error instanceof CustomerExplorerProblem && error.code === "customer-explorer/denied",
  );
  console.log(
    "PostgreSQL service smoke passed: isolated users, masking, atomic note conflict, reread, unavailable references and denied scope.",
  );
}
void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
