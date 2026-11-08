// croco-test-clock: controlled
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import type { Request as MiniflareRequest } from "miniflare";
import { expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const require = createRequire(import.meta.url);

async function scaffold(root: string) {
  const target = join(root, "app");
  await generate(
    target,
    normalizeNonInteractiveOptions({
      projectName: "app",
      scope: "@fixture",
      preset: "saas",
      saasProviderProfile: "saas-cloudflare",
      installDeps: false,
      initGit: false,
    }),
  );
  const api = join(target, "apps/api-server");
  const nodeModules = join(api, "node_modules");
  mkdirSync(join(nodeModules, "@croco"), { recursive: true });
  const repositoryPackages = resolve(import.meta.dirname, "../../..");
  const packages = new Set([
    "framework-context",
    "framework-module",
    "preset-cloudflare",
    "triggers-core",
    "tasks-core",
    "execution-core",
    "esbuild-plugin",
    "problems-core",
  ]);
  const pending = [...packages];
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name) continue;
    const source = join(repositoryPackages, name);
    const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      publishConfig?: Record<string, unknown>;
    };
    const installed = join(nodeModules, "@croco", name);
    mkdirSync(installed);
    writeFileSync(
      join(installed, "package.json"),
      JSON.stringify({ ...manifest, ...manifest.publishConfig }),
    );
    cpSync(join(source, "dist"), join(installed, "dist"), { recursive: true });
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (dependency.startsWith("@croco/")) {
        const sibling = dependency.slice("@croco/".length);
        if (!packages.has(sibling)) {
          packages.add(sibling);
          pending.push(sibling);
        }
      } else {
        const link = join(nodeModules, dependency);
        if (!existsSync(link)) {
          mkdirSync(resolve(link, ".."), { recursive: true });
          symlinkSync(join(source, "node_modules", dependency), link, "dir");
        }
      }
    }
  }
  // The compiler's peer dependencies belong to the generated toolchain.
  for (const dependency of ["typescript", "esbuild"]) {
    if (!existsSync(join(nodeModules, dependency)))
      symlinkSync(
        join(repositoryPackages, "esbuild-plugin/node_modules", dependency),
        join(nodeModules, dependency),
        "dir",
      );
  }
  symlinkSync(
    resolve(repositoryPackages, "create-croco-app/node_modules/smol-toml"),
    join(nodeModules, "smol-toml"),
    "dir",
  );
  return { api, nodeModules, repositoryPackages };
}

it("compiles published Cron services into Wrangler and invokes the same DI graph in workerd", async () => {
  const root = mkdtempSync(join(tmpdir(), "croco-worker-crons-"));
  let mf: Miniflare | undefined;
  try {
    const { api, repositoryPackages } = await scaffold(root);
    const serviceFile = join(api, "src/worker/Report.ts");
    const service = `
      import { Component, Inject } from '@croco/framework-context';
      import { CLOUDFLARE_ENV_TOKEN } from '@croco/preset-cloudflare/application';
      import { Cron } from '@croco/triggers-core';
      @Component()
      export class Report {
        constructor(@Inject(CLOUDFLARE_ENV_TOKEN) private readonly env: Record<string, unknown>) {}
        @Cron('*/5 * * * *', { name: 'fixture-report', timezone: 'UTC' })
        async run(input: unknown) {
          await fetch('https://scheduled-observer.test/report', { method:'POST', body: JSON.stringify({ binding:this.env.PRIVATE_SENTINEL,input }) });
        }
      }
    `;
    writeFileSync(serviceFile, service);
    const store = resolve(
      repositoryPackages,
      "preset-cloudflare/src/tests/fixtures/MemoryExecutionStore.ts",
    );
    writeFileSync(
      join(api, "src/workerScheduling.ts"),
      `
      import { ExecutionManagerImpl } from '@croco/execution-core';
      import { MemoryExecutionStore } from ${JSON.stringify(store)};
      export const workerApplicationId = 'fixture-app';
      export const createWorkerExecutionManager = () => new ExecutionManagerImpl(new MemoryExecutionStore());
    `,
    );
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        ["--import", require.resolve("tsx"), "scripts/worker-crons.ts", ...args],
        { cwd: api, encoding: "utf8", timeout: 30_000 },
      );
    const stale = run();
    expect(stale.status, stale.stderr).toBe(1);
    expect(stale.stderr).toContain("CLOUDFLARE_CRON_OUTPUT_DRIFT");
    const written = run("--write");
    expect(written.status, written.stderr).toBe(0);
    const check = run();
    expect(check.status, check.stderr).toBe(0);
    const declarationFile = join(api, "worker-crons.manifest.json");
    const declaration = readFileSync(declarationFile, "utf8");
    expect(JSON.parse(declaration)).toMatchObject({
      crons: ["*/5 * * * *"],
      bindings: [{ id: "fixture-report", methodName: "run" }],
    });
    const wranglerFile = join(api, "wrangler.toml");
    const config = readFileSync(wranglerFile, "utf8");
    writeFileSync(wranglerFile, config.replace("*/5 * * * *", "*/10 * * * *"));
    const drift = run();
    expect(drift.status, drift.stderr).toBe(1);
    expect(drift.stderr).toContain("CLOUDFLARE_CRON_OUTPUT_DRIFT");
    expect(readFileSync(declarationFile, "utf8")).toBe(declaration);
    writeFileSync(wranglerFile, config);
    writeFileSync(serviceFile, service.replace("timezone: 'UTC'", "timezone: 'Asia/Seoul'"));
    const unsupported = run("--write");
    expect(unsupported.status, unsupported.stderr).toBe(1);
    expect(unsupported.stderr).toContain("CLOUDFLARE_CRON_UNSUPPORTED");
    expect(readFileSync(declarationFile, "utf8")).toBe(declaration);
    writeFileSync(serviceFile, service);
    const restored = run();
    expect(restored.status, restored.stderr).toBe(0);

    const bundle = await build({
      entryPoints: [join(api, "src/worker.ts")],
      bundle: true,
      write: false,
      format: "esm",
      platform: "neutral",
      external: ["node:*"],
      // Match Wrangler's nodejs_compat resolution of Node-built package artifacts.
      alias: { async_hooks: "node:async_hooks", crypto: "node:crypto" },
      mainFields: ["module", "main"],
      conditions: ["worker", "browser"],
      tsconfig: join(api, "tsconfig.json"),
    });
    const output = bundle.outputFiles.at(0);
    if (!output) throw new Error("Missing generated Worker bundle");
    const observations: unknown[] = [];
    mf = new Miniflare({
      modules: true,
      script: output.text,
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      bindings: { PRIVATE_SENTINEL: "worker-fixture-binding" },
      outboundService: async (request: MiniflareRequest) => {
        observations.push(await request.json());
        return new Response(null, { status: 204 });
      },
    });
    const worker = (await mf.getWorker()) as unknown as {
      scheduled(options: { cron: string; scheduledTime: Date }): Promise<{ outcome: string }>;
    };
    const firing = { cron: "*/5 * * * *", scheduledTime: new Date(1_800_000_000_000) };
    expect(await worker.scheduled(firing)).toMatchObject({ outcome: "ok" });
    expect(await worker.scheduled(firing)).toMatchObject({ outcome: "ok" });
    expect(observations).toEqual([
      {
        binding: "worker-fixture-binding",
        input: { cron: firing.cron, scheduledTime: firing.scheduledTime.getTime() },
      },
    ]);
    const health = await mf.dispatchFetch("https://worker.test/ops/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ scope: "bootstrap-only", fullSaas: false });
  } finally {
    await mf?.dispose();
    rmSync(root, { recursive: true, force: true });
  }
}, 90_000);

