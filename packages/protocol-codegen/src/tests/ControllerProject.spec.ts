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
