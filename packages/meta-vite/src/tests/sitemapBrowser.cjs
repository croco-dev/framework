const { createRequire } = require("node:module");
const { resolve, join } = require("node:path");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");

(async () => {
  const root = await mkdtemp(join(tmpdir(), "croco-sitemap-browser-"));
  const artifacts = await mkdtemp(join(tmpdir(), "croco-sitemap-evidence-"));
  const bundle = await build({
    stdin: {
      contents: `export { createSitemapHandler } from ${JSON.stringify(resolve(__dirname, "../libs/sitemap/createSitemapHandler.ts"))}; export { FileSitemapPublisher } from ${JSON.stringify(resolve(__dirname, "../libs/sitemap/FileSitemapPublisher.ts"))};`,
      resolveDir: resolve(__dirname, ".."),
      loader: "ts",
    },
    platform: "node",
    bundle: true,
    write: false,
    format: "cjs",
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", bundle.outputFiles[0].text)(
    loaded,
    loaded.exports,
    require,
  );
  const { FileSitemapPublisher, createSitemapHandler } = loaded.exports;
  let handler;
  let unavailable = false;
  const errors = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const response =
      (await handler(
        new Request(`http://127.0.0.1:${server.address().port}${req.url}`, {
          method: req.method,
          headers: req.headers,
          ...(body.length ? { body } : {}),
        }),
      )) ?? new Response(null, { status: 404 });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  handler = createSitemapHandler({
    publisher: new FileSitemapPublisher(root),
    policy: {
      tenantId: "shop",
      origin: base,
      approveUrl: (url) => url.pathname.startsWith("/products/"),
    },
    source: {
      open: async () => ({ tenantId: "shop", revision: "pdp-7" }),
      read: async () => {
        if (unavailable) throw new Error("source unavailable");
        return {
          revision: "pdp-7",
          entries: [
            {
              resourceId: "public",
              tenantId: "shop",
              url: `${base}/products/public`,
              canonical: `${base}/products/public`,
              publication: "public",
              indexable: true,
            },
            {
              resourceId: "private",
              tenantId: "shop",
              url: `${base}/products/private`,
              canonical: `${base}/products/private`,
              publication: "private",
              indexable: false,
            },
          ],
          nextCursor: null,
          complete: true,
        };
      },
    },
    authorize: async (request) => ({
      actorId: "operator",
      tenantId: "shop",
      permissions:
        request.headers.get("cookie") === "role=reader"
          ? ["sitemap:read"]
          : ["sitemap:read", "sitemap:regenerate", "sitemap:publish"],
    }),
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("503"))
        errors.push(message.text());
    });
    await page.goto(`${base}/admin/sitemap`);
    await page.getByLabel("Expected source revision", { exact: true }).fill("pdp-7");
    await page.getByLabel("Idempotency key", { exact: true }).fill("preview-1");
    await page.getByRole("button", { name: "Regenerate preview" }).click();
    await page.getByRole("status").filter({ hasText: "Snapshot complete" }).waitFor();
    assert.match(
      await page.locator("main").innerText(),
      /Included: 1; scanned: 2; lastmod unknown: 1/,
    );
    assert.match(await page.locator("table").first().innerText(), /publication\s+1/);
    await page.screenshot({ path: join(artifacts, "preview-desktop.png"), fullPage: true });
    await page.getByLabel("Idempotency key", { exact: true }).fill("publish-1");
    await page.getByRole("button", { name: "Publish complete sitemap" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("status").filter({ hasText: "Complete sitemap published." }).waitFor();
    assert.match(await (await page.request.get(`${base}/sitemap.xml`)).text(), /sitemapindex/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(artifacts, "published-mobile.png"), fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    unavailable = true;
    await page.getByLabel("Idempotency key", { exact: true }).fill("retry-1");
    await page.getByRole("button", { name: "Regenerate preview" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Source incomplete. Current publication preserved." })
      .waitFor();
    assert.match(await page.locator("main").innerText(), /Last successful revision: pdp-7/);
    await page.screenshot({ path: join(artifacts, "incomplete-mobile.png"), fullPage: true });
    await page.context().addCookies([{ name: "role", value: "reader", url: base }]);
    await page.goto(`${base}/admin/sitemap`);
    assert.equal(
      await page.getByRole("button", { name: "Publish complete sitemap" }).isDisabled(),
      true,
    );
    assert.equal(await page.getByRole("button", { name: "Regenerate preview" }).isDisabled(), true);
    const denied = await page.request.post(`${base}/admin/sitemap`, {
      form: { action: "publish", revision: "pdp-7", idempotencyKey: "forged" },
      headers: { Origin: base },
    });
    assert.equal(denied.status(), 403);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        artifacts,
        desktop: "1280x900",
        mobile: "390x844",
        keyboardPublish: "passed",
        readOnly: "passed",
        sourceFailure: "preserved",
        errors,
      }),
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
