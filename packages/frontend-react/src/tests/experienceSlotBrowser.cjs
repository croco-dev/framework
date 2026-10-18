const { existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { RUN_TIMEOUT_MS, CLEANUP_TIMEOUT_MS } = require("./experienceSlotProcess.cjs");
const startedAt = process.hrtime.bigint();
const stageStarts = new Map();
const elapsedMs = (start) => Number(process.hrtime.bigint() - start) / 1_000_000;
const diagnostic = (stage, event, details = {}) => {
  if (event === "start") stageStarts.set(stage, process.hrtime.bigint());
  const stageStart = stageStarts.get(stage);
  process.stderr.write(
    `${JSON.stringify({
      runner: "experienceSlotBrowser",
      stage,
      event,
      elapsedMs: elapsedMs(startedAt),
      ...(stageStart === undefined ? {} : { stageElapsedMs: elapsedMs(stageStart) }),
      ...details,
    })}\n`,
  );
};
process.on("beforeExit", (code) =>
  diagnostic("process", "beforeExit", {
    code,
    activeResources: process.getActiveResourcesInfo(),
  }),
);
process.on("exit", (code) => diagnostic("process", "exit", { code }));
diagnostic("dependencies", "start", {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI ?? null,
  playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
  executionBudgetMs: RUN_TIMEOUT_MS,
  cleanupBudgetMs: CLEANUP_TIMEOUT_MS,
});
const docsRequire = createRequire(resolve(__dirname, "../../../docs/package.json"));
const { chromium } = docsRequire("@playwright/test");
const esbuild = createRequire(require.resolve("tsup"))("esbuild");
const { build } = esbuild;
diagnostic("dependencies", "completed", {
  playwright: docsRequire("@playwright/test/package.json").version,
  esbuild: esbuild.version,
  chromiumExecutablePath: chromium.executablePath(),
  chromiumExecutableExists: existsSync(chromium.executablePath()),
});

(async () => {
  const results = [];
  const failures = [];
  let browser;
  let esbuildStopAttempted = false;
  const stopEsbuild = async () => {
    esbuildStopAttempted = true;
    diagnostic("esbuild.stop", "start");
    await esbuild.stop();
    diagnostic("esbuild.stop", "completed");
  };
  try {
    const fixture = resolve(__dirname, "fixtures/ExperienceSlot.ts");
    diagnostic("bundle", "start");
    const bundle = await build({
      stdin: {
        contents: `import { verifyMountedExperienceSlot, verifyModalTabBoundaries } from ${JSON.stringify(fixture)}; Object.assign(window, { verifyFocus: verifyMountedExperienceSlot, verifyTabs: verifyModalTabBoundaries });`,
        resolveDir: __dirname,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      define: { "process.env.NODE_ENV": '"development"' },
    });
    diagnostic("bundle", "completed");
    await stopEsbuild();
    diagnostic("chromium.launch", "start");
    browser = await chromium.launch({ timeout: 10000 });
    diagnostic("chromium.launch", "completed", { chromium: browser.version() });
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      const viewportStage = `viewport.${viewport.width}x${viewport.height}`;
      diagnostic(`${viewportStage}.setup`, "start");
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setContent('<button id="opener">Open preview</button><main id="root"></main>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.exposeFunction("pressTabKey", (key) => page.keyboard.press(key));
      diagnostic(`${viewportStage}.setup`, "completed");
      diagnostic(`${viewportStage}.verification`, "start");
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
      const tabCases = await page.evaluate(async () =>
        window.verifyTabs(
          document.querySelector("#root"),
          document.querySelector("#opener"),
          window.pressTabKey,
          async () => {
            if (document.documentElement.scrollWidth > innerWidth)
              throw new Error("Horizontal overflow");
          },
        ),
      );
      if (errors.length) throw new Error(errors.join("\n"));
      results.push({ viewport, steps: steps.length, tabCases });
      diagnostic(`${viewportStage}.verification`, "completed", { steps: steps.length });
      diagnostic(`${viewportStage}.page.close`, "start");
      await page.close();
      diagnostic(`${viewportStage}.page.close`, "completed");
    }
  } catch (error) {
    failures.push(error);
    diagnostic("execution", "failed", { message: String(error) });
  } finally {
    diagnostic("cleanup", "start", { budgetMs: CLEANUP_TIMEOUT_MS });
    if (!esbuildStopAttempted) {
      try {
        await stopEsbuild();
      } catch (error) {
        failures.push(error);
        diagnostic("esbuild.stop", "failed", { message: String(error) });
      }
    }
    if (browser) {
      diagnostic("browser.close", "start");
      try {
        await browser.close();
        diagnostic("browser.close", "completed", {
          activeResources: process.getActiveResourcesInfo(),
        });
      } catch (error) {
        failures.push(error);
        diagnostic("browser.close", "failed", { message: String(error) });
      }
    }
    diagnostic("cleanup", "completed", { failures: failures.length });
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Browser verification and cleanup failed");
  process.stdout.write(JSON.stringify(results));
  diagnostic("successJson", "emitted");
})().catch((error) => {
  diagnostic("runner", "failed", { message: String(error) });
  console.error(error);
  process.exitCode = 1;
});
