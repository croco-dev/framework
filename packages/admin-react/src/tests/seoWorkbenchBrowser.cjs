const { createRequire } = require("node:module");
const { resolve, join } = require("node:path");
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
(async () => {
  const temp = mkdtempSync(join(tmpdir(), "seo-workbench-"));
  const evidenceDir = process.env.SEO_EVIDENCE_DIR || join(tmpdir(), "seo-2848-evidence");
  mkdirSync(evidenceDir, { recursive: true });
  let browser, server;
  try {
    const alias = {
      "@croco/admin-core": resolve(__dirname, "../../../admin-core/src/libs/SeoWorkbench.ts"),
      "@croco/metrics-core/runtime": resolve(__dirname, "../../../metrics-core/src/runtime.ts"),
      "@croco/metrics-core": resolve(__dirname, "../../../metrics-core/src/index.ts"),
    };
    const bundle = await build({
      entryPoints: [resolve(__dirname, "../../../../examples/seo-workbench/src/fixture.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
      alias,
    });
    const fixtureFile = join(temp, "fixture.cjs");
    writeFileSync(fixtureFile, bundle.outputFiles[0].text);
    const module = require(fixtureFile);
    const fixture = module.createSeoFixture();
    let nextState = "ready";
    let saved = false,
      exported = false;
    server = createServer(async (req, res) => {
      try {
        if (req.url === "/") {
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><main id="root"></main></body></html>',
          );
          return;
        }
        let text = "";
        for await (const chunk of req) text += chunk;
        const body = JSON.parse(text || "{}");
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/state") {
          nextState = body.kind;
          res.end("{}");
          return;
        }
        if (req.url === "/save") {
          await fixture.operations.save(
            "browser",
            body.definition,
            body.hash,
            "2026-10-21T00:00:00Z",
          );
          saved = true;
          res.end("{}");
          return;
        }
        if (req.url === "/export") {
          const out = await fixture.operations.export(body.definition, body.hash);
          assert(!out.includes("private=hidden"));
          exported = true;
          res.end(out);
          return;
        }
        const input = module.seoFixtureInput();
        fixture.setFailure(nextState === "error");
        fixture.setAccess({
          scope: module.seoScope,
          permissions: nextState === "denied" ? [] : ["seo.read", "seo.report", "seo.export"],
        });
        if (nextState === "partial") input.current.search.metadata.completeness = "partial";
        if (nextState === "missing-source") {
          for (const period of [input.baseline, input.current])
            for (const dataset of [period.search, period.landing]) {
              dataset.metadata.state = "unavailable";
              dataset.metadata.completeness = "partial";
              dataset.metadata.coverage = "returned-rows";
              dataset.rows = [];
            }
        }
        if (nextState === "empty") {
          input.current.search.rows = [];
          input.baseline.search.rows = [];
          input.current.landing.rows = [];
          input.baseline.landing.rows = [];
        }
        if (nextState === "many") {
          for (const period of [input.baseline, input.current]) {
            period.search.rows = Array.from({ length: 27 }, (_, index) => ({
              ...period.search.rows[0],
              page: `synthetic-page-${index}`,
            }));
            period.landing.rows = Array.from({ length: 27 }, (_, index) => ({
              ...period.landing.rows[0],
              page: `synthetic-page-${index}`,
            }));
          }
          input.mappings = Array.from({ length: 27 }, (_, index) => ({
            ...input.mappings[0],
            page: `synthetic-page-${index}`,
            pageId: `page-${String(index).padStart(2, "0")}`,
          }));
        }
        fixture.setInput(input);
        res.end(
          JSON.stringify(await fixture.operations.read(body.definition, body.offset, body.limit)),
        );
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const contents = `import React from 'react';import{createRoot}from'react-dom/client';import{SeoWorkbench}from ${JSON.stringify(resolve(__dirname, "../libs/SeoWorkbench.tsx"))};
    const definition=${JSON.stringify(module.seoDefinition)};const request=async(path,body,signal)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw new Error('Read failed');return r.json();};
    window.readRequests=[];window.renderedRevision=-1;
    function Committed({revision}){React.useEffect(()=>{window.renderedRevision=revision},[revision]);return null;}
    const root=createRoot(document.getElementById('root'));window.render=(scope,minImpressions=definition.minImpressions,revision=0)=>root.render(React.createElement(React.Fragment,null,React.createElement(SeoWorkbench,{scopeKey:scope,definition:{...definition,minImpressions},read:(definition,offset,limit,signal)=>{window.readRequests.push({definition,revision});return request('/read',{definition,offset,limit},signal)},onSave:(definition,hash,signal)=>request('/save',{definition,hash},signal),onExport:(definition,hash,signal)=>request('/export',{definition,hash},signal)}),React.createElement(Committed,{revision})));window.render('tenant-a');`;
    const ui = await build({
      stdin: { contents, resolveDir: resolve(__dirname, ".."), loader: "tsx" },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      define: { "process.env.NODE_ENV": '"development"' },
    });
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.addScriptTag({ content: ui.outputFiles[0].text });
    await page.getByText(/Population 2 · Included 2 · Excluded 0/).waitFor();
    await page.screenshot({ path: join(evidenceDir, "ready-desktop.png"), fullPage: true });
    await page.getByLabel("Minimum impressions", { exact: true }).fill("37");
    await page.getByRole("combobox", { name: "Candidate filter" }).selectOption("value-rate-down");
    await page.evaluate(() => window.render("tenant-a", undefined, 1));
    await page.waitForFunction(() => window.renderedRevision === 1);
    assert.equal(await page.getByLabel("Minimum impressions", { exact: true }).inputValue(), "37");
    assert.equal(
      await page.getByRole("combobox", { name: "Candidate filter" }).inputValue(),
      "value-rate-down",
    );
    assert.equal(await page.evaluate(() => window.readRequests.length), 1);
    await page.getByRole("button", { name: "Apply definition" }).click();
    await page.locator('[aria-label="SEO workbench"][aria-busy="false"]').waitFor();
    assert.deepEqual(
      await page.evaluate(() => {
        const last = window.readRequests.at(-1);
        return { minImpressions: last.definition.minImpressions, revision: last.revision };
      }),
      { minImpressions: 37, revision: 1 },
    );
    await page.evaluate(() => window.render("tenant-a", 150, 2));
    await page.waitForFunction(() => window.renderedRevision === 2);
    await page.locator('[aria-label="SEO workbench"][aria-busy="false"]').waitFor();
    await page.getByText(/Population 2 · Included 2 · Excluded 0/).waitFor();
    assert.equal(await page.getByLabel("Minimum impressions", { exact: true }).inputValue(), "150");
    assert.equal(await page.evaluate(() => window.readRequests.at(-1).revision), 2);
    await page.screenshot({ path: join(evidenceDir, "parent-rerender.png"), fullPage: true });
    await page.evaluate(() => window.render("after-parent-rerender"));
    await page.getByText(/Population 2 · Included 2 · Excluded 0/).waitFor();

    await page.getByText("Sources, denominators and assumptions", { exact: true }).click();
    await page
      .getByText(/Denominator: search impressions/)
      .first()
      .waitFor();
    await page.screenshot({ path: join(evidenceDir, "source-evidence.png"), fullPage: true });
    await page.getByText("Sources, denominators and assumptions", { exact: true }).click();
    await page.getByRole("button", { name: "start", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("region", { name: "Page detail", exact: true }).waitFor();
    await page.screenshot({ path: join(evidenceDir, "page-detail.png"), fullPage: true });
    assert.equal(
      await page
        .getByRole("heading", { name: "start", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Close page detail" }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "start", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page
      .getByRole("combobox", { name: "Candidate filter" })
      .selectOption("impressions-up-clicks-down");
    await page.getByLabel("Minimum click decline", { exact: true }).fill("0.6");
    await page.getByLabel("Minimum impression growth", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Apply definition" }).click();
    await page.getByText(/Population 2 · Included 0 · Excluded 2/).waitFor();
    await page.getByLabel("Baseline from (UTC)", { exact: true }).fill("2026-09-30T07:00");
    await page.getByLabel("Baseline to (UTC)", { exact: true }).fill("2026-10-01T07:00");
    await page.getByRole("button", { name: "Apply definition" }).focus();
    await page.keyboard.press("Enter");
    await page.getByText(/Population 2 · Included 1 · Excluded 1/).waitFor();
    const periodRow = page
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: "start", exact: true }) });
    assert.match(await periodRow.innerText(), /Clicks 30/);
    assert.match(await periodRow.innerText(), /Sessions 29/);
    await page.getByRole("button", { name: "Save report and definition" }).click();
    await page.getByRole("status").filter({ hasText: "Operation complete" }).waitFor();
    const periodSaved = [...fixture.records.values()].find((record) => record.id === "browser");
    assert.equal(periodSaved.report.definition.baselineWindow.from, "2026-09-30T07:00:00.000Z");
    assert.equal(periodSaved.report.rows[0].baseline.clicks, 30);
    await page.screenshot({ path: join(evidenceDir, "period-selected.png"), fullPage: true });
    await page.evaluate(() => window.render("default-after-period"));
    await page.getByText(/Population 2 · Included 2 · Excluded 0/).waitFor();
    await page
      .getByRole("combobox", { name: "Candidate filter" })
      .selectOption("impressions-up-clicks-down");
    await page.getByRole("button", { name: "Apply definition" }).focus();
    await page.keyboard.press("Enter");
    await page.getByText(/Population 2 · Included 1 · Excluded 1/).waitFor();
    assert.equal(await page.getByRole("button", { name: "docs", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Save report and definition" }).click();
    await page.getByRole("status").filter({ hasText: "Operation complete" }).waitFor();
    await page.getByRole("button", { name: "Export masked report" }).click();
    await page.getByRole("status").filter({ hasText: "Operation complete" }).waitFor();
    assert(saved && exported);
    await page.getByLabel("Minimum impressions", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Apply definition" }).click();
    await page.getByText(/Population 2 · Included 0 · Excluded 2/).waitFor();
    await page.getByText(/No pages match this definition/).waitFor();
    await page.screenshot({ path: join(evidenceDir, "filtered-empty.png"), fullPage: true });
    await page.request.post(`http://127.0.0.1:${server.address().port}/state`, {
      data: { kind: "many" },
    });
    await page.evaluate(() => window.render("pagination"));
    await page.getByText(/Population 27 · Included 27 · Excluded 0/).waitFor();
    await page.getByRole("button", { name: "Next page", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByText("26–27 of 27", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "page-00", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Previous page", exact: true }).click();
    await page.getByRole("button", { name: "page-00", exact: true }).waitFor();
    for (const kind of ["partial", "empty", "denied", "error"]) {
      await page.request.post(`http://127.0.0.1:${server.address().port}/state`, {
        data: { kind },
      });
      await page.evaluate((kind) => window.render(`tenant-a-${kind}`), kind);
      await page.locator(`[data-state="${kind}"]`).waitFor();
      if (kind === "denied" || kind === "error")
        assert.equal(await page.getByRole("table").count(), 0);
      await page.screenshot({ path: join(evidenceDir, `${kind}.png`), fullPage: true });
    }
    await page.request.post(`http://127.0.0.1:${server.address().port}/state`, {
      data: { kind: "missing-source" },
    });
    await page.evaluate(() => window.render("missing-source"));
    await page.locator('[data-state="partial"]').waitFor();
    await page
      .getByText(
        "No comparison rows are available. Review incomplete evidence, source coverage and exclusions.",
        { exact: true },
      )
      .waitFor();
    assert.equal(await page.getByRole("table").count(), 0);
    await page.screenshot({ path: join(evidenceDir, "partial-no-rows.png"), fullPage: true });
    await page.request.post(`http://127.0.0.1:${server.address().port}/state`, {
      data: { kind: "ready" },
    });
    await page.evaluate(() => window.render("mobile"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText(/Population 2 · Included 2 · Excluded 0/).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: join(evidenceDir, "ready-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ saved, exported, errors, overflow: false, evidenceDir }));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
    rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
