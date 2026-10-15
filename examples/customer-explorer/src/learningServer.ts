import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { LearningRegistryProblem, LearningStorageProblem } from "@croco/admin-core";
import { access, newDraft, pool, registry, scope } from "./learningFixture";
import type { LearningMutation, LearningQuery } from "@croco/admin-core";

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (request.method === "GET" && request.url === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Learning workspace</title><body style="font-family:system-ui;margin:0"><div id="root"></div><script src="/learning.js"></script></body></html>',
      );
      return;
    }
    if (request.method === "GET" && request.url === "/learning.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(await readFile(new URL("../dist/learningBrowser.global.js", import.meta.url)));
      return;
    }
    response.setHeader("Content-Type", "application/json");
    if (request.method === "GET" && request.url === "/api/config") {
      response.end(
        JSON.stringify({ scope, accessRevision: "synthetic-1", draft: newDraft(randomUUID()) }),
      );
      return;
    }
    if (
      request.method !== "POST" ||
      ![
        "/api/save",
        "/api/read",
        "/api/search",
        "/api/history",
        "/api/export",
        "/api/copy",
      ].includes(request.url ?? "")
    ) {
      response.statusCode = 404;
      response.end(JSON.stringify({ code: "learning-registry/not-found" }));
      return;
    }
    if (request.headers.origin !== "http://127.0.0.1:4325")
      throw new LearningRegistryProblem(
        "denied",
        "Local example requires its exact browser origin",
      );
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 70000) throw new LearningRegistryProblem("input", "Request exceeds local bound");
      chunks.push(buffer);
    }
    let data: { id: string; command: LearningMutation; query: LearningQuery; before?: number };
    try {
      data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      if (!data || typeof data !== "object")
        throw new LearningRegistryProblem("input", "Object required");
    } catch {
      throw new LearningRegistryProblem("input", "Invalid JSON request");
    }
    const result =
      request.url === "/api/save"
        ? await registry.save(data.command, access)
        : request.url === "/api/read"
          ? await registry.read(scope, data.id, access)
          : request.url === "/api/search"
            ? await registry.search(scope, data.query ?? {}, access)
            : request.url === "/api/history"
              ? await registry.history(scope, data.id, access, data.before)
              : request.url === "/api/export"
                ? await registry.export(scope, data.id, access)
                : await registry.copyDraft(scope, data.id, randomUUID(), access);
    response.end(JSON.stringify(result));
  } catch (error) {
    const problem =
      error instanceof LearningRegistryProblem || error instanceof LearningStorageProblem
        ? error
        : new LearningStorageProblem(error instanceof Error ? error : undefined);
    response.statusCode = problem.status;
    response.setHeader("Content-Type", "application/problem+json");
    response.end(JSON.stringify(problem.toJSON()));
  }
});
server.listen(4325, "127.0.0.1", () =>
  process.stdout.write("Learning workspace: http://127.0.0.1:4325\n"),
);
process.once("SIGINT", () => server.close(() => void pool.end()));
process.once("SIGTERM", () => server.close(() => void pool.end()));
