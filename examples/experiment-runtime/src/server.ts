import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Problem } from "@croco/problems-core";
import { ExperimentProblem } from "@croco/features-core";
import { createDemo, scope, actor, definition } from "./demo";
import type { IncomingMessage } from "node:http";
import type { ExperimentAdminConfiguration } from "@croco/admin-core";

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 32768) throw new ExperimentProblem("invalid", "Request exceeds 32 KiB");
  }
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ExperimentProblem("invalid", "Object body required");
  return body as Record<string, unknown>;
}
async function main(): Promise<void> {
  const { runtime, operations, access, samples } = await createDemo();
  const html = readFileSync(resolve(__dirname, "../index.html"));
  const browser = readFileSync(resolve(__dirname, "../dist/browser.global.js"));
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/") {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
        return;
      }
      if (request.method === "GET" && request.url === "/browser.js") {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(browser);
        return;
      }
      if (request.method === "GET" && request.url === "/favicon.ico") {
        response.statusCode = 204;
        response.end();
        return;
      }
      if (
        request.method !== "POST" ||
        !["/api/read", "/api/preview", "/api/command", "/api/configure", "/api/treat"].includes(
          request.url ?? "",
        )
      ) {
        response.statusCode = 404;
        response.end();
        return;
      }
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`)
        throw new ExperimentProblem("forbidden", "Cross-origin requests are rejected");
      const body = await bodyOf(request);
      const allowed = [
        "revision",
        "sampleId",
        "action",
        "expectedRevision",
        "reason",
        "idempotencyKey",
        "configuration",
      ];
      if (Object.keys(body).some((key) => !allowed.includes(key)))
        throw new ExperimentProblem("invalid", "Unsupported request field");
      if (typeof body.revision !== "string")
        throw new ExperimentProblem("invalid", "Revision is required");
      const target = { experimentId: definition.id, experimentRevision: body.revision, scope };
      const command = {
        ...target,
        expectedRevision: body.expectedRevision as number,
        reason: body.reason as string,
        idempotencyKey: body.idempotencyKey as string,
      };
      let result: unknown;
      if (request.url === "/api/read")
        result = {
          snapshot: await operations.read(target, access),
          revisions: (await runtime.list(scope, actor)).map((record) => record.experimentRevision),
        };
      else if (request.url === "/api/preview")
        result = await operations.preview(target, body.sampleId as string, access);
      else if (request.url === "/api/configure")
        result = await operations.configure(
          { ...command, configuration: body.configuration as ExperimentAdminConfiguration },
          access,
        );
      else if (request.url === "/api/command")
        result = await operations.command(
          { ...command, action: body.action as "start" | "pause" | "stop" },
          access,
        );
      else {
        const record = await runtime.get(target, actor);
        if (!record) throw new ExperimentProblem("missing", "Experiment does not exist");
        const sample = samples.find(
          (candidate) => candidate.subject.kind === record.definition.unit && candidate.subject.id,
        );
        if (!sample)
          throw new ExperimentProblem("missing", "No server-owned subject for this unit");
        const input = { ...target, actor, subject: sample.subject };
        const assignment = await runtime.assign(input);
        if (assignment.status !== "assigned") result = assignment;
        else {
          const treatment = await runtime.treat({
            ...input,
            assignmentId: assignment.assignment.id,
          });
          if (treatment.status !== "treated") result = treatment;
          else {
            const exposure = await runtime.recordExposure({
              ...input,
              assignmentId: assignment.assignment.id,
              deliveryInstanceId: randomUUID(),
              occurredAt: new Date().toISOString(),
              kind: "treatment",
            });
            result = {
              status: "treated",
              treatment: treatment.value,
              assignmentId: assignment.assignment.id,
              variant: assignment.assignment.variant,
              exposureId: exposure.id,
            };
          }
        }
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode =
        error instanceof Problem ? error.status : error instanceof SyntaxError ? 400 : 500;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          message:
            error instanceof Problem
              ? error.message
              : error instanceof SyntaxError
                ? "Invalid JSON"
                : "Experiment request failed",
        }),
      );
    }
  });
  const port = Number(process.env.PORT ?? 4182);
  server.listen(port, "127.0.0.1", () => process.stdout.write(`http://127.0.0.1:${port}\n`));
  process.on("SIGINT", () => server.close());
}
void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
