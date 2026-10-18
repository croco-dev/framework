import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const requireDocs = createRequire(new URL("../../../packages/docs/package.json", import.meta.url));
const { chromium } = requireDocs("@playwright/test");
const origin = "http://127.0.0.1:4187";
const output = join(tmpdir(), "croco-2827-browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const evidence = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const capture = async (name) => {
    const path = join(output, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    evidence.push({ name, path, viewport: page.viewportSize(), overflow });
  };
  await page.goto(
    `${origin}/?utm_source=newsletter&token=synthetic-secret&email=synthetic%40example.test#private`,
  );
  await page.getByText("No retained touchpoints for this conversion.").waitFor();
  await capture("desktop-empty");
  let posted;
  await page.route("**/api/collect", async (route) => {
    posted = route.request().postDataJSON();
    assert.equal(new URL(page.url()).search, "");
    assert.equal(new URL(page.url()).hash, "");
    assert.doesNotMatch(JSON.stringify(posted), /token|email|synthetic-secret|private/);
    await route.continue();
  });
  await page.getByRole("button", { name: "Collect this visit" }).click();
  await page.getByText("Visit saved without raw URL data.").waitFor();
  assert.equal(posted.campaign.utm_source, "newsletter");
  await page.getByRole("button", { name: "Link authenticated demo user" }).click();
  await page.getByRole("heading", { name: "Conversion synthetic-purchase" }).waitFor();
  assert.equal(await page.locator("article").filter({ hasText: "credit 1" }).count(), 2);
  await page.getByRole("button", { name: "Collect this visit" }).click();
  await page
    .locator("article")
    .filter({ hasText: "last-observed-touch" })
    .getByText("unattributed · unknown · credit 0")
    .waitFor();
  await page
    .locator("article")
    .filter({ hasText: "first-touch" })
    .getByText("attributed · campaign · credit 1", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Import conflicting self-reports" }).click();
  await page.getByRole("heading", { name: "Separate declarations: conflict" }).waitFor();
  assert.equal(await page.getByText(/Distinct conversions: 1\./).count(), 1);
  await capture("desktop-first-last");
  await page.getByRole("button", { name: "Refresh evidence" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Conversion synthetic-purchase" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Refresh evidence" })
      .evaluate((button) => button === document.activeElement),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("mobile-first-last");
  assert.deepEqual(errors, []);
  // The actual component receives each host state through its normal fetch boundary.
  for (const kind of ["partial", "denied", "error"]) {
    await page.route("**/api/compare", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kind }),
      });
    });
    await page.getByRole("button", { name: "Refresh evidence" }).click();
    if (kind === "partial") await page.getByText(/partial history is not attributed/).waitFor();
    else await page.getByRole("alert").waitFor();
    await capture(`mobile-${kind}`);
    await page.unroute("**/api/compare");
  }
  let held;
  let signal;
  const intercepted = new Promise((resolve) => {
    signal = resolve;
  });
  await page.route("**/api/compare", (route) => {
    held = route;
    signal();
  });
  await page.getByRole("button", { name: "Refresh evidence" }).click();
  await intercepted;
  await page.getByText("Loading acquisition evidence…").waitFor();
  assert.equal(await page.getByRole("button", { name: "Refresh evidence" }).isDisabled(), true);
  await capture("mobile-loading");
  await held.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ kind: "empty" }),
  });
  await page.unroute("**/api/compare");
  await page.getByText("No retained touchpoints for this conversion.").waitFor();
  await page.getByRole("button", { name: "Refresh evidence" }).click();
  await page.getByRole("heading", { name: "Conversion synthetic-purchase" }).waitFor();
  assert.deepEqual(errors, []);
  const request = async (path, data, headers = {}) =>
    page.request.post(`${origin}${path}`, {
      data,
      headers: { origin, "content-type": "application/json", ...headers },
    });
  const forged = await request("/api/collect", {
    landingRef: "home",
    campaign: { utm_source: "administrator" },
    referrer: { status: "absent" },
  });
  assert.equal(forged.status(), 422);
  assert.equal((await forged.json()).code, "analytics/acquisition/invalid");
  for (const landingRef of [["home"], { toString: "home" }]) {
    const malformed = await request("/api/collect", {
      landingRef,
      campaign: {},
      referrer: { status: "absent" },
    });
    assert.equal(malformed.status(), 422);
    assert.equal((await malformed.json()).code, "analytics/acquisition/invalid");
  }
  const redirect = await request("/api/collect", {
    landingRef: "//evil.test",
    campaign: {},
    referrer: { status: "absent" },
  });
  assert.equal(redirect.status(), 422);
  assert.equal((await redirect.json()).code, "analytics/acquisition/invalid");
  const query = await request("/api/collect?token=private", {});
  assert.equal(query.status(), 403);
  const crossOrigin = await request("/api/collect", {}, { origin: "https://evil.test" });
  assert.equal(crossOrigin.status(), 403);
  await page.getByRole("button", { name: "Logout and rotate session" }).click();
  await page.getByRole("heading", { name: "Conversion synthetic-purchase" }).waitFor();
  const before = await (await request("/api/compare", {})).json();
  await page.getByRole("button", { name: "Collect this visit" }).click();
  await page.getByText("Visit saved without raw URL data.").waitFor();
  const after = await (await request("/api/compare", {})).json();
  assert.equal(after.comparison.touchpoints.length, before.comparison.touchpoints.length);
  evidence.push({
    assertions:
      "browser/server sanitized payload, exact first/last credits, separate conflicting reports, distinct count, logout isolation, keyboard refresh, malformed campaign, redirect, query and cross-origin denial",
    errors,
  });
  await writeFile(join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
