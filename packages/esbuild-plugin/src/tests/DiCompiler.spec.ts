import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DiCompilerError,
  compileDiGraph,
  createDiPackageDescriptor,
  writeDiGraph,
  writeDiPackageDescriptor,
} from "../libs/DiCompiler";

const TEMP_DIR = path.join(__dirname, "di-compiler-temp");

function writeProject(files: Readonly<Record<string, string>>): void {
  writeProjectAt(TEMP_DIR, files);
}

function writeProjectAt(projectDir: string, files: Readonly<Record<string, string>>): void {
  const repositoryRoot = path.resolve(__dirname, "../../../..");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        experimentalDecorators: true,
        strict: true,
        baseUrl: repositoryRoot,
        paths: {
          "@croco/framework-context": ["packages/framework-context/src/index.ts"],
        },
      },
    }),
  );
  for (const [fileName, contents] of Object.entries(files)) {
    const filePath = path.join(projectDir, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
}

describe("compileDiGraph", () => {
  it("preserves graph output when the same compiler project is relocated", () => {
    const roots = [path.join(TEMP_DIR, "original"), path.join(TEMP_DIR, "relocated")];
    const results = roots.map((baseDir) => {
      writeProjectAt(baseDir, {
        "src/Service.ts":
          'import { Component } from "@croco/framework-context"; @Component() export class Service {}',
      });
      const configFile = path.join(baseDir, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as {
        compilerOptions: Record<string, unknown>;
      };
      Object.assign(config.compilerOptions, {
        rootDir: "src",
        outDir: "dist",
        typeRoots: ["./types"],
      });
      fs.writeFileSync(configFile, JSON.stringify(config));
      return compileDiGraph({ baseDir, graphId: "relocatable" });
    });
    expect(results[0]?.manifest.inputHash).toBe(results[1]?.manifest.inputHash);
    expect(results[0]?.code).toBe(results[1]?.code);
    expect(results[0]?.manifest).toEqual(results[1]?.manifest);
  });

  const binding = (target: string, options: { multiple?: boolean; override?: boolean } = {}) => ({
    token: { moduleSpecifier: "./src/Service.ts", exportName: "SERVICE" },
    useExisting: { moduleSpecifier: "./src/Service.ts", exportName: target },
    ...options,
  });

  function writeBindingFixture(injection = "Inject", parameterType = "Service", extra = ""): void {
    writeProject({
      "src/Service.ts": `
      import { Component, Token, Inject, InjectMany, InjectOptional } from "@croco/framework-context";
      export const SERVICE = new Token<Service>("service");
      @Component() export class Service { value = "ok"; }
      @Component() export class Other { value = "other"; }
      @Component() export class Consumer { constructor(@${injection}(SERVICE) readonly value: ${parameterType}) {} }
      ${extra}
    `,
    });
  }

  it("validates explicit bindings, ambiguity, overrides, many and optional injection before generation", () => {
    writeBindingFixture();
    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow(
      "No scanned provider or explicit binding",
    );
    expect(() => compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Missing")] })).toThrow(
      "references missing provider",
    );
    expect(() =>
      compileDiGraph({
        baseDir: TEMP_DIR,
        bindings: [binding("Service", { multiple: true }), binding("Other", { multiple: true })],
      }),
    ).toThrow("ambiguous");
    expect(
      compileDiGraph({
        baseDir: TEMP_DIR,
        bindings: [binding("Service"), binding("Other", { override: true })],
      }).manifest.providers.filter((provider) => provider.stereotype === "binding"),
    ).toHaveLength(1);
    writeBindingFixture("InjectMany", "readonly Service[]");
    expect(
      compileDiGraph({
        baseDir: TEMP_DIR,
        bindings: [binding("Service", { multiple: true }), binding("Other", { multiple: true })],
      }).code,
    ).toContain("resolver.getMany(");
    writeBindingFixture("InjectOptional", "Service | undefined");
    expect(compileDiGraph({ baseDir: TEMP_DIR }).code).toContain("resolver.getOptional(");
  }, 30_000);

  it("carries module ownership and rejects private access and duplicate ownership", () => {
    writeBindingFixture("InjectOptional", "Service | undefined");
    const service = "app:src/Service#Service";
    const consumer = "app:src/Service#Consumer";
    const token = "app:src/Service#SERVICE";
    const modules = [
      { id: "library", providers: [service, token], exports: [token] },
      { id: "app", providers: [consumer], imports: ["library"] },
    ];
    const result = compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Service")], modules });
    expect(result.manifest.modules).toEqual(modules);
    expect(result.code).toContain('moduleName: "library"');
    let privateAccessError: unknown;
    try {
      compileDiGraph({
        baseDir: TEMP_DIR,
        bindings: [binding("Service")],
        modules: [{ ...modules[0]!, exports: [] }, modules[1]!],
      });
    } catch (error) {
      privateAccessError = error;
    }
    expect(privateAccessError).toBeInstanceOf(DiCompilerError);
    expect((privateAccessError as DiCompilerError).diagnostics[0]).toMatchObject({
      file: "src/Service.ts",
      line: 6,
      message: expect.stringContaining("private provider"),
    });
    expect(() =>
      compileDiGraph({
        baseDir: TEMP_DIR,
        modules: [
          { id: "one", providers: [service] },
          { id: "two", providers: [service] },
        ],
      }),
    ).toThrow("duplicate module ownership");
  });

  it("validates module factory contracts without generating their providers", () => {
    writeBindingFixture();
    const token = { moduleSpecifier: "./src/Service.ts", exportName: "SERVICE" };
    const service = { moduleSpecifier: "./src/Service.ts", exportName: "Service" };
    const moduleProvider = { token, moduleId: "library", scope: "singleton" as const };
    const modules = [
      {
        id: "library",
        providers: ["app:src/Service#SERVICE"],
        exports: ["app:src/Service#SERVICE"],
      },
      { id: "app", providers: ["app:src/Service#Consumer"], imports: ["library"] },
    ];
    const options = { baseDir: TEMP_DIR, modules, moduleProviders: [moduleProvider] };
    const result = compileDiGraph(options);
    expect(
      result.manifest.providers.find((provider) => provider.stereotype === "module-provider"),
    ).toMatchObject({
      tokenId: "app:src/Service#SERVICE",
      moduleName: "library",
      scope: "singleton",
      source: { file: "src/Service.ts" },
      dependencies: [],
    });
    expect(result.code).toContain("moduleProviders: [");
    expect(result.code.match(/tokenId: "app:src\/Service#SERVICE"/g)).toHaveLength(2);
    expect(compileDiGraph(options).manifest.inputHash).toBe(result.manifest.inputHash);
    const soleModule = compileDiGraph({ ...options, modules: [modules[0]!] });
    expect(
      soleModule.manifest.providers.every((provider) => provider.moduleName === "library"),
    ).toBe(true);
    expect(soleModule.code).toContain('moduleName: "library"');
    expect(() =>
      compileDiGraph({ ...options, modules: [{ ...modules[0]!, exports: [] }, modules[1]!] }),
    ).toThrow("private provider");
    expect(() =>
      compileDiGraph({ ...options, moduleProviders: [{ ...moduleProvider, moduleId: "unknown" }] }),
    ).toThrow("must be owned");
    expect(() =>
      compileDiGraph({ ...options, moduleProviders: [moduleProvider, moduleProvider] }),
    ).toThrow("declared by both");
    expect(() => compileDiGraph({ ...options, bindings: [binding("Service")] })).toThrow(
      "declared by both",
    );
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [{ ...moduleProvider, token: { ...token, exportName: "Missing" } }],
      }),
    ).toThrow("exported runtime value");
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [
          { ...moduleProvider, token: { ...token, moduleSpecifier: "missing-package" } },
        ],
      }),
    ).toThrow("Cannot resolve");
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [
          { ...moduleProvider, scope: "request" } as unknown as typeof moduleProvider,
        ],
      }),
    ).toThrow("must use singleton scope");
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [{ ...moduleProvider, dependencies: [{ token }] }],
      }),
    ).toThrow("cycle");
    expect(
      compileDiGraph({
        ...options,
        moduleProviders: [{ ...moduleProvider, dependencies: [{ token: service }] }],
      }).manifest.inputHash,
    ).not.toBe(result.manifest.inputHash);
    writeBindingFixture(
      "Inject",
      "Service",
      'export const MISSING = new Token<Service>("missing");',
    );
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [
          { ...moduleProvider, dependencies: [{ token: { ...token, exportName: "MISSING" } }] },
        ],
      }),
    ).toThrow("No provider matches dependency");
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [
          {
            ...moduleProvider,
            dependencies: [{ token: { ...token, exportName: "MISSING" }, optional: true }],
          },
        ],
      }),
    ).not.toThrow();
    writeProject({
      "src/Service.ts": `import { Component, Token } from "@croco/framework-context";
        export const SERVICE = new Token<Service>("service");
        @Component({ scope: "request" }) export class Service { value = "request"; }
        @Component() export class Consumer {}`,
    });
    expect(() =>
      compileDiGraph({
        ...options,
        moduleProviders: [{ ...moduleProvider, dependencies: [{ token: service }] }],
      }),
    ).toThrow("cannot capture request");
  }, 30_000);

  it("reads scope only from the Croco decorator and rejects dynamic scope and inheritance", () => {
    writeProject({
      "src/Service.ts": `import { Component } from "@croco/framework-context"; function Other(options: object): ClassDecorator { return () => {}; } @Other({scope: "request"}) @Component() export class Service {}`,
    });
    expect(compileDiGraph({ baseDir: TEMP_DIR }).manifest.providers[0]?.scope).toBe("singleton");
    for (const options of ['{scope: "invalid"}', "options", "{...options}"]) {
      writeProject({
        "src/Service.ts": `import { Component } from "@croco/framework-context"; const options = {scope: "request"}; @Component(${options}) export class Service {}`,
      });
      expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow("must be static");
    }
    writeProject({
      "src/Service.ts": `import { Component } from "@croco/framework-context"; class Base { constructor(value: string) {} } @Component() export class Service extends Base {}`,
    });
    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow(
      "Inherited providers are not supported",
    );
  });

  it("hashes source implementation and optional/many flags", () => {
    writeBindingFixture("InjectOptional", "Service | undefined");
    const first = compileDiGraph({ baseDir: TEMP_DIR }).manifest.inputHash;
    const file = path.join(TEMP_DIR, "src/Service.ts");
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replace('value = "ok"', 'value = "changed"'),
    );
    expect(compileDiGraph({ baseDir: TEMP_DIR }).manifest.inputHash).not.toBe(first);
    const optional = compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Service")] }).manifest
      .inputHash;
    writeBindingFixture("InjectMany", "readonly Service[]");
    expect(
      compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Service")] }).manifest.inputHash,
    ).not.toBe(optional);
  });

  it("semantically verifies constructor and property injection and binding token types", () => {
    writeBindingFixture("Inject", "number");
    expect(() => compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Service")] })).toThrow(
      "not assignable",
    );
    writeBindingFixture(
      "Inject",
      "Service",
      "@Component() export class Invalid { @Inject(SERVICE) value!: number; }",
    );
    expect(() => compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Service")] })).toThrow(
      "not assignable",
    );
    writeBindingFixture("Inject", "Service", "@Component() export class Invalid { amount = 1; }");
    expect(() => compileDiGraph({ baseDir: TEMP_DIR, bindings: [binding("Invalid")] })).toThrow(
      "missing",
    );
  });

  it("discovers task handler components with method task metadata", () => {
    writeProject({
      "src/Handler.ts": `import { Component } from "@croco/framework-context"; import { Task } from "@croco/tasks-core"; @Component() export class Handler { @Task({ name: "fixture.task" }) async run(): Promise<void> {} }`,
    });
    expect(compileDiGraph({ baseDir: TEMP_DIR }).manifest.providers[0]?.exportName).toBe("Handler");
  });

  it("applies class overrides before lifetime validation and watches empty nested directories", () => {
    writeProject({
      "src/Service.ts": `import { Component } from "@croco/framework-context"; @Component({scope: "request"}) export class Service { value = "request"; } @Component() export class Replacement { value = "singleton"; } @Component() export class Consumer { constructor(readonly service: Service) {} }`,
    });
    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow("cannot capture request");
    const nested = path.join(TEMP_DIR, "src/empty/nested");
    fs.mkdirSync(nested, { recursive: true });
    const result = compileDiGraph({
      baseDir: TEMP_DIR,
      bindings: [
        {
          token: { moduleSpecifier: "./src/Service.ts", exportName: "Service" },
          useExisting: { moduleSpecifier: "./src/Service.ts", exportName: "Replacement" },
          override: true,
        },
      ],
    });
    expect(
      result.manifest.providers.find((provider) => provider.exportName === "Service")?.scope,
    ).toBe("singleton");
    expect(result.watchDirs).toContain(nested);
  });
  beforeEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("discovers unimported decorated providers and generates explicit factories", async () => {
    writeProject({
      "src/PricingService.ts": `
        import { Component } from "@croco/framework-context";
        @Component({ scope: "request" })
        export class PricingService {}
      `,
      "src/CheckoutService.ts": `
        import { Component } from "@croco/framework-context";
        import { PricingService } from "./PricingService";
        @Component({ scope: "request" })
        export class CheckoutService {
          constructor(readonly pricing: PricingService) {}
        }
      `,
      "src/index.ts": "export const bootstrap = true;",
    });

    const result = compileDiGraph({ baseDir: TEMP_DIR, graphId: "checkout" });
    writeDiGraph(result);

    expect(result.manifest.providers.map((provider) => provider.exportName)).toEqual([
      "CheckoutService",
      "PricingService",
    ]);
    expect(result.code).toContain("new source0.CheckoutService(");
    expect(result.code).toContain("resolver.get(source1.PricingService)");
    expect(result.code).not.toContain("Container.installGeneratedGraph");
    const build = await esbuild.build({
      entryPoints: [result.outFile],
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      external: ["@croco/framework-context"],
      tsconfig: path.join(TEMP_DIR, "tsconfig.json"),
    });
    expect(build.errors).toEqual([]);
  });

  it("uses symbol identity and ignores a user decorator with the same name", () => {
    writeProject({
      "src/Fake.ts": `
        function Component(): ClassDecorator { return () => undefined; }
        @Component()
        export class FakeService {}
      `,
      "src/Real.ts": `
        import { Component as CrocoComponent } from "@croco/framework-context";
        @CrocoComponent()
        export class RealService {}
      `,
    });

    const result = compileDiGraph({ baseDir: TEMP_DIR });

    expect(result.manifest.providers.map((provider) => provider.exportName)).toEqual([
      "RealService",
    ]);
  });

  it("generates factories for static tokens, lazy references, and injected properties", () => {
    writeProject({
      "src/Dependencies.ts": `
        import { Component, Token } from "@croco/framework-context";
        export const SETTINGS = new Token<{ region: string }>("SETTINGS");
        export const LABEL = new Token<string>("LABEL");
        @Component()
        export class Repository {}
        @Component()
        export class Settings { region = "test"; }
      `,
      "src/Service.ts": `
        import { Component, Inject, InjectOptional } from "@croco/framework-context";
        import { LABEL, Repository, SETTINGS } from "./Dependencies";
        @Component()
        export class Service {
          @Inject(() => Repository)
          repository!: Repository;
          constructor(
            @Inject(SETTINGS) readonly settings: { region: string },
            @InjectOptional(LABEL) readonly label: string = "default",
          ) {}
        }
      `,
    });

    const result = compileDiGraph({
      baseDir: TEMP_DIR,
      bindings: [
        {
          token: { moduleSpecifier: "./src/Dependencies.ts", exportName: "SETTINGS" },
          useExisting: { moduleSpecifier: "./src/Dependencies.ts", exportName: "Settings" },
        },
      ],
    });

    expect(result.code).toContain("resolver.get(source0.SETTINGS)");
    expect(result.code).toContain("resolver.getOptional(source0.LABEL)");
    expect(result.code).toContain('instance["repository"] = resolver.get(source0.Repository)');
    expect(
      result.manifest.providers.find((provider) => provider.exportName === "Service")?.dependencies,
    ).toEqual([
      expect.objectContaining({ reason: "explicit-token" }),
      expect.objectContaining({ optional: true, reason: "explicit-token" }),
      expect.objectContaining({ propertyKey: "repository", reason: "explicit-token" }),
    ]);
  });

  it("produces deterministic code and input hashes", () => {
    writeProject({
      "src/Service.ts": `
        import { Component } from "@croco/framework-context";
        @Component()
        export class Service {}
      `,
    });

    const first = compileDiGraph({ baseDir: TEMP_DIR });
    const second = compileDiGraph({ baseDir: TEMP_DIR });

    expect(second.code).toBe(first.code);
    expect(second.manifest).toEqual(first.manifest);
  });

  it("keeps the input hash stable when authored code imports generated graph output", () => {
    writeProject({
      "src/Service.ts":
        'import { Component } from "@croco/framework-context"; @Component() export class Service {}',
      "src/app.ts":
        'import { generatedDiGraph } from "../.croco/di.generated"; export const graph = generatedDiGraph;',
    });

    const first = compileDiGraph({ baseDir: TEMP_DIR });
    writeDiGraph(first);
    const second = compileDiGraph({ baseDir: TEMP_DIR });

    expect(second.manifest.inputHash).toBe(first.manifest.inputHash);
    expect(second.code).toBe(first.code);
  });

  it("resolves constructor import aliases through re-exports", () => {
    writeProject({
      "src/Dependency.ts":
        'import { Component } from "@croco/framework-context"; @Component() export class Dependency {}',
      "src/barrel.ts": 'export { Dependency as PublicDependency } from "./Dependency";',
      "src/Consumer.ts":
        'import { Component } from "@croco/framework-context"; import { PublicDependency as Alias } from "./barrel"; @Component() export class Consumer { constructor(readonly dependency: Alias) {} }',
    });
    expect(
      compileDiGraph({ baseDir: TEMP_DIR }).manifest.providers.find(
        (provider) => provider.exportName === "Consumer",
      )?.dependencies[0]?.tokenId,
    ).toBe("app:src/Dependency#Dependency");
  });

  it("preserves declared multi-binding order and rejects dynamic token calls", () => {
    writeBindingFixture("InjectMany", "readonly Service[]");
    const options = {
      baseDir: TEMP_DIR,
      bindings: [binding("Other", { multiple: true }), binding("Service", { multiple: true })],
    };
    const result = compileDiGraph(options);
    expect(
      result.manifest.providers
        .filter((provider) => provider.stereotype === "binding")
        .map((provider) => provider.dependencies[0]?.tokenId),
    ).toEqual(["app:src/Service#Other", "app:src/Service#Service"]);
    expect(compileDiGraph(options).code).toBe(result.code);
    writeProject({
      "src/Dynamic.ts":
        'import { Component, Inject, Token } from "@croco/framework-context"; function token() { return new Token<string>("dynamic"); } @Component() export class Dynamic { constructor(@Inject(token()) readonly value: string) {} }',
    });
    expect(() => compileDiGraph(options)).toThrow("cannot be resolved without executing user code");
  });

  it("rejects incompatible package descriptor compiler versions", () => {
    writeProject({
      "descriptor.json": JSON.stringify({
        version: "croco.di-package-descriptor.v1",
        compilerVersion: "unsupported",
        packageName: "fixture",
        packageVersion: "1",
        inputHash: "fixture",
        graph: { import: "./graph.js", exportName: "generatedDiGraph" },
        providers: [],
        roots: [],
      }),
    });
    expect(() =>
      compileDiGraph({ baseDir: TEMP_DIR, packageDescriptors: ["./descriptor.json"] }),
    ).toThrow("incompatible");
  });

  it("links a selected package descriptor without scanning package sources", async () => {
    const libraryDir = path.join(TEMP_DIR, "library");
    const appDir = path.join(TEMP_DIR, "app");
    writeProjectAt(libraryDir, {
      "src/LibraryService.ts": `
        import { Component } from "@croco/framework-context";
        @Component()
        export class LibraryService {}
      `,
    });
    const library = compileDiGraph({
      baseDir: libraryDir,
      graphId: "fixture-library",
      packageName: "@fixture/library",
    });
    writeDiGraph(library);
    const descriptorFile = path.join(libraryDir, ".croco", "di.package.json");
    writeDiPackageDescriptor(
      descriptorFile,
      createDiPackageDescriptor(library, {
        packageName: "@fixture/library",
        packageVersion: "1.0.0",
        graphImport: "./di.generated",
      }),
    );
    writeProjectAt(appDir, {
      "src/AppService.ts": `
        import { Component } from "@croco/framework-context";
        import { LibraryService } from "@fixture/library";
        @Component()
        export class AppService {
          constructor(readonly library: LibraryService) {}
        }
      `,
    });
    const appTsconfigFile = path.join(appDir, "tsconfig.json");
    const appTsconfig = JSON.parse(fs.readFileSync(appTsconfigFile, "utf8")) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    appTsconfig.compilerOptions.paths["@fixture/library"] = [
      path.join(libraryDir, "src/LibraryService.ts"),
    ];
    fs.writeFileSync(appTsconfigFile, JSON.stringify(appTsconfig));
    fs.writeFileSync(
      path.join(appDir, "package.json"),
      JSON.stringify({ name: "fixture-app", type: "module" }),
    );
    const installedLibraryDir = path.join(appDir, "node_modules/@fixture/library");
    fs.cpSync(path.join(libraryDir, "src"), path.join(installedLibraryDir, "src"), {
      recursive: true,
    });
    fs.cpSync(path.join(libraryDir, ".croco"), path.join(installedLibraryDir, ".croco"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(installedLibraryDir, "package.json"),
      JSON.stringify({
        name: "@fixture/library",
        version: "1.0.0",
        exports: { "./croco-di.json": "./.croco/di.package.json" },
      }),
    );

    const result = compileDiGraph({
      baseDir: appDir,
      packageDescriptors: ["@fixture/library/croco-di.json"],
    });
    writeDiGraph(result);

    expect(result.manifest.packages).toEqual([
      expect.objectContaining({
        packageName: "@fixture/library",
        packageVersion: "1.0.0",
      }),
    ]);
    expect(result.manifest.providers.map((provider) => provider.exportName)).toEqual([
      "AppService",
      "LibraryService",
    ]);
    expect(result.manifest.providers[1]?.tokenId).toBe("package:@fixture/library#LibraryService");
    expect(result.manifest.providers[0]?.dependencies[0]?.tokenId).toBe(
      "package:@fixture/library#LibraryService",
    );
    expect(result.code).toMatch(/\.\.\.source\d+\.generatedDiGraph\.providers/u);
    expect(result.watchFiles).toContain(path.join(installedLibraryDir, ".croco/di.package.json"));
    const build = await esbuild.build({
      entryPoints: [result.outFile],
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      external: ["@croco/framework-context", "@fixture/library"],
      tsconfig: path.join(appDir, "tsconfig.json"),
    });
    expect(build.errors).toEqual([]);
    const multiDescriptor = createDiPackageDescriptor(library, {
      packageName: "@fixture/library",
      packageVersion: "1.0.0",
      graphImport: "./di.generated",
    });
    const multipleProviders = multiDescriptor.providers.map((provider) => ({
      ...provider,
      multiple: true,
    }));
    writeDiPackageDescriptor(path.join(installedLibraryDir, ".croco/di.package.json"), {
      ...multiDescriptor,
      providers: [...multipleProviders, ...multipleProviders],
    });
    const compileLinked = () =>
      compileDiGraph({ baseDir: appDir, packageDescriptors: ["@fixture/library/croco-di.json"] });
    expect(compileLinked).toThrow("ambiguous");
    for (const injection of ["Inject", "InjectOptional", "InjectMany"]) {
      fs.writeFileSync(
        path.join(appDir, "src/AppService.ts"),
        `
        import { Component, ${injection} } from "@croco/framework-context";
        import { LibraryService } from "@fixture/library";
        @Component() export class AppService {
          constructor(@${injection}(LibraryService) readonly library: ${injection === "InjectMany" ? "readonly LibraryService[]" : "LibraryService | undefined"}) {}
        }
      `,
      );
      if (injection === "InjectMany") expect(compileLinked().code).toContain("resolver.getMany(");
      else expect(compileLinked).toThrow("ambiguous");
    }
  }, 30_000);

  it("builds and runs an app from a packed package graph without reflection fallback", async () => {
    const libraryDir = path.join(TEMP_DIR, "packed-library");
    const appDir = path.join(TEMP_DIR, "packed-app");
    const tarballDir = path.join(TEMP_DIR, "tarballs");
    writeProjectAt(libraryDir, {
      "src/LibraryService.ts": `
          import { Component } from "@croco/framework-context";
          @Component()
          export class LibraryService { readonly source = "packed-library"; }
        `,
    });
    const library = compileDiGraph({
      baseDir: libraryDir,
      graphId: "@fixture/packed-library",
      packageName: "@fixture/packed-library",
    });
    writeDiGraph(library);
    await esbuild.build({
      entryPoints: [path.join(libraryDir, "src/LibraryService.ts"), library.outFile],
      outdir: path.join(libraryDir, "dist"),
      outbase: libraryDir,
      bundle: false,
      format: "esm",
      platform: "node",
      tsconfig: path.join(libraryDir, "tsconfig.json"),
    });
    fs.writeFileSync(
      path.join(libraryDir, "dist/src/LibraryService.d.ts"),
      "export declare class LibraryService { readonly source: string; }",
    );
    fs.writeFileSync(
      path.join(libraryDir, "dist/.croco/di.generated.d.ts"),
      'export declare const generatedDiGraph: import("@croco/framework-context").GeneratedDiGraph;',
    );
    writeDiPackageDescriptor(
      path.join(libraryDir, "dist/croco-di.json"),
      createDiPackageDescriptor(library, {
        packageName: "@fixture/packed-library",
        packageVersion: "1.0.0",
        graphImport: "./.croco/di.generated.js",
      }),
    );
    fs.writeFileSync(
      path.join(libraryDir, "package.json"),
      JSON.stringify({
        name: "@fixture/packed-library",
        version: "1.0.0",
        type: "module",
        files: ["dist"],
        exports: {
          ".": {
            types: "./dist/src/LibraryService.d.ts",
            import: "./dist/src/LibraryService.js",
            require: "./dist/src/LibraryService.js",
          },
          "./croco-di.json": "./dist/croco-di.json",
        },
      }),
    );
    fs.mkdirSync(tarballDir, { recursive: true });
    const tarballName = execFileSync(
      "npm",
      ["pack", "--silent", "--pack-destination", tarballDir],
      { cwd: libraryDir, encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .at(-1);
    if (!tarballName) throw new Error("npm pack did not report a tarball name");

    writeProjectAt(appDir, {
      "src/AppService.ts": `
          import { Component } from "@croco/framework-context";
          import { LibraryService } from "@fixture/packed-library";
          @Component()
          export class AppService {
            constructor(readonly library: LibraryService) {}
          }
          @Component()
          export class Replacement { readonly source = "replacement"; }
        `,
    });
    fs.writeFileSync(
      path.join(appDir, "package.json"),
      JSON.stringify({ name: "packed-consumer", private: true, type: "module" }),
    );
    execFileSync(
      "npm",
      [
        "install",
        "--silent",
        "--ignore-scripts",
        "--no-package-lock",
        path.join(tarballDir, tarballName),
      ],
      { cwd: appDir, stdio: "pipe" },
    );

    expect(fs.existsSync(path.join(appDir, "node_modules/@fixture/packed-library/src"))).toBe(
      false,
    );
    const app = compileDiGraph({
      baseDir: appDir,
      packageDescriptors: ["@fixture/packed-library/croco-di.json"],
    });
    writeDiGraph(app);
    const overridden = compileDiGraph({
      baseDir: appDir,
      packageDescriptors: ["@fixture/packed-library/croco-di.json"],
      outFile: ".croco/override.generated.ts",
      manifestFile: ".croco/override.manifest.json",
      bindings: [
        {
          token: { moduleSpecifier: "@fixture/packed-library", exportName: "LibraryService" },
          useExisting: { moduleSpecifier: "./src/AppService.ts", exportName: "Replacement" },
          override: true,
        },
      ],
    });
    writeDiGraph(overridden);
    fs.writeFileSync(
      path.join(appDir, "runtime.ts"),
      `
          import { Container } from "@croco/framework-context";
          import { generatedDiGraph } from "./.croco/di.generated";
          import { generatedDiGraph as overrideGraph } from "./.croco/override.generated";
          import { AppService } from "./src/AppService";
          const scope = Container.createScope();
          const otherScope = Container.createScope();
          otherScope.run(() => {
            Container.installGeneratedGraph(overrideGraph);
            if (Container.get(AppService).library.source !== "replacement") throw new Error("override failed");
          });
          scope.run(() => {
            Container.installGeneratedGraph(generatedDiGraph);
            const service = Container.get(AppService);
            if (service.library.source !== "packed-library") throw new Error("packed graph resolution failed");
          });
          scope.dispose();
          otherScope.run(() => {
            if (Container.get(AppService).library.source !== "replacement") throw new Error("scope isolation failed");
          });
          otherScope.dispose();
        `,
    );
    const bundleFile = path.join(appDir, "runtime.cjs");
    await esbuild.build({
      entryPoints: [path.join(appDir, "runtime.ts")],
      outfile: bundleFile,
      alias: {
        "@croco/framework-context": path.resolve(
          __dirname,
          "../../../framework-context/src/index.ts",
        ),
      },
      bundle: true,
      format: "cjs",
      platform: "node",
      tsconfig: path.join(appDir, "tsconfig.json"),
    });
    execFileSync(process.execPath, [bundleFile], { cwd: appDir, stdio: "pipe" });

    expect(app.manifest.packages[0]?.packageName).toBe("@fixture/packed-library");
    expect(app.code).not.toContain("design:paramtypes");
    expect(app.code).not.toContain("typedi");
  }, 30_000);

  it("excludes tests, fixtures, scripts, generated files, and client code by default", () => {
    const service = `
      import { Component } from "@croco/framework-context";
      @Component()
      export class Service {}
    `;
    writeProject({
      "src/Included.ts": service,
      "src/Excluded.spec.ts": service,
      "src/fixtures/Excluded.ts": service,
      "src/scripts/Excluded.ts": service,
      "src/generated/Excluded.ts": service,
      "src/client/Excluded.ts": service,
    });

    const result = compileDiGraph({ baseDir: TEMP_DIR });

    expect(result.manifest.providers).toHaveLength(1);
    expect(result.manifest.providers[0]?.source.file).toBe("src/Included.ts");
  });

  it("rejects interface dependencies before generating a factory", () => {
    writeProject({
      "src/Service.ts": `
        import { Component } from "@croco/framework-context";
        interface Gateway { charge(): void }
        @Component()
        export class Service { constructor(readonly gateway: Gateway) {} }
      `,
    });

    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrowError(
      expect.objectContaining<Partial<DiCompilerError>>({
        diagnostics: [
          expect.objectContaining({
            code: "CROCO_DI_COMPILE_002",
            file: "src/Service.ts",
          }),
        ],
      }),
    );
  });

  it("rejects eager cycles and singleton captures of shorter-lived providers", () => {
    writeProject({
      "src/Cycle.ts": `
        import { Component, Inject } from "@croco/framework-context";
        @Component()
        export class First { constructor(@Inject(() => Second) readonly second: Second) {} }
        @Component()
        export class Second { constructor(readonly first: First) {} }
      `,
    });

    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow(/dependency cycle/);

    writeProject({
      "src/Cycle.ts": "",
      "src/Scope.ts": `
        import { Component } from "@croco/framework-context";
        @Component({ scope: "request" })
        export class RequestService {}
        @Component()
        export class SingletonService { constructor(readonly request: RequestService) {} }
      `,
    });

    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow(/cannot capture request provider/);

    writeProject({
      "src/Scope.ts": `
        import { Component } from "@croco/framework-context";
        @Component({ scope: "transient" })
        export class TransientService {}
        @Component()
        export class SingletonService { constructor(readonly transient: TransientService) {} }
      `,
    });

    expect(() => compileDiGraph({ baseDir: TEMP_DIR })).toThrow(
      /cannot capture transient provider/,
    );
  });
});
