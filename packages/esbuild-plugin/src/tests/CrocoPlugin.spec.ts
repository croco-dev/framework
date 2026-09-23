import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as esbuild from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crocoPlugin } from "../libs/plugin";

const TEMP_DIR = path.join(__dirname, "plugin-temp");

function createProject(): { readonly entry: string; readonly component: string } {
  const repositoryRoot = path.resolve(__dirname, "../../../..");
  const srcDir = path.join(TEMP_DIR, "src");
  const entry = path.join(srcDir, "index.ts");
  const component = path.join(srcDir, "Service.ts");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(
    path.join(TEMP_DIR, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        experimentalDecorators: true,
        baseUrl: repositoryRoot,
        paths: {
          "@croco/framework-context": ["packages/framework-context/src/index.ts"],
          "@croco/framework-module": ["packages/framework-module/src/index.ts"],
        },
      },
    }),
  );
  fs.writeFileSync(
    entry,
    'import { createApplicationRuntime } from "@croco/framework-module";\nexport const runtime = createApplicationRuntime();',
  );
  fs.writeFileSync(
    component,
    `
      import { Component } from "@croco/framework-context";
      @Component()
      export class Service {}
    `,
  );
  return { entry, component };
}

function createMockBuild(entry: string, platform: esbuild.Platform = "node"): esbuild.PluginBuild {
  return {
    initialOptions: {
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform,
    },
    onStart: vi.fn(),
    onLoad: vi.fn(),
    onEnd: vi.fn(),
  } as unknown as esbuild.PluginBuild;
}

