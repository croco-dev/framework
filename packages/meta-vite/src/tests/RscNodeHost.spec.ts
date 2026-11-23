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
import { splitStreamedFlight } from "./fixtures/streamedFlightDocument";
import type { RscBuild } from "../libs/rsc/buildEntry";

const fixtureDir = fileURLToPath(new URL("./fixtures/rsc-node-consumer/", import.meta.url));
const source = (path: string): string =>
  fileURLToPath(new URL(`../libs/rsc/${path}`, import.meta.url));

type RunningApp = {
  readonly server: ServerType;
  readonly build: RscBuild;
  readonly origin: string;
  readonly clientManifestVersion: string;
};

const TENANTS: Readonly<Record<string, string>> = { a: "tenant-a", b: "tenant-b" };

let outDirs: string[] = [];
let apps: RunningApp[] = [];
let primary!: RunningApp;

// The fixture imports the package by name; inside the workspace those names
// point at this package's sources. The published path is covered by the
// packed-consumer contract test.
async function buildFixture(outDir: string): Promise<void> {
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

// Each app resolves its tenant on the server from an allowlist; the request
// only names a key, so no client value becomes the context itself.
async function startApp(outDir: string): Promise<RunningApp> {
  const build = await loadRscBuild({ outDir });
  const renderServer = new RenderServer([...build.routes], { build });

  let app: ReturnType<typeof createNodeComposedHandler> | undefined;
  return new Promise<RunningApp>((resolve) => {
    const server = serve(
      {
        fetch: (request) =>
          app ? app.fetch(request) : Promise.resolve(new Response(null, { status: 503 })),
        port: 0,
        hostname: "127.0.0.1",
      },
      (info) => {
        const origin = `http://127.0.0.1:${info.port}`;
        app = createNodeComposedHandler({
          origin,
          apiHandlers: [createRscAssetHandler(build)],
          pageHandler: (request, context) =>
            renderServer.handle(request, {
              ...context,
              platform: "node",
              env: {
                tenant:
                  TENANTS[new URL(request.url).searchParams.get("t") ?? ""] ?? "server-tenant",
              },
            }),
        });
        resolve({ server, build, origin, clientManifestVersion: build.clientManifestVersion });
      },
    );
  });
}

async function closeApp(app: RunningApp): Promise<void> {
  await new Promise<void>((resolve) => {
    app.server.close(() => resolve());
  });
  await app.build.close();
}

function bodyField(html: string, field: string): string | undefined {
  return new RegExp(`${field}=(?:<!-- -->)?([\\w-]+)`).exec(html)?.[1];
}

describe("Node RSC production build host", () => {
  beforeAll(async () => {
    outDirs = [0, 1].map(() => mkdtempSync(join(tmpdir(), "croco-rsc-node-host-")));
    for (const outDir of outDirs) {
      await buildFixture(outDir);
    }
    apps = await Promise.all(outDirs.map((outDir) => startApp(outDir)));
    const [first] = apps;
    if (!first) {
      throw new Error("the first app did not start");
    }
    primary = first;
  }, 110_000);

  afterAll(async () => {
    await Promise.all(apps.map((app) => closeApp(app).catch(() => undefined)));
    for (const outDir of outDirs) {
      rmSync(outDir, { force: true, recursive: true });
    }
  });

  it("serves a Vite RSC build as HTML, Flight and client assets over a real Node HTTP server", async () => {
    const page = await fetch(`${primary.origin}/`);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    expect(html).toContain("tenant=<!-- -->server-tenant");
    expect(html).toContain("slow:resolved");
    expect(html).toContain('<meta name="croco:rsc-initial-flight" content="streamed">');
    expect(splitStreamedFlight(html).ended).toBe(true);
    const clientEntry = /<script type="module" src="([^"]+)"[^>]* async=""/.exec(html)?.[1];
    expect(clientEntry).toBeDefined();
    expect((await fetch(`${primary.origin}${clientEntry}`)).status).toBe(200);

    const flight = await fetch(`${primary.origin}/.rsc`, {
      headers: { "x-croco-rsc-client-manifest": primary.clientManifestVersion },
    });
    expect(flight.status).toBe(200);
    expect(flight.headers.get("content-type")).toBe("text/x-component; charset=utf-8");
    expect(await flight.text()).toContain("path=");

    const stale = await fetch(`${primary.origin}/.rsc`, {
      headers: { "x-croco-rsc-client-manifest": "stale" },
    });
    expect(stale.status).toBe(400);
    expect((await fetch(`${primary.origin}/missing`)).status).toBe(404);
  });

  it("sends the shell, the client entry and the shell's Flight before a held boundary resolves", async () => {
    const response = await fetch(`${primary.origin}/?hold=1`);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("the document has no body");
    }
    const decoder = new TextDecoder();
    let early = "";
    // HTTP may cut a block anywhere, so read until a whole one has arrived.
    while (!(early.includes('async=""') && splitStreamedFlight(early).flight.length > 0)) {
      const { done, value } = await reader.read();
      expect(done).toBe(false);
      early += decoder.decode(value, { stream: true });
    }

    const beforeRelease = splitStreamedFlight(early);
    expect(beforeRelease.html).toContain("holding");
    expect(beforeRelease.html).not.toContain("held:released");
    expect(beforeRelease.ended).toBe(false);
    expect(new TextDecoder().decode(beforeRelease.flight)).toContain("Packed RSC");
    // Every Flight block follows the whole shell, outside any element React hydrates.
    expect(early.indexOf("</main>")).toBeLessThan(beforeRelease.blockOffsets[0] ?? -1);

    await primary.build.invokeAction("release", null, { request: new Request(primary.origin) });
    let rest = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      rest += decoder.decode(value, { stream: true });
    }

    const whole = splitStreamedFlight(early + rest);
    expect(whole.html).toContain("held:released");
    expect(new TextDecoder().decode(whole.flight)).toContain("held:released");
    expect(whole.ended).toBe(true);
  });

  it("refuses a request whose Host header names another origin", async () => {
    const { request } = await import("node:http");
    const status = await new Promise<number | undefined>((resolve, reject) => {
      request(`${primary.origin}/`, { headers: { host: "attacker.example" } }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      })
        .on("error", reject)
        .end();
    });

    expect(status).toBe(400);
  });

  it("keeps two separately built apps and their tenants apart, and closing one leaves the other serving", async () => {
    const [appA, appB] = apps;
    if (!appA || !appB) {
      throw new Error("both apps must be running");
    }
    const page = (app: RunningApp, tenant: string) =>
      fetch(`${app.origin}/?t=${tenant}`).then((response) => response.text());

    const before = bodyField(await page(appB, "b"), "render");
    const pages = await Promise.all([
      page(appA, "a"),
      page(appB, "b"),
      page(appA, "b"),
      page(appB, "a"),
      page(appA, "a"),
    ]);

    expect(pages.map((html) => bodyField(html, "tenant"))).toEqual([
      "tenant-a",
      "tenant-b",
      "tenant-b",
      "tenant-a",
      "tenant-a",
    ]);
    // Each build keeps its own module state: app B counted only its own renders.
    const after = bodyField(await page(appB, "b"), "render");
    expect(Number(after) - Number(before)).toBe(3);

    await closeApp(appB);
    expect((await fetch(`${appA.origin}/?t=a`)).status).toBe(200);
  });
});
