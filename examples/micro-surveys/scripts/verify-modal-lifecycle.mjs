import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const requireExample = createRequire(new URL("../package.json", import.meta.url));
const requireTsup = createRequire(requireExample.resolve("tsup"));
const { build } = requireTsup("esbuild");
const requireDocs = createRequire(new URL("../../../packages/docs/package.json", import.meta.url));
const { chromium } = requireDocs("@playwright/test");

export async function verifyModalLifecycle(browser, out) {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL("..", import.meta.url)),
      sourcefile: "modal-lifecycle-fixture.js",
      contents: `
        import { createElement as h } from 'react';
        import { createRoot } from 'react-dom/client';
        import { SurveyModal } from '@croco/frontend-react/surveys';
        const root = createRoot(document.getElementById('app'));
        const definition = { id:'lifecycle', version:'v1', title:'Survey',
          startsAt:'2026-01-01T00:00:00Z', endsAt:'2027-01-01T00:00:00Z',
          eligibility:'everyone', trigger:'manual', frequencyPolicy:{maxInvitations:2,windowMs:86400000},
          retentionMs:86400000, allowEdits:false,
          questions:[{id:'choice',title:'Choice',kind:'single',required:true,
            options:[{id:'useful',label:'Useful'},{id:'unclear',label:'Unclear'}]}] };
        window.closedInvitations = [];
        window.renderInvitation = identity => root.render(h(SurveyModal, {
          identity, definition:{...definition,title:'Survey '+identity},
          returnFocusTo:document.getElementById('product'),
          onClose:()=>window.closedInvitations.push(identity),
          onSubmit:()=>new Promise(resolve=>{window.finishOldRequest=resolve;}),
          onDismiss:()=>new Promise(resolve=>{window.finishOldRequest=resolve;})
        }));
      `,
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  assert.equal(bundle.outputFiles.length, 1);
  await mkdir(out, { recursive: true });
  for (const action of ["submit", "dismiss"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setContent('<button id="product">Product action</button><div id="app"></div>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.getByRole("button", { name: "Product action" }).focus();
      await page.evaluate(() => window.renderInvitation("A"));
      const first = page.getByRole("dialog", { name: "Survey A", exact: true });
      await first.waitFor();
      if (action === "submit") await first.getByLabel("Useful", { exact: true }).check();
      await first
        .getByRole("button", { name: action === "submit" ? "Submit response" : "Skip survey" })
        .click();
      await page.waitForFunction(() => typeof window.finishOldRequest === "function");
      // Update the same public component without a parent unmount or a parent key.
      await page.evaluate(() => window.renderInvitation("B"));
      const current = page.getByRole("dialog", {
        name: "Survey B",
        exact: true,
        includeHidden: true,
      });
      await current.waitFor();
      await page.evaluate(async () => {
        window.finishOldRequest();
        // Inspect after browser frames, including the asynchronous acknowledgement and React commit.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(
        await current.evaluate((dialog) => dialog.open),
        true,
        `old ${action} must not close B`,
      );
      assert.deepEqual(await page.evaluate(() => window.closedInvitations), []);
      assert.equal(await current.getByLabel("Useful", { exact: true }).isChecked(), false);
      assert.equal(
        await current.evaluate((dialog) => dialog.contains(document.activeElement)),
        true,
      );
      await page.screenshot({ path: join(out, `same-mounted-modal-after-old-${action}.png`) });
      await current.getByRole("button", { name: "Return to product" }).click();
      assert.deepEqual(await page.evaluate(() => window.closedInvitations), ["B"]);
      assert.equal(await page.evaluate(() => document.activeElement.id), "product");
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    await verifyModalLifecycle(
      browser,
      process.env.RESEARCH_BROWSER_EVIDENCE ?? "/tmp/croco-2819-modal",
    );
    process.stdout.write("Same-mounted modal submit/dismiss lifecycle passed.\n");
  } finally {
    await browser.close();
  }
}
