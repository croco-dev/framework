import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const { chromium } = createRequire(resolve(root, "packages/docs/package.json"))("@playwright/test");
const base = process.env.ENRICHMENT_BROWSER_URL;
if (!base || new URL(base).hostname !== "127.0.0.1")
  throw new Error("Provide the synthetic loopback ENRICHMENT_BROWSER_URL");
const output = "/tmp/croco-2826-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const expectedNetworkErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.location().url === `${base}/api` && message.text().includes("status of 500"))
        expectedNetworkErrors.push(message.text());
      else errors.push(message.text());
    }
  });
  await page.goto(base);
  await page.getByText("Where is my order?", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Export reviewed labels", exact: true }).isDisabled(),
    true,
  );
  const articles = page.locator("article");
  await page.getByLabel("Audit reason", { exact: true }).fill("Manual review of current source");
  await articles
    .nth(5)
    .getByLabel("Review evidence", { exact: true })
    .fill("Human read the original before any model attempt");
  await articles.nth(5).getByRole("button", { name: "Approve label", exact: true }).click();
  await articles
    .nth(5)
    .getByText(/Reviewed label: support by local-reviewer/)
    .waitFor();
  for (let index = 0; index < 5; index++) {
    await articles
      .nth(index)
      .getByRole("button", { name: "Classify with v1", exact: true })
      .click();
    await page.getByText("Operation in progress…").waitFor({ state: "hidden" });
  }
  await articles
    .nth(0)
    .getByText(/dictionary · classified · Candidate: support/)
    .waitFor();
  await articles
    .nth(1)
    .getByText(/model · classified · Candidate: purchase/)
    .waitFor();
  await articles
    .nth(2)
    .getByText(/unknown · Candidate: none/)
    .waitFor();
  await page.screenshot({ path: `${output}/desktop-partial.png`, fullPage: true });
  await page.getByLabel("Audit reason", { exact: true }).fill("Checked synthetic source evidence");
  await articles
    .nth(1)
    .getByLabel("Review evidence", { exact: true })
    .fill("Human correction: this synthetic record is a support request.");
  await articles.nth(1).getByRole("button", { name: "Approve label", exact: true }).click();
  await articles
    .nth(1)
    .getByText(/Reviewed label: support by local-reviewer/)
    .waitFor();
  await page.getByRole("combobox", { name: "Definition version", exact: true }).selectOption("v2");
  await articles.nth(1).getByRole("button", { name: "Classify with v2", exact: true }).click();
  await articles
    .nth(1)
    .getByText(/v2 · model · classified · Candidate: purchase/)
    .waitFor();
  await articles
    .nth(1)
    .getByText(/Latest candidate differs from review or is unknown/)
    .waitFor();
  assert.equal(
    await articles
      .nth(1)
      .getByText(/Candidate: purchase/)
      .count(),
    2,
  );
  await articles.nth(1).screenshot({ path: `${output}/desktop-review-difference.png` });
  await articles.nth(5).getByRole("button", { name: "Classify with v2", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await articles
    .nth(5)
    .getByText(/failed · Candidate: none/)
    .waitFor();
  await page.getByLabel("Audit reason", { exact: true }).fill("Checked synthetic source evidence");
  await articles
    .nth(5)
    .getByLabel("Review evidence", { exact: true })
    .fill("Human review despite provider failure");
  await articles.nth(5).getByRole("button", { name: "Approve label", exact: true }).click();
  await articles
    .nth(5)
    .getByText(/Reviewed label: support by local-reviewer/)
    .waitFor();
  // Restore v1 for the remaining reviews, which refer to their actual latest candidate version.
  await page.getByRole("combobox", { name: "Definition version", exact: true }).selectOption("v1");
  for (const index of [0, 2, 3, 4]) {
    await articles
      .nth(index)
      .getByLabel("Review evidence", { exact: true })
      .fill(`Reviewed source record ${index}`);
    await articles.nth(index).getByRole("button", { name: "Approve label", exact: true }).click();
    await articles
      .nth(index)
      .getByText(/Reviewed label: support by local-reviewer/)
      .waitFor();
  }
  await page.getByRole("button", { name: "Export reviewed labels", exact: true }).click();
  const exported = page.getByLabel("Exported reviewed labels", { exact: true });
  await exported.waitFor();
  const labels = JSON.parse(await exported.innerText());
  assert.deepEqual(
    labels.map((row) => row.labelId),
    ["support", "support", "support", "support", "support", "support"],
  );
  assert.equal(JSON.stringify(labels).includes("Where is my order?"), false);
  // Keyboard and responsive evidence on the actual console, not HTML snapshots.
  await page.getByLabel("Audit reason", { exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Reload");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/mobile-reviewed.png` });
  const stateText = {
    loading: "Loading classification results…",
    empty: "No batch selected.",
    denied: "Access denied.",
    error: "Results unavailable.",
  };
  for (const state of ["loading", "empty", "denied", "error"]) {
    await page.goto(`${base}/?state=${state}`);
    await page.getByRole("heading", { name: "Enrichment review", exact: true }).waitFor();
    await page.getByText(stateText[state], { exact: true }).waitFor();
    assert.equal(await page.locator("article").count(), 0);
    assert.equal((await page.locator("body").innerText()).includes("Where is my order?"), false);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: `${output}/mobile-${state}.png`, fullPage: true });
  }
  await page.goto(base);
  await page.getByText("Where is my order?", { exact: true }).waitFor();
  // A real failed server callback reports failure and permits a subsequent reload.
  await page.route("**/api?offset=0", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "invalid-json" }),
  );
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.unroute("**/api?offset=0");
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await page.getByRole("alert").waitFor({ state: "hidden" });
  await page.goto(`${base}/?run=large`);
  await page.getByRole("button", { name: "Next page", exact: true }).waitFor();
  assert.equal(await page.locator("article").count(), 20);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await page.locator("article").count(), 6);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}/mobile-bounded-page.png`, fullPage: true });
  assert.deepEqual(errors, []);
  assert.equal(expectedNetworkErrors.length, 1);
  console.log(
    JSON.stringify({
      surface: base,
      viewports: ["1280x900", "390x844"],
      assertions:
        "dictionary/model/unknown, manual override and version diff, review-gated export, bounded callbacks, keyboard, failed callback recovery, loading/empty/denied/error, no horizontal overflow or console/page errors",
      screenshots: output,
    }),
  );
} finally {
  await browser.close();
}
