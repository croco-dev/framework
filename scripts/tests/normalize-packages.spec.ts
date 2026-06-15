import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../normalize-packages.mjs");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("normalize-packages.mjs", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports drift in check mode without writing files", () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, "example", {
      name: "@croco/example",
      version: "0.0.3",
      files: ["dist"],
      type: "commonjs",
      main: "./src/index.ts",
      types: ["dist/index.d.ts", "dist/index.d.mts"],
      publishConfig: {
        main: "./src/index.ts",
        types: ["dist/index.d.ts", "dist/index.d.mts"],
        exports: {
          ".": {
            import: "./dist/index.mjs",
            require: "./dist/index.js",
            types: ["dist/index.d.ts", "dist/index.d.mts"],
          },
        },
      },
    });
    const before = readFileSync(packagePath, "utf-8");

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("package manifest drift detected");
    expect(result.stdout).toContain("publishConfig.main must not reference ./src");
    expect(readFileSync(packagePath, "utf-8")).toBe(before);
  });

  it("normalizes publish contracts in write mode and preserves versions", () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, "example", {
      name: "@croco/example",
      version: "0.0.3",
      type: "commonjs",
      main: "./src/index.ts",
      types: ["dist/index.d.ts", "dist/index.d.mts"],
      publishConfig: {
        files: ["dist"],
        main: "./src/index.ts",
        types: ["dist/index.d.ts", "dist/index.d.mts"],
        exports: {
          ".": {
            import: "./dist/index.mjs",
            require: "./dist/index.js",
            types: ["dist/index.d.ts", "dist/index.d.mts"],
          },
        },
      },
    });

    const result = runScript(root, "--write");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    expect(result.status).toBe(0);
    expect(pkg.version).toBe("0.0.3");
    expect(pkg.files).toEqual(["dist"]);
    expect(pkg.types).toBe("./dist/index.d.ts");
    expect(pkg.publishConfig.access).toBe("public");
    expect(pkg.publishConfig.files).toBeUndefined();
    expect(pkg.publishConfig.main).toBe("./dist/index.js");
    expect(pkg.publishConfig.types).toBe("./dist/index.d.ts");
    expect(pkg.publishConfig.exports["."].types).toBe("./dist/index.d.ts");
  });

  it("normalizes storage packages to direct dist root entrypoints", () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, "storage-core", {
      name: "@croco/storage-core",
      version: "0.0.3",
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
    });

    const result = runScript(root, "--write");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    expect(result.status).toBe(0);
    expect(pkg.main).toBe("./dist/index.js");
    expect(pkg.module).toBe("./dist/index.mjs");
    expect(pkg.types).toBe("./dist/index.d.ts");
    expect(pkg.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.mjs",
        require: "./dist/index.js",
      },
    });
    expect(pkg.publishConfig.exports).toEqual(pkg.exports);
  });

  it("rejects storage packages whose root entrypoints point outside the shipped dist files", () => {
    const root = createTempRoot();
    writePackage(root, "storage-core", {
      name: "@croco/storage-core",
      version: "0.0.3",
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
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("storage-core/package.json");
    expect(result.stdout).toContain("main must point at ./dist");
    expect(result.stdout).toContain("module must be a string");
    expect(result.stdout).toContain('exports["."] is required');
  });

  it("skips the private docs site and allows documented public non-library package exceptions", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "docs",
      {
        name: "@croco/docs",
        private: true,
        version: "0.0.3",
        type: "module",
      },
      {
        sourceIndex: false,
      },
    );
    writePackage(root, "create-croco-app", {
      name: "create-croco-app",
      version: "0.0.3",
      bin: {
        "create-croco-app": "./dist/index.js",
      },
      files: ["dist", "templates"],
      type: "module",
      publishConfig: {
        access: "public",
      },
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Skipped private: 1");
  });

  it("rejects a public docs site package without a non-publish marker", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "docs",
      {
        name: "@croco/docs",
        version: "0.0.3",
        type: "module",
        publishConfig: {
          access: "public",
        },
      },
      {
        sourceIndex: false,
      },
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("docs/package.json");
    expect(result.stdout).toContain(
      "public packages without src/index.ts need an explicit entrypoint exemption",
    );
  });

  it("requires runtime reflect-metadata dependencies for source side-effect imports", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "decorator-dev-only",
      {
        name: "@croco/decorator-dev-only",
        version: "0.0.3",
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
        devDependencies: {
          "reflect-metadata": "^0.2.2",
        },
      },
      {
        sourceContent: 'import "reflect-metadata";\nexport const value = 1;\n',
      },
    );
    writePackage(
      root,
      "decorator-missing",
      {
        name: "@croco/decorator-missing",
        version: "0.0.3",
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
      {
        sourceContent: "import 'reflect-metadata';\nexport const value = 1;\n",
      },
    );
    writePackage(
      root,
      "decorator-runtime",
      {
        name: "@croco/decorator-runtime",
        version: "0.0.3",
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
        dependencies: {
          "reflect-metadata": "^0.2.2",
        },
      },
      {
        sourceContent: 'import "reflect-metadata";\nexport const value = 1;\n',
      },
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("decorator-dev-only/package.json");
    expect(result.stdout).toContain("only devDependencies.reflect-metadata is declared");
    expect(result.stdout).toContain("decorator-missing/package.json");
    expect(result.stdout).toContain("dependencies.reflect-metadata is missing");
    expect(result.stdout).not.toContain("decorator-runtime/package.json");
  });

  it("requires Drizzle package manifests to use the workspace catalog policy", () => {
    const root = createTempRoot();
    writePackage(root, "catalog-drizzle", {
      name: "@croco/catalog-drizzle",
      version: "0.0.3",
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
      devDependencies: {
        "drizzle-orm": "catalog:",
      },
      peerDependencies: {
        "drizzle-orm": "catalog:",
      },
    });
    writePackage(root, "runtime-drizzle", {
      name: "@croco/runtime-drizzle",
      version: "0.0.3",
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
      dependencies: {
        "drizzle-orm": "catalog:",
      },
    });
    writePackage(root, "dev-only-drizzle", {
      name: "@croco/dev-only-drizzle",
      version: "0.0.3",
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
      devDependencies: {
        "drizzle-orm": "catalog:",
      },
    });
    writePackage(root, "stale-drizzle", {
      name: "@croco/stale-drizzle",
      version: "0.0.3",
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
      devDependencies: {
        "drizzle-orm": "0.44.2",
      },
      peerDependencies: {
        "drizzle-orm": ">=0.30.0",
      },
    });
    writePackage(root, "missing-drizzle", {
      name: "@croco/missing-drizzle",
      version: "0.0.3",
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
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("catalog-drizzle/package.json");
    expect(result.stdout).not.toContain("runtime-drizzle/package.json");
    expect(result.stdout).toContain("dev-only-drizzle/package.json");
    expect(result.stdout).toContain(
      "drizzle-orm devDependencies and peerDependencies must be declared together",
    );
    expect(result.stdout).toContain("stale-drizzle/package.json");
    expect(result.stdout).toContain('devDependencies.drizzle-orm must use catalog:, not "0.44.2"');
    expect(result.stdout).toContain(
      'peerDependencies.drizzle-orm must use catalog:, not ">=0.30.0"',
    );
    expect(result.stdout).toContain("missing-drizzle/package.json");
    expect(result.stdout).toContain("drizzle-orm must be declared with catalog:");
  });

  it("ignores test-only reflect-metadata imports in package manifests", () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, "test-only-decorator", {
      name: "@croco/test-only-decorator",
      version: "0.0.3",
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
    });
    const packageDir = dirname(packagePath);
    const testPath = join(packageDir, "src", "tests", "Decorator.spec.ts");
    mkdirSync(dirname(testPath), { recursive: true });
    writeFileSync(testPath, 'import "reflect-metadata";\n');

    const result = runScript(root, "--check");

    expect(result.status).toBe(0);
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-package-manifests-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"));

  return root;
}

function writePackage(
  root: string,
  packageDirName: string,
  pkg: Record<string, unknown>,
  options: { readonly sourceContent?: string; readonly sourceIndex?: boolean } = {},
): string {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(packageDir, { recursive: true });

  if (options.sourceIndex !== false) {
    const sourcePath = join(packageDir, "src", "index.ts");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, options.sourceContent ?? "export const value = 1;\n");
  }

  const packagePath = join(packageDir, "package.json");
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  return packagePath;
}

function runScript(root: string, mode: "--check" | "--write"): ScriptResult {
  const result = spawnSync("node", [scriptPath, mode, "--root", root], {
    encoding: "utf-8",
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
