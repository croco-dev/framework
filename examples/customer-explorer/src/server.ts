import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CustomerExplorerProblem } from "@croco/admin-core";
import { pool, sampleId, scope, service } from "./fixture";
import type {
  ExplorerNoteInput,
  ExplorerQueryDraft,
  ExplorerScope,
  ExplorerSubject,
} from "@croco/admin-core";

// Synthetic local identity only. A production host must bind authentication before invoking the service.
const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFileSync(resolve(__dirname, "../index.html")));
      return;
    }
    if (req.method === "GET" && req.url === "/browser.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(readFileSync(resolve(__dirname, "../dist/browser.global.js")));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET" && req.url === "/api/config") {
      res.end(JSON.stringify({ scope, sampleId }));
      return;
    }
    if (
      req.method !== "POST" ||
      !["/api/sample", "/api/timeline", "/api/notes", "/api/note", "/api/draft"].includes(
        req.url ?? "",
      )
    ) {
      res.statusCode = 404;
      res.end(JSON.stringify({ code: "customer-explorer/not-found" }));
      return;
    }
    if (req.headers.origin && req.headers.origin !== "http://127.0.0.1:4320")
      throw new CustomerExplorerProblem("denied", "Cross-origin request rejected");
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 32768) throw new CustomerExplorerProblem("input", "Request exceeds 32 KiB");
    }
    let data: {
      scope: ExplorerScope;
      id: string;
      sampleId: string;
      subject: ExplorerSubject;
      options: { limit: number; cursors?: Record<string, string> };
      input: ExplorerNoteInput;
      conditions: ExplorerQueryDraft["conditions"];
    };
    try {
      data = JSON.parse(body);
      if (!data || typeof data !== "object")
        throw new CustomerExplorerProblem("input", "Object body required");
    } catch {
      throw new CustomerExplorerProblem("input", "Invalid JSON body");
    }
    const output =
      req.url === "/api/sample"
        ? await service.getSample(data.scope, data.id)
        : req.url === "/api/timeline"
          ? await service.timeline(data.scope, data.sampleId, data.subject, data.options)
          : req.url === "/api/notes"
            ? await service.notes(data.scope, data.sampleId)
            : req.url === "/api/note"
              ? await service.saveNote(data.scope, data.sampleId, data.input)
              : await service.exportDraft(data.scope, data.sampleId, data.conditions);
    res.end(JSON.stringify(output));
  } catch (error) {
    res.statusCode = error instanceof CustomerExplorerProblem ? error.status : 500;
    res.end(
      JSON.stringify({
        code:
          error instanceof CustomerExplorerProblem ? error.code : "customer-explorer/source-failed",
        detail: error instanceof CustomerExplorerProblem ? error.message : "Operation failed",
      }),
    );
  }
});
void service
  .getSample(scope, sampleId)
  .then(() => {
    server.listen(4320, "127.0.0.1", () =>
      process.stdout.write("Customer explorer: http://127.0.0.1:4320\n"),
    );
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
process.once("SIGINT", () => server.close(() => void pool.end()));
process.once("SIGTERM", () => server.close(() => void pool.end()));
