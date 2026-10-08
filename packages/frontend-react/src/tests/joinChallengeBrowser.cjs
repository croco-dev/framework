const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
(async () => {
  const bundle = await build({
    stdin: {
      contents: `
 import React from 'react';import{createRoot}from'react-dom/client';import{JoinChallenge}from ${JSON.stringify(resolve(__dirname, "../libs/JoinChallenge.tsx"))};
 const root=createRoot(document.getElementById('root'));window.leaves=0;window.joins=0;
 window.mountChallenge=kind=>{
  const view={challenge:{id:'challenge',version:1,start:new Date('2026-01-01Z'),end:new Date('2030-01-01Z'),goal:4,memberCap:2,minMembers:2,lateAllowanceMs:0,visibility:'aggregate',leavePolicy:'retain',state:'active',progress:1,memberCount:1},self:{intervals:[{joinedAt:new Date('2026-02-01Z'),leftAt:null}]},selfProgress:1,pendingEvidenceCount:1};
  const source={load:async()=>({kind,view}),join:async()=>{window.joins++;return{kind,view}},leave:async()=>{window.leaves++;view.self.intervals[0].leftAt=new Date();return{kind,view}}};
  root.render(<JoinChallenge key={kind} scopeKey={kind} source={source}/>);
 };`,
      resolveDir: resolve(__dirname, ".."),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const server = createServer((req, res) => {
    res.setHeader(
      "Content-Type",
      req.url === "/fixture.js" ? "application/javascript" : "text/html",
    );
    res.end(
      req.url === "/fixture.js"
        ? bundle.outputFiles[0].text
        : '<div id="root"></div><script src="/fixture.js"></script>',
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const kind of ["ready", "partial"]) {
      await page.evaluate((kind) => window.mountChallenge(kind), kind);
      const leave = page.getByRole("button", { name: "Leave challenge", exact: true });
      await leave.waitFor();
      assert.equal(await leave.isEnabled(), true);
      await leave.click();
      const join = page.getByRole("button", { name: "Join challenge", exact: true });
      await join.waitFor();
      assert.equal(await join.isEnabled(), false);
    }
    assert.equal(await page.evaluate(() => window.leaves), 2);
    assert.equal(await page.evaluate(() => window.joins), 0);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        pendingEvidenceWithdrawal: "ready and partial passed",
        newJoins: "blocked",
        errors,
      }),
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
