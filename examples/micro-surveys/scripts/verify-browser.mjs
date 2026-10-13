import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyModalLifecycle } from "./verify-modal-lifecycle.mjs";
const requireDocs = createRequire(new URL("../../../packages/docs/package.json", import.meta.url));
const { chromium } = requireDocs("@playwright/test");
const origin = process.env.RESEARCH_BROWSER_ORIGIN ?? "http://127.0.0.1:4321";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error("Only a loopback synthetic example may be exercised");
const out = process.env.RESEARCH_BROWSER_EVIDENCE ?? join(tmpdir(), "croco-2819-browser");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const evidence = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const api = async (path, input, role = "operator") => {
  const result = await page.request.post(`${origin}${path}`, {
    headers: { "x-demo-role": role },
    data: input,
  });
  assert.equal(result.status(), 200, await result.text());
  return result.json();
};
const counters = () => api("/api/results", { denominator: "invitation" });
async function screen(name) {
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  evidence.push({
    name,
    path,
    viewport: page.viewportSize(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  });
  assert.equal(evidence[evidence.length - 1].overflow, false);
}
try {
  await page.goto(origin);
  await page.getByRole("heading", { name: "Survey editor", exact: true }).waitFor();
  const before = await counters();
  assert.equal(before.invitations, 0, "Fresh disposable demo required");
  await page.getByRole("button", { name: "Toggle standalone preview" }).click();
  const preview = page.getByRole("region", { name: "How was your first report?" });
  await preview.getByLabel("Useful", { exact: true }).check();
  await preview.getByLabel("Satisfaction").selectOption("4");
  await preview.getByRole("button", { name: "Submit response" }).click();
  await preview.getByText("Preview complete — no response stored.").waitFor();
  assert.deepEqual(await counters(), before);
  await page.getByRole("button", { name: "Toggle standalone preview" }).click();
  let releaseInvitation;
  let enteredInvitation;
  const invitationEntered = new Promise((resolve) => {
    enteredInvitation = resolve;
  });
  const invitationBlocked = new Promise((resolve) => {
    releaseInvitation = resolve;
  });
  await page.route("**/api/invitation", async (route) => {
    enteredInvitation();
    await invitationBlocked;
    await route.continue();
  });
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await invitationEntered;
  await page.getByText(/^Report saved:/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Save report", exact: true }).isEnabled(),
    true,
  );
  assert.equal((await counters()).invitations, 0);
  const releasedInvitation = page.waitForResponse((res) => res.url().endsWith("/api/invitation"));
  releaseInvitation();
  await releasedInvitation;
  await page.unroute("**/api/invitation");
  const card = page.getByRole("region", { name: "How was your first report?" });
  await card.getByRole("button", { name: "Skip survey" }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("Survey skipped. Your product action is complete.").waitFor();
  const skipped = await counters();
  assert.equal(skipped.invitations, 1);
  assert.equal(skipped.exposures, 1);
  assert.equal(skipped.dismissed, 1);
  assert.equal(skipped.submitted, 0);
  await screen("desktop-skipped");
  await page.getByLabel("Use survey modal").check();
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)),
    true,
  );
  await dialog.getByLabel("Unclear", { exact: true }).check();
  await dialog.getByLabel("Satisfaction").selectOption("2");
  assert.equal(
    await dialog
      .getByLabel("Optional comment (avoid personal information)")
      .evaluate((element) => element.maxLength),
    200,
  );
  await dialog
    .getByLabel("Optional comment (avoid personal information)")
    .fill("<script>alert(1)</script> =1+2");
  await screen("desktop-modal");
  await dialog.getByRole("button", { name: "Submit response" }).focus();
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", { name: "Save report", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
    "Modal restores product focus",
  );
  const submitted = await counters();
  assert.equal(submitted.invitations, 2);
  assert.equal(submitted.exposures, 2);
  assert.equal(submitted.submitted, 1);
  assert.equal(submitted.dismissed, 1);
  assert.equal(submitted.unanswered, 0);
  const raw = await api("/api/raw", {});
  assert.equal(raw.length, 1);
  assert.equal(raw[0].answers.comment, "<script>alert(1)</script> =1+2");
  assert.equal(await page.locator("script").count(), 1, "Raw text must not create script elements");
  const response = page.getByRole("article", { name: "Response revision 1" });
  await response.getByLabel("Operation reason").fill("Synthetic human review");
  await response.getByLabel("Human classification", { exact: true }).fill("Usability feedback");
  await response.getByRole("button", { name: "Save classification" }).click();
  await page.getByText("Human classification: Usability feedback").waitFor();
  assert.equal((await api("/api/raw", {}))[0].answers.comment, raw[0].answers.comment);
  await page.getByLabel("Response-rate denominator").selectOption("exposure");
  await screen("desktop-results");
  // A version edit keeps frequency history; no third invitation is created.
  const definition = JSON.parse(
    await page.getByLabel("Survey definition", { exact: true }).inputValue(),
  );
  definition.version = "v2";
  definition.questions[0].options = [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
  ];
  await page
    .getByLabel("Survey definition", { exact: true })
    .fill(JSON.stringify(definition, null, 2));
  await page.getByLabel("Publication reason").fill("Synthetic version two");
  await page.getByRole("button", { name: "Publish survey", exact: true }).click();
  await page.getByText("Current publication revision: 2").waitFor();
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await page.getByText(/^Report saved:/).waitFor();
  assert.equal((await counters()).invitations, 2);
  for (const state of ["loading", "empty", "partial", "denied", "error", "ready"]) {
    await page.getByLabel("Demonstrate result state").selectOption(state);
    await screen(`state-${state}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await screen("mobile-results");
  const current = page.getByRole("article", { name: "Response revision 2" });
  await current.getByLabel("Operation reason").fill("Synthetic erasure request");
  await current.getByRole("button", { name: "Delete raw response" }).click();
  await page.getByText("Raw response deleted or retention expired.").waitFor();
  assert.deepEqual((await api("/api/raw", {}))[0].answers, {});
  assert.equal((await counters()).submitted, 1);
  await screen("mobile-deleted");
  const denied = await page.request.post(`${origin}/api/raw`, {
    headers: { "x-demo-role": "customer" },
    data: {},
  });
  assert.equal(denied.status(), 403);
  // A delayed acknowledgement for a closed modal must not close a newer invitation.
  const lifecycleDefinition = JSON.parse(
    await page.getByLabel("Survey definition", { exact: true }).inputValue(),
  );
  lifecycleDefinition.version = "v3";
  lifecycleDefinition.frequencyPolicy.maxInvitations = 4;
  await page
    .getByLabel("Survey definition", { exact: true })
    .fill(JSON.stringify(lifecycleDefinition, null, 2));
  await page.getByLabel("Publication reason").fill("Synthetic lifecycle verification");
  await page.getByRole("button", { name: "Publish survey", exact: true }).click();
  await page.getByText("Current publication revision: 3").waitFor();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  const pendingDialog = page.getByRole("dialog");
  await pendingDialog.waitFor();
  await pendingDialog.getByLabel("Yes", { exact: true }).check();
  await pendingDialog.getByLabel("Satisfaction").selectOption("3");
  let unblock;
  let markEntered;
  const entered = new Promise((resolve) => {
    markEntered = resolve;
  });
  const blocked = new Promise((resolve) => {
    unblock = resolve;
  });
  await page.route("**/api/submit", async (route) => {
    markEntered();
    await blocked;
    await route.continue();
  });
  await pendingDialog.getByRole("button", { name: "Submit response" }).click();
  await entered;
  await pendingDialog.getByRole("button", { name: "Return to product" }).click();
  await pendingDialog.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  const newer = page.getByRole("dialog");
  await newer.waitFor();
  const acknowledgement = page.waitForResponse(
    (res) => res.url().endsWith("/api/submit") && res.status() === 200,
  );
  unblock();
  await acknowledgement;
  await page.waitForResponse((res) => res.url().endsWith("/api/raw") && res.status() === 200);
  await page.waitForFunction(() => document.querySelector("dialog")?.open === true);
  assert.equal(await newer.getByLabel("Satisfaction").inputValue(), "");
  assert.equal(
    await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)),
    true,
  );
  await screen("newer-invitation-after-late-acknowledgement");
  await newer.getByRole("button", { name: "Skip survey" }).click();
  await newer.waitFor({ state: "detached" });
  await page.unroute("**/api/submit");
  // Out-of-order result requests must keep the user's latest denominator.
  const raceDefinition = JSON.parse(
    await page.getByLabel("Survey definition", { exact: true }).inputValue(),
  );
  raceDefinition.version = "v4";
  raceDefinition.frequencyPolicy.maxInvitations = 5;
  await page
    .getByLabel("Survey definition", { exact: true })
    .fill(JSON.stringify(raceDefinition, null, 2));
  await page.getByLabel("Publication reason").fill("Synthetic denominator race verification");
  await page.getByRole("button", { name: "Publish survey", exact: true }).click();
  await page.getByText("Current publication revision: 4").waitFor();
  const unexposedReport = await api("/api/report", { name: "Unexposed invitation" }, "customer");
  await api("/api/invitation", { reportId: unexposedReport.reportId }, "customer");
  const expected = await counters();
  assert.notEqual(expected.invitations, expected.exposures);
  let releaseResults;
  let enteredResults;
  const resultsEntered = new Promise((resolve) => {
    enteredResults = resolve;
  });
  const resultsBlocked = new Promise((resolve) => {
    releaseResults = resolve;
  });
  await page.route("**/api/results", async (route) => {
    if (route.request().postDataJSON().denominator === "invitation") {
      enteredResults();
      await resultsBlocked;
    }
    await route.continue();
  });
  await page.getByLabel("Response-rate denominator").selectOption("invitation");
  await resultsEntered;
  const newestResult = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/results") && res.request().postDataJSON().denominator === "exposure",
  );
  await page.getByLabel("Response-rate denominator").selectOption("exposure");
  await newestResult;
  const oldResult = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/results") &&
      res.request().postDataJSON().denominator === "invitation",
  );
  releaseResults();
  await oldResult;
  await page.waitForTimeout(200);
  assert.equal(await page.getByLabel("Response-rate denominator").inputValue(), "exposure");
  assert.equal(
    await page
      .getByText("Selected denominator", { exact: true })
      .evaluate((el) => Number(el.nextElementSibling.textContent)),
    expected.exposures,
  );
  await screen("latest-denominator-after-delayed-results");
  await page.unroute("**/api/results");
  assert.deepEqual(errors, []);
  await verifyModalLifecycle(browser, out);
  await writeFile(
    join(out, "evidence.json"),
    JSON.stringify(
      {
        origin,
        evidence,
        errors,
        assertions: [
          "preview isolation",
          "same-mounted modal identity replacement isolates late submit and dismiss",
          "product acknowledged before stalled optional invitation",
          "out-of-order results preserve latest denominator",
          "late acknowledgement cannot close newer invitation",
          "skip does not block completed product action",
          "actual exposure",
          "submit keyboard flow",
          "modal focus containment",
          "cross-version frequency",
          "raw text escape",
          "human classification separation",
          "deletion preserves denominator",
          "raw permission",
          "responsive overflow",
          "all result states",
        ],
      },
      null,
      2,
    ),
  );
  process.stdout.write(`Browser evidence: ${out}\n`);
} finally {
  await browser.close();
}
