const { createRequire } = require("node:module");
const {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { resolve, join } = require("node:path");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "../../../..");
const { chromium } = createRequire(join(root, "packages/docs/package.json"))("@playwright/test");
const { build } = createRequire(require.resolve("tsup"))("esbuild");

(async () => {
  const temporary = mkdtempSync(join(tmpdir(), "reminder-review-"));
  const evidence = process.env.REMINDER_REVIEW_EVIDENCE_DIR;
  if (evidence) mkdirSync(evidence, { recursive: true });
  const bundle = join(temporary, "fixture.js");
  const panel =
    process.argv[2] || join(root, "packages/admin-react/src/libs/ReminderOperationsPanel.tsx");
  await build({
    stdin: {
      contents: `import { mountReminderOperationsReviewFixture } from ${JSON.stringify(join(__dirname, "ReminderOperations.mounted.tsx"))}; mountReminderOperationsReviewFixture(document.getElementById('root'));`,
      resolveDir: root,
      loader: "tsx",
    },
    outfile: bundle,
    bundle: true,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    alias: { "@croco/admin-react": panel },
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const html = readFileSync(join(__dirname, "ReminderOperations.fixture.html"), "utf8").replace(
    "/dist/browser.global.js",
    "/fixture.js",
  );
  const server = createServer((request, response) => {
    response.setHeader(
      "Content-Type",
      request.url === "/fixture.js" ? "application/javascript" : "text/html",
    );
    response.end(request.url === "/fixture.js" ? readFileSync(bundle) : html);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    ...(evidence ? { recordVideo: { dir: temporary, size: { width: 1280, height: 1200 } } } : {}),
  });
  const page = await context.newPage();
  const errors = [],
    consoleErrors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  try {
    const origin =
      process.env.REMINDER_REVIEW_NATIVE_ORIGIN || `http://127.0.0.1:${server.address().port}`;
    if (process.env.REMINDER_REVIEW_NATIVE_ORIGIN) {
      await page.route(`${origin}/review-fixture`, (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.route(`${origin}/fixture.js`, (route) =>
        route.fulfill({ contentType: "application/javascript", body: readFileSync(bundle) }),
      );
    }
    await page.goto(`${origin}/review-fixture`);
    const region = page.getByRole("region", { name: "Reminder operations" });
    const first = region.locator("article").filter({ hasText: "Subject A" });
    const second = region.locator("article").filter({ hasText: "Subject B" });
    await second.waitFor();
    const third = region.locator("article").filter({ hasText: "Subject C" });
    const thirdHandle = await third.elementHandle();
    const firstHandle = await first.elementHandle();
    const secondHandle = await second.elementHandle();
    const snapshot = async (name) => {
      if (evidence) {
        await page.waitForTimeout(1000);
        await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: false });
      }
    };
    await snapshot("before-reorder");
    await page.getByRole("button", { name: "Reverse source row order" }).click();
    await region.getByRole("button", { name: "Reload operations" }).click();
    await page.waitForFunction(() =>
      document
        .querySelector('[aria-label="Reminder operations"] article')
        ?.textContent.includes("Subject C"),
    );
    const retainedThird = await third.evaluate(
      (element, original) => element === original,
      thirdHandle,
    );
    const retainedFirst = await first.evaluate(
      (element, original) => element === original,
      firstHandle,
    );
    const retainedSecond = await second.evaluate(
      (element, original) => element === original,
      secondHandle,
    );
    await snapshot("after-reorder");
    await page.getByRole("button", { name: "Revoke read permission" }).click();
    const commitResult = await page.getByLabel("Revocation commit result").innerText();
    await region.getByRole("alert").waitFor();
    await snapshot("permission-revoked");
    const proof = {
      route: page.url(),
      viewport: { width: 1280, height: 1200 },
      commitResult,
      retainedFirst,
      retainedSecond,
      retainedThird,
      rowsAfterRevocation: await region.locator("article").count(),
      reloadAfterRevocation: await region
        .getByRole("button", { name: "Reload operations" })
        .count(),
      errors,
      consoleErrors,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    };
    if (evidence) writeFileSync(join(evidence, "evidence.json"), JSON.stringify(proof, null, 2));
    process.stdout.write(JSON.stringify(proof) + "\n");
    assert.equal(retainedFirst, true, "Subject A must retain its article through reorder");
    assert.equal(retainedThird, true, "Same subject in a different tenant must retain its article");
    assert.equal(retainedSecond, true, "Subject B must retain its article through reorder");
    assert.match(
      commitResult,
      /^PASS:/,
      "Permission denial must hold in the commit before passive effects",
    );
    assert.equal(proof.rowsAfterRevocation, 0);
    assert.equal(proof.reloadAfterRevocation, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    assert.equal(proof.overflow, false);
  } finally {
    await context.close();
    if (evidence) renameSync(await page.video().path(), join(evidence, "review-fixes.webm"));
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
