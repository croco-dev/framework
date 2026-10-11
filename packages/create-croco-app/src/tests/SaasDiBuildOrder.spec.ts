import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";
import type { NormalizedGeneratorOptions } from "../types.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function generateApiServer(options: NormalizedGeneratorOptions): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "croco-saas-di-build-"));
  roots.push(root);
  const targetDir = join(root, "app");
  await generate(
    targetDir,
    normalizeNonInteractiveOptions({
      projectName: "app",
      scope: "@acme",
      installDeps: false,
      initGit: false,
      ...options,
    }),
    { outputMode: "json" },
  );
  return join(targetDir, "apps/api-server");
}

describe.each([
  { name: "goal saas-api", options: { goal: "saas-api" } },
  {
    name: "preset saas + saas-lambda",
    options: { preset: "saas", saasProviderProfile: "saas-lambda" },
  },
  {
    name: "preset saas + saas-cloudflare",
    options: { preset: "saas", saasProviderProfile: "saas-cloudflare" },
  },
  { name: "preset ai-saas", options: { preset: "ai-saas" } },
] satisfies readonly { name: string; options: NormalizedGeneratorOptions }[])(
  "$name API server build",
  ({ options }) => {
    it("generates the DI graph before tsup type-checks the declaration build", async () => {
      const apiServer = await generateApiServer(options);
      const manifest = JSON.parse(readFileSync(join(apiServer, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      };

      expect(readFileSync(join(apiServer, "src/app.ts"), "utf8")).toContain(
        "../.croco/di.generated",
      );
      expect(readFileSync(join(apiServer, "tsup.config.ts"), "utf8")).toMatch(/dts:\s*true/);
      expect(manifest.scripts.build).toMatch(/^pnpm di:generate && tsup /);
    });
  },
);
