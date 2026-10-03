import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createExample, request } from "./fixture";
import { NetOutcomeProblem } from "@croco/admin-core";
import type { NetOutcomeDrilldownRequest } from "@croco/admin-core";
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:4323");
  try {
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }
    if (url.pathname === "/" || url.pathname === "/browser.js") {
      res.setHeader("Content-Type", url.pathname === "/" ? "text/html" : "text/javascript");
      res.end(
        readFileSync(
          resolve(__dirname, url.pathname === "/" ? "../index.html" : "../dist/browser.global.js"),
        ),
      );
      return;
    }
    res.setHeader("Content-Type", "application/json");
    const mode = url.searchParams.get("fixture") ?? "ready";
    if (!["ready", "partial", "empty", "denied", "error", "loading"].includes(mode)) {
      res.writeHead(400).end();
      return;
    }
    const selected = {
      cutoff: {
        effectiveAt: url.searchParams.get("effectiveAt") ?? request.cutoff.effectiveAt,
        knownAt: url.searchParams.get("knownAt") ?? request.cutoff.knownAt,
      },
      revision: url.searchParams.get("revision") ?? request.revision,
    };
    const operations = createExample(mode);
    if (url.pathname === "/api/report") {
      if (mode === "loading") {
        res.end(JSON.stringify({ kind: "loading" }));
        return;
      }
      res.end(JSON.stringify(await operations.read(selected)));
      return;
    }
    if (url.pathname === "/api/drilldown") {
      const drilldown: NetOutcomeDrilldownRequest = {
        ...selected,
        arm: url.searchParams.get("arm") ?? "",
        currency: url.searchParams.get("currency") ?? "",
        source: url.searchParams.get("source") ?? "",
        limit: Number(url.searchParams.get("limit")),
      };
      res.end(JSON.stringify(await operations.drilldown(drilldown)));
      return;
    }
    res.writeHead(404).end();
  } catch (error) {
    const status =
      error instanceof NetOutcomeProblem &&
      (error.code === "admin/net-outcome/invalid-request" ||
        error.code === "admin/net-outcome/invalid-drilldown")
        ? 400
        : 500;
    res.writeHead(status).end(JSON.stringify({ kind: "error", code: "example/report-failed" }));
  }
});
server.listen(4323, "127.0.0.1", () =>
  process.stdout.write("Assigned outcomes: http://127.0.0.1:4323\n"),
);
process.once("SIGINT", () => server.close());
process.once("SIGTERM", () => server.close());
