import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WarehouseContractError } from "@croco/warehouse-core";
import { createExample } from "./fixture";

async function main() {
  const fixture = await createExample();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1:4320");
      if (req.method === "GET" && ["/", "/browser.js"].includes(url.pathname)) {
        res.setHeader(
          "Content-Type",
          url.pathname === "/" ? "text/html; charset=utf-8" : "text/javascript",
        );
        res.end(
          readFileSync(
            resolve(
              __dirname,
              url.pathname === "/" ? "../index.html" : "../dist/browser.global.js",
            ),
          ),
        );
        return;
      }
      res.setHeader("Content-Type", "application/json");
      const selected = url.searchParams.get("dataset") ?? "captures";
      if (req.method === "GET" && url.pathname === "/api/dataset") {
        if (["empty", "denied", "unavailable"].includes(selected)) {
          res.end(JSON.stringify({ kind: selected }));
          return;
        }
        if (selected !== "captures" && selected !== "search")
          throw new WarehouseContractError("WAREHOUSE_UNKNOWN_EXAMPLE");
        res.end(JSON.stringify(await fixture.state(selected)));
        return;
      }
      if (req.method !== "POST" || !["/api/remove", "/api/republish"].includes(url.pathname)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ code: "NOT_FOUND" }));
        return;
      }
      if (req.headers.origin !== `http://${req.headers.host}`)
        throw new WarehouseContractError("WAREHOUSE_ACCESS_DENIED");
      if (selected !== "captures" && selected !== "search")
        throw new WarehouseContractError("WAREHOUSE_ACCESS_DENIED");
      const service = selected === "captures" ? fixture.capture : fixture.search;
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 32768) throw new WarehouseContractError("WAREHOUSE_INVALID_REQUEST");
      }
      const request = JSON.parse(body) as Record<string, unknown>;
      if (
        request.actor !== service.access.actor ||
        typeof request.reason !== "string" ||
        typeof request.idempotencyKey !== "string" ||
        typeof request.expectedRevision !== "number"
      )
        throw new WarehouseContractError("WAREHOUSE_INVALID_REQUEST");
      const audit = {
        reason: request.reason,
        idempotencyKey: request.idempotencyKey,
        expectedRevision: request.expectedRevision,
      };
      if (url.pathname === "/api/remove") {
        if (typeof request.snapshotId !== "string")
          throw new WarehouseContractError("WAREHOUSE_INVALID_REQUEST");
        const result = await service.catalog.removePublication({
          access: service.access,
          snapshotId: request.snapshotId,
          audit,
        });
        service.setPrivacyEpoch(result.privacyEpoch);
      } else {
        if (typeof request.candidateId !== "string" || typeof request.fence !== "number")
          throw new WarehouseContractError("WAREHOUSE_INVALID_REQUEST");
        await service.catalog.publishCandidate({
          access: service.access,
          candidateId: request.candidateId,
          fence: request.fence,
          audit,
        });
      }
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          code: error instanceof Error && "code" in error ? error.code : "WAREHOUSE_EXAMPLE_FAILED",
        }),
      );
    }
  });
  server.listen(4320, "127.0.0.1", () =>
    process.stdout.write("Warehouse explorer: http://127.0.0.1:4320\n"),
  );
  const close = () =>
    server.close(() => {
      void fixture.dispose();
    });
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
