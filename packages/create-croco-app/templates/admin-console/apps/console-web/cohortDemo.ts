import { randomUUID } from "node:crypto";
import {
  assertCohortPreviewRequest,
  assertCohortPublishRequest,
  CohortAdminProblem,
} from "@croco/admin-core";
import {
  previewCohort,
  evaluateCohort,
  cohortContentHash,
  createCohortPublication,
  PublishedCohortReader,
  CohortAudienceSource,
} from "@croco/cohort-core";
import type {
  CohortDefinition,
  CohortRegistration,
  CohortSubject,
  CohortPublication,
} from "@croco/cohort-core";
import type {
  CohortAdminAccess,
  CohortAdminHistory,
  CohortPreviewRequest,
  CohortPublishRequest,
} from "@croco/admin-core";
import type { Plugin } from "vite";

const scope = { appId: "cohort-demo", environment: "local", tenantId: "demo-tenant" };
const asOf = "2026-09-27T00:00:00.000Z";
const access: CohortAdminAccess = {
  scope,
  subjectKind: "customer",
  permissions: ["cohort.preview", "cohort.explain", "cohort.publish"],
  fields: ["plan"],
};
const registration: CohortRegistration = {
  fields: { plan: { type: "string", operators: ["eq", "ne"], values: ["trial", "paid"] } },
  events: ["report.created"],
  memberships: [],
};
const definition: CohortDefinition = {
  id: "inactive-trial",
  version: 1,
  subjectKind: "customer",
  scope,
  root: {
    kind: "all",
    children: [
      { kind: "fact", field: "plan", operator: "eq", value: "trial" },
      {
        kind: "event",
        event: "report.created",
        metric: "count",
        operator: "eq",
        value: 0,
        windowDays: 7,
      },
    ],
  },
};
const subjects: readonly CohortSubject[] = [
  {
    subjectId: "active-trial",
    facts: { plan: "trial" },
    events: [{ event: "report.created", occurredAt: "2026-09-26T00:00:00Z" }],
    coverage: [{ event: "report.created", from: "2026-09-20T00:00:00Z", to: asOf }],
    memberships: [],
  },
  {
    subjectId: "inactive-trial",
    facts: { plan: "trial" },
    events: [],
    coverage: [{ event: "report.created", from: "2026-09-20T00:00:00Z", to: asOf }],
    memberships: [],
  },
  {
    subjectId: "unobserved-trial",
    facts: { plan: "trial" },
    events: [],
    coverage: [],
    memberships: [],
  },
];
/** Local synthetic-data demo only. Production routes must derive access from the authenticated principal. */
export function cohortDemo(): Plugin {
  const runs = new Map<string, CohortPreviewRequest>();
  const publications = new Map<string, CohortPublication>();
  const history: CohortAdminHistory[] = [];
  const completed = new Map<string, { request: string; entry: CohortAdminHistory }>();
  return {
    name: "cohort-demo",
    configureServer(server) {
      server.middlewares.use("/cohort-demo", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        try {
          if (req.method === "GET") {
            res.end(JSON.stringify({ definition, registration, asOf, history }));
            return;
          }
          let body = "";
          for await (const chunk of req) {
            body += String(chunk);
            if (body.length > 16384) throw new CohortAdminProblem("Request too large");
          }
          if (req.url === "/preview" && req.method === "POST") {
            const request = JSON.parse(body) as CohortPreviewRequest;
            assertCohortPreviewRequest(request, access);
            const result = previewCohort(
              request.definition,
              registration,
              { scope, subjectKind: "customer", allowedFields: access.fields },
              subjects,
              request.asOf,
              request.sampleLimit,
            );
            const id = randomUUID();
            runs.set(id, request);
            res.end(
              JSON.stringify({
                run: {
                  id,
                  status: "complete",
                  definitionVersion: request.definition.version,
                  asOf: request.asOf,
                  sourceSnapshotRefs: ["synthetic-fixture-v1"],
                  sourceWatermarks: { reports: asOf },
                },
                total: result.total,
                matched: result.match,
                unknown: result.unknown,
                sample: result.sample,
                previousMatched: history[0]?.memberCount,
              }),
            );
            return;
          }
          if (req.url === "/publish" && req.method === "POST") {
            const request = JSON.parse(body) as CohortPublishRequest;
            assertCohortPublishRequest(request, access);
            const existing = completed.get(request.idempotencyKey);
            if (existing) {
              if (existing.request !== JSON.stringify(request))
                throw new CohortAdminProblem("Idempotency key reused with different intent");
              res.end(JSON.stringify(existing.entry));
              return;
            }
            const run = runs.get(request.runId);
            if (
              !run ||
              JSON.stringify(run.definition) !== JSON.stringify(request.definition) ||
              request.expectedRevision !== history.length
            )
              throw new CohortAdminProblem("Run or publication revision conflict");
            const subjectIds = subjects
              .filter(
                (subject) => evaluateCohort(run.definition, subject, run.asOf).result === "match",
              )
              .map((subject) => subject.subjectId);
            const snapshot = {
              snapshotId: randomUUID(),
              scope,
              subjectKind: "customer",
              definitionId: run.definition.id,
              definitionVersion: run.definition.version,
              schemaVersion: 1 as const,
              sourceSnapshotRefs: ["synthetic-fixture-v1"],
              asOf: run.asOf,
              generatedAt: asOf,
              validUntil: "2026-09-28T00:00:00.000Z",
              contentHash: cohortContentHash(subjectIds),
              publicationRevision: history.length + 1,
              privacyVersion: "demo-v1",
              membershipRef: request.runId,
            };
            publications.set(snapshot.snapshotId, createCohortPublication(snapshot, subjectIds));
            const reader = new PublishedCohortReader(
              { read: async (id) => publications.get(id) },
              { currentVersion: async () => "demo-v1", isAllowed: async () => true },
            );
            const audience = new CohortAudienceSource(
              reader,
              snapshot.snapshotId,
              scope,
              "customer",
              () => new Date(asOf),
            );
            const memberCount = await audience.estimate({ tenantId: scope.tenantId });
            const entry = { snapshot, actor: request.actor, reason: request.reason, memberCount };
            history.unshift(entry);
            completed.set(request.idempotencyKey, { request: JSON.stringify(request), entry });
            res.end(JSON.stringify(entry));
            return;
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ code: "NOT_FOUND" }));
        } catch (failure) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              code:
                failure instanceof Error && "code" in failure
                  ? failure.code
                  : "COHORT_DEMO_REQUEST_FAILED",
            }),
          );
        }
      });
    },
  };
}
