const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");
(async () => {
  const fixture = resolve(__dirname, "fixtures/SavedItems.ts");
  const bundle = await build({
    stdin: {
      contents: `import { mountSavedItemsFixture } from ${JSON.stringify(fixture)}; window.mountSaved = mountSavedItemsFixture;`,
      resolveDir: __dirname,
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      const mount = async (kind) => {
        await page.goto("about:blank");
        await page.setContent('<main id="root"></main>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.evaluate(
          (kind) => window.mountSaved(document.querySelector("#root"), kind),
          kind,
        );
        await page.getByRole("heading", { name: "Saved items", exact: true }).waitFor();
      };
      for (const kind of ["loading", "empty", "denied", "error", "partial"]) {
        await mount(kind);
        assert.equal(await page.locator("section").getAttribute("data-state"), kind);
        assert.equal(await page.getByRole("link").count(), 0);
        assert.equal(await page.getByText("Must be masked").count(), 0);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
      }
      await mount("ready");
      await page.getByRole("button", { name: "Continue", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByText("Server recheck requested at revision 1").waitFor();
      await page.getByRole("button", { name: "Pin", exact: true }).click();
      await page.getByRole("button", { name: "Unpin", exact: true }).waitFor();
      await page.getByRole("button", { name: "Unpin", exact: true }).click();
      await page.getByRole("button", { name: "Pin", exact: true }).waitFor();
      await page.getByRole("button", { name: "Mark completed", exact: true }).click();
      await page.getByText("No saved items.", { exact: true }).waitFor();
      await mount("ready");
      await page.getByRole("button", { name: "Next page", exact: true }).click();
      await page.getByText("No saved items.", { exact: true }).waitFor();
      await mount("action-error");
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await page.getByRole("alert").waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Continue", exact: true }).isDisabled(),
        true,
      );
      await page
        .getByRole("alert")
        .getByRole("button", { name: "Reload saved items", exact: true })
        .click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByText("Server recheck requested at revision 2").waitFor();
      assert.deepEqual(errors, []);
      results.push({ viewport, states: 7, keyboard: true, revisionRecovery: true });
      await page.close();
    }
    process.stdout.write(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
