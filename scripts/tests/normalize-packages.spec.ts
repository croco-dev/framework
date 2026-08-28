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
    const packagePath = writePackage(
      root,
      "example",
      {
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
      },
      { repository: false },
    );
    const before = readFileSync(packagePath, "utf-8");

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("package manifest drift detected");
    expect(result.stdout).toContain("publishConfig.main must not reference ./src");
    expect(readFileSync(packagePath, "utf-8")).toBe(before);
  });

  it("normalizes publish contracts in write mode and preserves versions", () => {
    const root = createTempRoot();
    const packagePath = writePackage(
      root,
      "example",
      {
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
      },
      { repository: false },
    );

    const result = runScript(root, "--write");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    expect(result.status).toBe(0);
    expect(pkg.version).toBe("0.0.3");
    expect(pkg.repository).toEqual(repositoryFor("example"));
    expect(pkg.files).toEqual(["dist"]);
    expect(pkg.types).toBe("./dist/index.d.ts");
    expect(pkg.publishConfig.access).toBe("public");
    expect(pkg.publishConfig.files).toBeUndefined();
    expect(pkg.publishConfig.main).toBe("./dist/index.js");
    expect(pkg.publishConfig.types).toBe("./dist/index.d.ts");
    expect(pkg.publishConfig.exports["."].types).toBe("./dist/index.d.ts");
  });

  it("removes direct registry publish scripts while preserving safe package scripts", () => {
    const root = createTempRoot();
    const packagePath = writePublishablePackage(root, {
      build: "tsup",
      deploy: "pnpm run build && pnpm publish --no-git-checks",
      release: "changeset publish",
    });

    const result = runScript(root, "--write");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    expect(result.status).toBe(0);
    expect(pkg.scripts).toEqual({ build: "tsup" });
    expect(result.stdout).toContain("Removed direct publish script @croco/example: scripts.deploy");
    expect(result.stdout).toContain(
      "Removed direct publish script @croco/example: scripts.release",
    );
  });

  it.each([
    ["pnpm publish", "pnpm publish --access public"],
    ["filtered pnpm publish", "pnpm --filter @croco/example publish"],
    ["npm publish", "npm publish --provenance"],
    ["yarn publish", "yarn publish"],
    ["bun publish", "bun publish"],
    ["Changesets publish", "pnpm exec changeset publish"],
    ["option-terminated Changesets publish", "changeset -- publish"],
    ["npx Changesets publish", "npx changeset publish"],
    ["environment-prefixed npm publish", "CI=1 npm publish"],
    ["env-wrapped pnpm publish", "env CI=1 pnpm publish"],
    ["shell-wrapped pnpm publish", "sh -c 'pnpm publish'"],
    ["ash-wrapped pnpm publish", "ash -c 'pnpm publish'"],
    ["dash-wrapped pnpm publish", "dash -c 'pnpm publish'"],
    ["ksh-wrapped pnpm publish", "ksh -c 'pnpm publish'"],
    ["local Changesets publish", "./node_modules/.bin/changeset publish"],
    ["Corepack pnpm publish", "corepack pnpm publish"],
    ["versioned npx Changesets publish", "npx @changesets/cli@latest publish"],
    ["versioned pnpm dlx Changesets publish", "pnpm dlx @changesets/cli@2.29.7 publish"],
    ["node Changesets CLI publish", "node node_modules/@changesets/cli/bin.js publish"],
    ["option-prefixed Changesets publish", "changeset --tag next publish"],
    ["equals-option Changesets publish", "changeset --tag=next publish"],
    ["snapshot Changesets publish", "changeset --snapshot beta publish"],
    [
      "snapshot-template Changesets publish",
      "changeset --snapshotPrereleaseTemplate {tag} publish",
    ],
    ["boolean-value Changesets publish", "changeset --verbose false publish"],
    ["negated-boolean Changesets publish", "changeset --no-verbose publish"],
    ["negated-aliased-boolean Changesets publish", "changeset --no-git-tag publish"],
    ["negated-snapshot Changesets publish", "changeset --no-snapshot publish"],
    ["generic-option Changesets publish", "changeset --unknown value publish"],
    ["bundled-option Changesets publish", "changeset -xv publish"],
    [
      "double-brace snapshot-template Changesets publish",
      "changeset --snapshotPrereleaseTemplate {{tag}} publish",
    ],
    ["substituted-option Changesets publish", "changeset --tag $(printf next) publish"],
    ["backtick-option Changesets publish", "changeset --tag `printf next` publish"],
    [
      "nested-substituted-option Changesets publish",
      "changeset --tag ${TAG:-$(printf next)} publish",
    ],
    [
      "option-prefixed node Changesets publish",
      "node node_modules/@changesets/cli/bin.js --tag next publish",
    ],
    [
      "verbose node Changesets publish",
      "node node_modules/@changesets/cli/bin.js --verbose publish",
    ],
    ["line-continued Changesets publish", "changeset \\" + "\n" + "publish"],
    ["CRLF-line-continued Changesets publish", "changeset \\" + "\r\n" + "publish"],
    ["grouped Changesets publish", "{ changeset publish; }"],
    ["substituted pnpm publish", "echo `pnpm publish`"],
    ["double-quoted substituted pnpm publish", 'echo "$(pnpm publish)"'],
    ["double-quoted backtick pnpm publish", 'echo "`pnpm publish`"'],
    ["npm exec call Changesets publish", "npm exec -c 'changeset publish'"],
    ["npx call Changesets publish", "npx --call 'changeset publish'"],
    ["pnpm shell-mode Changesets publish", "pnpm exec --shell-mode 'changeset publish'"],
    [
      "registry-configured npx Changesets publish",
      "npx --registry https://registry.npmjs.org @changesets/cli publish",
    ],
    ["nested npm publish", "npm exec -- npm publish"],
    ["nested pnpm publish", "pnpm exec pnpm publish"],
    ["npx pnpm publish", "npx pnpm publish"],
    ["nested shell pnpm publish", "npm exec -- sh -c 'pnpm publish'"],
  ])("rejects a public package script that invokes %s", (_label, command) => {
    const root = createTempRoot();
    writePublishablePackage(root, {
      build: "tsup",
      release: `pnpm run build && ${command}`,
    });

    const result = runScript(root, "--check");

    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout, result.stderr).toContain(
      "scripts.release must not publish outside the protected Changesets workflow",
    );
  });

  it("rejects a private workspace package script that invokes Changesets publish", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "private-release-tool",
      {
        name: "@croco/private-release-tool",
        private: true,
        version: "0.0.0",
        scripts: {
          release: "changeset publish",
        },
      },
      { sourceIndex: false },
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("private-release-tool/package.json");
    expect(result.stdout).toContain(
      "scripts.release must not publish outside the protected Changesets workflow",
    );
  });

  it.each([
    "npm run publish",
    "npm exec echo publish",
    "pnpm run docs -- publish",
    "npx echo changeset publish",
    "pnpm exec echo changeset publish",
    "changeset --help publish",
    "changeset -- --tag value publish",
    "changeset --snapshot publish",
    "changeset --tag publish status",
    "node node_modules/@changesets/cli/bin.js --tag publish status",
    'echo "pnpm publish"',
    "echo '$(pnpm publish)'",
    "echo '`pnpm publish`'",
  ])("preserves a non-publishing script containing publish tokens: %s", (command) => {
    const root = createTempRoot();
    writePublishablePackage(root, {
      release: command,
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(0);
  });

  it("rejects a root script that bypasses the protected release workflow", () => {
    const root = createTempRoot();
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "croco",
          private: true,
          scripts: {
            release: "changeset publish",
          },
        },
        null,
        2,
      )}\n`,
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "package.json: scripts.release must not publish outside the protected Changesets workflow",
    );
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
    expect(result.stdout).toContain("main must match publishConfig.main");
    expect(result.stdout).toContain("types must match publishConfig.types");
    expect(result.stdout).toContain("exports must match publishConfig.exports");
    expect(result.stdout).toContain("main must point at ./dist");
    expect(result.stdout).toContain('exports["."] is required');
  });

  it("requires spine packages to use source root entrypoints unless they have a checked exception", () => {
    const root = createTempRoot();
    writePackageCatalog(root, ["protocols-core"]);
    writePackage(root, "protocols-core", {
      name: "@croco/protocols-core",
      version: "0.0.3",
      files: ["dist"],
      type: "commonjs",
      main: "./dist/index.js",
      module: "./dist/index.mjs",
      types: "./dist/index.d.ts",
      exports: {
        ".": {
          import: "./dist/index.mjs",
          require: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
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
    expect(result.stdout).toContain("protocols-core/package.json");
    expect(result.stdout).toContain("spine root main must be ./src/index.ts");
    expect(result.stdout).toContain("spine root types must be ./src/index.ts");
    expect(result.stdout).toContain(
      "spine root module is only allowed for direct-dist entrypoint exceptions",
    );
    expect(result.stdout).toContain(
      "spine root exports is only allowed for direct-dist entrypoint exceptions",
    );
  });

  it("normalizes spine packages back to source root entrypoints in write mode", () => {
    const root = createTempRoot();
    writePackageCatalog(root, ["protocols-core"]);
    const packagePath = writePackage(root, "protocols-core", {
      name: "@croco/protocols-core",
      version: "0.0.3",
      files: ["dist"],
      type: "commonjs",
      main: "./dist/index.js",
      module: "./dist/index.mjs",
      types: "./dist/index.d.ts",
      exports: {
        ".": {
          import: "./dist/index.mjs",
          require: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
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
    expect(pkg.main).toBe("./src/index.ts");
    expect(pkg.types).toBe("./src/index.ts");
    expect(pkg.module).toBeUndefined();
    expect(pkg.exports).toBeUndefined();
    expect(pkg.publishConfig.main).toBe("./dist/index.js");
    expect(pkg.publishConfig.types).toBe("./dist/index.d.ts");
  });

  it("rejects unmapped and noncanonical spine catalog entries", () => {
    const root = createTempRoot();
    writePackage(root, "retry-core", publishablePackage("@croco/retry-core"));
    writePackageCatalog(root, ["@croco/retry-core", "missing-spine"]);

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "docs/package-catalog.json: spine.packages entry @croco/retry-core must use package directory name retry-core",
    );
    expect(result.stdout).toContain(
      "docs/package-catalog.json: spine.packages references missing package missing-spine",
    );
  });

  it("requires package catalog metadata for spine validation", () => {
    const root = createTempRoot();
    rmSync(join(root, "docs", "package-catalog.json"), { force: true });
    writePackage(root, "retry-core", publishablePackage("@croco/retry-core"));

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "docs/package-catalog.json: package catalog is required for spine entrypoint policy",
    );
  });

  it("requires direct-dist entrypoints to match the publishConfig face", () => {
    const root = createTempRoot();
    writePackage(root, "telemetry-api", {
      name: "@croco/telemetry-api",
      version: "0.0.3",
      files: ["dist"],
      type: "commonjs",
      main: "./dist/index.js",
      module: "./dist/index.mjs",
      types: "./dist/index.d.ts",
      exports: {
        ".": {
          development: "./src/index.ts",
          import: "./dist/index.mjs",
          require: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
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
    expect(result.stdout).toContain("telemetry-api/package.json");
    expect(result.stdout).toContain("exports must match publishConfig.exports");
    expect(result.stdout).toContain('exports["."].development must point at ./dist');
  });

  it("derives direct-dist root exports from publishConfig without losing CJS conditions", () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, "rpc-codegen", {
      name: "@croco/rpc-codegen",
      version: "0.0.3",
      files: ["dist"],
      type: "module",
      main: "./src/index.ts",
      types: "./src/index.ts",
      publishConfig: {
        access: "public",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: {
          ".": {
            development: "./src/index.ts",
            import: "./dist/index.js",
            require: "./dist/index.cjs",
            types: "./dist/index.d.ts",
          },
        },
      },
    });

    const result = runScript(root, "--write");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    expect(result.status).toBe(0);
    expect(pkg.main).toBe("./dist/index.js");
    expect(pkg.types).toBe("./dist/index.d.ts");
    expect(pkg.module).toBeUndefined();
    expect(pkg.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
        require: "./dist/index.cjs",
      },
    });
    expect(Object.keys(pkg.exports["."])).toEqual(["types", "import", "require"]);
    expect(pkg.publishConfig.exports).toEqual(pkg.exports);
  });

  it("preserves explicit direct-dist subpath exports", () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, "storage-core", {
      name: "@croco/storage-core",
      version: "0.0.3",
      files: ["dist"],
      type: "commonjs",
      main: "./dist/index.js",
      module: "./dist/index.mjs",
      types: "./dist/index.d.ts",
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.mjs",
          require: "./dist/index.js",
        },
        "./node": {
          types: "./dist/node.d.ts",
          import: "./dist/node.mjs",
          require: "./dist/node.js",
        },
      },
      publishConfig: {
        access: "public",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.mjs",
            require: "./dist/index.js",
          },
          "./node": {
            types: "./dist/node.d.ts",
            import: "./dist/node.mjs",
            require: "./dist/node.js",
          },
        },
      },
    });

    const result = runScript(root, "--write");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    expect(result.status).toBe(0);
    expect(pkg.exports["./node"]).toEqual({
      types: "./dist/node.d.ts",
      import: "./dist/node.mjs",
      require: "./dist/node.js",
    });
    expect(pkg.publishConfig.exports).toEqual(pkg.exports);
  });

  it("skips the private docs site and validates the importable create-croco-app package", () => {
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
    writePackage(
      root,
      "create-croco-app",
      {
        name: "create-croco-app",
        version: "0.0.3",
        bin: {
          "create-croco-app": "./dist/bin.js",
        },
        files: ["dist", "templates"],
        type: "module",
        main: "./src/index.ts",
        types: "./src/index.ts",
        publishConfig: {
          access: "public",
          main: "./dist/index.js",
          types: "./dist/index.d.ts",
          exports: {
            ".": {
              types: "./dist/index.d.ts",
              import: "./dist/index.js",
            },
            "./programmatic": {
              types: "./dist/programmatic.d.ts",
              import: "./dist/programmatic.js",
            },
            "./dist/verification.js": {
              types: "./dist/verification.d.ts",
              import: "./dist/verification.js",
            },
          },
        },
        repository: repositoryFor("create-croco-app"),
      },
      {
        sourceContent: [
          "import { defineApplicationIntent } from '@croco/framework-context';",
          "import { DEFAULT_TENANT_MODEL } from '@croco/tenant-core/tenant-model';",
          "export const value = { DEFAULT_TENANT_MODEL, defineApplicationIntent };",
          "",
        ].join("\n"),
      },
    );

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

  it("requires publishable package repository metadata for npm provenance", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "missing-repository",
      {
        name: "@croco/missing-repository",
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
      { repository: false },
    );
    writePackage(root, "declared-repository", publishablePackage("@croco/declared-repository"));

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("missing-repository/package.json");
    expect(result.stdout).toContain(
      'repository must be {"type":"git","url":"git+https://github.com/croco-dev/framework.git","directory":"packages/missing-repository"}',
    );
    expect(result.stdout).not.toContain("declared-repository/package.json");
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

  it("requires direct runtime dependencies for source value imports", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "dataloader-core",
      {
        name: "@croco/dataloader-core",
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
          "@croco/telemetry-api": "workspace:*",
        },
      },
      {
        sourceContent:
          'import { recordError } from "@croco/telemetry-api";\nimport { context } from "@opentelemetry/api";\nexport const value = { context, recordError };\n',
      },
    );
    writePackage(
      root,
      "type-only",
      {
        name: "@croco/type-only",
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
        sourceContent:
          'import type { Context } from "@opentelemetry/api";\nexport type Value = Context;\n',
      },
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("dataloader-core/package.json");
    expect(result.stdout).toContain(
      "source imports @opentelemetry/api at runtime but dependencies/peerDependencies/optionalDependencies is missing: src/index.ts",
    );
    expect(result.stdout).not.toContain("type-only/package.json");
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

  it("requires internal Croco workspace package ranges to use workspace:*", () => {
    const root = createTempRoot();
    writePackage(root, "internal-runtime", publishablePackage("@croco/internal-runtime"));
    writePackage(
      root,
      "range-drift",
      publishablePackage("@croco/range-drift", {
        dependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
        devDependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
        optionalDependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
        peerDependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
      }),
    );
    writePackage(
      root,
      "workspace-ranges",
      publishablePackage("@croco/workspace-ranges", {
        dependencies: {
          "@croco/internal-runtime": "workspace:*",
        },
        devDependencies: {
          "@croco/internal-runtime": "workspace:*",
        },
        optionalDependencies: {
          "@croco/internal-runtime": "workspace:*",
        },
        peerDependencies: {
          "@croco/internal-runtime": "workspace:*",
        },
      }),
    );
    writePackage(
      root,
      "external-croco-scope",
      publishablePackage("@croco/external-croco-scope", {
        dependencies: {
          "@croco/not-in-workspace": "^1.0.0",
        },
      }),
    );
    writePackage(
      root,
      "private-range-drift",
      {
        name: "@croco/private-range-drift",
        private: true,
        version: "0.0.3",
        dependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
      },
      {
        sourceIndex: false,
      },
    );
    writeExamplePackage(root, "range-drift-example", {
      name: "@croco-example/range-drift",
      private: true,
      version: "0.0.0",
      dependencies: {
        "@croco/internal-runtime": "^0.0.3",
      },
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("range-drift/package.json");
    expect(result.stdout).toContain(
      'dependencies.@croco/internal-runtime must use workspace:* for internal Croco workspace packages, not "^0.0.3"',
    );
    expect(result.stdout).toContain(
      'devDependencies.@croco/internal-runtime must use workspace:* for internal Croco workspace packages, not "^0.0.3"',
    );
    expect(result.stdout).toContain(
      'optionalDependencies.@croco/internal-runtime must use workspace:* for internal Croco workspace packages, not "^0.0.3"',
    );
    expect(result.stdout).toContain(
      'peerDependencies.@croco/internal-runtime must use workspace:* for internal Croco workspace packages, not "^0.0.3"',
    );
    expect(result.stdout).toContain("private-range-drift/package.json");
    expect(result.stdout).toContain("examples/range-drift-example/package.json");
    expect(result.stdout).not.toContain("workspace-ranges/package.json");
    expect(result.stdout).not.toContain("external-croco-scope/package.json");
  });

  it("rejects wildcard, latest, and upper-unbounded published runtime peers", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "unbounded-peers",
      publishablePackage("@croco/unbounded-peers", {
        peerDependencies: {
          caretWildcard: "^*",
          latestPeer: "latest",
          lowerBoundOnly: ">=1.0.0",
          malformedPeer: "1.0.0 definitely-not-semver",
          tildeWildcard: "~x",
          wildcardPeer: "*",
        },
      }),
    );
    writePackage(
      root,
      "bounded-peers",
      publishablePackage("@croco/bounded-peers", {
        peerDependencies: {
          caretPeer: "^1.0.0",
          comparatorPeer: ">=1.0.0 <2",
          exactPeer: "1.0.0",
        },
      }),
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'peerDependencies.caretWildcard must use a bounded semver range, not "^*"',
    );
    expect(result.stdout).toContain(
      'peerDependencies.latestPeer must use a bounded semver range, not "latest"',
    );
    expect(result.stdout).toContain(
      'peerDependencies.lowerBoundOnly must use a bounded semver range, not ">=1.0.0"',
    );
    expect(result.stdout).toContain(
      'peerDependencies.malformedPeer must use a bounded semver range, not "1.0.0 definitely-not-semver"',
    );
    expect(result.stdout).toContain(
      'peerDependencies.tildeWildcard must use a bounded semver range, not "~x"',
    );
    expect(result.stdout).toContain(
      'peerDependencies.wildcardPeer must use a bounded semver range, not "*"',
    );
    expect(result.stdout).not.toContain("- packages/bounded-peers/package.json:");
  });

  it("allows checked peer-only internal semver range exceptions", () => {
    const root = createTempRoot();
    writePackage(root, "internal-runtime", publishablePackage("@croco/internal-runtime"));
    writePackage(
      root,
      "peer-compat",
      publishablePackage("@croco/peer-compat", {
        peerDependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
      }),
    );
    writeInternalPeerDependencyRangeExceptions(root, [
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "^0.0.3",
        reason: "Published peers intentionally accept the current compatible alpha line.",
        owner: "release",
        compatibilityRationale:
          "The peer package consumes only stable source-level contracts covered by the compatibility train.",
      },
    ]);

    const result = runScript(root, "--check");

    expect(result.status).toBe(0);
  });

  it("rejects malformed, empty, non-peer, and unused internal range exceptions", () => {
    const root = createTempRoot();
    writePackage(root, "internal-runtime", publishablePackage("@croco/internal-runtime"));
    writePackage(
      root,
      "peer-compat",
      publishablePackage("@croco/peer-compat", {
        peerDependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
      }),
    );
    writePackage(
      root,
      "dev-range",
      publishablePackage("@croco/dev-range", {
        devDependencies: {
          "@croco/internal-runtime": "^0.0.3",
        },
      }),
    );
    writePackage(
      root,
      "invalid-peer-range",
      publishablePackage("@croco/invalid-peer-range", {
        peerDependencies: {
          "@croco/internal-runtime": "file:../internal-runtime",
        },
      }),
    );
    writeInternalPeerDependencyRangeExceptions(root, [
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "^0.0.3",
        reason: "",
        owner: "release",
        compatibilityRationale:
          "The peer package consumes only stable source-level contracts covered by the compatibility train.",
      },
      {
        package: "@croco/dev-range",
        section: "devDependencies",
        dependency: "@croco/internal-runtime",
        range: "^0.0.3",
        reason: "Dev dependency ranges are not allowed to use semver exceptions.",
        owner: "release",
        compatibilityRationale: "Dev dependency ranges are not published compatibility contracts.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: 42,
        range: "^0.0.3",
        reason: "Malformed entries must be rejected instead of ignored.",
        owner: "release",
        compatibilityRationale: "Malformed entries must not silently bypass manifest validation.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "",
        reason: "Blank ranges are not valid published compatibility ranges.",
        owner: "release",
        compatibilityRationale: "Blank ranges cannot define a consumer-installable peer contract.",
      },
      {
        package: "@croco/invalid-peer-range",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "file:../internal-runtime",
        reason: "Non-semver dependency specs are not published peer compatibility ranges.",
        owner: "release",
        compatibilityRationale:
          "File dependencies are checkout-local and cannot define npm compatibility.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "1.2.3-.",
        reason: "Malformed prerelease identifiers are not compatibility ranges.",
        owner: "release",
        compatibilityRationale: "Malformed prerelease identifiers cannot define npm compatibility.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "1.2.3+.",
        reason: "Malformed build identifiers are not compatibility ranges.",
        owner: "release",
        compatibilityRationale: "Malformed build identifiers cannot define npm compatibility.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: ">=0.0.3",
        reason: "This valid exception is intentionally unused by any manifest entry.",
        owner: "release",
        compatibilityRationale:
          "Unused exception detection must keep the checked metadata file synchronized with manifests.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "~0.0.3",
        reason: "Old-schema drift must not be accepted.",
        owner: "",
        compatibilityRationale:
          "Empty owner metadata would leave the exception without a recovery owner.",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "~0.0.4",
        reason: "Old-schema drift must not be accepted.",
        owner: "release",
        compatibilityRationale: "",
      },
      {
        package: "@croco/peer-compat",
        section: "peerDependencies",
        dependency: "@croco/internal-runtime",
        range: "~0.0.5",
        rationale: "Legacy schema must be rejected because it has no explicit owner.",
      },
    ]);

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[0].reason must be nonempty",
    );
    expect(result.stdout).toContain(
      'scripts/internal-peer-dependency-range-exceptions.json[1].section must be "peerDependencies"; internal semver exceptions are peer-only',
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[2].dependency must be a string",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[3].range must be nonempty",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[4].range must be a semver compatibility range",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[5].range must be a semver compatibility range",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[6].range must be a semver compatibility range",
    );
    expect(result.stdout).toContain(
      'scripts/internal-peer-dependency-range-exceptions.json: unused internal peer dependency range exception @croco/peer-compat peerDependencies.@croco/internal-runtime=">=0.0.3"',
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[8].owner must be nonempty",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[9].compatibilityRationale must be nonempty",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[10].reason must be a string",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[10].owner must be a string",
    );
    expect(result.stdout).toContain(
      "scripts/internal-peer-dependency-range-exceptions.json[10].compatibilityRationale must be a string",
    );
    expect(result.stdout).toContain("peer-compat/package.json");
    expect(result.stdout).toContain("dev-range/package.json");
    expect(result.stdout).toContain("invalid-peer-range/package.json");
    expect(result.stdout).toContain(
      'peerDependencies.@croco/internal-runtime must use workspace:* for internal Croco workspace packages, not "file:../internal-runtime"',
    );
  });

  it("requires production source runtime imports to be declared as published dependencies", () => {
    const root = createTempRoot();

    writePackage(
      root,
      "events-inmemory-missing-otel",
      publishablePackage("@croco/events-inmemory-missing-otel", {
        dependencies: {
          "@croco/telemetry-api": "workspace:*",
        },
      }),
      {
        sourceContent:
          'import { recordError } from "@croco/telemetry-api";\nimport { context, SpanStatusCode, trace } from "@opentelemetry/api";\nexport const value = { context, recordError, SpanStatusCode, trace };\n',
      },
    );
    writePackage(
      root,
      "runtime-declared",
      publishablePackage("@croco/runtime-declared", {
        dependencies: {
          "runtime-lib": "^1.0.0",
        },
      }),
      {
        sourceContent:
          'import { value } from "runtime-lib/subpath";\nexport const exported = value;\n',
      },
    );
    writePackage(
      root,
      "peer-declared",
      publishablePackage("@croco/peer-declared", {
        peerDependencies: {
          "peer-lib": "^1.0.0",
        },
      }),
      {
        sourceContent:
          'import { value } from "peer-lib/subpath";\nexport const exported = value;\n',
      },
    );
    writePackage(
      root,
      "optional-declared",
      publishablePackage("@croco/optional-declared", {
        optionalDependencies: {
          "optional-lib": "^1.0.0",
        },
      }),
      {
        sourceContent: 'export const loadOptional = () => import("optional-lib");\n',
      },
    );
    writePackage(
      root,
      "type-package-declared",
      publishablePackage("@croco/type-package-declared", {
        dependencies: {
          "@types/aws-lambda": "^8.10.0",
        },
      }),
      {
        sourceContent:
          'import type { Context as AwsLambdaContext } from "aws-lambda";\nexport type LambdaContext = AwsLambdaContext;\n',
      },
    );
    writePackage(
      root,
      "runtime-with-only-types",
      publishablePackage("@croco/runtime-with-only-types", {
        dependencies: {
          "@types/runtime-with-only-types": "^1.0.0",
        },
      }),
      {
        sourceContent:
          'import { value } from "runtime-with-only-types";\nexport const exported = value;\n',
      },
    );
    writePackage(root, "builtin-import", publishablePackage("@croco/builtin-import"), {
      sourceContent:
        'import { readFileSync } from "node:fs";\nimport path from "path";\nexport const value = path.basename(readFileSync.toString());\n',
    });
    writePackage(
      root,
      "dev-only-import",
      publishablePackage("@croco/dev-only-import", {
        devDependencies: {
          "dev-only-lib": "^1.0.0",
        },
      }),
      {
        sourceContent: 'import { value } from "dev-only-lib";\nexport const exported = value;\n',
      },
    );
    writePackage(root, "missing-import", publishablePackage("@croco/missing-import"), {
      sourceContent: 'export { value } from "missing-lib/subpath";\n',
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("runtime-declared/package.json");
    expect(result.stdout).not.toContain("peer-declared/package.json");
    expect(result.stdout).not.toContain("optional-declared/package.json");
    expect(result.stdout).not.toContain("type-package-declared/package.json");
    expect(result.stdout).not.toContain("builtin-import/package.json");
    expect(result.stdout).toContain("events-inmemory-missing-otel/package.json");
    expect(result.stdout).toContain(
      "source imports @opentelemetry/api at runtime but dependencies/peerDependencies/optionalDependencies is missing: src/index.ts",
    );
    expect(result.stdout).toContain("runtime-with-only-types/package.json");
    expect(result.stdout).toContain(
      "source imports runtime-with-only-types at runtime but dependencies/peerDependencies/optionalDependencies is missing",
    );
    expect(result.stdout).toContain("dev-only-import/package.json");
    expect(result.stdout).toContain(
      "source imports dev-only-lib at runtime but dependencies/peerDependencies/optionalDependencies is missing",
    );
    expect(result.stdout).toContain("missing-import/package.json");
    expect(result.stdout).toContain(
      "source imports missing-lib at runtime but dependencies/peerDependencies/optionalDependencies is missing",
    );
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
  writePackageCatalog(root, []);

  return root;
}

function writePackage(
  root: string,
  packageDirName: string,
  pkg: Record<string, unknown>,
  options: {
    readonly repository?: boolean;
    readonly sourceContent?: string;
    readonly sourceIndex?: boolean;
  } = {},
): string {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(packageDir, { recursive: true });

  if (options.sourceIndex !== false) {
    const sourcePath = join(packageDir, "src", "index.ts");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, options.sourceContent ?? "export const value = 1;\n");
  }

  const packagePath = join(packageDir, "package.json");
  const manifest =
    options.repository !== false && pkg.private !== true
      ? withRepositoryMetadata(pkg, repositoryFor(packageDirName))
      : pkg;

  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

  return packagePath;
}

function writePublishablePackage(root: string, scripts: Record<string, string>): string {
  return writePackage(root, "example", publishablePackage("@croco/example", { scripts }));
}

function writeExamplePackage(
  root: string,
  exampleDirName: string,
  pkg: Record<string, unknown>,
): string {
  const packageDir = join(root, "examples", exampleDirName);
  mkdirSync(packageDir, { recursive: true });

  const packagePath = join(packageDir, "package.json");
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  return packagePath;
}

function writeInternalPeerDependencyRangeExceptions(
  root: string,
  entries: readonly Record<string, unknown>[],
): string {
  const exceptionPath = join(root, "scripts", "internal-peer-dependency-range-exceptions.json");
  mkdirSync(dirname(exceptionPath), { recursive: true });
  writeFileSync(exceptionPath, `${JSON.stringify(entries, null, 2)}\n`);

  return exceptionPath;
}

function writePackageCatalog(root: string, spinePackages: readonly string[]): string {
  const catalogPath = join(root, "docs", "package-catalog.json");
  mkdirSync(dirname(catalogPath), { recursive: true });
  writeFileSync(
    catalogPath,
    `${JSON.stringify(
      {
        spine: {
          description: "Release-critical package set for tests.",
          label: "Croco 1.0 spine",
          packages: spinePackages,
        },
      },
      null,
      2,
    )}\n`,
  );

  return catalogPath;
}

function withRepositoryMetadata(
  pkg: Record<string, unknown>,
  repository: Record<string, string>,
): Record<string, unknown> {
  const withoutRepository = { ...pkg };
  delete withoutRepository.repository;
  const manifest: Record<string, unknown> = {};
  const insertAfterKey = Object.hasOwn(withoutRepository, "description")
    ? "description"
    : "version";
  let inserted = false;

  for (const [key, value] of Object.entries(withoutRepository)) {
    manifest[key] = value;

    if (key === insertAfterKey) {
      manifest.repository = repository;
      inserted = true;
    }
  }

  if (!inserted) {
    manifest.repository = repository;
  }

  return manifest;
}

function repositoryFor(packageDirName: string): Record<string, string> {
  return {
    type: "git",
    url: "git+https://github.com/croco-dev/framework.git",
    directory: `packages/${packageDirName}`,
  };
}

function publishablePackage(
  packageName: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: packageName,
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
    ...extra,
  };
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
