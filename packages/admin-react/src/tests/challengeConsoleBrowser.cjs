const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { createServer } = require("node:http");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");

(async () => {
  const component = resolve(__dirname, "../libs/ChallengeConsole.tsx");
  const contents = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import {ChallengeConsole} from ${JSON.stringify(component)};
    const root=createRoot(document.getElementById('root'));
    const sources=new Map();
    window.saves=[]; window.loads=[]; window.pending=[];
    window.renderChallenge=(sourceId,tenant,goal=4,deferred=false,pendingEvidenceCount=0,challengeState="scheduled")=>{
      if(!sources.has(sourceId)) sources.set(sourceId,{
        load:()=>{window.loads.push(sourceId);return deferred?new Promise(resolve=>window.pending.push(resolve)):Promise.resolve(pendingEvidenceCount?{kind:'ready',view:{pendingEvidenceCount,challenge:{...initialDefinition,state:challengeState,progress:0,memberCount:0}}}:{kind:'empty'});},
        save:async request=>{window.saves.push({sourceId,request});return {kind:'empty'};},
        close:async()=>({kind:'empty'})
      });
      const initialDefinition={id:'cooperate',version:1,scope:{app:'app',environment:'test',tenantId:tenant},start:new Date('2030-01-01Z'),end:new Date('2030-02-01Z'),goal,memberCap:2,minMembers:2,lateAllowanceMs:1000,visibility:'aggregate',leavePolicy:'retain'};
      flushSync(()=>root.render(<ChallengeConsole scopeKey="unchanged" actor="operator" permissions={['challenge.read','challenge.write','challenge.close']} source={sources.get(sourceId)} initialDefinition={initialDefinition}/>));
      return document.querySelector('button[type="submit"]')?.disabled ?? true;
    };
    window.resolveLoads=()=>{for(const resolve of window.pending.splice(0))resolve({kind:'empty'});};
  `;
  const bundle = await build({
    stdin: { contents, resolveDir: resolve(__dirname, ".."), loader: "tsx" },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    alias: {
      "@croco/admin-core": resolve(
        __dirname,
        "../../../admin-core/src/libs/ChallengeOperations.ts",
      ),
    },
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const evidence = process.env.CHALLENGE_REVIEW_EVIDENCE_DIR;
  if (evidence) mkdirSync(evidence, { recursive: true });
  const server = createServer((request, response) => {
    response.setHeader(
      "Content-Type",
      request.url === "/fixture.js" ? "application/javascript" : "text/html",
    );
    response.end(
      request.url === "/fixture.js"
        ? bundle.outputFiles[0].text
        : '<div id="root"></div><script src="/fixture.js"></script>',
    );
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1100 },
    ...(evidence ? { recordVideo: { dir: evidence, size: { width: 1280, height: 1100 } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => window.renderChallenge("a", "tenant-a"));
    await page.getByRole("button", { name: "Create challenge" }).waitFor();
    await page.getByRole("spinbutton", { name: "Group goal" }).fill("99");
    await page.getByRole("textbox", { name: "Change reason" }).fill("Reviewed tenant A");
    assert.equal(
      await page.evaluate(() => window.renderChallenge("b", "tenant-b", 7, true)),
      true,
      "source transition must synchronously suppress stale submit",
    );
    assert.equal(await page.getByRole("button", { name: "Create challenge" }).count(), 0);
    await page.evaluate(() => window.resolveLoads());
    await page.getByText("app / test / tenant-b · cooperate", { exact: true }).waitFor();
    assert.equal(await page.getByRole("spinbutton", { name: "Group goal" }).inputValue(), "7");
    assert.equal(await page.getByRole("textbox", { name: "Change reason" }).inputValue(), "");
    await page.getByRole("textbox", { name: "Change reason" }).fill("Reviewed tenant B");
    await page.getByRole("button", { name: "Create challenge" }).click();
    const saved = await page.evaluate(() => window.saves);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].sourceId, "b");
    assert.equal(saved[0].request.definition.scope.tenantId, "tenant-b");
    assert.equal(saved[0].request.definition.goal, 7);
    await page.getByRole("spinbutton", { name: "Group goal" }).fill("88");
    await page.evaluate(() => window.renderChallenge("b", "tenant-c", 8, true));
    await page.evaluate(() => window.resolveLoads());
    await page.getByText("app / test / tenant-c · cooperate", { exact: true }).waitFor();
    assert.equal(await page.getByRole("spinbutton", { name: "Group goal" }).inputValue(), "8");
    const loads = await page.evaluate(() => window.loads.length);
    await page.getByRole("spinbutton", { name: "Group goal" }).fill("9");
    await page.evaluate(() => window.renderChallenge("b", "tenant-c", 8, true));
    assert.equal(
      await page.getByRole("spinbutton", { name: "Group goal" }).inputValue(),
      "9",
      "equal recreated definition preserves edits",
    );
    assert.equal(
      await page.evaluate(() => window.loads.length),
      loads,
      "equal recreated definition does not reload",
    );
    await page.evaluate(() =>
      window.renderChallenge("pending-policy", "tenant-pending", 4, false, 1),
    );
    await page.getByText(/evidence verification\(s\) unresolved/).waitFor();
    await page.getByRole("textbox", { name: "Change reason" }).fill("Reviewed pending evidence");
    assert.equal(await page.getByRole("button", { name: "Save policy" }).isEnabled(), false);
    await page.evaluate(() =>
      window.renderChallenge("pending-close", "tenant-pending", 4, false, 1, "closing"),
    );
    await page.getByText(/evidence verification\(s\) unresolved/).waitFor();
    await page.getByRole("textbox", { name: "Change reason" }).fill("Reviewed pending evidence");
    assert.equal(await page.getByRole("button", { name: "Finalize challenge" }).isEnabled(), false);
    assert.equal(await page.evaluate(() => window.saves.length), 1);
    assert.deepEqual(errors, []);
    if (evidence)
      await page.screenshot({ path: resolve(evidence, "source-transition.png"), fullPage: true });
    console.log(
      JSON.stringify({
        sourceTransition: "passed",
        definitionTransition: "passed",
        stableDefinition: "passed",
        errors,
      }),
    );
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