describe("crocoPlugin", () => {
  beforeEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("attaches one generated graph to the app runtime without import-time registration", async () => {
    const { entry, component } = createProject();
    const build = createMockBuild("src/index.ts");
    const plugin = crocoPlugin({ di: { graphId: "plugin-test" } });
    plugin.setup(build);

    const onStart = vi.mocked(build.onStart).mock.calls[0]?.[0];
    expect(onStart?.()).toBeUndefined();
    const generatedFile = path.join(TEMP_DIR, ".croco", "di.generated.ts");
    const manifestFile = path.join(TEMP_DIR, ".croco", "di.manifest.json");
    expect(fs.existsSync(generatedFile)).toBe(true);
    expect(fs.existsSync(manifestFile)).toBe(true);
    expect(fs.readFileSync(generatedFile, "utf8")).toContain("new source0.Service(");

    const onLoad = vi.mocked(build.onLoad).mock.calls[0]?.[1];
    const result = await onLoad?.({
      path: entry,
      namespace: "",
      suffix: "",
      pluginData: {},
      with: {},
    });
    const contents = result && "contents" in result ? String(result.contents) : "";
    expect(contents).toContain("@croco/generated-di-graph");
    expect(contents).toContain("createApplicationRuntime(undefined, crocoGeneratedDiGraph)");
    expect(contents).not.toContain("installGeneratedGraph");
    expect(contents).not.toContain("import './Service'");
    expect(result && "watchFiles" in result ? result.watchFiles : []).toContain(component);
    expect(result && "watchDirs" in result ? result.watchDirs : []).toContain(
      path.join(TEMP_DIR, "src"),
    );
  });

  it("regenerates when providers are added, renamed, or removed", () => {
    const { component } = createProject();
    const build = createMockBuild("src/index.ts");
    crocoPlugin().setup(build);
    const onStart = vi.mocked(build.onStart).mock.calls[0]?.[0];

    onStart?.();
    const manifestFile = path.join(TEMP_DIR, ".croco", "di.manifest.json");
    const first = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
      inputHash: string;
      providers: { exportName: string }[];
    };
    expect(first.providers.map((provider) => provider.exportName)).toEqual(["Service"]);

    fs.writeFileSync(
      component,
      `
        import { Component } from "@croco/framework-context";
        @Component()
        export class RenamedService {}
      `,
    );
    onStart?.();
    const renamed = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as typeof first;
    expect(renamed.providers.map((provider) => provider.exportName)).toEqual(["RenamedService"]);
    expect(renamed.inputHash).not.toBe(first.inputHash);

    fs.rmSync(component);
    onStart?.();
    const removed = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as typeof first;
    expect(removed.providers).toEqual([]);
  });

  it("does not generate or inject server providers into browser builds", async () => {
    const { entry } = createProject();
    const build = createMockBuild("src/index.ts", "browser");
    crocoPlugin().setup(build);

    const onStart = vi.mocked(build.onStart).mock.calls[0]?.[0];
    expect(onStart?.()).toBeUndefined();
    expect(fs.existsSync(path.join(TEMP_DIR, ".croco", "di.generated.ts"))).toBe(false);

    const onLoad = vi.mocked(build.onLoad).mock.calls[0]?.[1];
    const result = await onLoad?.({
      path: entry,
      namespace: "",
      suffix: "",
      pluginData: {},
      with: {},
    });
    const contents = result && "contents" in result ? String(result.contents) : "";
    expect(contents).not.toContain("generated-di-graph");
  });

  it("forwards explicit bindings and module ownership to the compiler", () => {
    createProject();
    fs.writeFileSync(
      path.join(TEMP_DIR, "src", "tokens.ts"),
      `
      import { Token } from "@croco/framework-context";
      export const SERVICE = new Token("service");
      export const CONFIG = new Token("config");
    `,
    );
    const modules = [
      {
        id: "services",
        providers: ["app:src/Service#Service", "app:src/tokens#SERVICE", "app:src/tokens#CONFIG"],
        exports: ["app:src/Service#Service", "app:src/tokens#SERVICE"],
      },
    ];
    const build = createMockBuild("src/index.ts");
    crocoPlugin({
      di: {
        bindings: [
          {
            token: { moduleSpecifier: "./src/tokens.ts", exportName: "SERVICE" },
            useExisting: { moduleSpecifier: "./src/Service.ts", exportName: "Service" },
          },
        ],
        modules,
        moduleProviders: [
          {
            token: { moduleSpecifier: "./src/tokens.ts", exportName: "CONFIG" },
            moduleId: "services",
            scope: "singleton",
          },
        ],
      },
    }).setup(build);
    expect(vi.mocked(build.onStart).mock.calls[0]?.[0]()).toBeUndefined();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(TEMP_DIR, ".croco", "di.manifest.json"), "utf8"),
    ) as {
      providers: { stereotype: string; tokenId: string }[];
      modules: typeof modules;
    };
    expect(manifest.providers).toContainEqual(
      expect.objectContaining({ stereotype: "binding", tokenId: "app:src/tokens#SERVICE" }),
    );
    expect(manifest.modules).toEqual(modules);
    expect(manifest.providers).toContainEqual(
      expect.objectContaining({ tokenId: "app:src/tokens#CONFIG", moduleName: "services" }),
    );
  });

  it("includes the DI graph in an SSR server build and excludes it from its browser hydration build", async () => {
    const { entry, component } = createProject();
    fs.writeFileSync(
      component,
      `
      import { Component } from "@croco/framework-context";
      @Component()
      export class Service { readonly title = "server-only-render-provider"; }
    `,
    );
    fs.writeFileSync(
      entry,
      `
      import { createApplicationRuntime } from "@croco/framework-module";
      import { Service } from "./Service";
      const runtime = createApplicationRuntime();
      export async function render() {
        return new Response("<h1>" + runtime.get(Service).title + "</h1>");
      }
    `,
    );
    const browserEntry = path.join(TEMP_DIR, "src", "hydrate.ts");
    fs.writeFileSync(
      browserEntry,
      'export const hydrate = () => document.querySelector("h1")?.textContent;',
    );
    const common: esbuild.BuildOptions = {
      absWorkingDir: TEMP_DIR,
      format: "esm",
      bundle: true,
      write: false,
      metafile: true,
      external: ["@croco/framework-context", "@croco/framework-module", "reflect-metadata"],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    };
    const server = await esbuild.build({
      ...common,
      entryPoints: [entry],
      platform: "node",
      plugins: [crocoPlugin()],
    });
    expect(server.outputFiles?.[0]?.text).toContain("server-only-render-provider");
    expect(Object.keys(server.metafile?.inputs ?? {})).toContain(".croco/di.generated.ts");
    const browser = await esbuild.build({
      ...common,
      entryPoints: [browserEntry],
      platform: "browser",
      plugins: [crocoPlugin({ reflectMetadata: false })],
    });
    expect(browser.outputFiles?.[0]?.text).toContain("querySelector");
    expect(browser.outputFiles?.[0]?.text).not.toContain("server-only-render-provider");
    expect(Object.keys(browser.metafile?.inputs ?? {})).toEqual(["src/hydrate.ts"]);
  });

  it("builds an application with the generated graph through the real esbuild plugin", async () => {
    const { entry } = createProject();
    fs.writeFileSync(entry, `#!/usr/bin/env node\n${fs.readFileSync(entry, "utf8")}`);
    const result = await esbuild.build({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform: "node",
      format: "esm",
      bundle: true,
      write: false,
      external: ["@croco/framework-context", "@croco/framework-module", "reflect-metadata"],
      plugins: [crocoPlugin()],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });

    expect(result.errors).toEqual([]);
    expect(result.outputFiles[0]?.text).not.toContain("RenamedService");
    expect(result.outputFiles[0]?.text).toContain("var Service = class");
  });

  it("attaches graphs in imported composition modules for multiple server entrypoints", async () => {
    const { entry } = createProject();
    const composition = path.join(TEMP_DIR, "src", "app.ts");
    fs.writeFileSync(
      composition,
      `
      import { createApplicationRuntime as createRuntime } from "@croco/framework-module";
      import { Service } from "./Service";
      const crocoGeneratedDiGraph = "existing-binding";
      export const runtime = createRuntime(undefined,);
      export const resolve = () => [runtime.get(Service).constructor.name, crocoGeneratedDiGraph];
    `,
    );
    fs.writeFileSync(entry, 'export { runtime, resolve } from "./app";');
    const secondEntry = path.join(TEMP_DIR, "src", "worker.ts");
    fs.writeFileSync(secondEntry, 'export { runtime, resolve } from "./app";');
    const result = await esbuild.build({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry, secondEntry],
      outdir: path.join(TEMP_DIR, "dist"),
      platform: "node",
      format: "cjs",
      bundle: true,
      write: false,
      alias: {
        "reflect-metadata": createRequire(
          path.resolve(__dirname, "../../../framework-context/package.json"),
        ).resolve("reflect-metadata"),
      },
      plugins: [crocoPlugin()],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });
    expect(result.outputFiles).toHaveLength(2);
    for (const output of result.outputFiles) {
      const loaded = { exports: {} };
      new Function("require", "module", "exports", output.text)(
        createRequire(entry),
        loaded,
        loaded.exports,
      );
      const app = loaded.exports as { resolve(): string[]; runtime: { dispose(): Promise<void> } };
      try {
        expect(app.resolve()).toEqual(["Service", "existing-binding"]);
      } finally {
        await app.runtime.dispose();
      }
    }
  });

  it("preserves an explicit graph argument in an imported composition module", async () => {
    const { entry } = createProject();
    fs.writeFileSync(entry, 'export { runtime } from "./app";');
    fs.writeFileSync(
      path.join(TEMP_DIR, "src", "app.ts"),
      `
      import * as application from "@croco/framework-module";
      const explicitGraph = { version: 1, graphId: "explicit", compilerVersion: "test", inputHash: "test", providers: [], roots: [] } as const;
      export const runtime = application.createApplicationRuntime(undefined, explicitGraph);
    `,
    );
    const result = await esbuild.build({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform: "node",
      format: "esm",
      bundle: true,
      write: false,
      metafile: true,
      external: ["@croco/framework-module"],
      plugins: [crocoPlugin({ reflectMetadata: false })],
    });
    expect(result.outputFiles[0]?.text).toContain("explicitGraph");
    expect(Object.keys(result.metafile?.inputs ?? {})).not.toContain(".croco/di.generated.ts");
  });

  it("rejects a server build whose imported modules never bind an application runtime", async () => {
    const { entry } = createProject();
    fs.writeFileSync(entry, 'export { value } from "./app";');
    fs.writeFileSync(path.join(TEMP_DIR, "src", "app.ts"), "export const value = 1;");
    await expect(
      esbuild.build({
        absWorkingDir: TEMP_DIR,
        entryPoints: [entry],
        platform: "node",
        bundle: true,
        write: false,
        logLevel: "silent",
        plugins: [crocoPlugin({ reflectMetadata: false })],
      }),
    ).rejects.toThrow("CROCO_DI_COMPILE_001");
  });

  it("rebuilds provider generations without replacing in-flight scopes or publishing failed graphs", async () => {
    const { entry, component } = createProject();
    fs.writeFileSync(
      entry,
      `
      import { Container } from "@croco/framework-context";
      import { createApplicationRuntime } from "@croco/framework-module";
      export const runtime = createApplicationRuntime();
      export const resolveAll = () => runtime.run(() =>
        Container.getGeneratedProviderTokens("component").map(token => Container.get(token))
      );
    `,
    );
    const providerSource = (name: string, version: string) => `
      import { Component } from "@croco/framework-context";
      @Component()
      export class ${name} {
        readonly version = ${JSON.stringify(version)};
        disposed = false;
        [Symbol.dispose]() { this.disposed = true; }
      }
    `;
    fs.writeFileSync(component, providerSource("Service", "first"));
    type Instance = { readonly version: string; readonly disposed: boolean };
    type Generation = {
      readonly runtime: {
        run<T>(callback: () => Promise<T>): Promise<T>;
        dispose(): Promise<void>;
      };
      readonly resolveAll: () => Instance[];
    };
    const generations: Generation[] = [];
    const context = await esbuild.context({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform: "node",
      format: "cjs",
      bundle: true,
      write: false,
      logLevel: "silent",
      alias: {
        "reflect-metadata": createRequire(
          path.resolve(__dirname, "../../../framework-context/package.json"),
        ).resolve("reflect-metadata"),
      },
      plugins: [crocoPlugin({ di: { graphId: "rebuild-test" } })],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });
    const rebuild = async (): Promise<Generation> => {
      const result = await context.rebuild();
      const output = result.outputFiles?.[0];
      expect(output).toBeDefined();
      const loaded = { exports: {} };
      new Function("require", "module", "exports", output?.text ?? "")(
        createRequire(entry),
        loaded,
        loaded.exports,
      );
      const generation = loaded.exports as Generation;
      generations.push(generation);
      return generation;
    };
    let releaseRequest: () => void = () => {};
    const requestBarrier = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    let inFlight: Promise<Instance[]> | undefined;
    try {
      const first = await rebuild();
      const original = first.resolveAll()[0];
      expect(original?.version).toBe("first");
      inFlight = first.runtime.run(async () => {
        await requestBarrier;
        return first.resolveAll();
      });

      const addedFile = path.join(TEMP_DIR, "src", "Added.ts");
      fs.writeFileSync(addedFile, providerSource("Added", "added"));
      const added = await rebuild();
      expect(
        added
          .resolveAll()
          .map((instance) => instance.version)
          .sort(),
      ).toEqual(["added", "first"]);
      expect(added.resolveAll().find((instance) => instance.version === "first")).not.toBe(
        original,
      );

      const graphFile = path.join(TEMP_DIR, ".croco", "di.generated.ts");
      const manifestFile = path.join(TEMP_DIR, ".croco", "di.manifest.json");
      const lastValidGraph = fs.readFileSync(graphFile, "utf8");
      const lastValidManifest = fs.readFileSync(manifestFile, "utf8");
      fs.writeFileSync(
        component,
        `
        import { Component, Inject } from "@croco/framework-context";
        @Component()
        export class Broken { constructor(@Inject("missing") value: unknown) {} }
      `,
      );
      await expect(context.rebuild()).rejects.toThrow("CROCO_DI");
      expect(fs.readFileSync(graphFile, "utf8")).toBe(lastValidGraph);
      expect(fs.readFileSync(manifestFile, "utf8")).toBe(lastValidManifest);
      expect(first.resolveAll()).toEqual([original]);
      expect(original?.disposed).toBe(false);

      fs.writeFileSync(component, providerSource("RenamedService", "renamed"));
      const renamed = await rebuild();
      expect(
        renamed
          .resolveAll()
          .map((instance) => instance.version)
          .sort(),
      ).toEqual(["added", "renamed"]);
      expect(fs.readFileSync(graphFile, "utf8")).toContain("RenamedService");

      fs.rmSync(component);
      fs.rmSync(addedFile);
      const removed = await rebuild();
      expect(removed.resolveAll()).toEqual([]);
      releaseRequest();
      expect(await inFlight).toEqual([original]);
      await first.runtime.dispose();
      expect(original?.disposed).toBe(true);
      expect(removed.resolveAll()).toEqual([]);
    } finally {
      releaseRequest();
      await inFlight;
      await context.dispose();
      await Promise.all(generations.map((generation) => generation.runtime.dispose()));
    }
  }, 30_000);

  it("watches provider additions, invalid changes, renames, and deletion automatically", async () => {
    const { entry, component } = createProject();
    const manifestFile = path.join(TEMP_DIR, ".croco", "di.manifest.json");
    const buildResults: number[] = [];
    const buildErrors: string[][] = [];
    const context = await esbuild.context({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform: "node",
      bundle: true,
      write: false,
      logLevel: "silent",
      external: ["@croco/framework-context", "@croco/framework-module", "reflect-metadata"],
      plugins: [
        crocoPlugin(),
        {
          name: "watch-observer",
          setup(build) {
            build.onEnd((result) => {
              buildResults.push(result.errors.length);
              buildErrors.push(result.errors.map((error) => error.text));
            });
          },
        },
      ],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });
    const providerNames = (): string[] => {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
        providers: { exportName: string }[];
      };
      return manifest.providers.map((provider) => provider.exportName).sort();
    };
    const waitFor = async (predicate: () => boolean): Promise<void> => {
      const deadline = Date.now() + 20_000;
      while (!predicate()) {
        if (Date.now() > deadline)
          throw new Error(
            `Timed out waiting for esbuild watch rebuild: ${JSON.stringify({ buildResults, buildErrors, providers: fs.existsSync(manifestFile) ? providerNames() : null })}`,
          );
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    try {
      await context.watch();
      await waitFor(() => buildResults.length > 0 && fs.existsSync(manifestFile));
      expect(providerNames()).toEqual(["Service"]);

      const addedFile = path.join(TEMP_DIR, "src", "Added.ts");
      fs.writeFileSync(
        addedFile,
        'import { Component } from "@croco/framework-context"; @Component() export class Added {}',
      );
      await waitFor(() => providerNames().join() === "Added,Service");
      await waitFor(() => buildResults.length >= 2);

      const lastValidManifest = fs.readFileSync(manifestFile, "utf8");
      const beforeFailure = buildResults.length;
      fs.writeFileSync(
        component,
        'import { Component, Inject } from "@croco/framework-context"; @Component() export class Broken { constructor(@Inject("missing") value: unknown) {} }',
      );
      await waitFor(() => buildResults.length > beforeFailure && buildResults.at(-1)! > 0);
      expect(fs.readFileSync(manifestFile, "utf8")).toBe(lastValidManifest);

      const beforeRecovery = buildResults.length;
      fs.writeFileSync(
        component,
        'import { Component } from "@croco/framework-context"; @Component() export class Renamed {}',
      );
      await waitFor(
        () =>
          buildResults.length > beforeRecovery &&
          buildResults.at(-1) === 0 &&
          providerNames().join() === "Added,Renamed",
      );

      const beforeFirstDeletion = buildResults.length;
      fs.rmSync(addedFile);
      await waitFor(
        () =>
          buildResults.length > beforeFirstDeletion &&
          buildResults.at(-1) === 0 &&
          providerNames().join() === "Renamed",
      );
      const beforeFinalDeletion = buildResults.length;
      fs.rmSync(component);
      await waitFor(
        () =>
          buildResults.length > beforeFinalDeletion &&
          buildResults.at(-1) === 0 &&
          providerNames().length === 0,
      );
    } finally {
      await context.dispose();
    }
  }, 90_000);

  it("recovers an initially invalid nested provider without touching the scan root", async () => {
    const { entry, component } = createProject();
    const nestedDir = path.join(TEMP_DIR, "src", "nested");
    const nestedProvider = path.join(nestedDir, "Service.ts");
    const manifestFile = path.join(TEMP_DIR, ".croco", "di.manifest.json");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.rmSync(component);
    fs.writeFileSync(
      nestedProvider,
      'import { Component, Inject } from "@croco/framework-context"; @Component() export class Service { constructor(@Inject("missing") value: unknown) {} }',
    );

    const buildResults: string[][] = [];
    const context = await esbuild.context({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform: "node",
      bundle: true,
      write: false,
      logLevel: "silent",
      external: ["@croco/framework-context", "@croco/framework-module", "reflect-metadata"],
      plugins: [
        crocoPlugin(),
        {
          name: "watch-observer",
          setup(build) {
            build.onEnd((result) => {
              buildResults.push(result.errors.map((error) => error.text));
            });
          },
        },
      ],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });
    const waitFor = async (predicate: () => boolean): Promise<void> => {
      const deadline = Date.now() + 20_000;
      while (!predicate()) {
        if (Date.now() > deadline)
          throw new Error(
            `Timed out waiting for nested provider recovery: ${JSON.stringify(buildResults)}`,
          );
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };

    try {
      await context.watch();
      await waitFor(
        () =>
          buildResults.length > 0 &&
          buildResults[0]?.some((error) => error.includes("CROCO_DI")) === true,
      );
      expect(fs.existsSync(manifestFile)).toBe(false);

      fs.writeFileSync(
        nestedProvider,
        'import { Component } from "@croco/framework-context"; @Component() export class Service {}',
      );
      await waitFor(
        () =>
          buildResults.length > 1 &&
          buildResults.at(-1)?.length === 0 &&
          fs.existsSync(manifestFile),
      );
      const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
        providers: { exportName: string }[];
      };
      expect(manifest.providers.map((provider) => provider.exportName)).toEqual(["Service"]);
    } finally {
      await context.dispose();
    }
  }, 60_000);

  it("watches a selected descriptor through initial and subsequent compiler failures", async () => {
    const { entry } = createProject();
    const libraryDir = path.join(TEMP_DIR, "library");
    const descriptorFile = path.join(libraryDir, "croco-di.json");
    const manifestFile = path.join(TEMP_DIR, ".croco", "di.manifest.json");
    fs.mkdirSync(libraryDir, { recursive: true });
    fs.writeFileSync(
      path.join(libraryDir, "graph.ts"),
      "export const generatedDiGraph = { providers: [], roots: [] };\n",
    );
    fs.writeFileSync(descriptorFile, "{");

    const descriptor = JSON.stringify({
      version: "croco.di-package-descriptor.v1",
      packageName: "@fixture/library",
      packageVersion: "1.0.0",
      compilerVersion: "croco.di-compiler.v1",
      inputHash: "fixture",
      graph: { import: "./graph.ts", exportName: "generatedDiGraph" },
      providers: [],
      roots: [],
    });
    const buildResults: string[][] = [];
    const context = await esbuild.context({
      absWorkingDir: TEMP_DIR,
      entryPoints: [entry],
      platform: "node",
      bundle: true,
      write: false,
      logLevel: "silent",
      external: ["@croco/framework-context", "@croco/framework-module", "reflect-metadata"],
      plugins: [
        crocoPlugin({ di: { packageDescriptors: ["./library/croco-di.json"] } }),
        {
          name: "watch-observer",
          setup(build) {
            build.onEnd((result) => {
              buildResults.push(result.errors.map((error) => error.text));
            });
          },
        },
      ],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });
    const waitFor = async (predicate: () => boolean): Promise<void> => {
      const deadline = Date.now() + 20_000;
      while (!predicate()) {
        if (Date.now() > deadline)
          throw new Error(
            `Timed out waiting for descriptor recovery: ${JSON.stringify(buildResults)}`,
          );
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };

    try {
      await context.watch();
      await waitFor(() => buildResults.length > 0 && buildResults[0]?.length !== 0);
      expect(fs.existsSync(manifestFile)).toBe(false);

      fs.writeFileSync(descriptorFile, descriptor);
      await waitFor(() => buildResults.length > 1 && buildResults.at(-1)?.length === 0);
      expect(fs.existsSync(manifestFile)).toBe(true);

      fs.writeFileSync(descriptorFile, "{");
      await waitFor(() => buildResults.length > 2 && buildResults.at(-1)?.length !== 0);

      fs.writeFileSync(descriptorFile, descriptor);
      await waitFor(() => buildResults.length > 3 && buildResults.at(-1)?.length === 0);
    } finally {
      await context.dispose();
    }
  }, 90_000);
});
