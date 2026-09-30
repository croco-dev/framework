import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as crocoRanges from "../helpers/croco-ranges.js";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const roots: string[] = [];

type PackageManifest = {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

function expectProjectMapDependencies(targetDir: string): void {
  const projectMap = JSON.parse(
    readFileSync(join(targetDir, "croco.project-map.json"), "utf8"),
  ) as {
    project: { packageManager: string };
    packageGraph: {
      packages: {
        name: string;
        path: string;
        dependencies: { name: string; range: string; kind: string }[];
      }[];
    };
    entrypoints: { kind: string; id: string; packageName?: string }[];
  };
  const rootManifest = JSON.parse(
    readFileSync(join(targetDir, "package.json"), "utf8"),
  ) as PackageManifest;
  expect(projectMap.project.packageManager).toBe(rootManifest.packageManager);

  expect(projectMap.packageGraph.packages).toEqual(
    [...projectMap.packageGraph.packages].sort(
      (left, right) =>
        compareStrings(left.name, right.name) || compareStrings(left.path, right.path),
    ),
  );
  expect(projectMap.entrypoints).toEqual(
    [...projectMap.entrypoints].sort(
      (left, right) =>
        compareStrings(left.kind, right.kind) ||
        compareStrings(left.id, right.id) ||
        compareStrings(left.packageName ?? "", right.packageName ?? ""),
    ),
  );

  for (const pkg of projectMap.packageGraph.packages) {
    const manifest = JSON.parse(readFileSync(join(targetDir, pkg.path), "utf8")) as PackageManifest;
    const dependencies = [
      ["dependencies", "dependency"],
      ["devDependencies", "devDependency"],
      ["peerDependencies", "peerDependency"],
      ["optionalDependencies", "optionalDependency"],
    ] as const;
    const expected = dependencies.flatMap(([field, kind]) =>
      Object.entries(manifest[field] ?? {}).map(([name, range]) => ({ name, range, kind })),
    );
    expected.sort(
      (left, right) =>
        compareStrings(left.name, right.name) || compareStrings(left.kind, right.kind),
    );
    expect(pkg.dependencies).toEqual(expected);
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function generatePreset(
  preset: "production-app" | "admin-console" | "saas",
  tenantModel?: "single",
  scope = "@acme",
  projectName = "app",
): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "croco-fresh-artifacts-"));
  roots.push(root);
  const targetDir = join(root, "app");
  await generate(
    targetDir,
    normalizeNonInteractiveOptions({
      projectName,
      scope,
      preset,
      tenantModel,
      installDeps: false,
      initGit: false,
    }),
    { outputMode: "json" },
  );
  return targetDir;
}

describe("fresh scaffold contract artifacts", () => {
  it("keeps project map ordering canonical after scope and project name substitution", async () => {
    for (const preset of ["production-app", "admin-console", "saas"] as const) {
      expectProjectMapDependencies(await generatePreset(preset, undefined, "@smoke", "1-app"));
    }
    expectProjectMapDependencies(await generatePreset("saas", "single", "@smoke", "1-app"));
  });
  it("keeps project maps aligned with the next published Croco version ranges", async () => {
    const ranges = crocoRanges.getExternalCrocoPackageRanges();
    const nextRange = ranges["@croco/cli"].replace(/\d+/, (major) => String(Number(major) + 1));
    const nextRanges = { ...ranges, "@croco/cli": nextRange };
    vi.spyOn(crocoRanges, "getExternalCrocoPackageRanges").mockReturnValue(nextRanges);
    vi.spyOn(crocoRanges, "getExternalCrocoPackageRange").mockImplementation(
      (name) => nextRanges[name as keyof typeof nextRanges],
    );

    for (const preset of ["production-app", "admin-console", "saas"] as const) {
      const targetDir = await generatePreset(preset);
      const manifest = JSON.parse(
        readFileSync(join(targetDir, "package.json"), "utf8"),
      ) as PackageManifest;
      expect(manifest.devDependencies?.["@croco/cli"]).toBe(nextRange);
      expectProjectMapDependencies(targetDir);
    }
    expectProjectMapDependencies(await generatePreset("saas", "single"));
  });
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
      expectProjectMapDependencies(targetDir);
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
    expectProjectMapDependencies(targetDir);

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
    expectProjectMapDependencies(singleDir);

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
