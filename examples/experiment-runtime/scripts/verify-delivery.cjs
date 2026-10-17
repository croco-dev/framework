const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { mkdir } = require("node:fs/promises");
const { chromium } = createRequire(resolve(__dirname, "../../../packages/docs/package.json"))(
  "@playwright/test",
);
(async () => {
  const browser = await chromium.launch({ headless: true });
  const base = "http://127.0.0.1:4183";
  const artifacts = process.env.DELIVERY_ARTIFACTS ?? "/tmp/croco-2838-browser";
  await mkdir(artifacts, { recursive: true });
  const evidence = [];
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      for (const route of ["/ssr", "/rsc"]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.setDefaultNavigationTimeout(30000);
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        const response = await page.goto(base + route);
        assert.equal(response.status(), 200);
        assert.equal(response.headers()["cache-control"], "private, no-store");
        const html = await response.text();
        assert.match(html, /Payment protected/);
        await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
        const decision = JSON.parse(await page.locator("#delivery").textContent());
        assert.ok(html.includes(decision.deliveryId));
        assert.equal(
          await page.locator("[data-experiment-region]").getAttribute("data-delivery"),
          decision.deliveryId,
        );
        await page.getByRole("button", { name: "Payment protected" }).click();
        await page.waitForFunction(
          () => document.querySelector("#interaction").textContent === "Clicked assurance",
        );
        assert.equal(
          await page.locator("[data-variant]").getAttribute("data-variant"),
          decision.variant,
        );
        await page.waitForFunction(async () => {
          const reports = await (await fetch("/reports")).json();
          const id = JSON.parse(document.querySelector("#delivery").textContent).deliveryId;
          return reports.some((r) => JSON.parse(r.deliveryInstanceId)[0] === id);
        });
        const reports = await (await context.request.get(base + "/reports")).json();
        assert.equal(
          reports.filter((r) => JSON.parse(r.deliveryInstanceId)[0] === decision.deliveryId).length,
          1,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        const shot = `${artifacts}/${route.slice(1)}-${viewport.width}.png`;
        await page.screenshot({ path: shot, fullPage: true });
        await page.evaluate(() => window.switchDeliveryScope());
        await page.getByText("Standard checkout", { exact: true }).waitFor();
        assert.equal(await page.locator("[data-variant]").count(), 0);
        assert.deepEqual(errors, []);
        evidence.push({
          route,
          viewport,
          deliveryId: decision.deliveryId,
          hydration: "same variant and delivery",
          interaction: "Clicked assurance",
          exposure: "one visible display",
          staleScope: "fallback",
          errors,
          screenshot: shot,
        });
        await context.close();
      }
    }
    for (const suffix of ["?prefetch", "?hidden"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(30000);
      await page.goto(base + "/ssr" + suffix);
      await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const decision = JSON.parse(await page.locator("#delivery").textContent());
      const reports = await (await context.request.get(base + "/reports")).json();
      assert.equal(
        reports.filter((r) => JSON.parse(r.deliveryInstanceId)[0] === decision.deliveryId).length,
        0,
      );
      if (suffix === "?prefetch") {
        await page.getByText("Standard checkout", { exact: true }).waitFor();
        const stolen = await browser.newContext();
        await stolen.addCookies([{ name: "demo-user", value: "b", url: base }]);
        assert.equal(
          (
            await stolen.request.post(base + "/admit", { data: { receipt: decision.receipt } })
          ).status(),
          403,
        );
        await stolen.close();
      }
      evidence.push({ route: "/ssr" + suffix, exposure: "none" });
      await context.close();
    }
    // Actual speculative consumption, plus a controlled in-flight admission across scope change.
    for (const staleScope of [false, true]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(30000);
      let release;
      let requested;
      const requestStarted = new Promise((resolve) => {
        requested = resolve;
      });
      const responseAllowed = new Promise((resolve) => {
        release = resolve;
      });
      await page.route("**/admit", async (route) => {
        requested();
        await responseAllowed;
        await route.continue();
      });
      await page.goto(base + "/ssr?prefetch&consume");
      await requestStarted;
      await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
      const original = JSON.parse(await page.locator("#delivery").textContent());
      await page.getByText("Standard checkout", { exact: true }).waitFor();
      if (staleScope) await page.evaluate(() => window.switchDeliveryScope());
      release();
      if (staleScope) {
        await page.waitForFunction(() => window.admissionSettled === true);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        assert.equal(await page.locator("[data-variant]").count(), 0);
        const reports = await (await context.request.get(base + "/reports")).json();
        assert.equal(
          reports.filter((r) => JSON.parse(r.deliveryInstanceId)[0] === original.deliveryId).length,
          0,
        );
      } else {
        await page.getByRole("button", { name: "Payment protected" }).waitFor();
        assert.equal(
          await page.locator("[data-variant]").getAttribute("data-variant"),
          original.variant,
        );
        assert.equal(
          await page.locator("[data-experiment-region]").getAttribute("data-delivery"),
          original.deliveryId,
        );
      }
      evidence.push({
        route: "/ssr?prefetch&consume",
        staleScope,
        outcome: staleScope
          ? "in-flight admission cancelled, fallback retained"
          : "frozen variant consumed",
      });
      await context.close();
    }
    // A mismatched admission cannot replace the frozen variant; observation failure leaves UI usable.
    for (const failure of ["admission-mismatch", "exposure-offline"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      if (failure === "admission-mismatch")
        await page.route("**/admit", async (route) => {
          const response = await route.fetch();
          const body = await response.json();
          await route.fulfill({ response, json: { ...body, variant: "invented-control" } });
        });
      else
        await page.route("**/exposure", (route) =>
          route.fulfill({ status: 503, body: "Measurement unavailable" }),
        );
      await page.goto(base + (failure === "admission-mismatch" ? "/ssr?prefetch&consume" : "/ssr"));
      await page.waitForFunction(() => !!window.observationError);
      if (failure === "admission-mismatch") {
        assert.equal(await page.locator("[data-variant]").count(), 0);
        await page.getByText("Standard checkout", { exact: true }).waitFor();
      } else {
        await page.getByRole("button", { name: "Payment protected" }).click();
        await page.waitForFunction(
          () => document.querySelector("#interaction").textContent === "Clicked assurance",
        );
        assert.equal(
          await page.locator("[data-variant]").getAttribute("data-variant"),
          "assurance",
        );
      }
      evidence.push({
        failure,
        outcome:
          failure === "admission-mismatch"
            ? "fallback without exposure"
            : "delivered UI and interaction preserved",
      });
      await context.close();
    }
    // Commit the first observation at the real sink, lose its response, then retry after time advances.
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const attempts = [];
      const receipts = [];
      await page.route("**/exposure", async (route) => {
        attempts.push(route.request().postDataJSON());
        const response = await route.fetch();
        receipts.push({ status: response.status(), body: await response.text() });
        if (attempts.length === 1)
          await route.fulfill({ status: 503, body: "Stored, response lost" });
        else await route.fulfill({ response });
      });
      await page.goto(base + "/ssr");
      await page.waitForFunction(() => !!window.observationError);
      // Set a later browser clock deterministically without slowing the test or changing the server.
      await page.evaluate(() => {
        const OriginalDate = Date;
        window.Date = class extends OriginalDate {
          constructor(...args) {
            if (args.length) super(...args);
            else super(OriginalDate.now() + 1000);
          }
        };
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForResponse((response) => response.url().endsWith("/exposure"));
      assert.equal(attempts.length, 2);
      assert.deepEqual(attempts[1], attempts[0]);
      assert.equal(receipts[0].status, 200);
      assert.equal(receipts[1].status, 200);
      assert.deepEqual(receipts[1].body, receipts[0].body);
      const decision = JSON.parse(await page.locator("#delivery").textContent());
      const reports = await (await context.request.get(base + "/reports")).json();
      const delivered = reports.filter(
        (r) => JSON.parse(r.deliveryInstanceId)[0] === decision.deliveryId,
      );
      assert.equal(delivered.length, 2);
      assert.equal(new Set(delivered.map((r) => r.id)).size, 1);
      await page.getByRole("button", { name: "Payment protected" }).click();
      await page.waitForFunction(
        () => document.querySelector("#interaction").textContent === "Clicked assurance",
      );
      evidence.push({
        failure: "stored-response-lost",
        outcome: "same occurrence retried, one receipt and usable UI",
      });
      await context.close();
    }
    // Negotiate actual Flight from the same private RenderServer, not a JSON imitation.
    const request = await browser.newContext();
    const page = await request.newPage();
    await page.goto(base + "/rsc");
    const manifest = await page.locator("#croco-rsc-manifest").textContent();
    const flight = await request.request.get(base + "/rsc", {
      headers: {
        Accept: "text/x-component",
        "x-croco-rsc-client-manifest": JSON.parse(manifest).clientManifestVersion,
      },
    });
    assert.equal(flight.status(), 200);
    assert.match(flight.headers()["content-type"], /text\/x-component/);
    assert.equal(flight.headers()["cache-control"], "private, no-store");
    assert.match(await flight.text(), /Payment protected/);
    await request.close();
    process.stdout.write(
      JSON.stringify({ evidence, flight: "official Node encoder and decoder" }, null, 2) + "\n",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
