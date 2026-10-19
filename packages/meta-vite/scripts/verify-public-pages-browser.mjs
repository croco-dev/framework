import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const requireDocs = createRequire(new URL("../../docs/package.json", import.meta.url));
const { chromium } = requireDocs("@playwright/test");
const evidenceDir = await mkdtemp(join(tmpdir(), "croco-public-pages-browser-"));
const requireBuild = createRequire(new URL("../package.json", import.meta.url));
const { build } = requireBuild("tsup");
await build({
  entry: {
    application: fileURLToPath(
      new URL("../../../examples/public-pages/application.mjs", import.meta.url),
    ),
    inspection: fileURLToPath(new URL("../../seo-core/src/index.ts", import.meta.url)),
  },
  outDir: evidenceDir,
  format: ["esm"],
  platform: "node",
  dts: false,
  config: false,
  noExternal: [/^@croco\//, "parse5", "entities"],
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@croco/seo-core": fileURLToPath(new URL("../../seo-core/src/index.ts", import.meta.url)),
    };
  },
  external: [
    "react",
    "react-dom",
    "react-dom/*",
    "vite",
    "@vitejs/plugin-rsc",
    "@vitejs/plugin-rsc/*",
    "react-server-dom-webpack/*",
  ],
  outExtension: () => ({ js: ".mjs" }),
});
await symlink(
  fileURLToPath(new URL("../node_modules", import.meta.url)),
  join(evidenceDir, "node_modules"),
  "dir",
);
const { app, inspect, definition, handler } = await import(
  pathToFileURL(join(evidenceDir, "application.mjs")).href
);
const { validatePublicPageResponse } = await import(
  pathToFileURL(join(evidenceDir, "inspection.mjs")).href
);
const server = createServer(async (request, response) => {
  try {
    if (request.url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const result = await app.fetch(
      new Request(`http://127.0.0.1${request.url}`, { method: request.method }),
    );
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    response.writeHead(500);
    response.end();
  }
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${message.text()} [${message.location().url}]`);
    });
    const result = await page.goto(`${origin}/products/lamp-7?variant=amber&utm_source=email`);
    assert.equal(result.status(), 200);
    assert.equal(await page.title(), "Amber reading lamp");
    assert.equal(
      await page.locator("main p").first().innerText(),
      "An adjustable reading lamp with a warm amber shade.",
    );
    assert.equal(
      await page.getByRole("link", { name: "Delivery details" }).getAttribute("href"),
      "/delivery",
    );
    assert.equal(
      await page.locator("link[rel=canonical]").getAttribute("href"),
      "https://shop.example/products/lamp-7?variant=amber",
    );
    assert.equal(await page.locator("[data-public-price]").innerText(), "USD 37.50");
    assert.equal(await page.locator("[data-public-availability]").innerText(), "Sold out");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await page.screenshot({ path: join(evidenceDir, `pdp-${viewport.width}.png`), fullPage: true });
    for (const id of ["lamp", "mismatch", "private", "outage"]) {
      const report = await inspect(id);
      assert.equal(
        report.state,
        { lamp: "ready", mismatch: "partial", private: "denied", outage: "unavailable" }[id],
      );
      if (id === "mismatch")
        assert.deepEqual(
          report.diagnostics.map((item) => item.code),
          ["SEO_CANONICAL_MISMATCH", "SEO_BODY_PRICE_MISMATCH"],
        );
      await page.goto(`${origin}/inspector/${id}`);
      assert.ok((await page.locator("section").innerText()).includes(`${id}: ${report.state}`));
      for (const diagnostic of report.diagnostics)
        assert.ok((await page.locator("section").innerText()).includes(diagnostic.code));
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      );
      await page.screenshot({
        path: join(evidenceDir, `inspector-${id}-${viewport.width}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    const requestUrl = `${origin}/products/lamp-7?variant=amber`;
    const snapshot = await definition.source.load(new Request(requestUrl));
    const response = await handler(new Request(requestUrl));
    const initialHtml = await response.text();
    const inspectionTarget = { id: "browser-links", definition, requestUrl, respond: handler };
    for (const [id, base, fallback, expected] of [
      ["noscript", "", true, "ready"],
      ["svg-base", "", false, "partial"],
      ["svg-only", "", false, "ready"],
      ["foreign-base", '<base href="https://other.example/">', false, "partial"],
      ["same-base", '<base href="/other/">', false, "ready"],
      ["first-base", '<base href="/other/"><base href="https://other.example/">', false, "ready"],
      ["invalid-base", '<base href="http://[">', false, "partial"],
      ["script-base", '<base href="javascript:alert(1)">', false, "ready"],
      ["data-base", '<base href="data:text/html,ignored">', false, "ready"],
    ]) {
      let candidate = initialHtml.replace("<head>", `<head>${base}`);
      if (id === "svg-base")
        candidate = candidate.replace(
          "<main",
          '<svg><base href="/"></base></svg><base href="https://other.example/"><main',
        );
      if (id === "svg-only")
        candidate = candidate.replace(
          "<main",
          '<svg><base href="https://other.example/"></base></svg><main',
        );
      if (fallback)
        candidate = candidate
          .replace("<main", "<noscript><main")
          .replace("</main>", "</main></noscript>");
      await page.goto(requestUrl);
      await page.setContent(candidate);
      const link = page.getByRole("link", { name: "Delivery details" });
      assert.equal(await link.isVisible(), true, id);
      const destination = await link.evaluate((node) => node.href);
      assert.equal(
        destination,
        id === "foreign-base" || id === "svg-base"
          ? "https://other.example/delivery"
          : id === "invalid-base"
            ? "/delivery"
            : `${origin}/delivery`,
        id,
      );
      const report = validatePublicPageResponse(inspectionTarget, snapshot, {
        status: response.status,
        headers: response.headers,
        html: candidate,
      });
      assert.equal(report.state, expected, id);
      assert.deepEqual(
        report.diagnostics,
        expected === "partial" ? [{ code: "SEO_LINK_MISSING", field: "links" }] : [],
        id,
      );
    }
    assert.deepEqual(errors, [
      "'javascript' URLs may not be used as base URLs for a document. []",
      "'data' URLs may not be used as base URLs for a document. []",
    ]);
    await context.close();
  }
  for (const [path, status] of [
    ["/draft", 404],
    ["/deleted", 410],
    ["/private", 403],
    ["/old", 308],
    ["/missing", 404],
    ["/outage", 503],
  ]) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" });
    assert.equal(response.status, status);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.ok(!(await response.text()).includes("application/ld+json"));
  }
  const context = await browser.newContext({ javaScriptEnabled: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/xss`);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.equal(await page.locator("script").count(), 1);
  assert.equal(
    JSON.parse(await page.locator('script[type="application/ld+json"]').textContent()).name,
    "</script><script>window.injected=true</script>",
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    JSON.stringify({
      state: "passed",
      evidenceDir,
      javascriptDisabled: true,
      viewports: ["1280x900", "390x844"],
      surfaces: ["PDP", "ready", "partial", "denied", "unavailable"],
      linkFixtures: [
        "noscript",
        "svg-base",
        "svg-only",
        "foreign-base",
        "same-base",
        "first-base",
        "invalid-base",
        "script-base",
        "data-base",
      ],
      xssExecuted: false,
      httpStatuses: [200, 403, 404, 410, 308, 503],
      pageErrors: [],
      unexpectedConsoleErrors: [],
      expectedBaseUrlRejections: ["javascript", "data"],
    }),
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
