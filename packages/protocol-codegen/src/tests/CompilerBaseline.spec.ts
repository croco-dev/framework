import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ts } from "ts-morph";
import { ControllerProjectConfigProblem, createControllerProject } from "../libs/ControllerProject";

const roots: string[] = [];
const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(
  module: string,
  type: string,
  explicit: boolean,
): { root: string; configPath: string } {
  const root = mkdtempSync(join(tmpdir(), "croco-compiler-baseline-"));
  roots.push(root);
  const configPath = join(root, explicit ? "config/project.json" : "tsconfig.json");
  mkdirSync(dirname(configPath), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ type }));
  writeFileSync(
    join(root, "src/Controller.ts"),
    "export class Controller { static value: number = 42; }",
  );
  writeFileSync(
    configPath,
    JSON.stringify({
      compilerOptions: { module, target: "ES2022", strict: true, skipLibCheck: true, noEmit: true },
      include: [explicit ? "../src/**/*.ts" : "src/**/*.ts"],
    }),
  );
  return { root, configPath };
}

describe("protocol compiler baseline", () => {
  it("uses the supported TypeScript compiler rather than an older embedded compiler", () => {
    expect(ts.version).toBe("6.0.2");
  });

  for (const module of ["node18", "node20", "nodenext"] as const) {
    for (const type of ["module", "commonjs"]) {
      it.each([false, true])(
        `${module} ${type} analysis and emission (explicit config: %s)`,
        (explicit) => {
          const { root, configPath } = fixture(module, type, explicit);
          execFileSync(process.execPath, [tscPath, "--project", configPath], { encoding: "utf8" });
          const session = createControllerProject({
            cwd: root,
            controllers: "src/Controller.ts",
            ...(explicit ? { tsconfigPath: configPath } : {}),
          });
          try {
            expect(session.tsconfigPath).toBe(configPath);
            expect(session.project.getCompilerOptions().module).toBe(
              {
                node18: ts.ModuleKind.Node18,
                node20: ts.ModuleKind.Node20,
                nodenext: ts.ModuleKind.NodeNext,
              }[module],
            );
            expect(session.getPreEmitDiagnostics()).toEqual([]);
            session.emit();
            const output = join(session.emitDir, "Controller.js");
            expect(JSON.parse(readFileSync(join(session.emitDir, "package.json"), "utf8"))).toEqual(
              { type },
            );
            expect(readFileSync(output, "utf8")).toContain(
              type === "module" ? "export class Controller" : "Controller",
            );
            execFileSync(process.execPath, ["--check", output], { encoding: "utf8" });
            const value = execFileSync(
              process.execPath,
              [
                "--input-type=module",
                "--eval",
                `const { Controller } = await import(${JSON.stringify(pathToFileURL(output).href)}); console.log(Controller.value);`,
              ],
              { encoding: "utf8" },
            );
            expect(value.trim()).toBe("42");
          } finally {
            session.dispose();
          }
        },
        60_000,
      );
    }
  }

  for (const module of ["node18", "node20", "nodenext"] as const) {
    it.each([
      { type: "module", sourceExtension: "cts", runtimeExtension: "cjs", value: 79 },
      { type: "commonjs", sourceExtension: "mts", runtimeExtension: "mjs", value: 83 },
    ])(
      `preserves sibling .js boundaries with explicit format overrides (${module}/$type)`,
      ({ type, sourceExtension, runtimeExtension, value }) => {
        const { root, configPath } = fixture(module, type, false);
        writeFileSync(join(root, `src/z.${sourceExtension}`), `export const value = ${value};`);
        writeFileSync(
          join(root, "src/Controller.ts"),
          `export class Controller { static async value() { return (await import('./z.${runtimeExtension}')).value; } }`,
        );
        execFileSync(process.execPath, [tscPath, "--project", configPath], { encoding: "utf8" });
        const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });
        try {
          expect(session.getPreEmitDiagnostics().map((diagnostic) => diagnostic.getCode())).toEqual(
            [],
          );
          session.emit();
          expect(JSON.parse(readFileSync(join(session.emitDir, "package.json"), "utf8"))).toEqual({
            type,
          });
          const output = join(session.emitDir, "Controller.js");
          execFileSync(process.execPath, ["--check", output], { encoding: "utf8" });
          const actual = execFileSync(
            process.execPath,
            [
              "--input-type=module",
              "--eval",
              `const { Controller } = await import(${JSON.stringify(pathToFileURL(output).href)}); console.log(await Controller.value());`,
            ],
            { encoding: "utf8" },
          );
          expect(actual.trim()).toBe(String(value));
        } finally {
          session.dispose();
        }
      },
      60_000,
    );
  }

  it("keeps a sibling referenced .cts project from changing the controller package boundary", () => {
    const { root, configPath } = fixture("node20", "module", false);
    writeFileSync(join(root, "src/z.cts"), "export const value = 89;");
    writeFileSync(
      join(root, "src/Controller.ts"),
      "export class Controller { static async value() { return (await import('./z.cjs')).value; } }",
    );
    const referenceConfig = join(root, "tsconfig.helper.json");
    writeFileSync(
      referenceConfig,
      JSON.stringify({
        compilerOptions: {
          module: "node20",
          target: "ES2022",
          composite: true,
          declaration: true,
          rootDir: "./src",
          outDir: "./lib",
        },
        include: ["src/z.cts"],
      }),
    );
    writeFileSync(
      configPath,
      JSON.stringify({
        compilerOptions: { module: "node20", target: "ES2022", noEmit: true },
        include: ["src/Controller.ts"],
        references: [{ path: "./tsconfig.helper.json" }],
      }),
    );
    execFileSync(process.execPath, [tscPath, "--build", referenceConfig], { encoding: "utf8" });
    execFileSync(process.execPath, [tscPath, "--project", configPath], { encoding: "utf8" });
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });
    try {
      expect(session.getPreEmitDiagnostics().map((diagnostic) => diagnostic.getCode())).toEqual([]);
      session.emit();
      expect(JSON.parse(readFileSync(join(session.emitDir, "package.json"), "utf8"))).toEqual({
        type: "module",
      });
      const actual = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `const { Controller } = await import(${JSON.stringify(pathToFileURL(join(session.emitDir, "Controller.js")).href)}); console.log(await Controller.value());`,
        ],
        { encoding: "utf8" },
      );
      expect(actual.trim()).toBe("89");
    } finally {
      session.dispose();
    }
  }, 60_000);

  it("resolves transitive CommonJS imports using each source file's package format", () => {
    const { root, configPath } = fixture("node20", "commonjs", false);
    writeFileSync(join(root, "src/Controller.ts"), "export { value } from './Helper.js';");
    writeFileSync(join(root, "src/Helper.ts"), "export { value } from './value';");
    writeFileSync(join(root, "src/value.ts"), "export const value: number = 73;");
    execFileSync(process.execPath, [tscPath, "--project", configPath], { encoding: "utf8" });
    const session = createControllerProject({ cwd: root, controllers: "src/Controller.ts" });
    try {
      expect(session.getPreEmitDiagnostics().map((diagnostic) => diagnostic.getCode())).toEqual([]);
      session.emit();
      const value = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `const { value } = await import(${JSON.stringify(pathToFileURL(join(session.emitDir, "Controller.js")).href)}); console.log(value);`,
        ],
        { encoding: "utf8" },
      );
      expect(value.trim()).toBe("73");
    } finally {
      session.dispose();
    }
  }, 60_000);

  it.each([false, true])("rejects unknown module options (explicit config: %s)", (explicit) => {
    const { root, configPath } = fixture("unknown-module", "module", explicit);
    expect(() =>
      createControllerProject({
        cwd: root,
        controllers: "src/Controller.ts",
        ...(explicit ? { tsconfigPath: configPath } : {}),
      }),
    ).toThrow(ControllerProjectConfigProblem);
  });
});
