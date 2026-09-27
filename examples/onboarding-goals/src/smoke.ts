import { randomUUID } from "node:crypto";
import type { GoalDefinition, GoalProgress } from "@croco/onboarding-core";

const base = "http://127.0.0.1:4320";

async function request(path: string, body?: unknown) {
  const response = await fetch(
    `${base}${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json", origin: base },
          body: JSON.stringify(body),
        },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const initial = await request("/api/bootstrap");
  assert(initial.status === 200, "Bootstrap failed");
  const access = initial.body.access as {
    scope: { tenantId: string; appId: string; environmentId: string };
    actor: string;
  };
  const definition = initial.body.definition as GoalDefinition;
  const progress = initial.body.progress as GoalProgress;
  assert(
    progress.progress === 0 && progress.status === "in_progress",
    "Initial progress must be zero",
  );

  const denied = await request("/api/preview", {
    scope: { ...access.scope, tenantId: "another-tenant" },
    subject: { id: initial.body.subjectId, verified: true },
    episodeId: initial.body.episodeId,
    asOf: new Date().toISOString(),
  });
  assert(denied.status === 400, "Cross-tenant preview must fail");

  const commandId = randomUUID();
  const first = await request("/api/reports", { commandId, name: "First report" });
  assert(
    first.status === 200 && first.body.progress === 1,
    "A domain report must advance progress",
  );
  const repeat = await request("/api/reports", { commandId, name: "First report" });
  assert(
    repeat.status === 200 && repeat.body.progress === 1,
    "Replayed report must not advance progress",
  );

  const after = await request("/api/bootstrap");
  const achieved = after.body.progress as GoalProgress;
  assert(
    achieved.status === "achieved" && achieved.progress === 1,
    "Goal must be achieved from the domain receipt",
  );

  const publish = await request("/api/publish", {
    scope: access.scope,
    definition: { ...definition, version: "v2", threshold: 3 },
    actor: access.actor,
    reason: "Raise target for future episodes",
    expectedRevision: 1,
    idempotencyKey: randomUUID(),
  });
  assert(publish.status === 200, "Definition v2 publication failed");
  const afterPublish = await request("/api/bootstrap");
  const pinned = afterPublish.body.progress as GoalProgress;
  assert(
    pinned.threshold === 1 && pinned.status === "achieved",
    "Existing episode must retain v1 policy",
  );
  process.stdout.write("Onboarding goal HTTP smoke passed\n");
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
