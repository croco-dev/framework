import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSavedIntentService, SavedIntentInvalidProblem } from "@croco/experience-core";
import { PostgresSavedIntentStore } from "@croco/experience-drizzle";
import { SavedIntentOperations } from "@croco/admin-core";
import { database, pool } from "./database";
import { canRead, readReport, reportResolver } from "./reports";
import type { SavedIntentPolicyInput, SavedIntentSourceKind } from "@croco/experience-core";

const port = Number(process.env.PORT ?? 4180);
const origin = `http://127.0.0.1:${port}`;
const scope = { appId: "saved-reports", environment: "local", tenantId: "demo-tenant" };
const subject = { kind: "customer", id: "demo-customer" };
// Local-only example identity. Production hosts must replace this with a verified session.
const principal = Object.freeze({ id: "demo-customer", operator: true });
const access = { scope, subject, principal };
const service = createSavedIntentService({
  store: new PostgresSavedIntentStore(database),
  resourceTypes: [
    {
      id: "report",
      resolver: reportResolver(),
      allowedOrigins: [],
      defaultPolicy: { displayLimit: 20, retentionDays: 90, excludeCompleted: true },
    },
  ],
  authorize: async (input) =>
    input.principal === principal &&
    input.scope.appId === scope.appId &&
    input.scope.environment === scope.environment &&
    input.scope.tenantId === scope.tenantId &&
    input.subject.kind === subject.kind &&
    input.subject.id === subject.id &&
    (input.action !== "policy:write" || input.actorId === principal.id),
});
const admin = new SavedIntentOperations(service);
const adminAccess = {
  scope,
  principal,
  actorId: principal.id,
  permissions: ["saved-intent.read", "saved-intent.write", "saved-intent.inspect"] as const,
};
async function main(): Promise<void> {
  const html = await readFile(resolve(__dirname, "../index.html"));
  const browser = await readFile(resolve(__dirname, "../dist/browser.global.js"));
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      const url = new URL(request.url ?? "/", origin);
      if (request.method === "GET" && url.pathname === "/") {
        response.setHeader("Content-Type", "text/html");
        response.end(html);
        return;
      }
      if (request.method === "GET" && url.pathname === "/browser.js") {
        response.setHeader("Content-Type", "text/javascript");
        response.end(browser);
        return;
      }
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.statusCode = 204;
        response.end();
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/reports/")) {
        let resourceId: string;
        try {
          resourceId = decodeURIComponent(url.pathname.slice("/reports/".length));
        } catch (error) {
          if (!(error instanceof URIError)) throw error;
          response.statusCode = 403;
          response.end("Report unavailable");
          return;
        }
        const report = await readReport(scope, resourceId);
        if (
          !report ||
          report.deleted ||
          !canRead(report, subject) ||
          report.expires_at.getTime() <= Date.now()
        ) {
          response.statusCode = 403;
          response.end("Report unavailable");
          return;
        }
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(`${report.title}\n\n${report.body}`);
        return;
      }
      if (request.method !== "POST" || request.headers.origin !== origin) {
        response.statusCode = 403;
        response.end("Request denied");
        return;
      }
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (Buffer.byteLength(raw, "utf8") > 16_384) {
          response.statusCode = 413;
          response.end();
          return;
        }
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new SavedIntentInvalidProblem("Request body must be JSON");
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new SavedIntentInvalidProblem("Request body must be an object");
      }
      const resource = {
        resourceType: "report",
        resourceId: body.resourceId as string,
        sourceKind: body.sourceKind as SavedIntentSourceKind,
      };
      const mutation = {
        ...access,
        ...resource,
        expectedRevision: body.expectedRevision as number | null,
        idempotencyKey: body.idempotencyKey as string,
      };
      let result: unknown;
      switch (url.pathname) {
        case "/api/list":
          result = await service.listResumeCandidates({
            ...access,
            offset: body.offset as number | undefined,
            limit: 2,
          });
          break;
        case "/api/identity":
          result = (await service.readIntent({ ...access, ...resource })) ?? null;
          break;
        case "/api/save":
          result = await service.saveIntent(mutation);
          break;
        case "/api/remove":
          result = await service.removeIntent(mutation);
          break;
        case "/api/complete":
          result = await service.markCompleted(mutation);
          break;
        case "/api/pin":
          result = await service.pinIntent({
            ...mutation,
            pinOrder: body.pinOrder as number | null,
          });
          break;
        case "/api/resolve":
          result = await service.resolveIntent({ ...access, ...resource });
          break;
        case "/api/policy":
          result = await admin.readPolicy("report", subject, adminAccess);
          break;
        case "/api/policy/save":
          result = await admin.updatePolicy(
            {
              ...access,
              resourceType: "report",
              displayLimit: body.displayLimit as number,
              retentionDays: body.retentionDays as number,
              excludeCompleted: body.excludeCompleted as boolean,
              expectedRevision: body.expectedRevision as number | null,
              idempotencyKey: body.idempotencyKey as string,
              reason: body.reason as string,
            } satisfies Omit<SavedIntentPolicyInput, "actorId">,
            adminAccess,
          );
          break;
        case "/api/inspect":
          if (body.targetId !== "current-customer") {
            response.statusCode = 403;
            response.end("Target denied");
            return;
          }
          result = await admin.inspect(subject, adminAccess, {
            offset: body.offset as number,
            limit: 2,
          });
          break;
        default:
          response.statusCode = 404;
          response.end();
          return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(result));
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "SAVED_REQUEST_FAILED";
      process.stderr.write(`${String(error)}\n`);
      response.statusCode = code.includes("denied")
        ? 403
        : code.includes("conflict")
          ? 409
          : code.includes("invalid")
            ? 400
            : 500;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ code }));
    }
  });
  server.listen(port, "127.0.0.1", () => process.stdout.write(`${origin}\n`));
  process.on("SIGINT", () => {
    server.close();
    void pool.end();
  });
}
void main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
  void pool.end();
});
