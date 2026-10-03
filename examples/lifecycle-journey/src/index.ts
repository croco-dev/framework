import assert from "node:assert/strict";
import { createExample, definition, scope } from "./fixture";
import { createJourneyRuntime } from "./tasks";

async function main() {
  const example = createExample();
  let runtime = createJourneyRuntime(example.store, example.engine, scope, example.now);
  example.setFacts("purchased-early", {
    purchased: false,
    interested: true,
    consent: true,
    available: true,
  });
  await example.engine.enter(definition.id, definition.version, example.entry("purchased-early"));
  await runtime.wake.run();
  const firstRevision = (await example.store.get(scope, "episode-purchased-early"))?.revision;
  const duplicateKey = JSON.stringify([
    scope.appId,
    scope.environment,
    scope.tenantId,
    "episode-purchased-early",
    "wait-one-hour",
    0,
  ]);
  await runtime.runner.execute(
    "croco.journey.node",
    {
      scope,
      episodeId: "episode-purchased-early",
      revision: 0,
    },
    { idempotencyKey: duplicateKey },
  );
  assert.equal(
    (await example.store.get(scope, "episode-purchased-early"))?.revision,
    firstRevision,
  );
  example.setFacts("purchased-early", {
    purchased: true,
    interested: true,
    consent: true,
    available: true,
  });
  example.advance(3_600_000);
  runtime = createJourneyRuntime(
    example.store,
    example.engine,
    scope,
    example.now,
    runtime.executionStore,
  );
  await runtime.wake.run();
  const exited = await example.store.get(scope, "episode-purchased-early");
  assert.ok(exited);
  assert.equal(exited.status, "exited");
  assert.equal(example.sent.length, 0);

  example.setFacts("reminded", {
    purchased: false,
    interested: true,
    consent: true,
    available: true,
  });
  await example.engine.enter(definition.id, definition.version, example.entry("reminded"));
  await runtime.wake.run();
  example.advance(3_600_000);
  await runtime.wake.run();
  await runtime.wake.run();
  await runtime.wake.run();
  await runtime.wake.run();
  const reminded = await example.store.get(scope, "episode-reminded");
  assert.ok(reminded);
  assert.equal(reminded.nodeId, "wait-one-day");
  assert.equal(example.sent.length, 1);

  process.stdout.write(
    JSON.stringify({
      earlyPurchase: exited.status,
      reminder: reminded.status,
      messages: example.sent.length,
      taskExecutions: (await runtime.executionStore.list()).length,
    }) + "\n",
  );
}

void main();
