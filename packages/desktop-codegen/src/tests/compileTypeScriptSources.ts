import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { expect } from "vitest";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACE_MODULES = new Map([
  ["@croco/desktop-codegen", path.join(PACKAGE_ROOT, "src/index.ts")],
  ["@croco/problems-core", path.resolve(PACKAGE_ROOT, "../problems-core/src/index.ts")],
  ["@croco/protocols-desktop", path.resolve(PACKAGE_ROOT, "../protocols-desktop/src/index.ts")],
]);

export function expectTypeScriptSourcesToCompile(
  sources: ReadonlyMap<string, string>,
  rootFileNames: readonly string[] = [...sources.keys()],
): void {
  const compilerOptions: ts.CompilerOptions = {
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  };
  const host = ts.createCompilerHost(compilerOptions);
  const getSource = (name: string): string | undefined =>
    sources.get(name) ?? ts.sys.readFile(name);

  host.getSourceFile = (name, languageVersion) => {
    const source = getSource(name);
    return source === undefined
      ? undefined
      : ts.createSourceFile(name, source, languageVersion, true);
  };
  host.fileExists = (name) => sources.has(name) || ts.sys.fileExists(name);
  host.readFile = getSource;
  host.directoryExists = (name) => name === "/virtual" || ts.sys.directoryExists(name);
  host.resolveModuleNames = (moduleNames, containingFile) =>
    moduleNames.map((moduleName) => {
      const workspaceModule = WORKSPACE_MODULES.get(moduleName);
      if (workspaceModule !== undefined) {
        return { resolvedFileName: workspaceModule, extension: ts.Extension.Ts };
      }
      const virtualCandidate = path.resolve(path.dirname(containingFile), `${moduleName}.ts`);
      if (sources.has(virtualCandidate)) {
        return { resolvedFileName: virtualCandidate, extension: ts.Extension.Ts };
      }
      return ts.resolveModuleName(moduleName, containingFile, compilerOptions, host).resolvedModule;
    });

  const program = ts.createProgram([...rootFileNames], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (diagnostic.file === undefined || diagnostic.start === undefined) {
      return message;
    }
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
  });

  expect(diagnostics).toEqual([]);
}
