const { createRequire } = require("node:module");
const { resolve, join } = require("node:path");
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
(async () => {
  const temp = mkdtempSync(join(tmpdir(), "research-browser-"));
  const evidenceDir = process.env.RESEARCH_EVIDENCE_DIR || join(tmpdir(), "research-2820-evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const serverBundle = await build({
    entryPoints: [resolve(__dirname, "../../../../examples/research-recruitment/src/fixture.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    alias: {
      "@croco/admin-core": resolve(__dirname, "../../../admin-core/src/libs/ResearchOperations.ts"),
      "@croco/research-core": resolve(__dirname, "../../../research-core/src/index.ts"),
    },
  });
  const fixturePath = join(temp, "fixture.cjs");
  writeFileSync(fixturePath, serverBundle.outputFiles[0].text);
  const fixture = await require(fixturePath).createRecruitmentFixture();
  const { scope, access, definition, operations } = fixture;
  const emptyFixture = await require(fixturePath).createRecruitmentFixture(false);
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="root"></main></body></html>',
        );
        return;
      }
      let text = "";
      for await (const chunk of req) text += chunk;
      const body = text ? JSON.parse(text) : {};
      if (req.url === "/fail") fixture.failNextDispatch();
      if (req.url === "/empty") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify(
            await emptyFixture.operations.read(
              emptyFixture.scope,
              emptyFixture.definition.id,
              emptyFixture.access,
            ),
          ),
        );
        return;
      }
      if (req.url === "/action")
        await operations.execute(scope, definition.id, body.action, body.command, access);
      const page = await operations.read(scope, definition.id, access, body.offset || 0, 4);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(page));
    } catch (error) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const component = resolve(__dirname, "../libs/ResearchRecruitmentConsole.ts");
  const contents = `import React from 'react';import{createRoot}from'react-dom/client';import{ResearchRecruitmentConsole}from ${JSON.stringify(component)};const root=createRoot(document.getElementById('root'));let current;const request=async(path,body={})=>{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;};const render=(state)=>root.render(React.createElement(ResearchRecruitmentConsole,{state,canWrite:true,canConfirmParticipation:true,canWriteNotes:true,onAction:async(action,command)=>{current=await request('/action',{action,command});return current;},onPage:async(offset)=>request('/page',{offset}),onReload:async()=>{current=await request('/page');render({kind:'ready',page:current});}}));window.renderEmpty=async()=>render({kind:'ready',page:await request('/empty')});window.renderState=(kind)=>render(kind==='ready'?{kind,page:current}:{kind,message:kind==='denied'?'Permission denied':'Provider unavailable'});(async()=>{current=await request('/page');render({kind:'ready',page:current});})();`;
  const bundle = await build({
    stdin: { contents, resolveDir: resolve(__dirname, ".."), loader: "tsx" },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: "es2022",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const browser = await chromium.launch();
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("400 (Bad Request)"))
        errors.push(message.text());
    });
    await page.goto(url);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.getByRole("heading", { name: "Research recruitment", exact: true }).waitFor();
    await page.getByLabel("Audit reason", { exact: true }).fill("Synthetic verified recruitment");
    await page.getByRole("button", { name: "Select replacement candidates", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByText("Operation saved", { exact: true }).waitFor();
    const selectedLocator = page
      .getByRole("region", { name: /^Candidate / })
      .filter({ has: page.getByText(/ · selected · eligible$/) })
      .first();
    const selectedName = await selectedLocator.getAttribute("aria-label");
    const selected = page.getByRole("region", { name: selectedName, exact: true });
    await selected.getByRole("button", { name: "Invite", exact: true }).click();
    await selected.getByText(/ · invited · eligible$/).waitFor();
    await selected
      .getByRole("button", { name: "Record participation consent", exact: true })
      .click();
    await selected.getByText(/Participation consent yes/).waitFor();
    await selected.getByRole("button", { name: "Accept", exact: true }).click();
    await selected.getByText(/ · accepted · eligible$/).waitFor();
    const group = page.getByRole("region", { name: "Group achieved", exact: true });
    await group.getByText(/Accepted 1 · Participated 0/).waitFor();
    await selected
      .getByRole("button", { name: "Confirm actual participation", exact: true })
      .click();
    await selected.getByText(/ · participated · eligible$/).waitFor();
    await group.getByText(/Accepted 1 · Participated 1/).waitFor();
    await selected.getByRole("textbox", { name: /^Note for / }).fill("Private synthetic note");
    await selected.getByRole("button", { name: "Save private note", exact: true }).click();
    await selected.getByText("Private note: Private synthetic note", { exact: true }).waitFor();
    await selected.getByRole("button", { name: "Delete private note", exact: true }).click();
    await page
      .getByText("Private note: Private synthetic note", { exact: true })
      .waitFor({ state: "hidden" });
    const another = page
      .getByRole("region", { name: /^Candidate / })
      .filter({ has: page.getByText(/ · selected · eligible$/) })
      .first();
    await another.getByRole("button", { name: "Decline", exact: true }).click();
    await page
      .getByText(/Shortage 1/)
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Select replacement candidates", exact: true }).click();
    await group.getByText(/Held 2 · Shortage 0/).waitFor();
    assert.equal(fixture.dispatchCount(), 1);
    await page.screenshot({ path: join(evidenceDir, "ready-desktop.png"), fullPage: true });
    const unknownLocator = page
      .getByRole("region", { name: /^Candidate / })
      .filter({ has: page.getByText(/ · selected · eligible$/) })
      .first();
    const unknownName = await unknownLocator.getAttribute("aria-label");
    const unknownRegion = page.getByRole("region", { name: unknownName, exact: true });
    await page.request.post(url + "/fail");
    await unknownRegion.getByRole("button", { name: "Invite", exact: true }).click();
    await page.getByText(/Dispatch acceptance is unknown/).waitFor();
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await unknownRegion.getByText(/ · unknown · eligible$/).waitFor();
    await page
      .getByText(/Unknown 1 · Held 2 · Shortage 0/)
      .first()
      .waitFor();
    await page.screenshot({ path: join(evidenceDir, "partial-unknown.png"), fullPage: true });
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page.getByRole("heading", { name: "comparison-0", exact: true }).waitFor();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page.getByRole("heading", { name: "incomplete-observation", exact: true }).waitFor();
    await page.getByText(/observation-incomplete/).waitFor();
    assert.equal(await page.getByRole("button", { name: "Next page", exact: true }).count(), 0);
    await page.evaluate(() => window.renderEmpty());
    await page.getByText("No candidates imported", { exact: true }).waitFor();
    await page.screenshot({ path: join(evidenceDir, "empty.png"), fullPage: true });
    for (const kind of ["loading", "denied", "error"]) {
      await page.evaluate((value) => window.renderState(value), kind);
      await page
        .getByText(
          kind === "loading"
            ? "Loading research recruitment…"
            : kind === "denied"
              ? "Permission denied"
              : "Provider unavailable",
          { exact: true },
        )
        .waitFor();
      assert.equal(await page.getByRole("button", { name: "Invite", exact: true }).count(), 0);
      await page.screenshot({ path: join(evidenceDir, `${kind}.png`), fullPage: true });
    }
    await page.evaluate(() => window.renderState("ready"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText(/Accepted 1 · Participated 1/).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: join(evidenceDir, "ready-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        dispatchCount: fixture.dispatchCount(),
        participated: 1,
        errors,
        overflow: false,
        evidenceDir,
      }),
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
