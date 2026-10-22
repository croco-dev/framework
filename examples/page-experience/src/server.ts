import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { build } from "tsup";
import { calculatePageExperience, importGa4Engagement } from "@croco/metrics-core";
import { fixture } from "./fixture";
import type * as FixtureRenderer from "./render";
async function main() {
  const directory = await mkdtemp(join(tmpdir(), "croco-page-experience-"));
  await build({
    entry: [resolve("src/browser.tsx")],
    outDir: directory,
    format: ["iife"],
    platform: "browser",
    noExternal: [/.*/],
    define: { "process.env.NODE_ENV": '"development"' },
    dts: false,
    config: false,
    esbuildOptions(options) {
      const appRequire = createRequire(resolve("package.json"));
      options.alias = {
        react: dirname(appRequire.resolve("react/package.json")),
        "react-dom": dirname(appRequire.resolve("react-dom/package.json")),
      };
    },
  });
  await build({
    entry: [resolve("src/render.ts")],
    outDir: directory,
    format: ["cjs"],
    platform: "node",
    noExternal: [/.*/],
    dts: false,
    config: false,
    outExtension: () => ({ js: ".cjs" }),
    esbuildOptions(options) {
      const appRequire = createRequire(resolve("package.json"));
      options.alias = {
        react: dirname(appRequire.resolve("react/package.json")),
        "react-dom": dirname(appRequire.resolve("react-dom/package.json")),
      };
    },
  });
  const { renderFixture } = createRequire(resolve("package.json"))(
    join(directory, "render.cjs"),
  ) as typeof FixtureRenderer;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/browser.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(await readFile(join(directory, "browser.global.js")));
      return;
    }
    if (url.pathname === "/report") {
      const partial = url.searchParams.get("mode") === "partial";
      const report = await calculatePageExperience({
        ...fixture,
        ...(partial ? { coverage: "partial" as const, completeThrough: null } : {}),
      });
      res.setHeader("Content-Type", "application/json");
      const ga4 = importGa4Engagement({
        provider: "ga4",
        definitionVersion: "ga4-v1",
        settingsVersion: "settings-7",
        sourceRevision: "ga4-demo",
        sessionDenominator: 10,
        engagedSessions: 7,
        window: fixture.window,
        timezone: "UTC",
        filters: "public-only",
      });
      res.end(JSON.stringify({ kind: partial ? "partial" : "ready", report, ga4 }));
      return;
    }
    const seed = randomUUID();
    const { html, queued } = renderFixture(seed);
    res.setHeader("X-Page-Experience-Queued", queued);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page experience fixture</title><div id="root" data-instance="${seed}">${html}</div><script src="/browser.js"></script></html>`,
    );
  });
  server.listen(Number(process.env.PORT ?? 4395), "127.0.0.1", () =>
    console.log(`Page experience: http://127.0.0.1:${(server.address() as { port: number }).port}`),
  );
  async function close() {
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });
}
void main();
