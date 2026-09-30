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

describe.each([
  ["trpc", "nextjs"],
  ["graphql", "nextjs"],
  ["graphql", "standalone"],
] as const)("ddd-fullstack %s/%s --frontend-deploy docker", (api, apiHosting) => {
  it("generates every web path copied by the Dockerfile", async () => {
    const root = mkdtempSync(join(tmpdir(), "croco-next-docker-"));
    roots.push(root);
    const targetDir = join(root, "app");

    await generate(
      targetDir,
      normalizeNonInteractiveOptions({
        projectName: "app",
        scope: "@acme",
        preset: "ddd-fullstack",
        api,
        apiHosting,
        webApps: ["web"],
        frontendDeploy: "docker",
        installDeps: false,
        initGit: false,
      }),
      { outputMode: "json" },
    );

    const dockerfile = readFileSync(join(targetDir, "web/Dockerfile"), "utf8");
    const nextConfig = readFileSync(join(targetDir, "apps/web/next.config.ts"), "utf8");
    const copiedPaths = [
      ...dockerfile.matchAll(/^COPY --from=builder\S* (?:--\S+ )*\/app\/apps\/web\/(\S+)/gm),
    ].map((match) => match[1]);
    const standaloneOutput = /output\s*:\s*["']standalone["']/.test(nextConfig);
    const missing = copiedPaths.filter((copied) => {
      if (copied === ".next/standalone") return !standaloneOutput;
      if (copied.startsWith(".next/")) return false;
      return !existsSync(join(targetDir, "apps/web", copied));
    });

    expect(copiedPaths.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
    expect(nextConfig).toMatch(/outputFileTracingRoot\s*:/);
  });
});
