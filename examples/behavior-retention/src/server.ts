import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRetentionWorkbenchSource, RetentionWorkbenchProblem } from "@croco/admin-core";
import type { RetentionSavedView, RetentionWorkbenchRequest } from "@croco/admin-core";
import { definition, dataset, scope, baseline, returning } from "./fixture.js";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "croco-retention-ui-"));
  const modes = ["ready", "empty", "provisional", "insufficient", "denied", "error"] as const;
  const requestFor = (mode: string): RetentionWorkbenchRequest => ({
    definitionId: definition.id,
    definitionVersion: definition.version,
    subjectKind: definition.subjectKind,
    scope,
    sourceRef: mode,
    selections: [
      { id: "week-1", kind: "periodic", options: { baseline, returning } },
      { id: "first-behavior", kind: "cohort", options: { baseline, returning } },
      { id: "actions", kind: "frequency", options: { window: returning, measure: "count" } },
      {
        id: "active-days",
        kind: "frequency",
        options: { window: returning, measure: "activeDays" },
      },
    ],
  });
  const file = (authorized: typeof scope, subjectKind: string, id: string) =>
    join(
      directory,
      createHash("sha256")
        .update(JSON.stringify([authorized, subjectKind, id]))
        .digest("hex") + ".json",
    );
  const api = (mode: string) =>
    createRetentionWorkbenchSource({
      definitions: [definition],
      maxEvents: 300,
      maxPageSize: 20,
      adapter: {
        authorize: async (input) =>
          mode !== "denied" &&
          JSON.stringify(input.scope) === JSON.stringify(scope) &&
          input.subjectKind === "user",
        read: async (input) => {
          const selected = input.sourceRef ?? mode;
          if (!modes.some((value) => value === selected) || selected === "error")
            throw new RetentionWorkbenchProblem("invalid-dataset");
          return {
            ...dataset,
            sourceRef: selected,
            ...(selected === "empty" ? { events: [] } : {}),
            ...(selected === "provisional" ? { completeThrough: baseline.to } : {}),
            ...(selected === "insufficient" ? { knownHistoryFrom: undefined } : {}),
          };
        },
        subjectLabel: async ({ subjectId }) =>
          "Subject " + createHash("sha256").update(subjectId).digest("hex").slice(0, 8),
      },
      savedViews: {
        read: async (authorized, subjectKind, id) => {
          try {
            return JSON.parse(
              await readFile(file(authorized, subjectKind, id), "utf8"),
            ) as RetentionSavedView;
          } catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
              return undefined;
            throw error;
          }
        },
        write: async (authorized, subjectKind, record) => {
          const target = file(authorized, subjectKind, record.id);
          await writeFile(target + ".tmp", JSON.stringify(record));
          await rename(target + ".tmp", target);
        },
      },
    });
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1:4322");
      if (request.method === "GET" && ["/", "/browser.js"].includes(url.pathname)) {
        response.setHeader(
          "Content-Type",
          url.pathname === "/" ? "text/html; charset=utf-8" : "text/javascript",
        );
        response.end(
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
      if (!modes.some((value) => value === mode))
        throw new RetentionWorkbenchProblem("invalid-request");
      const host = api(mode);
      const selection = requestFor(mode);
      let result: unknown;
      if (request.method === "GET" && url.pathname === "/api/load")
        result = await host.load(selection);
      else if (request.method === "GET" && url.pathname === "/api/drilldown")
        result = await host.drilldown(selection, {
          selectionId: url.searchParams.get("selection") ?? "",
          offset: Number(url.searchParams.get("offset") ?? 0),
          limit: 20,
          inputToken: url.searchParams.get("token") ?? "",
        });
      else if (request.method === "POST" && url.pathname === "/api/save")
        result = await host.save(selection, "weekly", url.searchParams.get("token") ?? "");
      else if (request.method === "GET" && url.pathname === "/api/saved")
        result = (await host.readSaved(scope, "user", "weekly")) ?? null;
      else {
        response.writeHead(404).end();
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(
        error instanceof RetentionWorkbenchProblem && error.reason === "denied" ? 403 : 400,
        { "Content-Type": "application/json" },
      );
      response.end(
        JSON.stringify({
          code:
            error instanceof RetentionWorkbenchProblem
              ? error.code
              : "retention-demo/source-failed",
        }),
      );
    }
  }).listen(4322, "127.0.0.1", () => console.log("Retention demo: http://127.0.0.1:4322"));
}
void main();
