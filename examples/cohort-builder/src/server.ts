import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { assertCohortPreviewRequest, assertCohortPublishRequest } from "@croco/admin-core";
import {
  CohortAudienceSource,
  CohortInvalidProblem,
  PublishedCohortReader,
  cohortContentHash,
} from "@croco/cohort-core";
import type {
  CohortAdminHistory,
  CohortAdminPreview,
  CohortPreviewRequest,
  CohortPublishRequest,
} from "@croco/admin-core";
import type { CohortDefinition, CohortMember, CohortRun, CohortSnapshot } from "@croco/cohort-core";
import { createExample, pool } from "./fixture";

async function main() {
  const fixture = await createExample();
  const { store, scope, asOf, definition, registration, context, mapping, sourceSnapshotId } =
    fixture;
  const access = {
    scope,
    subjectKind: definition.subjectKind,
    fields: ["plan"],
    permissions: ["cohort.preview", "cohort.explain", "cohort.publish"],
  };
  const runs = new Map<
    string,
    { definition: CohortDefinition; preview: CohortAdminPreview; members: CohortMember[] }
  >();
  const history: CohortAdminHistory[] = [];
  const publicationAttempts = new Map<
    string,
    { request: CohortPublishRequest; snapshot: CohortSnapshot }
  >();
  const reader = new PublishedCohortReader(store, {
    currentVersion: async () => "demo-v1",
    isAllowed: async () => true,
  });
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(readFileSync(resolve(__dirname, "../index.html")));
        return;
      }
      if (req.method === "GET" && req.url === "/browser.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(readFileSync(resolve(__dirname, "../dist/browser.global.js")));
        return;
      }
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" && req.url === "/api/config") {
        res.end(
          JSON.stringify({ definition, registration, asOf, state: { kind: "ready", history } }),
        );
        return;
      }
      if (req.method !== "POST" || !["/api/preview", "/api/publish"].includes(req.url ?? "")) {
        res.statusCode = 404;
        res.end(JSON.stringify({ code: "NOT_FOUND" }));
        return;
      }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
        throw new CohortInvalidProblem("Cross-origin requests are rejected");
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 32_768) throw new CohortInvalidProblem("Request exceeds 32 KiB");
      }
      if (req.url === "/api/preview") {
        const request = JSON.parse(body) as CohortPreviewRequest;
        assertCohortPreviewRequest(request, access);
        if (request.definition.id !== definition.id || request.asOf !== asOf)
          throw new CohortInvalidProblem("Example definition or source timestamp changed");
        const input = {
          definition: request.definition,
          registration,
          context,
          mapping,
          snapshotId: sourceSnapshotId,
        };
        const run: CohortRun = {
          id: randomUUID(),
          definitionVersion: request.definition.version,
          asOf,
          sourceSnapshotRefs: [sourceSnapshotId],
          sourceWatermarks: { reports: asOf },
          status: "running",
        };
        const saved = [...runs.values()].find(
          (item) => item.definition.version === request.definition.version,
        );
        if (saved && !isDeepStrictEqual(saved.definition, request.definition))
          throw new CohortInvalidProblem("Saved definition version changed");
        if (!saved) await store.saveDefinition(request.definition, registration, context);
        await store.start(input, run);
        const members: CohortMember[] = [];
        let revision = 0;
        while (true) {
          const page = await store.materializePage(input, run.id, revision, 2);
          members.push(...page.members);
          revision = page.revision;
          if (page.complete) break;
        }
        const preview: CohortAdminPreview = {
          run: { ...run, status: "complete" },
          total: members.length,
          matched: members.filter((m) => m.result === "match").length,
          unknown: members.filter((m) => m.result === "unknown").length,
          sample: members.slice(0, request.sampleLimit),
          previousMatched: history[0]?.memberCount,
        };
        runs.set(run.id, { definition: request.definition, preview, members });
        res.end(JSON.stringify({ kind: "ready", preview, history }));
        return;
      }
      const request = JSON.parse(body) as CohortPublishRequest;
      assertCohortPublishRequest(request, access);
      const completed = runs.get(request.runId);
      if (!completed || !isDeepStrictEqual(completed.definition, request.definition))
        throw new CohortInvalidProblem("Preview the current definition before publishing");
      const previousAttempt = publicationAttempts.get(request.idempotencyKey);
      if (previousAttempt && !isDeepStrictEqual(previousAttempt.request, request))
        throw new CohortInvalidProblem("Idempotency key belongs to a different publication");
      const now = new Date();
      const snapshot: CohortSnapshot = previousAttempt?.snapshot ?? {
        snapshotId: randomUUID(),
        scope,
        subjectKind: definition.subjectKind,
        definitionId: definition.id,
        definitionVersion: completed.definition.version,
        schemaVersion: 1,
        sourceSnapshotRefs: [sourceSnapshotId],
        asOf,
        generatedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + 3_600_000).toISOString(),
        contentHash: cohortContentHash(
          completed.members.filter((m) => m.result === "match").map((m) => m.subjectId),
        ),
        publicationRevision: request.expectedRevision + 1,
        privacyVersion: "demo-v1",
        membershipRef: request.runId,
      };
      publicationAttempts.set(request.idempotencyKey, { request, snapshot });
      const publication = await store.publish(request.runId, snapshot, request.expectedRevision, {
        actor: "demo-operator",
        reason: request.reason,
        idempotencyKey: request.idempotencyKey,
      });
      if (!history.some((item) => item.snapshot.snapshotId === publication.snapshot.snapshotId))
        history.unshift({
          snapshot: publication.snapshot,
          actor: "demo-operator",
          reason: request.reason,
          memberCount: publication.subjectIds.length,
        });
      const audience = new CohortAudienceSource(
        reader,
        publication.snapshot.snapshotId,
        scope,
        definition.subjectKind,
        () => new Date(),
      );
      const members = [];
      for await (const member of audience.members({ tenantId: scope.tenantId }))
        members.push(member);
      res.end(
        JSON.stringify({ state: { kind: "ready", preview: completed.preview, history }, members }),
      );
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          code: error instanceof Error && "code" in error ? error.code : "COHORT_OPERATION_FAILED",
          detail: error instanceof Error ? error.message : "Invalid request",
        }),
      );
    }
  });
  server.listen(4319, "127.0.0.1", () =>
    process.stdout.write("Cohort builder: http://127.0.0.1:4319\n"),
  );
  process.once("SIGINT", () => server.close(() => void pool.end()));
  process.once("SIGTERM", () => server.close(() => void pool.end()));
}
void main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
