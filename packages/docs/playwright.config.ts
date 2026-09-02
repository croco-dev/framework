import { defineConfig } from "@playwright/test";
import { cpSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupIsolatedBuildRoot } from "./playwright.global-teardown";

const isolatedBuildRoot = mkdtempSync(join(tmpdir(), "croco-docs-playwright-"));
process.env.CROCO_DOCS_PLAYWRIGHT_ROOT = isolatedBuildRoot;
process.once("exit", cleanupIsolatedBuildRoot);
cpSync(join(import.meta.dirname, "src"), join(isolatedBuildRoot, "src"), { recursive: true });
cpSync(join(import.meta.dirname, "public"), join(isolatedBuildRoot, "public"), { recursive: true });
symlinkSync(
  join(import.meta.dirname, "node_modules"),
  join(isolatedBuildRoot, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);

export default defineConfig({
  globalTeardown: "./playwright.global-teardown.ts",
  outputDir: join(isolatedBuildRoot, "test-results"),
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4321",
  },
  webServer: {
    command:
      "pnpm --workspace-root turbo run docs:api:model --env-mode=loose --output-logs=errors-only && pnpm exec astro dev --host 127.0.0.1 --port 4321",
    env: { CROCO_DOCS_BUILD_ROOT: isolatedBuildRoot },
    reuseExistingServer: false,
    timeout: 600_000,
    url: "http://127.0.0.1:4321/en/",
  },
});
