const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve, join } = require("node:path");
const { mkdir } = require("node:fs/promises");
const { chromium, expect } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");

(async () => {
  // In-memory callbacks only: this fixture has no billing provider or network backend.
  const bundle = await build({
    stdin: {
      contents: `
import {createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {CancellationFlow} from ${JSON.stringify(resolve(__dirname, "../libs/CancellationFlow.ts"))};
const root = createRoot(document.getElementById('root'));
let generation = 0;
window.mount = (mode, restriction = '') => {
  window.probe = {decisions: [], refreshes: 0, displays: 0};
  const identity = {appId:'app', environment:'test', tenantId:'tenant', subject:'member', subscriptionRef:'sub'};
  const session = {...identity, id:'session', revision:0, subscriptionRevision:'r1', quoteRef:'q1',
    policyVersion:1, state:'open', keepAvailable:true, createdAt:'2026-01-01T00:00:00Z', evidence:[],
    snapshot:{...identity, revision:'r1', status:'active', subscriptionStartedAt:'2025-01-01T00:00:00Z',
      billingPeriod:'renewal', quote:{ref:'q1', expiresAt:restriction === 'expired' ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
      amount:'1250', currency:'USD', refund:'partial'}},
    choices:[{id:'cancel', action:'cancel', available:restriction !== 'unavailable', label:'Cancel', consequence:'Access remains until period end.'},
      {id:'lower', action:'change-plan', available:true, label:'Lower plan', consequence:'Lower monthly charge.'}]};
  root.render(h(CancellationFlow, {key:++generation,
    state:{kind:restriction === 'conflict' ? 'conflict' : 'ready', session},
    onDisplayed:() => {window.probe.displays++; return mode === 'reject' ? Promise.reject(new Error('display failed')) : new Promise(r => {window.finishDisplay = r;});},
    onDecide:decision => {window.probe.decisions.push(decision); return restriction === 'command-pending' ? new Promise(r => {window.finishCommand=r;}) : restriction === 'command-unknown' ? Promise.reject(new Error('outcome unknown')) : Promise.resolve();},
    onRefresh:async() => {window.probe.refreshes++;}
  }));
};`,
      resolveDir: __dirname,
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("https://cancellation.test/", (route) =>
        route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }),
      );
      await page.goto("https://cancellation.test/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const cancel = page.getByRole("button", { name: "Confirm cancellation", exact: true });
      const refresh = page.getByRole("button", { name: "Refresh current state", exact: true });
      const offer = page.getByRole("button", { name: "Accept Lower plan", exact: true });
      const mount = async (mode, restriction = "") => {
        await page.evaluate(([m, r]) => window.mount(m, r), [mode, restriction]);
        await page.waitForFunction(() => window.probe.displays === 1);
        if (mode === "reject")
          await page
            .getByRole("alert")
            .filter({ hasText: "Offer display could not be recorded" })
            .waitFor();
      };
      for (const mode of ["reject", "hang"]) {
        await mount(mode);
        await expect(cancel).toBeEnabled();
        await expect(offer).toBeDisabled();
        await expect(refresh).toBeEnabled();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        if (process.env.CANCELLATION_SCREENSHOT_DIR) {
          await mkdir(process.env.CANCELLATION_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({
            path: join(process.env.CANCELLATION_SCREENSHOT_DIR, `${mode}-${viewport.width}.png`),
            fullPage: true,
          });
        }
        await cancel.click();
        await expect(cancel).toBeDisabled();
        assert.equal(await page.evaluate(() => window.probe.decisions.length), 1);
        assert.equal(await page.evaluate(() => window.probe.decisions[0].kind), "continue_cancel");
        if (mode === "hang") {
          await page.evaluate(() => window.finishDisplay());
          await page.getByText("Decision submitted.", { exact: false }).waitFor();
          assert.equal(await page.evaluate(() => window.probe.decisions.length), 1);
          await expect(cancel).toBeDisabled();
        }
        await mount(mode);
        await page.getByRole("button", { name: "Decline offers", exact: true }).click();
        await expect(page.getByRole("region", { name: "Optional retention choices" })).toHaveCount(
          0,
        );
        await expect(cancel).toBeFocused();
        await expect(cancel).toBeEnabled();
        assert.equal(await page.evaluate(() => window.probe.decisions.length), 0);
        await mount(mode);
        await refresh.click();
        assert.equal(await page.evaluate(() => window.probe.refreshes), 1);
        assert.equal(await page.evaluate(() => window.probe.decisions.length), 0);
      }
      for (const restriction of ["expired", "conflict", "unavailable"]) {
        await mount("hang", restriction);
        await expect(cancel).toBeDisabled();
        await expect(refresh).toBeEnabled();
        assert.equal(await page.evaluate(() => window.probe.decisions.length), 0);
      }
      for (const restriction of ["command-pending", "command-unknown"]) {
        await mount("hang", restriction);
        await cancel.click();
        await expect(cancel).toBeDisabled();
        if (restriction === "command-pending") await expect(refresh).toBeDisabled();
        else {
          await page.getByRole("alert").filter({ hasText: "No outcome was confirmed" }).waitFor();
          await expect(refresh).toBeEnabled();
        }
        await page.evaluate(() => window.finishDisplay());
        await expect(cancel).toBeDisabled();
        assert.equal(await page.evaluate(() => window.probe.decisions.length), 1);
      }
      await mount("hang");
      await page.evaluate(() => window.finishDisplay());
      await expect(offer).toBeEnabled();
      await offer.click();
      assert.equal(
        await page.evaluate(() => window.probe.decisions[0].kind),
        "accept_registered_offer",
      );
      assert.equal(await page.evaluate(() => window.probe.decisions[0].choiceId), "lower");
      assert.deepEqual(errors, []);
      results.push({ viewport, displayFailureIsolation: true, commandGuards: true, errors });
      await page.close();
    }
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
