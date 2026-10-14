import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrowthModelWorkbenchSource, GrowthWorkbenchProblem } from "@croco/admin-core";
import type { GrowthWorkbenchRequest } from "@croco/admin-core";
import { scope, dataset } from "./fixture";
import { fileReports } from "./FileReports";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "croco-growth-model-"));
  const reports = fileReports(directory);
  createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1:4324");
      if (req.method === "GET" && ["/", "/browser.js"].includes(url.pathname)) {
        res.setHeader(
          "Content-Type",
          url.pathname === "/" ? "text/html; charset=utf-8" : "text/javascript",
        );
        res.end(
          await readFile(
            new URL(
              url.pathname === "/" ? "../index.html" : "../dist/browser.global.js",
              import.meta.url,
            ),
          ),
        );
        return;
      }
      const mode = url.searchParams.get("mode") ?? "ready";
      if (!["ready", "empty", "partial", "denied", "error"].includes(mode))
        throw new GrowthWorkbenchProblem("invalid-request");
      const source = createGrowthModelWorkbenchSource({
        limits: { maxRows: 1000, maxStates: 8, maxHorizon: 24 },
        reports,
        adapter: {
          authorize: async (s) =>
            mode !== "denied" &&
            s.appId === scope.appId &&
            s.environment === scope.environment &&
            s.tenantId === scope.tenantId,
          actor: async () => "synthetic-operator",
          read: async () => {
            if (mode === "error") throw new GrowthWorkbenchProblem("source-failed");
            return dataset(mode);
          },
        },
      });
      let result: unknown;
      if (req.method === "POST" && ["/api/load", "/api/save"].includes(url.pathname)) {
        let body = "";
        for await (const chunk of req) {
          body += String(chunk);
          if (Buffer.byteLength(body) > 100_000)
            throw new GrowthWorkbenchProblem("invalid-request");
        }
        const input = JSON.parse(body) as {
          request: GrowthWorkbenchRequest;
          id: string;
          revision: number;
          hash: string;
        };
        result =
          url.pathname === "/api/load"
            ? await source.load(input.request)
            : await source.save(input.request, input.id, input.revision, input.hash);
      } else if (req.method === "GET" && url.pathname === "/api/saved")
        result = await source.readSaved(scope, url.searchParams.get("id") ?? "");
      else {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result ?? null));
    } catch (error) {
      res.writeHead(
        error instanceof GrowthWorkbenchProblem && error.reason === "denied" ? 403 : 400,
        { "Content-Type": "application/json" },
      );
      res.end(
        JSON.stringify({
          code: error instanceof GrowthWorkbenchProblem ? error.code : "growth-demo/request-failed",
        }),
      );
    }
  }).listen(4324, "127.0.0.1", () => console.log("Growth model demo: http://127.0.0.1:4324"));
}
void main();
