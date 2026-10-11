const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
(async () => {
  const component = resolve(__dirname, "../libs/SavedIntentConsole.ts");
  const contents = `import React from 'react';import{createRoot}from'react-dom/client';import{SavedIntentConsole}from ${JSON.stringify(component)};const root=createRoot(document.getElementById('root'));window.renderTenant=(tenant)=>root.render(React.createElement(SavedIntentConsole,{state:{kind:'ready',policies:[{scope:{appId:'app',environment:'test',tenantId:tenant},resourceType:'report',displayLimit:5,retentionDays:30,excludeCompleted:true,revision:1,actorId:'operator',reason:'test',updatedAt:'2026-10-05T00:00:00Z'}]},canWrite:false,targets:[{id:'current-customer',label:'Customer'}],onSave:async()=>{},onInspect:async()=>({rows:[],exclusions:[{intentId:'tenant-a-private-intent',resourceType:'report',reason:'removed'}]}),onReload:()=>{}}));`;
  const bundle = await build({
    stdin: { contents, resolveDir: resolve(__dirname, ".."), loader: "tsx" },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => window.renderTenant("tenant-a"));
    await page.getByRole("button", { name: "Inspect", exact: true }).click();
    await page.getByText("report · tenant-a-private-intent · removed", { exact: true }).waitFor();
    await page.evaluate(() => window.renderTenant("tenant-b"));
    await page.getByText("app / test / tenant-b", { exact: true }).waitFor();
    const stale = await page
      .getByText("report · tenant-a-private-intent · removed", { exact: true })
      .count();
    assert.equal(stale, 0, "Previous tenant inspection must be discarded");
    console.log(JSON.stringify({ newScope: "tenant-b", oldScopeExclusionsVisible: stale }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
