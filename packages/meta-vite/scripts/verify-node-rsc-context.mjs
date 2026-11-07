import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

const requirePackage = createRequire(new URL("../package.json", import.meta.url));
const requireDocs = createRequire(new URL("../../docs/package.json", import.meta.url));
// Encoder discovery is anchored at the consuming application's package root.
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const { chromium } = requireDocs("@playwright/test");
const evidenceDir = await mkdtemp(join(tmpdir(), "croco-node-rsc-context-"));
const { build } = requirePackage("tsup");
await build({
  entry: {
    renderServer: fileURLToPath(new URL("../src/libs/render/renderServer.ts", import.meta.url)),
    nodeAdapter: fileURLToPath(new URL("../src/libs/providers/node.ts", import.meta.url)),
    routeRegistry: fileURLToPath(new URL("../src/libs/routes/routeRegistry.ts", import.meta.url)),
    defineRoute: fileURLToPath(new URL("../src/libs/routes/defineRoute.ts", import.meta.url)),
  },
  outDir: evidenceDir,
  format: ["esm"],
  platform: "node",
  dts: false,
  config: false,
  noExternal: [/^@croco\//],
  external: ["react", "react-dom", "react-dom/*", "react-server-dom-webpack/*"],
  outExtension: () => ({ js: ".mjs" }),
});
await symlink(
  fileURLToPath(new URL("../node_modules", import.meta.url)),
  join(evidenceDir, "node_modules"),
  "dir",
);
const { RenderServer } = await import(pathToFileURL(join(evidenceDir, "renderServer.mjs")).href);
const { createNodeHandler, createNodeComposedHandler } = await import(
  pathToFileURL(join(evidenceDir, "nodeAdapter.mjs")).href
);
const { RouteRegistry } = await import(pathToFileURL(join(evidenceDir, "routeRegistry.mjs")).href);
const { defineRoute } = await import(pathToFileURL(join(evidenceDir, "defineRoute.mjs")).href);
const componentRef = `${fileURLToPath(new URL("../src/tests/fixtures/rsc-basic/nodeContext.mjs", import.meta.url))}#default`;
const registry = new RouteRegistry();
for (const path of ["/standalone", "/composed"]) {
  registry.register(defineRoute({ path, mode: "rsc", componentRef, component: () => null }));
}
const renderer = new RenderServer(registry.compile());
const pageHandler = (request, context) => renderer.handle(request, context);
const standalone = createNodeHandler(pageHandler);
const composed = createNodeComposedHandler({ apiHandlers: [], pageHandler });
const server = createServer(async (request, response) => {
  try {
    if (request.url === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    const adapter = request.url.startsWith("/standalone") ? standalone : composed;
    const result = await adapter.fetch(
      new Request(`http://${request.headers.host}${request.url}`, {
        headers: request.headers,
      }),
    );
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) {
      Readable.fromWeb(result.body).pipe(response);
    } else {
      response.end();
    }
  } catch (error) {
    response.destroy(error);
  }
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const path of ["/standalone", "/composed"]) {
    await page.setExtraHTTPHeaders({ "x-tenant": `tenant${path}` });
    const response = await page.goto(`http://127.0.0.1:${server.address().port}${path}?locale=ko`);
    assert.equal(response.status(), 200);
    assert.equal(
      await page.locator("#node-context").textContent(),
      `platform=node;path=${path};locale=ko;tenant=tenant${path}`,
    );
    await page.setExtraHTTPHeaders({});
    const flight = await page.evaluate(async (pathname) => {
      const version = document.querySelector('meta[name="croco:rsc-client-manifest"]').content;
      const response = await fetch(`${pathname}.rsc?locale=en`, {
        headers: {
          accept: "text/x-component",
          "x-croco-rsc-client-manifest": version,
          "x-tenant": "refresh-tenant",
        },
      });
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        body: await response.text(),
      };
    }, path);
    assert.equal(flight.status, 200);
    assert.match(flight.type, /text\/x-component/);
    assert.ok(
      flight.body.includes(`platform=node;path=${path}.rsc;locale=en;tenant=refresh-tenant`),
      flight.body,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    const screenshot = join(evidenceDir, `${path.slice(1)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(JSON.stringify({ path, viewport: "1280x720", html: 200, flight: 200, screenshot }));
  }
  assert.deepEqual(errors, []);
  console.log(
    "Node adapter RSC browser checks passed; no page/console errors or horizontal overflow.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
