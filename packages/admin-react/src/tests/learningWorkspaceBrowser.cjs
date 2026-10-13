const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { mkdirSync } = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
const output = process.env.LEARNING_BROWSER_EVIDENCE_DIR || "/tmp/croco-learning-2825-browser";
mkdirSync(output, { recursive: true });

(async () => {
  const config = await (await fetch("http://127.0.0.1:4325/api/config")).json();
  const command = {
    record: { ...config.draft, question: "경계에서도 같은 기록" },
    expectedRevision: 0,
    reason: "Synthetic UTF-8 boundary",
    idempotencyKey: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify({ command }));
  const marker = encoded.indexOf(Buffer.from("경"));
  const post = (split) =>
    new Promise((resolveRequest, rejectRequest) => {
      const req = require("node:http").request(
        "http://127.0.0.1:4325/api/save",
        {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:4325",
            "Content-Type": "application/json",
            "Content-Length": encoded.length,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolveRequest({
              status: res.statusCode,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            }),
          );
        },
      );
      req.on("error", rejectRequest);
      req.write(encoded.subarray(0, split), () =>
        setImmediate(() => req.end(encoded.subarray(split))),
      );
    });
  const unicode = await post(marker + 1);
  assert.equal(unicode.status, 200);
  assert.equal(unicode.body.content.question, "경계에서도 같은 기록");
  const retried = await post(marker + 2);
  assert.equal(retried.status, 200);
  assert.equal(retried.body.revision, 1);
  assert.equal(retried.body.content.question, "경계에서도 같은 기록");
  const browser = await chromium.launch();
  const errors = [];
  const screenshots = [];
  const watch = (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  };
  const snapshot = async (page, name) => {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
      `${name}: horizontal overflow`,
    );
    const path = resolve(output, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    screenshots.push(path);
  };
  try {
    const first = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    watch(first);
    await first.goto("http://127.0.0.1:4325");
    await first.getByLabel("Decision", { exact: true }).fill("Roll out the UI");
    await first
      .getByLabel("Change reason", { exact: true })
      .fill("Record a deployment decision only");
    await first.getByRole("button", { name: "Save record", exact: true }).click();
    await first
      .getByText("Saved revision 1. No learning has been recorded.", { exact: true })
      .waitFor();
    const legend = await first.locator("legend").first().textContent();
    const id = legend.match(/^Record (.+) · revision 1$/)[1];
    const current = await first.evaluate(async (id) => {
      const response = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return response.json();
    }, id);
    const second = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(second);
    await second.route("**/api/config", (route) =>
      route.fulfill({
        json: {
          scope: current.scope,
          accessRevision: "synthetic-1",
          draft: { ...current.content, scope: current.scope, id, revision: 1 },
        },
      }),
    );
    await second.goto("http://127.0.0.1:4325");
    await second
      .getByLabel("Question", { exact: true })
      .fill("Local unsaved second-editor question");
    await first
      .getByLabel("Question", { exact: true })
      .fill("First editor saved a shorter checkout question");
    await first.getByLabel("Change reason", { exact: true }).fill("First editor update");
    await first.getByRole("button", { name: "Save record", exact: true }).click();
    await first
      .getByText("Saved revision 2. No learning has been recorded.", { exact: true })
      .waitFor();
    await second.getByLabel("Change reason", { exact: true }).fill("Second editor update");
    await second.getByRole("button", { name: "Save record", exact: true }).click();
    await second
      .getByRole("alert")
      .filter({ hasText: "learning-registry/revision-conflict" })
      .waitFor();
    assert.equal(
      await second.getByLabel("Question", { exact: true }).inputValue(),
      "Local unsaved second-editor question",
    );
    await second.getByRole("button", { name: "Load latest without replacing draft" }).click();
    await second.getByRole("heading", { name: "Latest revision 2", exact: true }).waitFor();
    assert.equal(
      await second.getByLabel("Question", { exact: true }).inputValue(),
      "Local unsaved second-editor question",
    );
    await snapshot(second, "conflict-mobile");
    await second.getByRole("button", { name: "Replace draft with latest" }).click();
    assert.equal(
      await second.getByLabel("Question", { exact: true }).inputValue(),
      "First editor saved a shorter checkout question",
    );
    await second.getByRole("button", { name: "Add hypothesis", exact: true }).click();
    await second
      .getByLabel("Hypothesis 1 text", { exact: true })
      .fill("The shorter checkout may help");
    await second.getByLabel("Hypothesis 1 state", { exact: true }).selectOption("inconclusive");
    await second.getByLabel("Change reason", { exact: true }).fill("Observation is inconclusive");
    await second.getByRole("button", { name: "Save record", exact: true }).click();
    await second.getByText("Saved revision 3. Learning is recorded.", { exact: true }).waitFor();
    assert.equal(
      await second.getByLabel("Hypothesis 1 limitations", { exact: true }).inputValue(),
      "",
    );
    await second.getByLabel("Question", { exact: true }).focus();
    await second.keyboard.press("Tab");
    assert.equal(
      await second
        .getByLabel("Desired outcome", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await second.getByRole("button", { name: "Read revision history", exact: true }).click();
    await second.getByLabel("Revision history", { exact: true }).waitFor();
    assert.equal(
      await second.getByLabel("Revision history", { exact: true }).locator("li").count(),
      3,
    );
    await second.getByRole("button", { name: "Search", exact: true }).click();
    await second.getByRole("button", { name: `Inspect ${id}`, exact: true }).waitFor();
    assert.equal(await second.getByRole("button", { name: /Create local experiment/ }).count(), 0);
    await second
      .getByRole("button", { name: "Export current authorized record", exact: true })
      .click();
    await second.getByLabel("Authorized export", { exact: true }).waitFor();
    const exported = JSON.parse(
      await second.getByLabel("Authorized export", { exact: true }).textContent(),
    );
    assert.equal(exported.content.hypotheses[0].state, "inconclusive");
    await snapshot(second, "ready-mobile");
    await snapshot(first, "ready-desktop");
    await second
      .getByLabel("Observed facts (one per line)", { exact: true })
      .fill("First observed fact");
    await second.getByLabel("Observed facts (one per line)", { exact: true }).focus();
    await second.keyboard.press("End");
    await second.keyboard.press("Enter");
    await second.keyboard.type("Second observed fact");
    assert.equal(
      await second.getByLabel("Observed facts (one per line)", { exact: true }).inputValue(),
      "First observed fact\nSecond observed fact",
    );
    const imported = {
      source: "synthetic-report",
      id: "checkout",
      version: "v1",
      observedWindow: { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" },
      snapshot: {
        schemaVersion: 1,
        metrics: [{ metricId: "conversion", value: 0.17, sampleSize: 81 }],
      },
    };
    await second
      .getByLabel("Import aggregate evidence JSON", { exact: true })
      .fill(JSON.stringify(imported));
    await second.getByRole("button", { name: "Import evidence into draft", exact: true }).click();
    await second.getByLabel("Change reason", { exact: true }).fill("Import a synthetic aggregate");
    await second.getByRole("button", { name: "Save record", exact: true }).click();
    await second.getByText("Saved revision 4. Learning is recorded.", { exact: true }).waitFor();
    await second
      .getByLabel("Current evidence availability", { exact: true })
      .getByText("synthetic-report / checkout / v1 · available", { exact: true })
      .waitFor();
    await second.getByLabel("Evidence 1 version", { exact: true }).fill("v0");
    await second
      .getByLabel("Change reason", { exact: true })
      .fill("Reference an older report version");
    await second.getByRole("button", { name: "Save record", exact: true }).click();
    await second.getByText("Saved revision 5. Learning is recorded.", { exact: true }).waitFor();
    await second
      .getByLabel("Current evidence availability", { exact: true })
      .getByText("synthetic-report / checkout / v0 · version-mismatch", { exact: true })
      .waitFor();
    await second
      .getByRole("button", { name: "Export current authorized record", exact: true })
      .click();
    await second.getByLabel("Authorized export", { exact: true }).waitFor();
    assert.equal(
      (await second.getByLabel("Authorized export", { exact: true }).textContent()).includes(
        "sampleSize",
      ),
      false,
    );
    await snapshot(second, "partial-evidence-mobile");

    await second.getByRole("button", { name: `Copy ${id} as new draft`, exact: true }).click();
    await second
      .getByRole("alert")
      .getByText("learning-registry/denied", { exact: true })
      .waitFor();
    assert.match(await second.locator("legend").first().textContent(), /revision 5$/);
    await second.getByLabel("Evidence 1 version", { exact: true }).fill("v1");
    await second
      .getByLabel("Change reason", { exact: true })
      .fill("Restore the current report version");
    await second.getByRole("button", { name: "Save record", exact: true }).click();
    await second.getByText("Saved revision 6. Learning is recorded.", { exact: true }).waitFor();
    await second.getByRole("button", { name: `Copy ${id} as new draft`, exact: true }).click();
    await second
      .getByRole("button", { name: "Read revision history", exact: true })
      .waitFor({ state: "visible" });
    await second
      .getByRole("button", { name: "Save record", exact: true })
      .waitFor({ state: "visible" });
    await second.waitForFunction(() =>
      document.querySelector("legend")?.textContent.endsWith("revision 0"),
    );
    assert.match(await second.locator("legend").first().textContent(), /revision 0$/);
    assert.equal(await second.getByLabel("Authorized export", { exact: true }).count(), 0);

    // State and privacy-epoch checks render the production component in an isolated browser fixture.
    const component = resolve(__dirname, "../libs/LearningWorkspace.ts");
    const contents = `import React from 'react';import{createRoot}from'react-dom/client';import{LearningWorkspace}from ${JSON.stringify(component)};const root=createRoot(document.getElementById('root'));const scope={appId:'app',environment:'test',tenantId:'one'};const draft={id:'draft',scope,revision:0,question:'Initial question',desiredOutcome:'',facts:[],hypotheses:[],evidenceRefs:[],nextActions:[],owner:'operator',status:'draft',tags:{action:[],target:[],metric:[]}};window.renderState=(kind,epoch='1')=>root.render(React.createElement(LearningWorkspace,{scope:window.reorderScope?{tenantId:scope.tenantId,environment:scope.environment,appId:scope.appId}:scope,accessRevision:epoch,state:kind==='ready'?{kind,draft}:{kind,message:'Access unavailable'},canWrite:true,canExport:true,onSave:async()=>{},onRead:async()=>{},onSearch:async()=>window.deferSearch?await new Promise(resolve=>{window.resolveSearch=resolve}):({rows:[],nextAfter:'page-cursor'}),onHistory:async()=>[],onExport:async()=>{},onCopyDraft:async()=>draft}));
window.renderRecords=(redacted=false)=>{
 window.historyCalls=[];window.savedCommands=[];
 const reference={source:'reports',id:'synthetic',version:'v1',observedWindow:{from:'2026-01-01T00:00:00Z',to:'2026-01-02T00:00:00Z'},url:'https://example.test/synthetic',snapshot:{schemaVersion:1,metrics:[{metricId:'conversion',value:0.1,sampleSize:10}]}};
 const a={...draft,id:'A',revision:30,question:'Question A',evidenceRefs:redacted?[reference]:[]};
 const b={...draft,id:'B',revision:40,question:'Question B'};
 const view=(record,partial=false)=>({id:record.id,scope,revision:record.revision,content:{...record,evidenceRefs:partial?[{source:'reports',id:'synthetic',version:'v1',observedWindow:reference.observedWindow}]:record.evidenceRefs},evidence:[],hasLearning:false,isComplete:!partial});
 root.render(React.createElement(LearningWorkspace,{scope,accessRevision:redacted?'redacted':'records',state:{kind:'ready',draft:a},canWrite:true,canExport:true,
 onSave:async command=>{window.savedCommands.push(command);return view({...command.record,revision:command.expectedRevision+1},redacted)},
 onRead:async id=>view(id==='A'?a:b,redacted),onSearch:async()=>({rows:[view(b)]}),
 onHistory:async(id,before)=>{window.historyCalls.push([id,before??null]);const record=id==='A'?a:b;return [{view:view({...record,revision:before?before-1:record.revision}),actor:'actor-'+id,reason:'reason-'+id,at:'2026-01-01'}]},
 onExport:async()=>view(a),onCopyDraft:async()=>a}));
};
`;
    const bundle = await build({
      stdin: { contents, resolveDir: resolve(__dirname, ".."), loader: "tsx" },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      define: { "process.env.NODE_ENV": '"development"' },
    });
    const states = await browser.newPage({ viewport: { width: 390, height: 844 } });
    watch(states);
    await states.route("**/fixture", (route) =>
      route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }),
    );
    await states.goto("http://127.0.0.1:4325/fixture");
    await states.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const kind of ["loading", "denied", "error", "ready"]) {
      await states.evaluate((kind) => window.renderState(kind), kind);
      if (kind === "ready") await states.getByLabel("Question", { exact: true }).waitFor();
      else await states.getByRole(kind === "loading" ? "status" : "alert").waitFor();
      await snapshot(states, `${kind}-state`);
    }
    await states.getByRole("button", { name: "Search", exact: true }).click();
    await states.getByRole("button", { name: "Next search page", exact: true }).waitFor();
    await states.getByLabel("Search text", { exact: true }).fill("A different search");
    assert.equal(
      await states.getByRole("button", { name: "Next search page", exact: true }).count(),
      0,
    );
    await states.evaluate(() => {
      window.deferSearch = true;
    });
    await states.getByRole("button", { name: "Search", exact: true }).click();
    await states.getByText("Working…", { exact: true }).waitFor();
    await states.getByLabel("Search text", { exact: true }).fill("Changed while loading");
    await states.evaluate(() =>
      window.resolveSearch({
        rows: [
          {
            id: "old",
            revision: 1,
            content: { question: "STALE_SEARCH_RESULT" },
            scope: { appId: "app", environment: "test", tenantId: "one" },
            evidence: [],
            hasLearning: false,
          },
        ],
        nextAfter: "stale-cursor",
      }),
    );
    await states.getByText("Working…", { exact: true }).waitFor({ state: "hidden" });
    assert.equal(await states.getByText("STALE_SEARCH_RESULT", { exact: true }).count(), 0);
    await states.getByLabel("Question", { exact: true }).fill("Old private draft");
    await states.evaluate(() => {
      window.reorderScope = true;
      window.renderState("ready");
    });
    assert.equal(
      await states.getByLabel("Question", { exact: true }).inputValue(),
      "Old private draft",
    );
    await states.evaluate(() => window.renderState("ready", "new-privacy-epoch"));
    await states.getByLabel("Question", { exact: true }).waitFor();
    assert.equal(
      await states.getByLabel("Question", { exact: true }).inputValue(),
      "Initial question",
    );
    // Different identities must never share history or its pagination cursor.
    await states.evaluate(() => window.renderRecords());
    await states.waitForFunction(
      () => document.querySelector("legend")?.textContent === "Record A · revision 30",
    );
    await states.getByRole("button", { name: "Read revision history", exact: true }).click();
    await states
      .getByLabel("Revision history", { exact: true })
      .locator("li")
      .filter({ hasText: "Revision 30 · actor-A · reason-A" })
      .waitFor();
    await states.getByRole("button", { name: "Search", exact: true }).click();
    await states.getByRole("button", { name: "Inspect B", exact: true }).click();
    await states.getByRole("button", { name: "Replace draft with latest", exact: true }).click();
    assert.equal(await states.getByLabel("Question", { exact: true }).inputValue(), "Question B");
    assert.equal(await states.getByLabel("Revision history", { exact: true }).count(), 0);
    assert.equal(
      await states.getByRole("button", { name: "Earlier revisions", exact: true }).count(),
      0,
    );
    await states.getByRole("button", { name: "Read revision history", exact: true }).click();
    await states
      .getByLabel("Revision history", { exact: true })
      .locator("li")
      .filter({ hasText: "Revision 40 · actor-B · reason-B" })
      .waitFor();
    await states.getByRole("button", { name: "Earlier revisions", exact: true }).click();
    await states
      .getByLabel("Revision history", { exact: true })
      .locator("li")
      .filter({ hasText: "Revision 39 · actor-B · reason-B" })
      .waitFor();
    assert.deepEqual(await states.evaluate(() => window.historyCalls), [
      ["A", null],
      ["B", null],
      ["B", 40],
    ]);
    // Source-redacted views cannot replace full documents; successful redacted responses keep submitted data.
    await states.evaluate(() => window.renderRecords(true));
    await states.waitForFunction(
      () => document.querySelector("legend")?.textContent === "Record A · revision 30",
    );
    await states
      .getByRole("button", { name: "Load latest without replacing draft", exact: true })
      .click();
    await states
      .getByText("Some stored content is unavailable. This view cannot replace the draft.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await states.getByRole("button", { name: "Replace draft with latest", exact: true }).count(),
      0,
    );
    await states.getByLabel("Question", { exact: true }).fill("Unrelated question edit");
    await states.getByLabel("Change reason", { exact: true }).fill("Keep stored evidence");
    await states.getByRole("button", { name: "Save record", exact: true }).click();
    await states
      .getByText("Saved revision 31. No learning has been recorded.", { exact: true })
      .waitFor();
    await states.getByLabel("Change reason", { exact: true }).fill("Retry another edit");
    await states.getByRole("button", { name: "Save record", exact: true }).click();
    await states
      .getByText("Saved revision 32. No learning has been recorded.", { exact: true })
      .waitFor();
    const commands = await states.evaluate(() => window.savedCommands);
    assert.deepEqual(
      commands.map((command) => command.expectedRevision),
      [30, 31],
    );
    for (const command of commands) {
      assert.equal(command.record.evidenceRefs[0].url, "https://example.test/synthetic");
      assert.equal(command.record.evidenceRefs[0].snapshot.metrics[0].sampleSize, 10);
    }
    await snapshot(states, "redacted-view-retained-draft");
    assert.deepEqual(errors, [
      "Failed to load resource: the server responded with a status of 409 (Conflict)",
      "Failed to load resource: the server responded with a status of 403 (Forbidden)",
    ]);
    console.log(
      JSON.stringify({
        assertions: [
          "decision-only is not learning",
          "two actual PostgreSQL editors conflict",
          "local draft retained alongside latest",
          "inconclusive without forced cause",
          "history/export/search/copy",
          "keyboard tab order",
          "privacy epoch clears drafts",
          "loading/denied/error/ready",
          "no unsupported experiment action",
          "no horizontal overflow",
        ],
        expectedConflictConsole: errors,
        unexpectedErrors: [],
        screenshots,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
