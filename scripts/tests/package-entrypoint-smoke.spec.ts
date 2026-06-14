import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../package-entrypoint-smoke.mts");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("package-entrypoint-smoke.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("checks valid importable packages and reports exempt packages", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "valid");
    writeDocsPackage(root);

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ @croco/valid: esm 1, cjs 1, types 1");
    expect(result.stdout).toContain(
      "- @croco/docs: Astro documentation site; not imported as a runtime package.",
    );
    expect(result.stdout).toContain("summary checked=1 exempt=1 skippedPrivate=0");
  });

  it("fails when an export map points at a missing runtime entrypoint", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "invalid-export", {
      importTarget: "./dist/missing.mjs",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '@croco/invalid-export: exports["."].import points to missing file ./dist/missing.mjs',
    );
  });

  it("fails when an export map has an invalid shape", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "invalid-export-map", {
      exportsValue: [],
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "@croco/invalid-export-map: exports must be a string or object",
    );
  });

  it("fails when a declaration target is missing", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "missing-types", {
      typesTarget: "./dist/missing.d.ts",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '@croco/missing-types: exports["."].types points to missing file ./dist/missing.d.ts',
    );
  });

  it("fails when a runtime entrypoint imports an undeclared dependency", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "missing-runtime-dependency", {
      cjsContent: 'require("zod");\nexports.value = "ok";\n',
      esmContent: 'import "zod";\nexport const value = "ok";\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("zod");
  });

  it("fails when declarations import an undeclared type dependency", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "missing-type-dependency", {
      declarationContent:
        'import type { MissingType } from "@croco-smoke/missing-types";\nexport type Value = MissingType;\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("@croco-smoke/missing-types");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-entrypoint-smoke-test-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"));
  mkdirSync(join(root, "node_modules", "reflect-metadata"), { recursive: true });
  writeFileSync(join(root, "node_modules", "reflect-metadata", "index.js"), "\n");

  return root;
}

function writeImportablePackage(
  root: string,
  packageDirName: string,
  options: {
    readonly cjsContent?: string;
    readonly declarationContent?: string;
    readonly esmContent?: string;
    readonly exportsValue?: unknown;
    readonly importTarget?: string;
    readonly typesTarget?: string;
  } = {},
): void {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });
  mkdirSync(join(packageDir, "dist"), { recursive: true });

  const packageName = `@croco/${packageDirName}`;
  writeFileSync(join(packageDir, "src", "index.ts"), 'export const value = "ok";\n');
  writeFileSync(
    join(packageDir, "dist", "index.js"),
    options.cjsContent ?? 'exports.value = "ok";\n',
  );
  writeFileSync(
    join(packageDir, "dist", "index.mjs"),
    options.esmContent ?? 'export const value = "ok";\n',
  );
  writeFileSync(
    join(packageDir, "dist", "index.d.ts"),
    options.declarationContent ?? "export declare const value: string;\n",
  );
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: packageName,
        version: "0.0.0",
        files: ["dist"],
        type: "commonjs",
        main: "./src/index.ts",
        types: "./src/index.ts",
        publishConfig: {
          access: "public",
          main: "./dist/index.js",
          types: options.typesTarget ?? "./dist/index.d.ts",
          exports: options.exportsValue ?? {
            ".": {
              import: options.importTarget ?? "./dist/index.mjs",
              require: "./dist/index.js",
              types: options.typesTarget ?? "./dist/index.d.ts",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

function writeDocsPackage(root: string): void {
  const packageDir = join(root, "packages", "docs");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@croco/docs",
        version: "0.0.0",
        type: "module",
        publishConfig: {
          access: "public",
        },
      },
      null,
      2,
    )}\n`,
  );
}

function runScript(root: string): ScriptResult {
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath, "--root", root], {
    encoding: "utf-8",
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
