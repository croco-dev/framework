import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startServer } from "./dist/server/server.js";
const { chromium } = createRequire(resolve("../../packages/docs/package.json"))("@playwright/test");
const directory = process.env.APOLLO_EVIDENCE_DIR ?? resolve(tmpdir(), "croco-2844-browser");
await mkdir(directory, { recursive: true });
let server;

let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    server = await startServer();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    let browserQueries = 0;
    let markRequest;
    let held;
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (request.url() === `${origin}/graphql`) browserQueries++;
    });
    const response = await page.goto(origin);
    const html = await response.text();
    assert.match(html, /17.00/);
    assert.ok(!html.includes("server-only-secret"));
    assert.ok(!html.includes("session=alice"));
    await page.getByTestId("price").filter({ hasText: "17.00" }).waitFor();
    // A browser interaction proves hydration has attached. Native mutation/refetch must execute.
    await page.getByRole("button", { name: "Apply discount" }).click();
    await page.getByTestId("price").filter({ hasText: "14.00" }).waitFor();
    assert.equal(
      browserQueries,
      2,
      "hydration must add no request before the mutation and explicit refetch",
    );
    const screenshot = resolve(directory, `apollo-${viewport.width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    // Hold an old-owner network response, then release it after the new owner's cache is visible.
    await page.route(`${origin}/graphql`, async (route) => {
      if (route.request().postDataJSON().operationName === "Discount") {
        const result = await route.fetch();
        held = { route, result };
        markRequest();
      } else await route.continue();
    });
    const oldStarted = new Promise((done) => {
      markRequest = done;
    });
    await page.getByRole("button", { name: "Apply discount" }).click();
    await oldStarted;
    await page.getByRole("button", { name: "Switch to Bob" }).click();
    await page.getByTestId("price").filter({ hasText: "31.00" }).waitFor();
    await held.route.fulfill({ response: held.result });
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    assert.equal(await page.getByTestId("price").textContent(), "31.00");
    await page.getByRole("button", { name: "Switch tenant" }).click();
    await page.getByTestId("price").filter({ hasText: "38.00" }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        viewport,
        screenshot,
        initialHydrationFetches: 0,
        nativeMutation: "14.00",
        transitionedPrice: "31.00",
        lateResponseIsolated: true,
        tenantPrice: "38.00",
        errors,
      }),
    );
    await context.close();
    if (server)
      await new Promise((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    server = undefined;
  }
} finally {
  if (browser) await browser.close();
  if (server)
    await new Promise((done, reject) => server.close((error) => (error ? reject(error) : done())));
}
