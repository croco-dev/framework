import { randomUUID } from "node:crypto";
import { MissionInvalidProblem } from "@croco/gamification-core";
import type {
  MissionIngestResult,
  MissionProgress,
  MissionPublication,
} from "@croco/gamification-core";

const base = "http://127.0.0.1:4315";
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
function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new MissionInvalidProblem(detail);
}
async function main(): Promise<void> {
  const initial = await request("/api/bootstrap");
  assert(initial.status === 200, "Bootstrap unavailable");
  const original = initial.body.progress as MissionProgress;
  const publication = initial.body.publication as MissionPublication;
  assert(
    publication.definition.countMode === "events",
    "Run smoke with the event-count demo definition",
  );
  const episodeCommand = { version: publication.definition.version, commandId: randomUUID() };
  const restart = await request("/api/episodes", episodeCommand);
  assert(restart.status === 200, "Explicit new episode failed");
  const episode = (restart.body.progress as MissionProgress).key.episodeId;
  const replayEpisode = await request("/api/episodes", episodeCommand);
  assert(
    replayEpisode.status === 200 &&
      (replayEpisode.body.progress as MissionProgress).key.episodeId === episode,
    "Episode command replay changed identity",
  );
  assert(
    (await request("/api/episodes", { ...episodeCommand, version: episodeCommand.version + 1 }))
      .status === 409,
    "Episode command conflict accepted",
  );
  const commandId = randomUUID();
  const first = await request("/api/reports", { commandId, name: "Mission smoke report" });
  const result = first.body as unknown as MissionIngestResult;
  assert(
    first.status === 200 && result.progress.instance.progress === 1,
    "Server report did not count",
  );
  const replay = await request("/api/reports", { commandId, name: "Mission smoke report" });
  const duplicate = replay.body as unknown as MissionIngestResult;
  assert(
    replay.status === 200 && duplicate.duplicate && duplicate.progress.instance.progress === 1,
    "Duplicate counted",
  );
  const conflict = await request("/api/reports", { commandId, name: "Changed report" });
  assert(conflict.status === 409, "Conflicting command accepted");
  const forged = await request("/api/reports", {
    commandId: randomUUID(),
    name: "Forgery",
    subjectId: "another-member",
    completion: 3,
  });
  assert(forged.status === 422, "Client subject/completion accepted");
  const denied = await request("/api/definition", {
    ...publication,
    scope: { ...publication.scope, tenantId: "other-tenant" },
  });
  assert(denied.status === 422, "Cross-tenant publication accepted");
  let completions = Number(result.completionCreated);
  for (let index = 1; index < publication.definition.target; index++) {
    const saved = await request("/api/reports", {
      commandId: randomUUID(),
      name: `Mission report ${index}`,
    });
    assert(saved.status === 200, "Report save failed");
    completions += Number((saved.body as unknown as MissionIngestResult).completionCreated);
  }
  const complete = await request("/api/progress");
  const progress = complete.body as unknown as MissionProgress;
  assert(progress.instance.state === "achieved" && completions === 1, "Completion was not unique");
  assert(
    progress.key.episodeId === episode && original.key.version === publication.definition.version,
    "Episode/version provenance changed unexpectedly",
  );
  const nextPublication: MissionPublication = {
    ...publication,
    definition: { ...publication.definition, version: publication.definition.version + 1 },
    revision: publication.revision + 1,
    idempotencyKey: randomUUID(),
    reason: "Verify replay across a later episode",
    publishedAt: new Date().toISOString(),
  };
  assert((await request("/api/definition", nextPublication)).status === 200, "Next policy failed");
  const later = await request("/api/episodes", {
    version: nextPublication.definition.version,
    commandId: randomUUID(),
  });
  assert(later.status === 200, "Later episode failed");
  const laterEpisode = (later.body.progress as MissionProgress).key.episodeId;
  const historicalReport = await request("/api/reports", {
    commandId,
    name: "Mission smoke report",
  });
  const historicalEpisode = await request("/api/episodes", episodeCommand);
  process.stdout.write(
    `Historical replay: report status ${historicalReport.status}; episode ${(historicalEpisode.body.progress as MissionProgress).key.episodeId}; expected ${episode}\n`,
  );
  assert(
    historicalReport.status === 200 &&
      (historicalReport.body as unknown as MissionIngestResult).duplicate &&
      (historicalReport.body as unknown as MissionIngestResult).progress.key.episodeId ===
        episode &&
      (historicalReport.body as unknown as MissionIngestResult).progress.key.version ===
        episodeCommand.version,
    "Report replay must retain its recorded episode/version after a later transition",
  );
  assert(
    historicalEpisode.status === 200 &&
      (historicalEpisode.body.progress as MissionProgress).key.episodeId === episode &&
      (historicalEpisode.body.progress as MissionProgress).key.version === episodeCommand.version &&
      (historicalEpisode.body.publication as MissionPublication).definition.version ===
        episodeCommand.version,
    "Episode replay must return its recorded episode/version after a later transition",
  );
  const stillCurrent = (await request("/api/progress")).body as unknown as MissionProgress;
  assert(
    stillCurrent.key.episodeId === laterEpisode && stillCurrent.instance.progress === 0,
    "Historical command replay changed the current episode",
  );
  assert(
    (await request("/api/reports", { commandId, name: "Changed historical report" })).status ===
      409,
    "Historical command payload conflict accepted",
  );
  process.stdout.write(
    "Recurring mission PostgreSQL HTTP smoke passed: dedupe, conflict, authorization, explicit episode, unique achievement\n",
  );
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
