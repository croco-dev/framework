import assert from "node:assert/strict";

async function main() {
  const base = "http://127.0.0.1:4319";
  const config = await (await fetch(`${base}/api/config`)).json();
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const previewResponse = await post("/api/preview", {
    definition: config.definition,
    asOf: config.asOf,
    sampleLimit: 3,
  });
  assert.equal(previewResponse.status, 200);
  const state = await previewResponse.json();
  assert.equal(state.preview.run.status, "complete");
  assert.equal(state.preview.matched, 1);
  assert.equal(state.preview.unknown, 1);
  assert.equal(state.preview.total, 3);
  const denied = await post("/api/preview", {
    definition: {
      ...config.definition,
      scope: { ...config.definition.scope, tenantId: "another-tenant" },
    },
    asOf: config.asOf,
    sampleLimit: 3,
  });
  assert.equal(denied.status, 400);
  const invalid = await post("/api/preview", {
    definition: config.definition,
    asOf: config.asOf,
    sampleLimit: 0,
  });
  assert.equal(invalid.status, 400);
  const request = {
    definition: config.definition,
    runId: state.preview.run.id,
    actor: "demo-operator",
    reason: "API smoke",
    expectedRevision: state.history[0]?.snapshot.publicationRevision ?? 0,
    idempotencyKey: state.preview.run.id,
  };
  const publishedResponse = await post("/api/publish", request);
  assert.equal(publishedResponse.status, 200);
  const published = await publishedResponse.json();
  assert.deepEqual(
    published.members.map((member: { subjectId: string }) => member.subjectId),
    ["inactive-trial"],
  );
  const retry = await post("/api/publish", request);
  assert.equal(retry.status, 200);
  assert.deepEqual((await retry.json()).state.history, published.state.history);
  const changedIntent = await post("/api/publish", { ...request, reason: "Different reason" });
  assert.equal(changedIntent.status, 400);
  const stale = await post("/api/publish", {
    ...request,
    idempotencyKey: `${request.idempotencyKey}-stale`,
  });
  assert.equal(stale.status, 400);
  process.stdout.write(
    "API smoke passed: materialization, coverage, access denial, publication retry, audience, revision conflict\n",
  );
}
void main();