it("keeps Worker-only bindings out of the advertised Node tooling graph", async () => {
  const root = mkdtempSync(join(tmpdir(), "croco-worker-tooling-"));
  try {
    const { api, nodeModules } = await scaffold(root);
    // The advertised tooling command must exclude native services, while the Worker graph includes them.
    const tooling = join(root, "tooling");
    mkdirSync(join(tooling, "src/worker"), { recursive: true });
    mkdirSync(join(tooling, "scripts"));
    symlinkSync(nodeModules, join(tooling, "node_modules"), "dir");
    writeFileSync(join(tooling, "package.json"), '{"type":"commonjs"}');
    writeFileSync(
      join(tooling, "tsconfig.json"),
      '{"compilerOptions":{"experimentalDecorators":true,"moduleResolution":"Bundler","module":"ESNext"},"include":["src/**/*.ts"]}',
    );
    writeFileSync(
      join(tooling, "di.config.ts"),
      "export const diOptions = { modules: [], moduleProviders: [] };",
    );
    writeFileSync(
      join(tooling, "src/worker/Report.ts"),
      `import { Component, Inject } from '@croco/framework-context'; import { CLOUDFLARE_ENV_TOKEN } from '@croco/preset-cloudflare/application'; @Component() export class Report { constructor(@Inject(CLOUDFLARE_ENV_TOKEN) readonly env: unknown) {} }`,
    );
    writeFileSync(
      join(tooling, "src/Service.ts"),
      'import { Component } from "@croco/framework-context"; @Component() export class Service {}',
    );
    copyFileSync(join(api, "scripts/generate-di.ts"), join(tooling, "scripts/generate-di.ts"));
    const unscoped = spawnSync(
      process.execPath,
      ["--import", require.resolve("tsx"), "scripts/generate-di.ts"],
      { cwd: tooling, encoding: "utf8", timeout: 30_000 },
    );
    expect(unscoped.status).not.toBe(0);
    expect(unscoped.stderr).toContain("CLOUDFLARE_ENV_TOKEN");
    const apiPackage = JSON.parse(readFileSync(join(api, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const toolingArguments = apiPackage.scripts["di:generate"].split(" && ")[0].split(" ").slice(1);
    const scoped = spawnSync(
      process.execPath,
      ["--import", require.resolve("tsx"), ...toolingArguments],
      { cwd: tooling, encoding: "utf8", timeout: 30_000 },
    );
    expect(scoped.status, scoped.stderr).toBe(0);
    expect(
      JSON.parse(readFileSync(join(tooling, ".croco/di.manifest.json"), "utf8")).providers.map(
        (provider: { exportName: string }) => provider.exportName,
      ),
    ).toEqual(["Service"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 90_000);
