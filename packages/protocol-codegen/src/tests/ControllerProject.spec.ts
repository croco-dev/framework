import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ts } from "ts-morph";
import { ControllerProjectConfigProblem, createControllerProject } from "../libs/ControllerProject";

const temporaryDirectories: string[] = [];
const CONTROLLER_PROJECT_TEST_TIMEOUT_MS = 60_000;

vi.setConfig({ testTimeout: CONTROLLER_PROJECT_TEST_TIMEOUT_MS });

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("createControllerProject", () => {
  it("discovers the nearest tsconfig from the controller directory and loads extends options", () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.base.json"), {
      compilerOptions: { target: "ES2022", experimentalDecorators: true },
    });
    writeJson(path.join(root, "app", "tsconfig.json"), {
      extends: "../tsconfig.base.json",
      compilerOptions: { module: "CommonJS" },
    });
    writeFile(path.join(root, "app", "src", "Controller.ts"), "export class Controller {}");

    const session = createControllerProject({
      cwd: root,
      controllers: "app/src/Controller.ts",
    });

    try {
      expect(session.tsconfigPath).toBe(path.join(root, "app", "tsconfig.json"));
      expect(session.project.getCompilerOptions().target).toBe(ts.ScriptTarget.ES2022);
      expect(session.project.getCompilerOptions().experimentalDecorators).toBe(true);
    } finally {
      session.dispose();
    }
  });

  it("gives an explicit relative tsconfig precedence over automatic discovery", () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), { compilerOptions: { target: "ES2018" } });
    writeJson(path.join(root, "config", "explicit.json"), {
      compilerOptions: { target: "ES2021", module: "CommonJS" },
    });
    writeFile(path.join(root, "src", "Controller.ts"), "export class Controller {}");

    const session = createControllerProject({
      cwd: root,
      controllers: "src/Controller.ts",
      tsconfigPath: "config/explicit.json",
    });

    try {
      expect(session.tsconfigPath).toBe(path.join(root, "config", "explicit.json"));
      expect(session.project.getCompilerOptions().target).toBe(ts.ScriptTarget.ES2021);
    } finally {
      session.dispose();
    }
  });

  it.each([
    ["missing", "config/missing.json"],
    ["unreadable", "config/unreadable.json"],
    ["invalid", "config/invalid.json"],
  ] as const)(
    "reports CROCO_BUILD_004 evidence for an %s explicit config",
    (reason, configPath) => {
      const root = createTemporaryDirectory();
      writeFile(path.join(root, "src", "Controller.ts"), "export class Controller {}");
      if (reason === "unreadable") fs.mkdirSync(path.join(root, configPath), { recursive: true });
      if (reason === "invalid") writeFile(path.join(root, configPath), "{ invalid");

      let thrown: unknown;
      try {
        createControllerProject({
          cwd: root,
          controllers: "src/Controller.ts",
          tsconfigPath: configPath,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ControllerProjectConfigProblem);
      const problem = thrown as ControllerProjectConfigProblem;
      expect(problem.reason).toBe(reason);
      expect(problem.tsconfigPath).toBe(path.join(root, configPath));
      expect(problem.extensions).toMatchObject({
        crocoCode: "CROCO_BUILD_004",
        reason,
        tsconfigPath: path.join(root, configPath),
        recoveryAction: expect.stringContaining("valid tsconfig"),
      });
    },
  );

  it("rewrites a runtime path alias to the emitted JavaScript module", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        baseUrl: ".",
        paths: { "@app/*": ["src/*"] },
      },
    });
    writeFile(path.join(root, "src", "value.ts"), "export const value = 'resolved';");
    writeFile(
      path.join(root, "src", "controllers", "Controller.ts"),
      "import { value } from '@app/value'; export class Controller { static value = value; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/controllers/*.ts" });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("resolved");
      const emitted = fs.readFileSync(
        path.join(session.emitDir, "controllers", "Controller.js"),
        "utf8",
      );
      expect(emitted).not.toContain("@app/value");
      expect(emitted).toContain("../value.js");
    } finally {
      session.dispose();
    }
  });

  it("emits a same-directory CommonJS JSON dependency and removes it on dispose", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        resolveJsonModule: true,
        esModuleInterop: true,
      },
    });
    writeJson(path.join(root, "src", "config.json"), { title: "local-json" });
    writeJson(path.join(root, "src", "unrelated.json"), { secret: "not-a-dependency" });
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "import config from './config.json'; export class Controller { static title = config.title; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      expect(session.getPreEmitDiagnostics()).toEqual([]);
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { title: string }).title).toBe("local-json");
      expect(readJson(path.join(session.emitDir, "config.json"))).toEqual({ title: "local-json" });
      expect(fs.existsSync(path.join(session.emitDir, "unrelated.json"))).toBe(false);
      expect(fs.existsSync(path.join(session.emitDir, "tsconfig.json"))).toBe(false);
    } finally {
      session.dispose();
    }
    expect(fs.existsSync(session.emitDir)).toBe(false);
    expect(readJson(path.join(root, "src", "config.json"))).toEqual({ title: "local-json" });
  });

  it("preserves imported package.json data separately from the CommonJS module boundary", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        resolveJsonModule: true,
        esModuleInterop: true,
      },
    });
    const metadata = { name: "controller-data", version: "7.2.1", type: "module" };
    writeJson(path.join(root, "src", "package.json"), metadata);
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "import metadata from './package.json'; export class Controller { static metadata = metadata; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      expect(session.getPreEmitDiagnostics()).toEqual([]);
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { metadata: typeof metadata }).metadata).toEqual(
        metadata,
      );
      expect(readJson(path.join(session.emitDir, "package.json"))).toEqual({ type: "commonjs" });
    } finally {
      session.dispose();
    }
    expect(readJson(path.join(root, "src", "package.json"))).toEqual(metadata);
  });

  it("emits a nested JSON path alias outside the controller directory", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        resolveJsonModule: true,
        esModuleInterop: true,
        baseUrl: ".",
        paths: { "@config/*": ["config/*"] },
      },
    });
    writeJson(path.join(root, "config", "nested", "settings.json"), { title: "aliased-json" });
    writeJson(path.join(root, "config", "nested", "unrelated.json"), { secret: "unused" });
    writeFile(
      path.join(root, "src", "controllers", "Controller.ts"),
      "import config from '@config/nested/settings.json'; export class Controller { static title = config.title; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/controllers/*.ts" });

    try {
      expect(session.getPreEmitDiagnostics()).toEqual([]);
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { title: string }).title).toBe("aliased-json");
      expect(session.sourceRoot).toBe(root);
      expect(readJson(path.join(session.emitDir, "config", "nested", "settings.json"))).toEqual({
        title: "aliased-json",
      });
      const emitted = fs.readFileSync(
        path.join(session.emitDir, "src", "controllers", "Controller.js"),
        "utf8",
      );
      expect(emitted).toContain("../../config/nested/settings.json");
      expect(emitted).not.toContain("@config/");
      expect(fs.existsSync(path.join(session.emitDir, "config", "nested", "unrelated.json"))).toBe(
        false,
      );
    } finally {
      session.dispose();
    }
  });

  it.each(["static", "dynamic"] as const)(
    "preserves NodeNext %s JSON import attributes when emitting a local dependency",
    async (importKind) => {
      const root = createTemporaryDirectory();
      writeJson(path.join(root, "package.json"), { type: "module" });
      writeJson(path.join(root, "tsconfig.json"), {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          resolveJsonModule: true,
          baseUrl: ".",
          paths: { "@config/*": ["config/*"] },
        },
      });
      writeJson(path.join(root, "config", "settings.json"), { title: "esm-json" });
      writeFile(
        path.join(root, "src", "Controller.ts"),
        importKind === "static"
          ? "import config from '@config/settings.json' with { type: 'json' }; export class Controller { static title = config.title; }"
          : "export class Controller { static async title() { return (await import('@config/settings.json', { with: { type: 'json' } })).default.title; } }",
      );
      const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

      try {
        expect(session.getPreEmitDiagnostics().map((diagnostic) => diagnostic.getCode())).toEqual(
          importKind === "static" ? [2856] : [],
        );
        session.emit();
        const [moduleExports] = await session.importControllerModules();
        const Controller = moduleExports.Controller as { title: string | (() => Promise<string>) };
        expect(
          typeof Controller.title === "function" ? await Controller.title() : Controller.title,
        ).toBe("esm-json");
        expect(readJson(path.join(session.emitDir, "config", "settings.json"))).toEqual({
          title: "esm-json",
        });
        const emitted = fs.readFileSync(path.join(session.emitDir, "src", "Controller.js"), "utf8");
        expect(emitted).toContain("../config/settings.json");
        expect(emitted).toMatch(/type: ["']json["']/);
        expect(emitted).toContain("with");
        expect(emitted).not.toContain("@config/");
      } finally {
        session.dispose();
      }
    },
  );

  it("preserves NodeNext module resolution and imports emitted ESM controllers", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        baseUrl: ".",
        paths: { "@app/*": ["src/*"] },
      },
    });
    writeFile(path.join(root, "src", "value.ts"), "export const value = 'esm';");
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "import { value } from '@app/value'; export class Controller { static value = value; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      expect(session.project.getCompilerOptions()).toMatchObject({
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      });
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("esm");
      expect(readJson(path.join(session.emitDir, "package.json"))).toEqual({ type: "module" });
    } finally {
      session.dispose();
    }
  });

  it("rewrites extensionless relative imports to emitted ESM modules", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
      },
    });
    writeFile(path.join(root, "src", "schemas.ts"), "export const value = 'relative';");
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "import { value } from './schemas'; export class Controller { static value = value; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("relative");
      const emitted = fs.readFileSync(path.join(session.emitDir, "Controller.js"), "utf8");
      expect(emitted).toContain("./schemas.js");
    } finally {
      session.dispose();
    }
  });

  it("keeps valid incremental application options isolated from temporary emission", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        incremental: true,
        module: "CommonJS",
        noEmit: true,
        tsBuildInfoFile: "cache/app.tsbuildinfo",
      },
    });
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "export class Controller { static value = 'incremental'; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      expect(
        session.project.getPreEmitDiagnostics().map((diagnostic) => diagnostic.getCode()),
      ).not.toContain(5111);
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("incremental");
    } finally {
      session.dispose();
    }
  });

  it("emits TypeScript-extension imports from a valid noEmit application config", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        allowImportingTsExtensions: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        target: "ES2022",
      },
    });
    writeFile(path.join(root, "src", "value.ts"), "export const value = 'typescript-extension';");
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "import { value } from './value.ts'; export class Controller { static value = value; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      expect(
        session.project.getPreEmitDiagnostics().map((diagnostic) => diagnostic.getCode()),
      ).not.toContain(5096);
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("typescript-extension");
      expect(fs.readFileSync(path.join(session.emitDir, "Controller.js"), "utf8")).toContain(
        "./value.js",
      );
    } finally {
      session.dispose();
    }
  });

  it("loads referenced composite project sources without widening controller matches", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "shared", "tsconfig.json"), {
      compilerOptions: {
        baseUrl: ".",
        composite: true,
        declaration: true,
        module: "CommonJS",
        paths: { "@shared/*": ["src/*"] },
      },
      include: ["src/**/*.ts"],
    });
    writeFile(
      path.join(root, "shared", "src", "internal.ts"),
      "export const value = 'referenced';",
    );
    writeFile(
      path.join(root, "shared", "src", "value.ts"),
      "export { value } from '@shared/internal';",
    );
    writeFile(
      path.join(root, "shared", "src", "UnimportedReference.ts"),
      "export const unimported = true;",
    );
    writeJson(path.join(root, "app", "tsconfig.json"), {
      compilerOptions: { module: "CommonJS" },
      references: [{ path: "../shared" }],
    });
    writeFile(
      path.join(root, "app", "src", "Controller.ts"),
      "import { value } from '../../shared/src/value'; export class Controller { static value = value; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: "app/src/Controller.ts",
    });

    try {
      expect(session.controllerSourceFiles).toHaveLength(1);
      expect(session.getPreEmitDiagnostics()).toHaveLength(0);
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("referenced");
    } finally {
      session.dispose();
    }
  });

  it("preserves mixed NodeNext package boundaries for emitted dependencies", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "app", "package.json"), { type: "module" });
    writeJson(path.join(root, "app", "legacy", "package.json"), { type: "commonjs" });
    writeJson(path.join(root, "app", "tsconfig.json"), {
      compilerOptions: {
        esModuleInterop: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    writeFile(path.join(root, "app", "legacy", "value.ts"), "export const value = 'mixed';");
    writeFile(
      path.join(root, "app", "src", "Controller.ts"),
      "import * as legacy from '../legacy/value.js'; export class Controller { static value = legacy.value; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: "app/src/Controller.ts",
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("mixed");
      expect(readJson(path.join(session.emitDir, "src", "package.json"))).toEqual({
        type: "module",
      });
      expect(readJson(path.join(session.emitDir, "legacy", "package.json"))).toEqual({
        type: "commonjs",
      });
    } finally {
      session.dispose();
    }
  });

  it("rewrites dynamic NodeNext path-alias imports", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        baseUrl: ".",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        paths: { "@app/*": ["src/*"] },
        target: "ES2022",
      },
    });
    writeFile(path.join(root, "src", "value.ts"), "export const value = 'dynamic';");
    writeFile(
      path.join(root, "src", "Controller.ts"),
      "const loaded = await import('@app/value'); export class Controller { static value = loaded.value; }",
    );
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      const Controller = moduleExports.Controller as { value: string };
      expect(Controller.value).toBe("dynamic");
      const emitted = fs.readFileSync(path.join(session.emitDir, "Controller.js"), "utf8");
      expect(emitted).not.toContain("@app/value");
      expect(emitted).toContain("./value.js");
    } finally {
      session.dispose();
    }
  });

  it("uses legacy CommonJS, ES2020, and decorator defaults when no config exists", () => {
    const root = createTemporaryDirectory();
    writeFile(path.join(root, "Controller.ts"), "export class Controller {}");
    const session = createControllerProject({ cwd: root, controllers: "Controller.ts" });

    try {
      expect(session.tsconfigPath).toBeNull();
      expect(session.project.getCompilerOptions()).toMatchObject({
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      });
    } finally {
      session.dispose();
    }
  });

  it("does not widen explicitly matched controllers with tsconfig include files", () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: { module: "CommonJS" },
      include: ["src/**/*.ts"],
    });
    writeFile(path.join(root, "src", "Controller.ts"), "export class Controller {}");
    writeFile(path.join(root, "src", "IncludedButUnmatched.ts"), "export class Unmatched {}");
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });

    try {
      expect(session.controllerSourceFiles.map((sourceFile) => sourceFile.getBaseName())).toEqual([
        "Controller.ts",
      ]);
      expect(session.project.getSourceFile("IncludedButUnmatched.ts")).toBeUndefined();
    } finally {
      session.dispose();
    }
  });

  it("preserves each application root's external dependency identity after emission", async () => {
    const root = createTemporaryDirectory();
    const modulePaths: string[] = [];
    for (const name of ["first", "second"]) {
      const applicationRoot = path.join(root, name);
      const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
      fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
      const dependencyDir = path.join(applicationRoot, "node_modules", "identity-marker");
      fs.mkdirSync(dependencyDir, { recursive: true });
      const markerPath = path.join(dependencyDir, "index.js");
      fs.writeFileSync(
        path.join(dependencyDir, "package.json"),
        JSON.stringify({ name: "identity-marker", main: "index.js" }),
      );
      fs.writeFileSync(markerPath, `module.exports = { owner: '${name}' };\n`);
      modulePaths.push(markerPath);
      writeFile(
        controllerPath,
        "import { owner } from 'identity-marker'; export class Controller { static owner = owner; }",
      );
    }
    const session = createControllerProject({
      cwd: root,
      controllers: ["first/src/Controller.ts", "second/src/Controller.ts"],
    });

    try {
      session.emit();
      const [first, second] = await session.importControllerModules();
      expect((first.Controller as { owner: string }).owner).toBe("first");
      expect((second.Controller as { owner: string }).owner).toBe("second");
      const emittedByName: Record<string, string> = {};
      for (const sourceFile of session.controllerSourceFiles) {
        const sourcePath = sourceFile.getFilePath();
        const relative = path.relative(session.sourceRoot, sourcePath).replace(/\.tsx?$/, ".js");
        emittedByName[sourcePath] = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      }
      for (const [sourcePath, emitted] of Object.entries(emittedByName)) {
        const expected = modulePaths.find((modulePath) =>
          sourcePath.startsWith(path.dirname(path.dirname(path.dirname(modulePath)))),
        );
        expect(expected).toBeDefined();
        expect(emitted).toContain(expected as string);
        expect(emitted).not.toContain("from 'identity-marker'");
        expect(emitted).not.toContain('require("identity-marker")');
      }
    } finally {
      session.dispose();
    }
  });

  it("preserves external dependency identity for ESM application roots", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    for (const name of ["first", "second"]) {
      const applicationRoot = path.join(root, name);
      const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
      fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
      writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
      const dependencyDir = path.join(applicationRoot, "node_modules", "identity-marker");
      fs.mkdirSync(dependencyDir, { recursive: true });
      const markerPath = path.join(dependencyDir, "index.js");
      const esmPath = path.join(dependencyDir, "index.mjs");
      fs.writeFileSync(
        path.join(dependencyDir, "package.json"),
        JSON.stringify({
          name: "identity-marker",
          main: "index.js",
          exports: { ".": { import: "./index.mjs", require: "./index.js" } },
        }),
      );
      fs.writeFileSync(markerPath, `exports.owner = 'cjs-${name}';\n`);
      fs.writeFileSync(esmPath, `export const owner = 'esm-${name}';\n`);
      writeFile(
        controllerPath,
        "import { owner } from 'identity-marker'; export class Controller { static owner = owner; }",
      );
    }
    const session = createControllerProject({
      cwd: root,
      controllers: ["first/src/Controller.ts", "second/src/Controller.ts"],
    });

    try {
      session.emit();
      const [first, second] = await session.importControllerModules();
      expect((first.Controller as { owner: string }).owner).toBe("esm-first");
      expect((second.Controller as { owner: string }).owner).toBe("esm-second");
      for (const sourceFile of session.controllerSourceFiles) {
        const sourcePath = sourceFile.getFilePath();
        const relative = path.relative(session.sourceRoot, sourcePath).replace(/\.tsx?$/, ".js");
        const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
        expect(emitted).toContain("file://");
        expect(emitted).toContain("index.mjs");
        expect(emitted).not.toContain("from 'identity-marker'");
      }
    } finally {
      session.dispose();
    }
  });

  it("resolves conditional-sugar exports for ESM application roots", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "sugar-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "sugar-marker",
        main: "./cjs.js",
        exports: { import: "./esm.mjs", require: "./cjs.js" },
      }),
    );
    fs.writeFileSync(path.join(dependencyDir, "cjs.js"), `exports.owner = 'cjs';\n`);
    fs.writeFileSync(path.join(dependencyDir, "esm.mjs"), `export const owner = 'esm';\n`);
    writeFile(
      controllerPath,
      "import { owner } from 'sugar-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("esm");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("esm.mjs");
      expect(emitted).not.toContain("from 'sugar-marker'");
    } finally {
      session.dispose();
    }
  });

  it("resolves ESM wildcard export subpaths through the import condition", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "wildcard-marker");
    fs.mkdirSync(path.join(dependencyDir, "esm"), { recursive: true });
    fs.mkdirSync(path.join(dependencyDir, "cjs"), { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "wildcard-marker",
        exports: {
          "./features/*": {
            import: "./esm/*.mjs",
            require: "./cjs/*.cjs",
          },
        },
      }),
    );
    fs.writeFileSync(
      path.join(dependencyDir, "esm", "flag.mjs"),
      `export const owner = 'esm-wildcard';\n`,
    );
    fs.writeFileSync(
      path.join(dependencyDir, "cjs", "flag.cjs"),
      `exports.owner = 'cjs-wildcard';\n`,
    );
    writeFile(
      controllerPath,
      "import { owner } from 'wildcard-marker/features/flag'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("esm-wildcard");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("flag.mjs");
      expect(emitted).not.toContain("wildcard-marker/features/flag");
    } finally {
      session.dispose();
    }
  });

  it("ignores the bundler-only module field for ESM application roots", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "legacy-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "legacy-marker",
        main: "./node-main.js",
        module: "./bundler.mjs",
      }),
    );
    fs.writeFileSync(
      path.join(dependencyDir, "node-main.js"),
      `export const owner = 'node-main';\n`,
    );
    fs.writeFileSync(path.join(dependencyDir, "bundler.mjs"), `export const owner = 'bundler';\n`);
    writeFile(
      controllerPath,
      "import { owner } from 'legacy-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("node-main");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("node-main.js");
      expect(emitted).not.toContain("bundler.mjs");
    } finally {
      session.dispose();
    }
  });

  it("keeps require calls on the require condition inside ESM controllers", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "dual-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "dual-marker",
        exports: { ".": { import: "./esm.mjs", require: "./cjs.cjs" } },
      }),
    );
    fs.writeFileSync(path.join(dependencyDir, "cjs.cjs"), `module.exports = { owner: 'cjs' };\n`);
    fs.writeFileSync(path.join(dependencyDir, "esm.mjs"), `export const owner = 'esm';\n`);
    writeFile(
      controllerPath,
      "declare const require: (specifier: string) => { owner: string }; const { owner } = require('dual-marker'); export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("cjs.cjs");
      expect(emitted).not.toContain("file://");
      expect(emitted).not.toContain("require('dual-marker')");
    } finally {
      session.dispose();
    }
  });

  it("resolves legacy ESM package subpaths without an exports field", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "legacy-subpath-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({ name: "legacy-subpath-marker", main: "./index.js" }),
    );
    fs.writeFileSync(
      path.join(dependencyDir, "feature.js"),
      `export const owner = 'legacy-subpath';\n`,
    );
    writeFile(
      controllerPath,
      "import { owner } from 'legacy-subpath-marker/feature.js'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("legacy-subpath");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("feature.js");
      expect(emitted).toContain("file://");
      expect(emitted).not.toContain("from 'legacy-subpath-marker/feature.js'");
    } finally {
      session.dispose();
    }
  });

  it("evaluates the default export condition in declaration order", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "default-first-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "default-first-marker",
        exports: { ".": { default: "./default.mjs", import: "./import.mjs" } },
      }),
    );
    fs.writeFileSync(
      path.join(dependencyDir, "default.mjs"),
      `export const owner = 'default-first';\n`,
    );
    fs.writeFileSync(
      path.join(dependencyDir, "import.mjs"),
      `export const owner = 'import-target';\n`,
    );
    writeFile(
      controllerPath,
      "import { owner } from 'default-first-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("default-first");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("default.mjs");
    } finally {
      session.dispose();
    }
  });

  it("skips invalid targets in export fallback arrays", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "fallback-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "fallback-marker",
        exports: { ".": { import: ["bad-target", "./good.mjs"] } },
      }),
    );
    fs.writeFileSync(path.join(dependencyDir, "good.mjs"), `export const owner = 'fallback';\n`);
    writeFile(
      controllerPath,
      "import { owner } from 'fallback-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("fallback");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("good.mjs");
    } finally {
      session.dispose();
    }
  });

  it("prefers the longest wildcard prefix when export patterns overlap", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "specificity-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "specificity-marker",
        exports: {
          "./a*c": "./generic.mjs",
          "./ab*": "./specific.mjs",
        },
      }),
    );
    fs.writeFileSync(path.join(dependencyDir, "generic.mjs"), `export const owner = 'generic';\n`);
    fs.writeFileSync(
      path.join(dependencyDir, "specific.mjs"),
      `export const owner = 'specific';\n`,
    );
    writeFile(
      controllerPath,
      "import { owner } from 'specificity-marker/abc'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("specific");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("specific.mjs");
    } finally {
      session.dispose();
    }
  });

  it("completes extensionless legacy main entries before emitting file URLs", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "extensionless-marker");
    fs.mkdirSync(path.join(dependencyDir, "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({ name: "extensionless-marker", main: "./lib/entry" }),
    );
    fs.writeFileSync(
      path.join(dependencyDir, "lib", "entry.js"),
      `export const owner = 'extensionless';\n`,
    );
    writeFile(
      controllerPath,
      "import { owner } from 'extensionless-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("extensionless");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("entry.js");
    } finally {
      session.dispose();
    }
  });

  it("honors node-addons and module-sync conditions over default", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "addon-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({
        name: "addon-marker",
        exports: {
          ".": { "node-addons": "./addons.mjs", "module-sync": "./sync.mjs", default: "./js.mjs" },
        },
      }),
    );
    fs.writeFileSync(path.join(dependencyDir, "addons.mjs"), `export const owner = 'addons';\n`);
    fs.writeFileSync(path.join(dependencyDir, "sync.mjs"), `export const owner = 'sync';\n`);
    fs.writeFileSync(path.join(dependencyDir, "js.mjs"), `export const owner = 'js';\n`);
    writeFile(
      controllerPath,
      "import { owner } from 'addon-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("addons");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("addons.mjs");
    } finally {
      session.dispose();
    }
  });

  it("leaves shadowed require bindings untouched", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
      },
    });
    const applicationRoot = path.join(root, "app");
    const controllerPath = path.join(applicationRoot, "src", "Controller.ts");
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });
    writeJson(path.join(applicationRoot, "package.json"), { type: "module" });
    const dependencyDir = path.join(applicationRoot, "node_modules", "shadow-marker");
    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, "package.json"),
      JSON.stringify({ name: "shadow-marker", main: "./index.js" }),
    );
    fs.writeFileSync(
      path.join(dependencyDir, "index.js"),
      `module.exports = { owner: 'shadow' };\n`,
    );
    writeFile(
      controllerPath,
      "const require = (_specifier: string): { owner: string } => ({ owner: 'local' }); const { owner } = require('shadow-marker'); export class Controller { static owner = owner; }",
    );
    writeFile(path.join(applicationRoot, "src", "loader.ts"), "export const unused = true;");
    const session = createControllerProject({
      cwd: root,
      controllers: ["app/src/Controller.ts"],
    });

    try {
      session.emit();
      const [moduleExports] = await session.importControllerModules();
      expect((moduleExports.Controller as { owner: string }).owner).toBe("local");
      const relative = path
        .relative(session.sourceRoot, session.controllerSourceFiles[0].getFilePath())
        .replace(/\.tsx?$/, ".js");
      const emitted = fs.readFileSync(path.join(session.emitDir, relative), "utf8");
      expect(emitted).toContain("require('shadow-marker')");
    } finally {
      session.dispose();
    }
  });

  it("preserves dependency identity for root export arrays", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
    });
    for (const name of ["first", "second"]) {
      const applicationRoot = path.join(root, name);
      const dependencyDir = path.join(applicationRoot, "node_modules", "array-marker");
      writeJson(path.join(dependencyDir, "package.json"), {
        name: "array-marker",
        exports: ["./identity.mjs"],
      });
      writeFile(path.join(dependencyDir, "identity.mjs"), `export const owner = '${name}';`);
      writeFile(
        path.join(applicationRoot, "Controller.ts"),
        "import { owner } from 'array-marker'; export class Controller { static owner = owner; }",
      );
    }
    const session = createControllerProject({ cwd: root, controllers: ["*/Controller.ts"] });
    try {
      session.emit();
      const modules = await session.importControllerModules();
      expect(
        modules.map((module) => (module.Controller as { owner: string }).owner).sort(),
      ).toEqual(["first", "second"]);
    } finally {
      session.dispose();
    }
  });

  it.each(["self-marker", "#marker"])(
    "resolves source package references through %s",
    async (specifier) => {
      const root = createTemporaryDirectory();
      writeJson(path.join(root, "tsconfig.json"), {
        compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
      });
      for (const name of ["first", "second"]) {
        const applicationRoot = path.join(root, name);
        writeJson(path.join(applicationRoot, "package.json"), {
          name: "self-marker",
          type: "module",
          exports: { ".": "./runtime.mjs" },
          imports: { "#marker": "self-marker" },
        });
        writeFile(path.join(applicationRoot, "runtime.mjs"), `export const owner = '${name}';`);
        writeFile(
          path.join(applicationRoot, "Controller.ts"),
          `import { owner } from '${specifier}'; export class Controller { static owner = owner; }`,
        );
      }
      const session = createControllerProject({ cwd: root, controllers: ["*/Controller.ts"] });
      try {
        session.emit();
        const modules = await session.importControllerModules();
        expect(
          modules.map((module) => (module.Controller as { owner: string }).owner).sort(),
        ).toEqual(["first", "second"]);
      } finally {
        session.dispose();
      }
    },
  );

  it.each(["CommonJS", "NodeNext"] as const)(
    "fails emission for an unresolved external dependency in %s",
    (moduleKind) => {
      const root = createTemporaryDirectory();
      writeJson(path.join(root, "package.json"), {
        type: moduleKind === "NodeNext" ? "module" : "commonjs",
      });
      writeJson(path.join(root, "tsconfig.json"), {
        compilerOptions: {
          module: moduleKind,
          moduleResolution: moduleKind === "NodeNext" ? "NodeNext" : "Node",
          target: "ES2022",
        },
      });
      writeFile(
        path.join(root, "Controller.ts"),
        "import { owner } from 'missing-runtime-marker'; export class Controller { static owner = owner; }",
      );
      const session = createControllerProject({ cwd: root, controllers: ["Controller.ts"] });
      try {
        expect(() => session.emit()).toThrow(/missing-runtime-marker/);
      } finally {
        session.dispose();
      }
    },
  );

  it("rejects nested null export conditions instead of selecting a later fallback", () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
    });
    const dependencyDir = path.join(root, "node_modules", "blocked-marker");
    writeJson(path.join(dependencyDir, "package.json"), {
      name: "blocked-marker",
      exports: { ".": { node: { import: null }, default: "./fallback.mjs" } },
    });
    writeFile(path.join(dependencyDir, "fallback.mjs"), "export const owner = 'wrong-fallback';");
    writeFile(
      path.join(root, "Controller.ts"),
      "import { owner } from 'blocked-marker'; export class Controller { static owner = owner; }",
    );
    const session = createControllerProject({ cwd: root, controllers: ["Controller.ts"] });
    try {
      expect(() => session.emit()).toThrow(/blocked-marker/);
    } finally {
      session.dispose();
    }
  });

  it.each([
    [
      "function parameter",
      "function load(require: (value: string) => string) { return require('shadow-marker'); } export const value = load((value) => value);",
    ],
    [
      "catch binding",
      "let value = ''; try { throw (value: string) => value; } catch (require) { value = require('shadow-marker'); } export { value };",
    ],
    [
      "destructured binding",
      "const { require } = { require: (value: string) => value }; export const value = require('shadow-marker');",
    ],
  ])("preserves require arguments for a %s", async (_name, source) => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
    });
    writeJson(path.join(root, "node_modules", "shadow-marker", "package.json"), {
      name: "shadow-marker",
      main: "index.js",
    });
    writeFile(path.join(root, "node_modules", "shadow-marker", "index.js"), "module.exports = {};");
    writeFile(path.join(root, "Controller.ts"), source);
    const session = createControllerProject({ cwd: root, controllers: ["Controller.ts"] });
    try {
      session.emit();
      const [module] = await session.importControllerModules();
      expect(module.value).toBe("shadow-marker");
    } finally {
      session.dispose();
    }
  });
  it("preserves multi-root dynamic import identity with an explicit options argument", async () => {
    const root = createTemporaryDirectory();
    writeJson(path.join(root, "package.json"), { type: "module" });
    writeJson(path.join(root, "tsconfig.json"), {
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
    });
    for (const name of ["first", "second"]) {
      const applicationRoot = path.join(root, name);
      const dependencyDir = path.join(applicationRoot, "node_modules", "dynamic-marker");
      writeJson(path.join(dependencyDir, "package.json"), {
        name: "dynamic-marker",
        exports: "./identity.mjs",
      });
      writeFile(path.join(dependencyDir, "identity.mjs"), `export const owner = '${name}';`);
      writeFile(
        path.join(applicationRoot, "Controller.ts"),
        "const loaded = await import('dynamic-marker', {}); export class Controller { static owner = loaded.owner; }",
      );
    }
    const session = createControllerProject({ cwd: root, controllers: ["*/Controller.ts"] });
    try {
      session.emit();
      expect(path.dirname(session.emitDir)).toBe(root);
      const modules = await session.importControllerModules();
      expect(
        modules.map((module) => (module.Controller as { owner: string }).owner).sort(),
      ).toEqual(["first", "second"]);
    } finally {
      session.dispose();
    }
  });

  it.each([
    { flags: ["--no-require-module"], condition: "module-sync", expected: "default" },
    { flags: ["--no_require_module"], condition: "module-sync", expected: "default" },
    { flags: ["--no-experimental-require-module"], condition: "module-sync", expected: "default" },
    { flags: ["--no_experimental_require_module"], condition: "module-sync", expected: "default" },
    { flags: ["--no-addons"], condition: "node-addons", expected: "default" },
    { flags: ["--no_addons"], condition: "node-addons", expected: "default" },
    { flags: ["--conditions=app_mode"], condition: "app_mode", expected: "selected" },
    { flags: ["-C", "app_mode"], condition: "app_mode", expected: "selected" },
    {
      flags: ["--addons"],
      condition: "node-addons",
      expected: "selected",
      nodeOptions: "--no-addons",
    },
  ])(
    "forwards resolver flags $flags with condition $condition",
    async ({ flags, condition, expected, nodeOptions }) => {
      const root = createTemporaryDirectory();
      writeJson(path.join(root, "package.json"), { type: "module" });
      writeJson(path.join(root, "tsconfig.json"), {
        compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022" },
      });
      const dependencyDir = path.join(root, "node_modules", "condition-marker");
      writeJson(path.join(dependencyDir, "package.json"), {
        name: "condition-marker",
        exports: { ".": { [condition]: "./selected.mjs", default: "./default.mjs" } },
      });
      writeFile(path.join(dependencyDir, "selected.mjs"), "export const owner = 'selected';");
      writeFile(path.join(dependencyDir, "default.mjs"), "export const owner = 'default';");
      writeFile(
        path.join(root, "Controller.ts"),
        "import { owner } from 'condition-marker'; export class Controller { static owner = owner; }",
      );
      const session = createControllerProject({ cwd: root, controllers: ["Controller.ts"] });
      const originalExecArgv = process.execArgv;
      const originalNodeOptions = process.env.NODE_OPTIONS;
      try {
        try {
          process.execArgv = [...originalExecArgv, ...flags];
          if (nodeOptions !== undefined) process.env.NODE_OPTIONS = nodeOptions;
          session.emit();
        } finally {
          process.execArgv = originalExecArgv;
          if (originalNodeOptions === undefined) delete process.env.NODE_OPTIONS;
          else process.env.NODE_OPTIONS = originalNodeOptions;
        }
        const [module] = await session.importControllerModules();
        expect((module.Controller as { owner: string }).owner).toBe(expected);
      } finally {
        session.dispose();
      }
    },
  );
});

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "croco-protocol-codegen-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function writeFile(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, JSON.stringify(value));
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}
