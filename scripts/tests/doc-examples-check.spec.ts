import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../doc-examples-check.mts");
const scriptTestTimeout = 30_000;
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("doc-examples-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it(
    "typechecks TypeScript documentation fences marked with typecheck",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { greet } from "@croco/alpha";',
        "",
        'const message: string = greet("docs");',
        "```",
        "",
      ]);

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 1 TypeScript documentation example");
    },
    scriptTestTimeout,
  );

  it(
    "fails when a typechecked documentation fence no longer matches the public API",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { greet } from "@croco/alpha";',
        "",
        'const message: number = greet("docs");',
        "```",
        "",
      ]);

      const result = runScript(root, "--check");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("documentation example drift detected");
      expect(result.stdout).toContain("Type 'string' is not assignable to type 'number'");
    },
    scriptTestTimeout,
  );

  it(
    "requires untypechecked TypeScript fences to be explicitly marked or recorded",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { value } from "@croco/alpha";',
        "",
        "const typedValue: number = value;",
        "```",
        "",
        "```ts",
        "const legacyExample = runtimeOnlyValue;",
        "```",
        "",
      ]);

      const failedCheck = runScript(root, "--check");

      expect(failedCheck.status).toBe(1);
      expect(failedCheck.stdout).toContain("must be marked as `typecheck`, marked as `no-check`");

      const writeResult = runScript(root, "--write");
      const passingCheck = runScript(root, "--check");
      const baseline = readFileSync(join(root, "docs", "doc-examples-baseline.json"), "utf-8");

      expect(writeResult.status).toBe(0);
      expect(passingCheck.status).toBe(0);
      expect(baseline).toContain("Legacy authored docs block");
    },
    scriptTestTimeout,
  );

  it(
    "skips pseudo-code fences marked with skip markers without adding them to the baseline",
    () => {
      const root = createTempRoot();
      writeDocs(root, [
        "# Example",
        "",
        "```ts typecheck",
        'import { value } from "@croco/alpha";',
        "",
        "const typedValue: number = value;",
        "```",
        "",
        "```ts no-check",
        "const generatedAtRuntime: RuntimeOnlyType = container.resolve();",
        "```",
        "",
        "```ts skip-typecheck",
        "const generatedInAnotherRuntime: RuntimeOnlyType = container.resolve();",
        "```",
        "",
      ]);

      const result = runScript(root, "--check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("checked 1 TypeScript documentation example");
    },
    scriptTestTimeout,
  );
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-doc-examples-"));
  tempRoots.push(root);
  writePackage(root, "alpha", {
    name: "@croco/alpha",
  });

  return root;
}

function writeDocs(root: string, lines: readonly string[]): void {
  writeFileSync(join(root, "README.md"), `${lines.join("\n")}\n`);
}

function writePackage(root: string, packageDirName: string, pkg: Record<string, unknown>): void {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFileSync(
    join(packageDir, "src", "index.ts"),
    [
      "export const value = 1;",
      "",
      "export function greet(name: string): string {",
      "  return `hello ${name}`;",
      "}",
      "",
    ].join("\n"),
  );
  writeJson(join(packageDir, "package.json"), pkg);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runScript(root: string, mode: "--check" | "--write"): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, mode, "--root", root],
    {
      encoding: "utf-8",
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
