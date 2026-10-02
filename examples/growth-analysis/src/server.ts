import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import { Problem } from "@croco/problems-core";
import { createOpenAIPlanProposal } from "./openai";
import { createFixture } from "./fixture";
import { startLocalProvider } from "./localProvider";
import type { AnalysisPlan } from "@croco/analytics-core";

async function main(): Promise<void> {
  const provider = await startLocalProvider();
  const model = createOpenAIPlanProposal(
    new OpenAI({ apiKey: "local-fixture-only", baseURL: provider.baseURL, maxRetries: 0 }),
    "fixture-model",
  );
  const states = ["ready", "empty", "partial", "stale", "denied", "error", "missing"];
  const fixtures = new Map(states.map((state) => [state, createFixture(model, state)]));
  const files = new Map([
    ["/", { path: "index.html", type: "text/html; charset=utf-8" }],
    [
      "/dist/browser.global.js",
      { path: "dist/browser.global.js", type: "text/javascript; charset=utf-8" },
    ],
  ]);
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const file = files.get(url.pathname);
      if (file && request.method === "GET") {
        const data = await readFile(join(process.cwd(), file.path));
        response.writeHead(200, { "content-type": file.type }).end(data);
        return;
      }
      const fixture = fixtures.get(url.searchParams.get("state") ?? "ready");
      if (
        !fixture ||
        request.method !== "POST" ||
        !["/propose", "/execute"].includes(url.pathname)
      ) {
        response.writeHead(404).end();
        return;
      }
      const controller = new AbortController();
      response.on("close", () => {
        if (!response.writableEnded) controller.abort();
      });
      const chunks: Buffer[] = [];
      let bodyBytes = 0;
      for await (const chunk of request) {
        const bytes = chunk as Buffer;
        bodyBytes += bytes.byteLength;
        if (bodyBytes > 8192) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(bytes);
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks, bodyBytes).toString("utf8"));
      const output =
        url.pathname === "/propose"
          ? await fixture.service.propose(input as string, controller.signal)
          : await fixture.service.execute(input as AnalysisPlan, controller.signal);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(output));
    } catch (error) {
      if (!response.destroyed) {
        const problem = error instanceof Problem ? error.toJSON() : undefined;
        response
          .writeHead(problem?.status ?? 500, { "content-type": "application/json" })
          .end(JSON.stringify(problem ?? { code: "DEMO_ANALYSIS_FAILED" }));
      }
    }
  }).listen(4179, "127.0.0.1", () =>
    console.log("Growth analysis: http://127.0.0.1:4179/ (local SDK fixture)"),
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
