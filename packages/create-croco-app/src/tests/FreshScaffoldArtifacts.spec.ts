import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function generatePreset(
  preset: "production-app" | "admin-console" | "saas",
): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "croco-fresh-artifacts-"));
  roots.push(root);
  const targetDir = join(root, "app");
  await generate(
    targetDir,
    normalizeNonInteractiveOptions({
      projectName: "app",
      scope: "@acme",
      preset,
      installDeps: false,
      initGit: false,
    }),
    { outputMode: "json" },
  );
  return targetDir;
}

describe("fresh scaffold contract artifacts", () => {
  it.each(["production-app", "admin-console"] as const)(
    "%s ships the baselines that its generated browser CI contracts job verifies",
    async (preset) => {
      const targetDir = await generatePreset(preset);
      const workflow = readFileSync(join(targetDir, ".github/workflows/browser-tests.yml"), "utf8");
      const biome = readFileSync(join(targetDir, "biome.json"), "utf8");

      expect(workflow).toContain("pnpm contract:verify");
      expect(biome).toContain('"!libs/shared/provider-rpc/src"');
      expect(biome).toContain('"!apps/console-web/public/mockServiceWorker.js"');
      expect({
        contractGraph: existsSync(join(targetDir, "contract-graph.snapshot.json")),
        projectMap: existsSync(join(targetDir, "croco.project-map.json")),
        openapi: existsSync(join(targetDir, "openapi.json")),
      }).toEqual({ contractGraph: true, projectMap: true, openapi: true });
    },
  );

  it("saas ships the artifacts that its generated executable assurance test reads", async () => {
    const targetDir = await generatePreset("saas");
    const biome = readFileSync(join(targetDir, "biome.json"), "utf8");
    const spec = readFileSync(
      join(targetDir, "apps/api-server/src/tests/ExecutableAssurance.spec.ts"),
      "utf8",
    );

    expect(spec).toContain('"contract-graph.snapshot.json"');
    expect(biome).toContain('"!libs/shared/provider-rpc/src"');
    expect({
      contractGraph: existsSync(join(targetDir, "contract-graph.snapshot.json")),
      projectMap: existsSync(join(targetDir, "croco.project-map.json")),
    }).toEqual({ contractGraph: true, projectMap: true });

    const singleRoot = mkdtempSync(join(tmpdir(), "croco-fresh-artifacts-single-"));
    roots.push(singleRoot);
    const singleDir = join(singleRoot, "app");
    await generate(
      singleDir,
      normalizeNonInteractiveOptions({
        projectName: "app",
        scope: "@acme",
        preset: "saas",
        tenantModel: "single",
        installDeps: false,
        initGit: false,
      }),
      { outputMode: "json" },
    );
    expect(existsSync(join(singleDir, "contract-graph.snapshot.json"))).toBe(true);
    expect(readFileSync(join(singleDir, "croco.project-map.json"), "utf8")).toContain(
      "telemetry-flush:apps/api-server/src/generatedSaasProviderProfile.ts:547",
    );

    for (const variation of [
      { preset: "saas" as const, tenantModel: "workspace" as const },
      { preset: "saas" as const, saasProviderProfile: "saas-cloudflare" as const },
      { preset: "ai-saas" as const },
    ]) {
      const root = mkdtempSync(join(tmpdir(), "croco-fresh-artifacts-variant-"));
      roots.push(root);
      const variantDir = join(root, "app");
      await generate(
        variantDir,
        normalizeNonInteractiveOptions({
          projectName: "app",
          scope: "@acme",
          installDeps: false,
          initGit: false,
          ...variation,
        }),
        { outputMode: "json" },
      );
      expect(existsSync(join(variantDir, "contract-graph.snapshot.json"))).toBe(false);
    }
  });
});
