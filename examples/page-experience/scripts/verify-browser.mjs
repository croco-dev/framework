import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
const directory = fileURLToPath(new URL("../", import.meta.url));
const requireDocs = createRequire(resolve(directory, "../../packages/docs/package.json"));
const { chromium, expect } = requireDocs("@playwright/test");
const server = spawn("pnpm", ["dev"], {
  cwd: directory,
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let browser;
let logs = "";
try {
  const origin = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`Fixture did not start: ${logs}`)), 60000);
    const read = (chunk) => {
      logs += chunk.toString();
      const match = logs.match(/Page experience: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolveReady(match[1]);
      }
    };
    server.stdout.on("data", read);
    server.stderr.on("data", read);
    server.once("error", reject);
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Fixture exited ${code}: ${logs}`));
    });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const prefetch = await page.request.get(origin);
  expect(prefetch.headers()["x-page-experience-queued"]).toBe("0");
  expect(await prefetch.text()).toContain("Product preview");
  await page.goto(origin);
  await expect(page.getByRole("heading", { name: "Page experience", exact: true })).toBeVisible();
  await expect(page.getByText("2 / 3 · 66.7%", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 3 · 33.3%", { exact: true })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "GA4 session engagement" })).toBeVisible();
  await expect(page.getByText(/GA4 bounce: 3 \/ 10 · 30.0%/)).toBeVisible();
  await page.getByRole("button", { name: "Preview product" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.pageExperienceFixture.observations.filter((r) => r.kind === "view").length,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.pageExperienceFixture.observations.filter((r) => r.kind === "content").length,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Next product" }).click();
  await page.getByRole("button", { name: "Preview product" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.pageExperienceFixture.observations.filter((r) => r.kind === "view").length,
      ),
    )
    .toBe(2);
  expect(
    await page.evaluate(
      () =>
        new Set(
          window.pageExperienceFixture.observations
            .filter((r) => r.kind === "view")
            .map((r) => r.pageInstance),
        ).size,
    ),
  ).toBe(2);
  await page.getByRole("button", { name: "Refresh report" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("2 / 3 · 66.7%", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh report" })).toBeFocused();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: resolve(tmpdir(), `croco-2850-ready-${viewport.width}.png`),
      fullPage: true,
    });
    await page.getByRole("combobox", { name: "Fixture state" }).selectOption("partial");
    await expect(page.getByText(/Partial observation/)).toBeVisible();
    await expect(page.getByText("0 / 3 · Unknown · 1 unobserved", { exact: true })).toBeVisible();
    await page.screenshot({
      path: resolve(tmpdir(), `croco-2850-partial-${viewport.width}.png`),
      fullPage: true,
    });
    for (const mode of ["empty", "loading", "denied", "error", "unavailable"]) {
      await page.getByRole("combobox", { name: "Fixture state" }).selectOption(mode);
      if (mode === "loading")
        await expect(page.getByRole("button", { name: "Refresh report" })).toBeDisabled();
      else await expect(page.getByRole("button", { name: "Refresh report" })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole("combobox", { name: "Fixture state" }).selectOption("ready");
    await expect(page.getByText("2 / 3 · 66.7%", { exact: true })).toBeVisible();
  }
  const requestsPage = await browser.newPage();
  const requestErrors = [];
  requestsPage.on("pageerror", (error) => requestErrors.push(error.message));
  await requestsPage.goto(origin);
  await expect(requestsPage.getByText("2 / 3 · 66.7%", { exact: true })).toBeVisible();
  let release;
  let intercepted;
  const started = new Promise((resolveStarted) => {
    intercepted = resolveStarted;
  });
  const held = new Promise((resolveHeld) => {
    release = resolveHeld;
  });
  await requestsPage.route("**/report?mode=ready", async (route) => {
    const response = await route.fetch();
    intercepted();
    await held;
    await route.fulfill({ response });
  });
  await requestsPage.getByRole("button", { name: "Refresh report" }).click();
  await started;
  await requestsPage.getByRole("combobox", { name: "Fixture state" }).selectOption("partial");
  await expect(requestsPage.getByText(/Partial observation/)).toBeVisible();
  const oldResponse = requestsPage.waitForResponse((response) =>
    response.url().endsWith("/report?mode=ready"),
  );
  release();
  await (await oldResponse).finished();
  await requestsPage.evaluate(
    () =>
      new Promise((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
      ),
  );
  await expect(requestsPage.getByText(/Partial observation/)).toBeVisible();
  await requestsPage.getByRole("button", { name: "Refresh report" }).click();
  await expect(requestsPage.getByText(/Partial observation/)).toBeVisible();
  await requestsPage.route("**/report?mode=partial", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await requestsPage.getByRole("button", { name: "Refresh report" }).click();
  await expect(
    requestsPage.getByText("Source failed. No report is available.", { exact: true }),
  ).toBeVisible();
  await expect(requestsPage.getByRole("button", { name: "Refresh report" })).toBeEnabled();
  await requestsPage.unroute("**/report?mode=partial");
  await requestsPage.getByRole("button", { name: "Refresh report" }).click();
  await expect(requestsPage.getByText(/Partial observation/)).toBeVisible();
  expect(requestErrors).toEqual([]);
  await requestsPage.close();
  expect(errors).toEqual([]);
  console.log(
    "Page experience: SSR/prefetch zero views, hydration/StrictMode uniqueness, SPA navigation identity, registered counts, keyboard refresh, seven states, stale-response rejection, selected-mode refresh, HTTP failure/recovery, desktop/mobile overflow and console checks passed. Screenshots are in the OS temporary directory: croco-2850-{ready,partial}-{1440,390}.png",
  );
} finally {
  await browser?.close();
  if (server.pid) process.kill(-server.pid, "SIGTERM");
}
