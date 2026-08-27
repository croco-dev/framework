import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import type { GeneratorOptions, NormalizedGeneratorOptions } from "../types.js";

describe("E2E Vite SPA: generate()", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-e2e-vite-spa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it(
    "generates vite spa frontend deploy files for standalone web app",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-vite-spa",
        scope: "@test",
        preset: "ddd-fullstack",
        webApps: ["web"],
        api: "graphql",
        apiHosting: "standalone",
        frontendDeploy: "vite-spa",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const appDir = join(testDir, "apps", "web");
      const viteConfigContent = readFileSync(join(appDir, "vite.config.ts"), "utf8");
      const packageJsonContent = readFileSync(join(appDir, "package.json"), "utf8");
      const clientContent = readFileSync(join(appDir, "src", "api", "client.ts"), "utf8");

      expect(existsSync(join(appDir, "vite.config.ts"))).toBe(true);
      expect(existsSync(join(appDir, "package.json"))).toBe(true);
      expect(existsSync(join(appDir, "src", "main.tsx"))).toBe(true);
      expect(existsSync(join(appDir, "src", "App.tsx"))).toBe(true);
      expect(existsSync(join(appDir, "src", "api", "client.ts"))).toBe(true);
      expect(existsSync(join(appDir, "src", "vite-env.d.ts"))).toBe(true);
      expect(existsSync(join(appDir, "index.html"))).toBe(true);

      expect(clientContent).toContain("VITE_API_URL");
      expect(clientContent).toContain("window.location.origin");
      expect(viteConfigContent).toContain("crocoSpaViteConfig");
      expect(packageJsonContent).toContain('"vite": "^6.0.0"');
    },
  );

  it("generates isolated none and Astryx UI profiles", { timeout: 120_000 }, async () => {
    const noneDir = `${testDir}-none`;
    const astryxDir = `${testDir}-astryx`;
    const baseOptions: GeneratorOptions = {
      projectName: "my-vite-ui",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      frontendDeploy: "vite-spa",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    try {
      await generate(noneDir, { ...baseOptions, ui: "none" });
      await generate(astryxDir, { ...baseOptions, ui: "astryx" });

      const nonePackage = readFileSync(join(noneDir, "apps", "web", "package.json"), "utf8");
      const astryxPackage = readFileSync(join(astryxDir, "apps", "web", "package.json"), "utf8");
      const noneManifest = JSON.parse(
        readFileSync(join(noneDir, "croco-presentation-profile.manifest.json"), "utf8"),
      ) as { profiles: [{ ui: { name: string; requiresStylexCompile: boolean } }] };
      const astryxManifest = JSON.parse(
        readFileSync(join(astryxDir, "croco-presentation-profile.manifest.json"), "utf8"),
      ) as { profiles: [{ runtimeProfile: string; ui: { name: string; maturity: string } }] };

      expect(noneManifest.profiles[0].ui).toEqual(
        expect.objectContaining({ name: "none", requiresStylexCompile: false }),
      );
      expect(nonePackage).not.toContain("astryx");
      expect(nonePackage).not.toContain("stylex");
      expect(existsSync(join(noneDir, "libs", "shared", "ui"))).toBe(false);

      expect(astryxManifest.profiles[0]).toEqual(
        expect.objectContaining({
          runtimeProfile: "browser-vite-spa-astryx",
          ui: expect.objectContaining({ name: "astryx", maturity: "beta" }),
        }),
      );
      expect(astryxPackage).toContain('"@croco/ui-astryx": "^0.1.0"');
      expect(astryxPackage).toContain('"@astryxdesign/core": "0.1.4"');
      expect(astryxPackage).toContain('"@stylexjs/stylex": "^0.18.3"');
      expect(existsSync(join(astryxDir, "libs", "shared", "ui"))).toBe(false);
      expect(existsSync(join(astryxDir, "apps", "web", "src", "presentation-smoke.tsx"))).toBe(
        true,
      );
    } finally {
      rmSync(noneDir, { recursive: true, force: true });
      rmSync(astryxDir, { recursive: true, force: true });
    }
  });

  it("rejects incompatible programmatic UI generation before writing files", async () => {
    const options: NormalizedGeneratorOptions = {
      projectName: "invalid-astryx-runtime",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      frontendDeploy: "cloudflare-meta-vite",
      ui: "astryx",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await expect(generate(testDir, options as GeneratorOptions)).rejects.toThrow(
      "--ui is currently only supported with --frontend-deploy vite-spa",
    );
    expect(existsSync(testDir)).toBe(false);
  });

  it("generates vite spa docker file with api build artifacts", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-vite-spa-docker",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "trpc",
      apiHosting: "standalone",
      backendDeploy: "docker",
      frontendDeploy: "vite-spa",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    const dockerfileContent = readFileSync(join(testDir, "web", "Dockerfile.vite-spa"), "utf8");
    const apiDockerfileContent = readFileSync(join(testDir, "apps", "api", "Dockerfile"), "utf8");
    const apiPackageName = JSON.parse(
      readFileSync(join(testDir, "apps", "api", "package.json"), "utf8"),
    ).name as string;
    const webPackageName = JSON.parse(
      readFileSync(join(testDir, "apps", "web", "package.json"), "utf8"),
    ).name as string;

    expect(apiDockerfileContent).toContain(`turbo prune ${apiPackageName} --docker`);
    expect(apiDockerfileContent).toContain(`pnpm turbo build --filter=${apiPackageName}`);
    expect(dockerfileContent).toContain(
      `pnpm turbo build --filter=${webPackageName} --filter=${apiPackageName}`,
    );
    expect(dockerfileContent).not.toContain("@@test");
    expect(dockerfileContent).not.toContain("{{scope}}");
    expect(dockerfileContent).not.toContain("}}");
    expect(dockerfileContent).toContain(
      "COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist",
    );
    expect(dockerfileContent).toContain("EXPOSE 3001");
    expect(dockerfileContent).toContain('CMD ["node", "apps/api/dist/index.js"]');
  });

  it("generates vite spa docker file for graphql api artifacts", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-vite-spa-graphql-docker",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      backendDeploy: "docker",
      frontendDeploy: "vite-spa",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    const dockerfileContent = readFileSync(join(testDir, "web", "Dockerfile.vite-spa"), "utf8");
    const apiPackageName = JSON.parse(
      readFileSync(join(testDir, "apps", "graphql-api", "package.json"), "utf8"),
    ).name as string;
    const webPackageName = JSON.parse(
      readFileSync(join(testDir, "apps", "web", "package.json"), "utf8"),
    ).name as string;

    expect(dockerfileContent).toContain(
      `pnpm turbo build --filter=${webPackageName} --filter=${apiPackageName}`,
    );
    expect(dockerfileContent).toContain(
      "COPY --from=builder --chown=nodejs:nodejs /app/apps/graphql-api/dist ./apps/graphql-api/dist",
    );
    expect(dockerfileContent).toContain("EXPOSE 4000");
    expect(dockerfileContent).toContain('CMD ["node", "apps/graphql-api/dist/index.js"]');
    expect(dockerfileContent).not.toContain("apps/api");
  });
});
