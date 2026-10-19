const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const esbuild = createRequire(require.resolve("tsup"))("esbuild");
const diagnostic = (stage, event, details = {}) =>
  process.stderr.write(
    `${JSON.stringify({ runner: "experienceSlotBrowser", stage, event, ...details })}\n`,
  );
(async () => {
  const results = [];
  const failures = [];
  let browser;
  try {
    const fixture = resolve(__dirname, "fixtures/ExperimentRegion.ts");
    const bundle = await esbuild.build({
      stdin: {
        contents: `import { mountExperimentRegionProbe } from ${JSON.stringify(fixture)}; window.mountProbe = mountExperimentRegionProbe;`,
        resolveDir: __dirname,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      define: { "process.env.NODE_ENV": '"production"' },
    });
    browser = await chromium.launch({ headless: true });
    for (const kind of ["admission-sync", "report-sync", "admission-null"]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("https://region.test/", (route) =>
        route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }),
      );
      await page.goto("https://region.test/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate((value) => window.mountProbe(value), kind);
      await page
        .waitForFunction(() => window.regionProbe.errors.length > 0)
        .catch(async (error) => {
          console.error(
            JSON.stringify({
              kind,
              pageErrors: errors,
              probe: await page.evaluate(() => window.regionProbe),
              html: await page.locator("body").innerHTML(),
              visible: await page.evaluate(() => document.visibilityState),
            }),
          );
          throw error;
        });
      if (kind === "report-sync") {
        await page.getByRole("button", { name: "Payment protected" }).click();
        assert.equal(await page.evaluate(() => window.regionProbe.clicks), 1);
      } else {
        assert.equal(await page.getByRole("button").count(), 0);
        await page.getByText("Standard checkout").waitFor();
      }
      assert.deepEqual(errors, []);
      results.push({ kind, errorReported: true, usable: true });
      await page.close();
    }
    for (const style of ["display:none", "visibility:hidden", "opacity:0"]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.route("https://region.test/", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<section style="${style}"><div id="root"></div></section>`,
        }),
      );
      await page.goto("https://region.test/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(() => window.mountProbe("visibility"));
      await page.locator("button").waitFor({ state: "attached" });
      // Allow observer callbacks and rendering frames while the region is hidden.
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            let frames = 0;
            const tick = () => (++frames === 10 ? resolve() : requestAnimationFrame(tick));
            requestAnimationFrame(tick);
          }),
      );
      assert.equal(await page.evaluate(() => window.regionProbe.reports), 0, style);
      await page.locator("section").evaluate((node) => node.removeAttribute("style"));
      await page.waitForFunction(() => window.regionProbe.reports === 1);
      await page.getByRole("button").click();
      assert.equal(await page.evaluate(() => window.regionProbe.clicks), 1);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.evaluate(() => new Promise(requestAnimationFrame));
      assert.equal(await page.evaluate(() => window.regionProbe.reports), 1);
      assert.deepEqual(await page.evaluate(() => window.regionProbe.errors), []);
      assert.deepEqual(errors, []);
      await page.close();
    }
    for (const nativeVisibility of [true, false]) {
      const page = await browser.newPage();
      await page.route("https://region.test/", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<style>[data-experiment-region]{visibility:visible}</style><section style="visibility:hidden"><div id="root"></div></section>',
        }),
      );
      await page.goto("https://region.test/");
      if (!nativeVisibility)
        await page.evaluate(() => {
          Object.defineProperty(Element.prototype, "checkVisibility", { value: undefined });
        });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(() => window.mountProbe("visibility"));
      await page.waitForFunction(() => window.regionProbe.reports === 1, null, { timeout: 5000 });
      await page.getByRole("button").click();
      assert.equal(await page.evaluate(() => window.regionProbe.clicks), 1);
      assert.deepEqual(await page.evaluate(() => window.regionProbe.errors), []);
      await page.close();
    }
  } catch (error) {
    failures.push(error);
    diagnostic("execution", "failed", { message: String(error) });
  } finally {
    diagnostic("cleanup", "start");
    try {
      await esbuild.stop();
    } catch (error) {
      failures.push(error);
      diagnostic("esbuild.stop", "failed", { message: String(error) });
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        failures.push(error);
        diagnostic("browser.close", "failed", { message: String(error) });
      }
    }
    diagnostic("cleanup", "completed", { failures: failures.length });
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Browser verification and cleanup failed");
  process.stdout.write(JSON.stringify(results));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
