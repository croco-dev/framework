import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  SurveyManager,
  SurveyInvalidProblem,
  SurveyDeniedProblem,
  surveyCsvCell,
} from "@croco/research-core";
import { DrizzleSurveyStore, surveyTokenCodec, addMicroSurveys } from "@croco/research-drizzle";
import { validateSurveyPublishRequest } from "@croco/admin-core/survey-operations";
import type { SurveyDefinition, SurveyScope, SurveyAnswers } from "@croco/research-core";
import type { SurveyPublishRequest } from "@croco/admin-core/survey-operations";
import type { IncomingMessage, ServerResponse } from "node:http";

const scope: SurveyScope = { tenantId: "demo-tenant", appId: "reports", environmentId: "local" };
const definition: SurveyDefinition = {
  id: "first-report",
  version: "v1",
  title: "How was your first report?",
  questions: [
    {
      id: "result",
      title: "Was the report useful?",
      kind: "single",
      required: true,
      options: [
        { id: "useful", label: "Useful" },
        { id: "unclear", label: "Unclear" },
      ],
    },
    { id: "score", title: "Satisfaction", kind: "scale", required: true, min: 1, max: 5 },
    {
      id: "features",
      title: "What did you use?",
      kind: "multi",
      required: false,
      options: [
        { id: "chart", label: "Chart" },
        { id: "export", label: "Export" },
      ],
    },
    {
      id: "comment",
      title: "Optional comment (avoid personal information)",
      kind: "text",
      required: false,
      maxLength: 200,
    },
  ],
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  trigger: "report.saved",
  eligibility: "first-report",
  frequencyPolicy: { maxInvitations: 2, windowMs: 86400000 },
  allowEdits: true,
  retentionMs: 7 * 86400000,
};
async function main() {
  const url = process.env.RESEARCH_EXAMPLE_DATABASE_URL;
  if (!url) throw new SurveyInvalidProblem("RESEARCH_EXAMPLE_DATABASE_URL required");
  // This demo creates a disposable schema; deploy migrations separately in a real app.
  const schema = `micro_surveys_demo_${randomUUID().replaceAll("-", "")}`;
  const setup = new Pool({ connectionString: url });
  await setup.query(`create schema "${schema}"`);
  await setup.end();
  const pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
  const db = drizzle(pool);
  await addMicroSurveys(db);
  await pool.query(
    "create table demo_reports(id text primary key,subject_id text not null,name text not null)",
  );
  const manager = new SurveyManager(
    new DrizzleSurveyStore(db),
    {
      authorize: async ({ scope: s, actor }) =>
        JSON.stringify(s) === JSON.stringify(scope) && actor === "demo-operator",
      verifySubject: async ({ scope: s, actor, subject }) =>
        JSON.stringify(s) === JSON.stringify(scope) &&
        subject.kind === "member" &&
        actor === subject.id &&
        actor === "demo-customer",
    },
    surveyTokenCodec,
    {
      "first-report": async ({ subject }) =>
        (await pool.query("select 1 from demo_reports where subject_id=$1 limit 1", [subject.id]))
          .rowCount === 1,
    },
    ["report.saved"],
  );
  const admin = { scope, actor: "demo-operator" };
  const customer = { scope, actor: "demo-customer" };
  await manager.publish({
    ...admin,
    definition,
    expectedRevision: 0,
    reason: "Local synthetic demonstration",
    idempotencyKey: "initial",
  });
  const html = await readFile(join(process.cwd(), "index.html"));
  const browser = await readFile(join(process.cwd(), "dist/browser.global.js"));
  const port = Number(process.env.RESEARCH_EXAMPLE_PORT ?? 4321);
  const origin = `http://127.0.0.1:${port}`;
  const json = (res: ServerResponse, status: number, payload: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(payload));
  };
  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let text = "";
    for await (const chunk of req) {
      text += String(chunk);
      if (text.length > 32768) throw new SurveyInvalidProblem("body too large");
    }
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new SurveyInvalidProblem("body");
    return value as Record<string, unknown>;
  }
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", origin).pathname;
      if (req.method === "GET" && path === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(html);
        return;
      }
      if (req.method === "GET" && path === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === "GET" && path === "/browser.js") {
        res.writeHead(200, { "content-type": "application/javascript" });
        res.end(browser);
        return;
      }
      // A same-origin, loopback-only synthetic demonstration, not a deployable authentication adapter.
      if (req.headers.origin && req.headers.origin !== origin) throw new SurveyDeniedProblem();
      if (req.headers["sec-fetch-site"] === "cross-site") throw new SurveyDeniedProblem();
      const actor =
        req.headers["x-demo-role"] === "operator"
          ? admin
          : req.headers["x-demo-role"] === "customer"
            ? customer
            : null;
      if (!actor) throw new SurveyDeniedProblem();
      if (req.method === "GET" && path === "/api/bootstrap") {
        if (actor.actor !== admin.actor) throw new SurveyDeniedProblem();
        const publication = await new DrizzleSurveyStore(db).transaction(scope, (s) =>
          s.latest(definition.id),
        );
        json(res, 200, {
          publication,
          access: { ...admin, permissions: ["publish", "read", "raw", "delete", "classify"] },
        });
        return;
      }
      if (req.method !== "POST") {
        json(res, 404, { message: "Not found" });
        return;
      }
      const input = await body(req);
      if (path === "/api/report") {
        if (
          actor.actor !== customer.actor ||
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 120
        )
          throw new SurveyInvalidProblem("report");
        const id = randomUUID();
        await pool.query("insert into demo_reports values($1,$2,$3)", [
          id,
          customer.actor,
          input.name,
        ]);
        json(res, 200, { reportId: id });
        return;
      }
      if (path === "/api/invitation") {
        if (
          actor.actor !== customer.actor ||
          typeof input.reportId !== "string" ||
          !(
            await pool.query("select 1 from demo_reports where id=$1 and subject_id=$2", [
              input.reportId,
              customer.actor,
            ])
          ).rowCount
        )
          throw new SurveyDeniedProblem();
        const invitation = await manager.createInvitation({
          ...customer,
          subject: { kind: "member", id: customer.actor },
          familyId: definition.id,
          trigger: "report.saved",
        });
        json(res, 200, invitation);
        return;
      }
      if (path === "/api/publish") {
        const value = input as unknown as SurveyPublishRequest;
        validateSurveyPublishRequest(value);
        json(res, 200, await manager.publish({ ...value, ...actor }));
        return;
      }
      if (path === "/api/results") {
        json(
          res,
          200,
          await manager.results({
            ...actor,
            familyId: definition.id,
            denominator: input.denominator as "invitation" | "exposure",
          }),
        );
        return;
      }
      if (path === "/api/raw") {
        json(
          res,
          200,
          await manager.rawResponses({
            ...actor,
            familyId: definition.id,
            limit: 20,
            after: typeof input.after === "string" ? input.after : undefined,
          }),
        );
        return;
      }
      if (path === "/api/export") {
        const rows = await manager.rawResponses({ ...actor, familyId: definition.id, limit: 100 });
        json(res, 200, {
          csv: [
            '"invitation","revision","answers","human classification"',
            ...rows.map((r) =>
              [
                r.invitationId,
                String(r.revision),
                JSON.stringify(r.answers),
                r.classification ?? "",
              ]
                .map(surveyCsvCell)
                .join(","),
            ),
          ].join("\r\n"),
          bounded: true,
        });
        return;
      }
      if (path === "/api/change") {
        await manager.changeResponse({
          ...actor,
          invitationId: input.invitationId as string,
          operation: input.operation as "delete" | "classify",
          classification: input.classification as string | undefined,
          expectedRevision: input.expectedRevision as number,
          reason: input.reason as string,
          idempotencyKey: input.idempotencyKey as string,
        });
        json(res, 200, { ok: true });
        return;
      }
      const tokenInput = { ...actor, token: input.token as string };
      if (path === "/api/expose") {
        json(res, 200, await manager.expose(tokenInput));
        return;
      }
      if (path === "/api/submit") {
        json(
          res,
          200,
          await manager.submitResponse({
            ...tokenInput,
            answers: input.answers as SurveyAnswers,
            idempotencyKey: input.idempotencyKey as string,
            expectedRevision: input.expectedRevision as number | undefined,
          }),
        );
        return;
      }
      if (path === "/api/dismiss") {
        await manager.dismiss(tokenInput);
        json(res, 200, { ok: true });
        return;
      }
      json(res, 404, { message: "Not found" });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : "research/survey-invalid";
      json(
        res,
        code === "research/survey-denied"
          ? 403
          : code === "research/survey-conflict"
            ? 409
            : code === "research/survey-unavailable"
              ? 503
              : 400,
        { code, message: error instanceof Error ? error.message : "Request failed" },
      );
    }
  });
  server.listen(port, "127.0.0.1", () =>
    process.stdout.write(`Micro surveys: ${origin} (${schema})\n`),
  );
  const stop = () =>
    server.close(() => {
      void pool.end().then(async () => {
        const cleanup = new Pool({ connectionString: url });
        await cleanup.query(`drop schema "${schema}" cascade`);
        await cleanup.end();
        process.exit(0);
      });
    });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
