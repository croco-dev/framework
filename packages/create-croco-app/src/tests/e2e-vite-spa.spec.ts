import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { getExternalCrocoPackageRange } from "../helpers/croco-ranges.js";
import type { GeneratorOptions, NormalizedGeneratorOptions } from "../types.js";

async function getFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Expected the test port probe to listen on a TCP address."));
        return;
      }
      const { port } = address;
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

type GatewayChild = {
  readonly kill: () => void;
  readonly exited: Promise<number>;
};

async function startGateway(env: NodeJS.ProcessEnv): Promise<GatewayChild> {
  const { spawn } = await import("node:child_process");
  const gatewayPath = new URL("../../templates/addons/docker/web/gateway.mjs", import.meta.url);
  const child = spawn(process.execPath, [gatewayPath.pathname], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", () => undefined);
  child.stderr?.on("data", () => undefined);
  const exited = new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
  return {
    kill: () => {
      child.kill("SIGTERM");
    },
    exited,
  };
}

async function waitForHttpOk(url: string, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet; retry below.
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

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
      expect(astryxPackage).toContain(
        `"@croco/ui-astryx": "${getExternalCrocoPackageRange("@croco/ui-astryx")}"`,
      );
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
    expect(dockerfileContent).toContain(
      "COPY --chown=nodejs:nodejs web/gateway.mjs ./web/gateway.mjs",
    );
    expect(dockerfileContent).toContain("EXPOSE 3001");
    expect(dockerfileContent).toContain('CMD ["node", "web/gateway.mjs"]');

    expect(existsSync(join(testDir, "web", "gateway.mjs"))).toBe(true);
    const apiIndexContent = readFileSync(join(testDir, "apps", "api", "src", "index.ts"), "utf8");
    expect(apiIndexContent).toContain("process.env.PORT");
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
    expect(dockerfileContent).toContain(
      "COPY --chown=nodejs:nodejs web/gateway.mjs ./web/gateway.mjs",
    );
    expect(dockerfileContent).toContain("EXPOSE 4000");
    expect(dockerfileContent).toContain('CMD ["node", "web/gateway.mjs"]');
    expect(dockerfileContent).not.toContain("apps/api");
    expect(existsSync(join(testDir, "web", "gateway.mjs"))).toBe(true);
  });

  it(
    "serves the SPA and proxies the API through the docker gateway",
    { timeout: 60_000 },
    async () => {
      const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const fixtureRoot = mkdtempSync(join(tmpdir(), "croco-2372-gateway-"));
      let gateway: GatewayChild | undefined;

      try {
        const spaRoot = join(fixtureRoot, "apps", "web", "dist");
        mkdirSync(join(spaRoot, "assets"), { recursive: true });
        writeFileSync(
          join(spaRoot, "index.html"),
          "<!doctype html><html><body>spa index</body></html>\n",
        );
        writeFileSync(join(spaRoot, "assets", "app.js"), "console.log('spa');\n");

        const apiDir = join(fixtureRoot, "apps", "api", "dist");
        mkdirSync(apiDir, { recursive: true });
        writeFileSync(
          join(apiDir, "index.js"),
          [
            "const http = require('node:http');",
            "const port = Number(process.env.PORT ?? '3001');",
            "http.createServer((req, res) => {",
            "  res.writeHead(200, { 'content-type': 'application/json' });",
            "  res.end(JSON.stringify({ path: req.url }));",
            "}).listen(port);",
            "",
          ].join("\n"),
        );

        const publicPort = await getFreePort();
        const apiPort = await getFreePort();
        gateway = await startGateway({
          PORT: String(publicPort),
          CROCO_API_PORT: String(apiPort),
          CROCO_API_ENTRY: join(apiDir, "index.js"),
          CROCO_SPA_ROOT: spaRoot,
        });

        await waitForHttpOk(`http://127.0.0.1:${publicPort}/`);
        const indexResponse = await fetch(`http://127.0.0.1:${publicPort}/`);
        const assetResponse = await fetch(`http://127.0.0.1:${publicPort}/assets/app.js`);
        const fallbackResponse = await fetch(`http://127.0.0.1:${publicPort}/dashboard`);
        const apiResponse = await fetch(`http://127.0.0.1:${publicPort}/health.check?batch=1`, {
          headers: { accept: "application/json" },
        });

        expect(indexResponse.status).toBe(200);
        expect(await indexResponse.text()).toContain("spa index");
        expect(assetResponse.status).toBe(200);
        expect(assetResponse.headers.get("content-type")).toContain("javascript");
        expect(fallbackResponse.status).toBe(200);
        expect(await fallbackResponse.text()).toContain("spa index");
        expect(apiResponse.status).toBe(200);
        expect(await apiResponse.json()).toEqual(
          expect.objectContaining({ path: "/health.check?batch=1" }),
        );
      } finally {
        gateway?.kill();
        rmSync(fixtureRoot, { recursive: true, force: true });
      }
    },
  );
});
