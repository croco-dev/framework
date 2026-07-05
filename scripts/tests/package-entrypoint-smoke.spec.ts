import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../package-entrypoint-smoke.mts");
const spawnTimeoutMs = 180_000;
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

type TempRootOptions = {
  readonly packageManager?: string | false;
};

describe("package-entrypoint-smoke.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("checks valid importable packages and skips the private docs site", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "valid");
    writeDocsPackage(root);

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "package-entrypoint-smoke: @croco/valid packed tarball installed with node-linker=isolated",
    );
    expect(result.stdout).toContain("✓ @croco/valid: esm 1, cjs 1, types 1");
    expect(result.stdout).toContain("summary checked=1 exempt=0 skippedPrivate=1");
  });

  it("requires the root package manager pin for isolated consumers", () => {
    const root = createTempRoot({ packageManager: false });
    writeImportablePackage(root, "valid");

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "packageManager must pin the pnpm version",
    );
  });

  it("rejects a public docs site package without an entrypoint exemption", () => {
    const root = createTempRoot();
    writePublicDocsPackage(root);

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "packages/docs/package.json: public package without src/index.ts needs an explicit entrypoint exemption",
    );
  });

  it("fails early when package build artifacts are absent", () => {
    const root = createTempRoot();
    writeUnbuiltPackage(root, "unbuilt");

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Package entrypoint smoke build prerequisite failed:");
    expect(result.stdout).toContain("1 public package(s) are missing build artifacts under dist.");
    expect(result.stdout).toContain("Run pnpm build before pnpm package-entrypoints:smoke.");
    expect(result.stdout).toContain("@croco/unbuilt (packages/unbuilt/dist)");
    expect(result.stdout).not.toContain("points to missing file");
    expect(result.stdout).not.toContain("no ESM import target found");
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
    writeImportablePackage(root, "hidden-helper");
    writeImportablePackage(root, "hidden-owner", {
      cjsContent: 'exports.value = require("@croco/hidden-helper").value;\n',
      dependencies: {
        "@croco/hidden-helper": "0.0.0",
      },
      declarationContent:
        'export type { Value } from "@croco/hidden-helper";\nexport declare const value: string;\n',
      esmContent: 'export { value } from "@croco/hidden-helper";\n',
    });
    writeImportablePackage(root, "missing-runtime-dependency", {
      cjsContent: 'exports.value = require("@croco/hidden-helper").value;\n',
      dependencies: {
        "@croco/hidden-owner": "0.0.0",
      },
      esmContent: 'export { value } from "@croco/hidden-helper";\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("@croco/hidden-helper");
  });

  it("installs transitive internal dependencies from packed tarball overrides", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "runtime-helper", {
      declarationContent: "export type Value = string;\nexport declare const value: string;\n",
    });
    writeImportablePackage(root, "runtime-bridge", {
      cjsContent: 'exports.value = require("@croco/runtime-helper").value;\n',
      dependencies: {
        "@croco/runtime-helper": "0.0.0",
      },
      declarationContent: 'export type { Value } from "@croco/runtime-helper";\n',
      esmContent: 'export { value } from "@croco/runtime-helper";\n',
    });
    writeImportablePackage(root, "uses-runtime-bridge", {
      cjsContent: 'exports.value = require("@croco/runtime-bridge").value;\n',
      dependencies: {
        "@croco/runtime-bridge": "0.0.0",
      },
      declarationContent: 'export type { Value } from "@croco/runtime-bridge";\n',
      esmContent: 'export { value } from "@croco/runtime-bridge";\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "package-entrypoint-smoke: @croco/uses-runtime-bridge packed tarball installed with node-linker=isolated",
    );
    expect(result.stdout).toContain("summary checked=3 exempt=0 skippedPrivate=0");
  });

  it("matches packed tarballs by manifest name when package names share a prefix", () => {
    const root = createTempRoot();
    const prefixedExport = {
      import: "./dist/index.mjs",
      require: "./dist/index.js",
      types: "./dist/index.d.ts",
    };
    writeImportablePackage(root, "aaa-prefix-extra", {
      exportsValue: {
        ".": prefixedExport,
        "./extra": {
          import: "./dist/extra.mjs",
          require: "./dist/extra.js",
          types: "./dist/extra.d.ts",
        },
      },
      packageName: "@croco/prefix-extra",
    });
    writeFileSync(
      join(root, "packages", "aaa-prefix-extra", "dist", "extra.js"),
      'exports.extra = "ok";\n',
    );
    writeFileSync(
      join(root, "packages", "aaa-prefix-extra", "dist", "extra.mjs"),
      'export const extra = "ok";\n',
    );
    writeFileSync(
      join(root, "packages", "aaa-prefix-extra", "dist", "extra.d.ts"),
      "export declare const extra: string;\n",
    );
    writeImportablePackage(root, "zzz-prefix", {
      packageName: "@croco/prefix",
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ @croco/prefix-extra: esm 2, cjs 2, types 2");
    expect(result.stdout).toContain("✓ @croco/prefix: esm 1, cjs 1, types 1");
  });

  it("does not resolve dependencies from package-local node_modules", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "package-local-dependency", {
      cjsContent: 'require("package-local-only");\nexports.value = "ok";\n',
      dependencies: {
        "package-local-only": "1.0.0",
      },
      esmContent: 'import "package-local-only";\nexport const value = "ok";\n',
    });
    writePackageLocalDependency(root, "package-local-dependency", "package-local-only");

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("package-local-only");
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

  it("does not treat diagnostic code string literals as type dependency imports", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "diagnostic-codes", {
      declarationContent:
        'type DiagnosticCode = "architecture-policy/forbidden-import" | "architecture-policy/private-entrypoint-import";\nexport type Value = { readonly code: DiagnosticCode };\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("undeclared type dependency");
  });

  it("does not treat generated runtime source strings as runtime dependency imports", () => {
    const root = createTempRoot();
    writeImportablePackage(root, "generated-source", {
      cjsContent:
        'const generated = `import { ProblemClientError } from "@croco/frontend-problems";\\n`;\nexports.value = generated;\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("undeclared runtime dependency");
  });
});

function createTempRoot(options: TempRootOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), "croco-entrypoint-smoke-test-"));
  const packageManager = options.packageManager ?? "pnpm@10.15.1";
  tempRoots.push(root);
  mkdirSync(join(root, "packages"));
  mkdirSync(join(root, "node_modules", "reflect-metadata"), { recursive: true });
  writeFileSync(join(root, "node_modules", "reflect-metadata", "index.js"), "\n");
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "croco-entrypoint-smoke-test-root",
        ...(packageManager === false ? {} : { packageManager }),
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    `${JSON.stringify(
      {
        packages: ["packages/*"],
      },
      null,
      2,
    )}\n`,
  );

  return root;
}

