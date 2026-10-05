import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ActivationAdminProblem, ActivationCandidateOperations } from "@croco/admin-core";
import type { ActivationAdminScope, ActivationSavedReport } from "@croco/admin-core";
import type { ActivationReport } from "@croco/metrics-core";
import { definition, rows } from "./fixture";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "croco-activation-"));
  const scope: ActivationAdminScope = {
    app: "activation-example",
    environment: "demo",
    tenantId: "synthetic",
    subjectKind: "user",
  };
  const file = (authorized: ActivationAdminScope, id: string) =>
    join(
      directory,
      `${createHash("sha256")
        .update(JSON.stringify([authorized, id]))
        .digest("hex")}.json`,
    );
  const operations = (denied: boolean, partial: boolean) =>
    new ActivationCandidateOperations({
      authenticate: async () => ({
        scope,
        permissions: denied ? [] : ["activation.read", "activation.report-write"],
      }),
      loadInput: async (authorized, run, signal) => {
        signal?.throwIfAborted();
        const selectedRun = run ?? (partial ? "synthetic-100-partial-v1" : definition.sourceRunRef);
        if (
          JSON.stringify(authorized) !== JSON.stringify(scope) ||
          ![definition.sourceRunRef, "synthetic-100-partial-v1"].includes(selectedRun)
        )
          throw new ActivationAdminProblem("Unknown source scope or run");
        return {
          definition: { ...definition, sourceRunRef: selectedRun },
          rows:
            selectedRun === "synthetic-100-partial-v1"
              ? rows.map((row, index) => (index < 5 ? { ...row, outcome: null } : row))
              : rows,
        };
      },
      store: {
        read: async (authorized, id) => {
          try {
            return JSON.parse(
              await readFile(file(authorized, id), "utf8"),
            ) as ActivationSavedReport;
          } catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
              return undefined;
            throw error;
          }
        },
        write: async (authorized, record) => {
          await writeFile(file(authorized, record.id), JSON.stringify(record), { flag: "wx" });
        },
      },
    });
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    response.once("close", () => {
      if (!response.writableEnded) controller.abort();
    });
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1:4321");
      if (request.method === "GET" && ["/", "/browser.js"].includes(url.pathname)) {
        response.setHeader(
          "Content-Type",
          url.pathname === "/" ? "text/html; charset=utf-8" : "text/javascript",
        );
        response.end(
          await readFile(
            resolve(
              __dirname,
              url.pathname === "/" ? "../index.html" : "../dist/browser.global.js",
            ),
          ),
        );
        return;
      }
      response.setHeader("Content-Type", "application/json");
      const state = url.searchParams.get("state") ?? "ready";
      const service = operations(state === "denied", state === "partial");
      if (url.pathname === "/api/load" && request.method === "GET") {
        if (state === "error") throw new ActivationAdminProblem("Synthetic source failure");
        if (state === "loading") await new Promise((resolve) => setTimeout(resolve, 1500));
        const report = await service.load(controller.signal);
        response.end(
          JSON.stringify(
            state === "empty"
              ? { kind: "empty" }
              : { kind: state === "partial" ? "partial" : "ready", report },
          ),
        );
        return;
      }
      if (url.pathname === "/api/export" && request.method === "GET") {
        response.end(await service.export(url.searchParams.get("id") ?? "", controller.signal));
        return;
      }
      if (url.pathname === "/api/save" && request.method === "POST") {
        if (request.headers.origin !== `http://${request.headers.host}`)
          throw new ActivationAdminProblem("Origin denied", true);
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 32768) throw new ActivationAdminProblem("Request too large");
        }
        const data: unknown = JSON.parse(body);
        if (
          !data ||
          typeof data !== "object" ||
          !("candidateId" in data) ||
          typeof data.candidateId !== "string" ||
          !("cohort" in data) ||
          (data.cohort !== "new" && data.cohort !== "returning") ||
          !("expectedReport" in data)
        )
          throw new ActivationAdminProblem("Invalid selection");
        response.end(
          JSON.stringify(
            await service.save(
              randomUUID(),
              data.candidateId,
              data.cohort,
              data.expectedReport as ActivationReport,
              controller.signal,
            ),
          ),
        );
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ code: "not-found" }));
    } catch (error) {
      response.statusCode = 400;
      response.end(
        JSON.stringify({
          kind: "error",
          code:
            error instanceof Error && "code" in error ? error.code : "activation-example-failed",
        }),
      );
    }
  });
  server.listen(4321, "127.0.0.1", () =>
    console.log(`Activation example: http://127.0.0.1:4321; reports: ${directory}`),
  );
  process.once("SIGINT", () => server.close());
  process.once("SIGTERM", () => server.close());
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
