import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Problem } from "@croco/problems-core";
import { TargetingImpactProblem } from "@croco/admin-core/targeting-impact-operations";
import { createFixture, fixtureInput, fixtureStates, scope } from "./fixture";
import type { FixtureState } from "./fixture";

export async function createDemoServer(directory: string) {
  const fixtures = new Map(
    await Promise.all(
      fixtureStates.map(async (state) => [state, await createFixture(state)] as const),
    ),
  );
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && ["/", "/dist/browser.global.js"].includes(url.pathname)) {
        response
          .writeHead(200, {
            "content-type": url.pathname === "/" ? "text/html" : "text/javascript",
          })
          .end(
            await readFile(
              join(directory, url.pathname === "/" ? "index.html" : "dist/browser.global.js"),
            ),
          );
        return;
      }
      const state = url.searchParams.get("state") ?? "ready";
      const fixture = fixtures.get(state as FixtureState);
      if (
        !fixture ||
        request.method !== "POST" ||
        !["/compare", "/save", "/get", "/export"].includes(url.pathname)
      ) {
        response.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = chunk as Buffer;
        size += bytes.length;
        if (size > 4096) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(bytes);
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new TargetingImpactProblem("json", "Expected JSON");
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new TargetingImpactProblem("request", "Expected request object");
      const fields = body as Record<string, unknown>;
      const comparing = url.pathname === "/compare" || url.pathname === "/save";
      if (Object.keys(fields).some((key) => key !== (comparing ? "unknownPolicy" : "id")))
        throw new TargetingImpactProblem("request", "Unsupported request field");
      let output: unknown;
      if (comparing) {
        if (fields.unknownPolicy !== "preserve" && fields.unknownPolicy !== "exclude")
          throw new TargetingImpactProblem("policy", "Invalid unknown policy");
        const comparison = await fixture.compare(fields.unknownPolicy);
        if (url.pathname === "/save" && !comparison.report)
          throw new TargetingImpactProblem(
            "source-unavailable",
            "A populated historical report is required to save",
          );
        output =
          url.pathname === "/compare"
            ? comparison
            : await fixture.service.save(fixtureInput(state as FixtureState, fields.unknownPolicy));
      } else {
        if (typeof fields.id !== "string" || !/^[a-f0-9]{64}$/.test(fields.id))
          throw new TargetingImpactProblem("id", "Expected report hash");
        output =
          url.pathname === "/get"
            ? await fixture.service.load(scope, fields.id)
            : JSON.parse(await fixture.service.export(scope, fields.id));
      }
      response
        .writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        .end(JSON.stringify(output));
    } catch (error) {
      const problem = error instanceof Problem ? error.toJSON() : undefined;
      response
        .writeHead(problem?.status ?? 500, { "content-type": "application/json" })
        .end(JSON.stringify(problem ?? { code: "SYNTHETIC_SERVER_FAILURE" }));
    }
  });
}
