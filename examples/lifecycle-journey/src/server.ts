import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JourneyOperations } from "@croco/admin-core";
import type { JourneyAdminCommand } from "@croco/admin-core";
import type { JourneyDefinition } from "@croco/lifecycle-core";
import { createExample, definition, scope } from "./fixture";

async function main() {
  const example = createExample();
  example.setFacts("sample", {
    purchased: false,
    interested: true,
    consent: true,
    available: true,
  });
  await example.engine.enter(definition.id, definition.version, example.entry("sample"));
  await example.engine.tick(scope, "episode-sample");

  const operations = new JourneyOperations({
    authenticate: async () => ({
      scope,
      actor: "demo-operator",
      permissions: ["journey.read", "journey.preview", "journey.operate"],
    }),
    store: example.store,
    command: (requestedScope, episodeId, command) =>
      example.engine.command(requestedScope, episodeId, command),
    dryRun: async (_requestedScope, draft, sampleId) => {
      if (sampleId !== "sample") throw new Error("Sample is not registered");
      const result = await example.preview(draft, sampleId);
      return {
        steps: result.steps.map((step) => ({
          nodeId: step.nodeId,
          outcome: `${step.outcome}: ${step.reason}`,
        })),
      };
    },
  });

  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/") {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(readFileSync(resolve(__dirname, "../index.html")));
        return;
      }
      if (request.method === "GET" && request.url === "/browser.global.js") {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(readFileSync(resolve(__dirname, "../dist/browser.global.js")));
        return;
      }
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      if (request.method === "GET" && request.url === "/api/config") {
        response.end(
          JSON.stringify({
            definition,
            state: { kind: "ready", episodes: await operations.list(scope) },
            permissions: ["journey.read", "journey.preview", "journey.operate"],
            samples: [{ id: "sample", label: "Sample customer" }],
          }),
        );
        return;
      }
      if (
        request.method !== "POST" ||
        !["/api/preview", "/api/command"].includes(request.url ?? "")
      ) {
        response.statusCode = 404;
        response.end(JSON.stringify({ code: "NOT_FOUND" }));
        return;
      }
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        response.statusCode = 403;
        response.end(JSON.stringify({ code: "ORIGIN_DENIED" }));
        return;
      }
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 32_768) throw new Error("Request exceeds 32 KiB");
      }
      const input = JSON.parse(body) as Record<string, unknown>;
      const result =
        request.url === "/api/preview"
          ? await operations.dryRun(
              scope,
              input.definition as JourneyDefinition,
              String(input.sampleId),
            )
          : await operations.command(scope, input as JourneyAdminCommand);
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = 400;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          code:
            error instanceof Error && "code" in error
              ? String(error.code)
              : "JOURNEY_EXAMPLE_ERROR",
        }),
      );
    }
  });
  server.listen(4321, "127.0.0.1", () =>
    process.stdout.write("Journey example: http://127.0.0.1:4321\n"),
  );
}

void main();
