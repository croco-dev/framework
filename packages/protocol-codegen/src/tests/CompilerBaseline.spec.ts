import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

  for (const module of ["node18", "node20", "nodenext"]) {
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
                `const { Controller } = await import(${JSON.stringify(output)}); console.log(Controller.value);`,
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
          `const { value } = await import(${JSON.stringify(join(session.emitDir, "Controller.js"))}); console.log(value);`,
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
