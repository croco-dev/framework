import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import vitePluginRsc from "@vitejs/plugin-rsc";
import { createBuilder } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNodeComposedHandler } from "../libs/providers/node";
import { RenderServer } from "../libs/render/renderServer";
import { loadRscBuild } from "../libs/rsc/loadRscBuild";
import { createRscAssetHandler } from "../libs/rsc/rscAssets";
import { crocoMetaVitePlugin } from "../libs/vite/crocoMetaVitePlugin";
import type { ServerType } from "@hono/node-server";

const fixtureDir = fileURLToPath(new URL("./fixtures/rsc-node-consumer/", import.meta.url));
const source = (path: string): string =>
  fileURLToPath(new URL(`../libs/rsc/${path}`, import.meta.url));

let outDir!: string;
let server: ServerType | undefined;
let origin!: string;
let clientManifestVersion!: string;

// The fixture imports the package by name; inside the workspace those names
// point at this package's sources. The published path is covered by the
// packed-consumer contract test.
async function buildFixture(): Promise<void> {
  const builder = await createBuilder({
    root: fixtureDir,
    configFile: false,
    logLevel: "error",
    esbuild: { jsx: "automatic" },
    resolve: {
      alias: {
        "@croco/meta-vite/rsc/server": source("serverEntry.ts"),
        "@croco/meta-vite/rsc/ssr": source("ssrEntry.ts"),
        "@croco/meta-vite/rsc/browser": source("flightBrowser.entry.ts"),
      },
    },
    environments: {
      client: { build: { outDir: join(outDir, "client") } },
      ssr: { build: { outDir: join(outDir, "ssr") } },
      rsc: { build: { outDir: join(outDir, "rsc") } },
    },
    plugins: [
      crocoMetaVitePlugin({ rsc: true }),
      vitePluginRsc({
        entries: {
          client: join(fixtureDir, "src", "entry.browser.jsx"),
          ssr: join(fixtureDir, "src", "entry.ssr.jsx"),
          rsc: join(fixtureDir, "src", "entry.rsc.jsx"),
        },
      }),
    ],
  });
  await builder.buildApp();
}

describe("Node RSC production build host", () => {
  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), "croco-rsc-node-host-"));
    await buildFixture();
    const build = await loadRscBuild({ outDir });
    clientManifestVersion = build.clientManifestVersion;
    const renderServer = new RenderServer([...build.routes], { build });

    let app: ReturnType<typeof createNodeComposedHandler> | undefined;
    origin = await new Promise<string>((resolve) => {
      server = serve(
        {
          fetch: (request) =>
            app ? app.fetch(request) : Promise.resolve(new Response(null, { status: 503 })),
          port: 0,
          hostname: "127.0.0.1",
        },
        (info) => {
          const listening = `http://127.0.0.1:${info.port}`;
          app = createNodeComposedHandler({
            origin: listening,
            apiHandlers: [createRscAssetHandler(build)],
            pageHandler: (request, context) =>
              renderServer.handle(request, {
                ...context,
                platform: "node",
                env: { tenant: "server-tenant" },
              }),
          });
          resolve(listening);
        },
      );
    });
  }, 110_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
    rmSync(outDir, { force: true, recursive: true });
  });

  it("serves a Vite RSC build as HTML, Flight and client assets over a real Node HTTP server", async () => {
    const page = await fetch(`${origin}/`);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    expect(html).toContain("tenant=<!-- -->server-tenant");
    expect(html).toContain("slow:resolved");
    expect(html).toContain('id="croco-rsc-initial-flight"');
    const clientEntry = /<script type="module" src="([^"]+)"/.exec(html)?.[1];
    expect(clientEntry).toBeDefined();
    expect((await fetch(`${origin}${clientEntry}`)).status).toBe(200);

    const flight = await fetch(`${origin}/.rsc`, {
      headers: { "x-croco-rsc-client-manifest": clientManifestVersion },
    });
    expect(flight.status).toBe(200);
    expect(flight.headers.get("content-type")).toBe("text/x-component; charset=utf-8");
    expect(await flight.text()).toContain("path=");

    const stale = await fetch(`${origin}/.rsc`, {
      headers: { "x-croco-rsc-client-manifest": "stale" },
    });
    expect(stale.status).toBe(400);
    expect((await fetch(`${origin}/missing`)).status).toBe(404);
  });

  it("refuses a request whose Host header names another origin", async () => {
    const { request } = await import("node:http");
    const status = await new Promise<number | undefined>((resolve, reject) => {
      request(`${origin}/`, { headers: { host: "attacker.example" } }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      })
        .on("error", reject)
        .end();
    });

    expect(status).toBe(400);
  });
});
