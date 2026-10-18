import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.each([
  ["graphql", "nextjs"],
  ["trpc", "nextjs"],
  ["graphql", "standalone"],
  ["trpc", "standalone"],
] as const)("%s/%s OpenNext frontend", (api, apiHosting) => {
  it("declares the builder and keeps the Next build separate from Worker build/preview/deploy", async () => {
    const root = mkdtempSync(join(tmpdir(), "croco-opennext-"));
    roots.push(root);
    const targetDir = join(root, "app");
    const webApps = apiHosting === "nextjs" ? ["web"] : ["portal", "admin"];
    await generate(
      targetDir,
      normalizeNonInteractiveOptions({
        projectName: "sample",
        scope: "@acme",
        preset: "ddd-fullstack",
        api,
        apiHosting,
        webApps,
        frontendDeploy: "opennext",
        installDeps: false,
        initGit: false,
        agentRules: false,
      }),
      { outputMode: "json" },
    );

    for (const app of webApps) {
      const appDir = join(targetDir, "apps", app);
      const manifest = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8")) as {
        name: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      expect(manifest.name).toBe(`@acme/${app}`);
      expect(manifest.dependencies["@opennextjs/cloudflare"]).toBeTruthy();
      expect(manifest.devDependencies.wrangler).toBeTruthy();
      expect(manifest.scripts["build:worker"]).toBe("opennextjs-cloudflare build");
      expect(manifest.scripts.preview).toBe("pnpm build:worker && opennextjs-cloudflare preview");
      expect(manifest.scripts.deploy).toBe("pnpm build:worker && opennextjs-cloudflare deploy");
      expect(manifest.scripts.build).toBe(
        apiHosting === "standalone"
          ? "next build"
          : api === "graphql"
            ? "pnpm contract:check && next build"
            : "pnpm di:generate && next build",
      );
      expect(manifest.dependencies.next).toBeTruthy();
      const nextConfig = readFileSync(join(appDir, "next.config.ts"), "utf8");
      expect(nextConfig).toMatch(/output\s*:\s*["']standalone["']/);
      expect(nextConfig).toMatch(/outputFileTracingRoot\s*:/);
      const config = readFileSync(join(appDir, "open-next.config.ts"), "utf8");
      expect(config).toContain('import { defineCloudflareConfig } from "@opennextjs/cloudflare"');
      expect(config).toContain("defineCloudflareConfig()");
      const wrangler = parse(readFileSync(join(appDir, "wrangler.toml"), "utf8"));
      expect(wrangler.name).toBe(`sample-${app}`);
      expect(wrangler.main).toBe(".open-next/worker.js");
      expect(wrangler.assets).toMatchObject({ directory: ".open-next/assets", binding: "ASSETS" });
    }
  });
});

it.each(["opennext", "vercel"] as const)(
  "permits the required workerd installation only for the OpenNext frontend (%s)",
  async (frontendDeploy) => {
    const root = mkdtempSync(join(tmpdir(), "croco-opennext-install-"));
    roots.push(root);
    const targetDir = join(root, "app");
    await generate(
      targetDir,
      normalizeNonInteractiveOptions({
        projectName: "sample",
        scope: "@acme",
        preset: "ddd-fullstack",
        api: "graphql",
        apiHosting: "nextjs",
        webApps: ["web"],
        frontendDeploy,
        installDeps: false,
        initGit: false,
        agentRules: false,
      }),
      { outputMode: "json" },
    );
    const workspace = parseYaml(readFileSync(join(targetDir, "pnpm-workspace.yaml"), "utf8")) as {
      allowBuilds: Record<string, boolean>;
      onlyBuiltDependencies: string[];
    };
    expect(workspace.allowBuilds.workerd === true).toBe(frontendDeploy === "opennext");
    expect(workspace.onlyBuiltDependencies.includes("workerd")).toBe(frontendDeploy === "opennext");
    expect(workspace.allowBuilds.esbuild).toBe(true);
    expect(workspace.onlyBuiltDependencies).toContain("esbuild");
  },
);
