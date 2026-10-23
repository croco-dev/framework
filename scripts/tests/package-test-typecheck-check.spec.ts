import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectPackageTestTypecheckDiagnostics } from "../package-test-typecheck-check.mts";

const roots: string[] = [];
function fixture(config: unknown, command = "tsrs --noEmit"): string {
  const root = mkdtempSync(join(tmpdir(), "croco-test-typecheck-"));
  roots.push(root);
  write(root, "packages/example/package.json", {
    name: "@croco/example",
    scripts: { typecheck: command },
  });
  write(root, "packages/example/tsconfig.json", config);
  write(root, "packages/example/src/index.ts", "export const value = 1;");
  write(root, "packages/example/src/tests/example.spec.ts", "export {};");
  write(root, "packages/example/src/nested/example.test.ts", "export {};");
  return root;
}
function write(root: string, path: string, value: unknown): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("package test typecheck membership", () => {
  it("accepts broad inclusion, harmless exclusions, and both test naming patterns", () => {
    const root = fixture({ include: ["src"], exclude: ["dist", "node_modules"] });
    expect(collectPackageTestTypecheckDiagnostics(root)).toEqual([]);
  });

  it.each([
    { include: ["src"], exclude: ["**/*.spec.ts", "**/*.test.ts"] },
    { include: ["src/index.ts"] },
    { files: ["src/index.ts"] },
  ])("rejects omitted tests with resolved package, config, and file paths: %j", (config) => {
    const diagnostics = collectPackageTestTypecheckDiagnostics(fixture(config));
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toContain(
      "@croco/example (packages/example/package.json), config packages/example/tsconfig.json",
    );
    expect(diagnostics.join("\n")).toContain("packages/example/src/tests/example.spec.ts");
    expect(diagnostics.join("\n")).toContain("packages/example/src/nested/example.test.ts");
  });

  it("resolves inherited exclusions and child overrides with TypeScript semantics", () => {
    const root = fixture({ extends: "../../tsconfig/base.json" });
    write(root, "tsconfig/base.json", {
      include: ["../packages/example/src"],
      exclude: ["../packages/example/src/tests"],
    });
    expect(collectPackageTestTypecheckDiagnostics(root)).toEqual([
      expect.stringContaining("test packages/example/src/tests/example.spec.ts is missing"),
    ]);
    write(root, "packages/example/tsconfig.json", {
      extends: "../../tsconfig/base.json",
      exclude: [],
    });
    expect(collectPackageTestTypecheckDiagnostics(root)).toEqual([]);
  });

  it("uses the selected project and resolves its paths relative to that config", () => {
    const root = fixture({ exclude: ["src"] }, "tsrs --noEmit --project configs/check.json");
    write(root, "packages/example/configs/check.json", { include: ["../src"] });
    expect(collectPackageTestTypecheckDiagnostics(root)).toEqual([]);
    write(root, "packages/example/configs/check.json", { include: ["../src/index.ts"] });
    expect(collectPackageTestTypecheckDiagnostics(root)).toHaveLength(2);
  });

  it.each([
    "tsc --noEmit",
    "node ../../node_modules/typescript/bin/tsc --noEmit",
    "tsrs --noEmit || tsc --noEmit",
    "tsrs --noEmit\ntsc --noEmit",
  ])("rejects a fallback to the TypeScript compiler: %s", (command) => {
    expect(collectPackageTestTypecheckDiagnostics(fixture({ include: ["src"] }, command))).toEqual([
      expect.stringContaining("unsupported typecheck command"),
    ]);
  });

  it("accepts explicit no-emit project options for tsrs", () => {
    expect(
      collectPackageTestTypecheckDiagnostics(
        fixture({ include: ["src"] }, "tsrs --pretty false --noEmit --project ./tsconfig.json"),
      ),
    ).toEqual([]);
  });

  it.each(["{", { extends: "./missing.json" }, { compilerOptions: { target: "invalid" } }])(
    "rejects malformed configs: %j",
    (config) => {
      expect(collectPackageTestTypecheckDiagnostics(fixture(config)).join("\n")).toContain(
        "config packages/example/tsconfig.json:",
      );
    },
  );

  it("rejects a missing config and an unsupported command", () => {
    const root = fixture({ include: ["src"] });
    rmSync(join(root, "packages/example/tsconfig.json"));
    expect(collectPackageTestTypecheckDiagnostics(root).join("\n")).toContain("Cannot read file");
    write(root, "packages/example/package.json", { scripts: { typecheck: "echo skipped" } });
    expect(collectPackageTestTypecheckDiagnostics(root).join("\n")).toContain(
      "unsupported typecheck command",
    );
  });

  it.each([
    "tsrs --noEmit src/index.ts",
    "tsrs --noEmit --exclude src/tests",
    "tsrs --noEmit false",
    "tsrs --project tsconfig.json",
    "tsrs --noEmit --noEmit false",
  ])("rejects commands that do not check a supported no-emit project: %s", (command) => {
    expect(collectPackageTestTypecheckDiagnostics(fixture({ include: ["src"] }, command))).toEqual([
      expect.stringContaining("typecheck must run tsrs --noEmit with a project config"),
    ]);
  });

  it("does not impose typecheck on tooling packages without that script", () => {
    const root = fixture({ include: ["src"] });
    write(root, "packages/example/package.json", { scripts: { test: "vitest run" } });
    expect(collectPackageTestTypecheckDiagnostics(root)).toEqual([]);
  });
});
