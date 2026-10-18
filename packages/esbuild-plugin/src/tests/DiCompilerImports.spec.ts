import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { compileDiGraph, writeDiGraph } from "../libs/DiCompiler";

const repositoryRoot = path.resolve(__dirname, "../../../..");
const roots: string[] = [];

function fixture(options: Record<string, unknown>, packageType: string, extension: string): string {
  const root = fs.mkdtempSync(path.join(tmpdir(), "croco-di-imports-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: packageType }));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        experimentalDecorators: true,
        strict: true,
        skipLibCheck: true,
        types: ["node"],
        typeRoots: [path.join(repositoryRoot, "node_modules/@types")],
        lib: ["esnext", "dom"],
        ignoreDeprecations: "6.0",
        paths: {
          "@croco/framework-context": [
            path.join(repositoryRoot, "packages/framework-context/src/index.ts"),
          ],
          "@croco/problems-core": [
            path.join(repositoryRoot, "packages/problems-core/src/index.ts"),
          ],
        },
        ...options,
      },
      include: ["src/**/*"],
    }),
  );
  fs.writeFileSync(
    path.join(root, `src/Service.${extension}`),
    'import { Component } from "@croco/framework-context"; @Component() export class Service { value = 37; }',
  );
  return root;
}

function typecheck(root: string): void {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules/typescript/bin/tsc"),
      "--project",
      path.join(root, "tsconfig.json"),
      "--noEmit",
    ],
    { encoding: "utf8" },
  );
  expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toEqual({
    status: 0,
    stdout: "",
    stderr: "",
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("DI graph consumer imports", () => {
  it.each([
    {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      packageType: "module",
      source: "ts",
      graph: "ts",
      runtime: "js",
    },
    {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      packageType: "commonjs",
      source: "mts",
      graph: "mts",
      runtime: "mjs",
    },
    {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      packageType: "module",
      source: "cts",
      graph: "mts",
      runtime: "cjs",
    },
    {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      packageType: "commonjs",
      source: "ts",
      graph: "ts",
      runtime: "js",
    },
    {
      module: "CommonJS",
      moduleResolution: "Node10",
      packageType: "commonjs",
      source: "ts",
      graph: "ts",
      runtime: "js",
    },
    {
      module: "ESNext",
      moduleResolution: "Bundler",
      packageType: "module",
      source: "ts",
      graph: "ts",
      runtime: "js",
    },
  ])(
    "typechecks $module/$packageType .$source from .$graph graph",
    ({ module, moduleResolution, packageType, source, graph, runtime }) => {
      const root = fixture({ module, moduleResolution }, packageType, source);
      typecheck(root);
      const result = compileDiGraph({ baseDir: root, outFile: `src/di.generated.${graph}` });
      writeDiGraph(result);
      const config = ts.getParsedCommandLineOfConfigFile(
        path.join(root, "tsconfig.json"),
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: () => {},
        },
      );
      expect(config?.fileNames).toContain(result.outFile);
      typecheck(root);
      expect(result.code).toContain(`from "./Service.${runtime}"`);
    },
    30_000,
  );

  it.each([
    { jsx: "preserve", runtime: "jsx" },
    { jsx: "react-native", runtime: "js" },
    { jsx: "react-jsx", runtime: "js" },
  ])(
    "matches actual TypeScript emission for jsx: $jsx",
    ({ jsx, runtime }) => {
      const root = fixture(
        { module: "NodeNext", moduleResolution: "NodeNext", jsx },
        "module",
        "tsx",
      );
      typecheck(root);
      const result = compileDiGraph({ baseDir: root, outFile: "src/di.generated.ts" });
      writeDiGraph(result);
      typecheck(root);
      const config = ts.getParsedCommandLineOfConfigFile(
        path.join(root, "tsconfig.json"),
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: () => {},
        },
      );
      expect(config).toBeDefined();
      const program = ts.createProgram(config?.fileNames ?? [], config?.options ?? {});
      const emittedFiles: string[] = [];
      const emit = program.emit(
        program.getSourceFile(path.join(root, "src/Service.tsx")),
        (fileName) => {
          emittedFiles.push(path.resolve(fileName));
        },
      );
      expect(emit.emitSkipped).toBe(false);
      expect(emittedFiles).toContain(path.join(root, `src/Service.${runtime}`));
      expect(result.code).toContain(`from "./Service.${runtime}"`);
    },
    30_000,
  );

  it("rejects generated ESM syntax in a CommonJS graph with verbatimModuleSyntax", () => {
    const root = fixture(
      { module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true },
      "commonjs",
      "ts",
    );
    fs.writeFileSync(path.join(root, "src/Service.ts"), "");
    typecheck(root);
    expect(() => compileDiGraph({ baseDir: root, outFile: "src/di.generated.ts" })).toThrow(
      /CROCO_DI_COMPILE_004/,
    );
  }, 30_000);
});
