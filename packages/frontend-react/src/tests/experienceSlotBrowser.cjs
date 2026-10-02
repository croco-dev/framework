const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { chromium } = createRequire(resolve(__dirname, "../../../docs/package.json"))(
  "@playwright/test",
);
const { build } = createRequire(require.resolve("tsup"))("esbuild");

(async () => {
  const fixture = resolve(__dirname, "fixtures/ExperienceSlot.ts");
  const bundle = await build({
    stdin: {
      contents: `import { verifyMountedExperienceSlot } from ${JSON.stringify(fixture)}; window.verifyFocus = verifyMountedExperienceSlot;`,
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
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setContent('<button id="opener">Open preview</button><main id="root"></main>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const steps = await page.evaluate(async () => {
        const observed = [];
        await window.verifyFocus(
          document.querySelector("#root"),
          document.querySelector("#opener"),
          async (step) => {
            if (document.documentElement.scrollWidth > innerWidth)
              throw new Error("Horizontal overflow");
            observed.push(step);
          },
        );
        return observed;
      });
      if (errors.length) throw new Error(errors.join("\n"));
      results.push({ viewport, steps: steps.length });
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
