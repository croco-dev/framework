import { createServer } from "node:http";
import { EnrichmentProblem } from "@croco/analytics-core/enrichment";
import type { EnrichmentOperations } from "@croco/admin-core";

function text(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string") throw new EnrichmentProblem("invalid-command");
  return value;
}
function revision(input: Record<string, unknown>): number {
  const value = input.expectedRevision;
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new EnrichmentProblem("invalid-command");
  return value;
}
function acknowledgement(input: Record<string, unknown>): boolean {
  if (typeof input.acknowledgeDuplicateBilling !== "boolean")
    throw new EnrichmentProblem("invalid-command");
  return input.acknowledgeDuplicateBilling;
}

/** Synthetic loopback example only. Real hosts must provide authenticated principal context. */
export function createDemoServer(
  operations: EnrichmentOperations,
  browserBundle: () => Promise<string>,
) {
  const server = createServer(async (request, response) => {
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new EnrichmentProblem("local-server-unavailable");
      const origin = `http://127.0.0.1:${address.port}`;
      if (
        request.headers.host !== `127.0.0.1:${address.port}` ||
        (request.headers.origin && request.headers.origin !== origin) ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        throw new EnrichmentProblem("denied");
      const url = new URL(request.url ?? "/", origin);
      const runId = url.searchParams.get("run") === "large" ? "demo-large" : "demo";
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      if (request.method === "GET" && url.pathname === "/") {
        response.setHeader("content-type", "text/html");
        response.end(
          '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Enrichment review</title><style>body{font:16px system-ui;margin:24px;max-width:1100px}input,select,button{font:inherit;max-width:100%;box-sizing:border-box}pre{white-space:pre-wrap}label{display:inline-block;margin:4px 8px 4px 0}</style><main id="app"></main><script src="/browser.js"></script></html>',
        );
        return;
      }
      if (request.method === "GET" && url.pathname === "/browser.js") {
        response.setHeader("content-type", "text/javascript");
        response.end(await browserBundle());
        return;
      }
      response.setHeader("content-type", "application/json");
      if (request.method === "GET" && url.pathname === "/api") {
        response.end(
          JSON.stringify(await operations.read(runId, Number(url.searchParams.get("offset") ?? 0))),
        );
        return;
      }
      if (
        request.method !== "POST" ||
        url.pathname !== "/api" ||
        !String(request.headers["content-type"]).startsWith("application/json")
      ) {
        response.writeHead(404).end("{}");
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += Buffer.byteLength(chunk);
        if (size > 16384) throw new EnrichmentProblem("input-budget");
        chunks.push(Buffer.from(chunk));
      }
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (cause) {
        throw new EnrichmentProblem("invalid-command", cause);
      }
      if (!input || typeof input !== "object" || !("action" in input) || !("payload" in input))
        throw new EnrichmentProblem("invalid-command");
      const payload = input.payload as Record<string, unknown>;
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new EnrichmentProblem("invalid-command");
      let result: unknown;
      // Only finite feature operations. Service validators and authority run on every path.
      switch (input.action) {
        case "classify":
          result = await operations.classify(
            runId,
            text(payload, "itemId"),
            text(payload, "version"),
          );
          break;
        case "review":
          result = await operations.review(runId, {
            itemId: text(payload, "itemId"),
            version: text(payload, "version"),
            labelId: text(payload, "labelId"),
            evidence: text(payload, "evidence"),
            reason: text(payload, "reason"),
            expectedRevision: revision(payload),
            idempotencyKey: text(payload, "idempotencyKey"),
          });
          break;
        case "retry":
          result = await operations.retry(runId, {
            itemId: text(payload, "itemId"),
            receiptId: text(payload, "receiptId"),
            acknowledgeDuplicateBilling: acknowledgement(payload),
            reason: text(payload, "reason"),
            expectedRevision: revision(payload),
            idempotencyKey: text(payload, "idempotencyKey"),
          });
          break;
        case "export":
          result = await operations.exportLabels(runId, {
            version: text(payload, "version"),
            reason: text(payload, "reason"),
            expectedRevision: revision(payload),
            idempotencyKey: text(payload, "idempotencyKey"),
          });
          break;
        case "settle":
          result = await operations.settle(runId);
          break;
        default:
          throw new EnrichmentProblem("invalid-command");
      }
      response.end(JSON.stringify(result));
    } catch (cause) {
      response.setHeader("content-type", "application/json");
      response.writeHead(cause instanceof EnrichmentProblem ? cause.status : 500).end(
        JSON.stringify({
          code: cause instanceof EnrichmentProblem ? cause.code : "enrichment-unavailable",
        }),
      );
    }
  });
  return server;
}