function writeImportablePackage(
  root: string,
  packageDirName: string,
  options: {
    readonly cjsContent?: string;
    readonly declarationContent?: string;
    readonly dependencies?: Record<string, string>;
    readonly esmContent?: string;
    readonly exportsValue?: unknown;
    readonly importTarget?: string;
    readonly packageName?: string;
    readonly typesTarget?: string;
  } = {},
): void {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });
  mkdirSync(join(packageDir, "dist"), { recursive: true });

  const packageName = options.packageName ?? `@croco/${packageDirName}`;
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
        ...(options.dependencies ? { dependencies: options.dependencies } : {}),
        name: packageName,
        version: "0.0.0",
        dependencies: options.dependencies,
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

function writePackageLocalDependency(
  root: string,
  packageDirName: string,
  dependencyName: string,
): void {
  const dependencyDir = join(
    root,
    "packages",
    packageDirName,
    "node_modules",
    ...dependencyName.split("/"),
  );

  mkdirSync(dependencyDir, { recursive: true });
  writeFileSync(
    join(dependencyDir, "package.json"),
    `${JSON.stringify(
      {
        name: dependencyName,
        version: "1.0.0",
        main: "./index.js",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(dependencyDir, "index.js"), "module.exports = {};\n");
}

function writeUnbuiltPackage(root: string, packageDirName: string): void {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });

  const packageName = `@croco/${packageDirName}`;
  writeFileSync(join(packageDir, "src", "index.ts"), 'export const value = "ok";\n');
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
          types: "./dist/index.d.ts",
          exports: {
            ".": {
              import: "./dist/index.mjs",
              require: "./dist/index.js",
              types: "./dist/index.d.ts",
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
        private: true,
        version: "0.0.0",
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
}

function writePublicDocsPackage(root: string): void {
  const packageDir = join(root, "packages", "docs");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@croco/docs",
        publishConfig: {
          access: "public",
        },
        type: "module",
        version: "0.0.0",
      },
      null,
      2,
    )}\n`,
  );
}

function runScript(root: string): ScriptResult {
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath, "--root", root], {
    encoding: "utf-8",
    timeout: spawnTimeoutMs,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
