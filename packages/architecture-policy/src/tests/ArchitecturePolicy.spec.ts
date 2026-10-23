import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ProblemCategory } from "@croco/problems-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  ARCHITECTURE_POLICY_SCHEMA_VERSION,
  ArchitecturePolicyManifestJsonParseProblem,
  ArchitecturePolicyManifestSchemaVersionProblem,
  ArchitecturePolicyManifestShapeProblem,
  ArchitecturePolicyPackageJsonParseProblem,
  checkArchitecturePolicy,
  formatArchitecturePolicyDiagnostic,
  parseArchitecturePolicyManifest,
  type ArchitectureAllowedGroupImportRule,
  type ArchitectureForbiddenImportRule,
  type ArchitecturePolicyManifest,
} from "../index.js";

const tempRepos: string[] = [];

describe("architecture policy engine", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("flags a relative import that reaches into a forbidden provider package", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/billing-core", "@croco/billing-core");
    writePackage(repo, "packages/billing-polar", "@croco/billing-polar");
    writeFile(
      repo,
      "packages/billing-core/src/index.ts",
      'import { value as polar } from "../../billing-polar/src/index";\nexport const value = polar;\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["packages"],
        include: ["packages/*/src/**/*.ts"],
        packageGroups: {
          contracts: { packages: ["@croco/billing-core"] },
          plugins: { packages: ["@croco/billing-polar"] },
        },
        rules: {
          forbiddenImports: [
            {
              id: "framework-provider-package-boundary",
              from: { groups: ["contracts"] },
              to: { groups: ["plugins"] },
            },
          ],
        },
      },
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/forbidden-import",
        importSpecifier: "../../billing-polar/src/index",
        sourcePackage: "@croco/billing-core",
        targetPackage: "@croco/billing-polar",
        targetGroup: "plugins",
      }),
    ]);
  });

  it("flags a generated provider package that imports an app file through a relative path", () => {
    const repo = createTempRepo();
    writePackage(repo, "apps/api-server", "@test/api-server");
    writePackage(repo, "libs/shared/provider-database", "@test/provider-database");
    writeFile(
      repo,
      "libs/shared/provider-database/src/index.ts",
      'import { value as app } from "../../../../apps/api-server/src/index";\nexport const value = app;\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["apps", "libs"],
        include: ["apps/*/src/**/*.ts", "libs/shared/*/src/**/*.ts"],
        packageGroups: {
          application: { paths: ["apps/*"] },
          plugins: { paths: ["libs/shared/provider-*"] },
        },
        rules: {
          allowedGroupImports: [
            {
              id: "generated-provider-layer-edges",
              fromGroups: ["plugins", "contracts"],
              allowGroups: ["kernel", "contracts", "plugins", "tooling"],
              allowExternal: true,
            },
          ],
        },
      },
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/disallowed-dependency-edge",
        ruleId: "generated-provider-layer-edges",
        sourceGroup: "plugins",
        targetPackage: "@test/api-server",
        targetGroup: "application",
      }),
    ]);
  });

  it("keeps relative imports inside the same package out of cross-package rules", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/billing-core", "@croco/billing-core");
    writeFile(repo, "packages/billing-core/src/internal.ts", "export const internal = 1;\n");
    writeFile(
      repo,
      "packages/billing-core/src/index.ts",
      'import { internal } from "./internal";\nexport const value = internal;\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["packages"],
        include: ["packages/*/src/**/*.ts"],
        packageGroups: { contracts: { packages: ["@croco/billing-core"] } },
        rules: {
          allowedGroupImports: [
            { id: "contracts-edges", fromGroups: ["contracts"], allowGroups: [] },
          ],
        },
      },
    });

    expect(report.diagnostics).toEqual([]);
  });

  it("flags relative imports into private workspace entrypoints", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/tx-drizzle", "@croco/tx-drizzle");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'export { value } from "../../tx-drizzle/src/index.js";\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        ...crocoManifest(),
        rules: { publicEntrypoints: { id: "public-entrypoints", includePackages: ["@croco/*"] } },
      },
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/private-entrypoint-import",
        importSpecifier: "../../tx-drizzle/src/index.js",
        targetPackage: "@croco/tx-drizzle",
        targetGroup: "provider",
      }),
    ]);
  });

  it("keeps relative imports outside workspace packages out of package rules", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/repository-core-extra", "@croco/repository-core-extra");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      [
        'import "../../../shared/value";',
        'import "../../repository-core-extra-unowned/value";',
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        ...crocoManifest(),
        rules: {
          allowedGroupImports: [
            { id: "no-edges", fromGroups: ["framework"], allowGroups: [], allowSameGroup: false },
          ],
          publicEntrypoints: { id: "public-entrypoints", includePackages: ["@croco/*"] },
        },
      },
    });

    expect(report.diagnostics).toEqual([]);
  });

  it("flags forbidden source imports with deterministic source locations", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/tx-drizzle", "@croco/tx-drizzle");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      [
        'import { Problem } from "@croco/problems-core";',
        'import { AbstractDrizzleRepository } from "@croco/tx-drizzle";',
        "export const value = Problem ?? AbstractDrizzleRepository;",
        "",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: crocoManifest(),
    });

    expect(report.status).toBe("fail");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/forbidden-import",
        file: "packages/repository-core/src/index.ts",
        line: 2,
        column: 44,
        importSpecifier: "@croco/tx-drizzle",
        sourcePackage: "@croco/repository-core",
        sourceGroup: "framework",
        targetPackage: "@croco/tx-drizzle",
        targetGroup: "provider",
      }),
    ]);
    expect(formatArchitecturePolicyDiagnostic(report.diagnostics[0])).toContain(
      "ERROR architecture-policy/forbidden-import packages/repository-core/src/index.ts:2:44",
    );
  });

  it("flags forbidden multiline source imports", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/tx-drizzle", "@croco/tx-drizzle");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      ["import {", "  AbstractDrizzleRepository,", '} from "@croco/tx-drizzle";', ""].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: crocoManifest(),
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/forbidden-import",
        line: 3,
        column: 9,
        importSpecifier: "@croco/tx-drizzle",
      }),
    ]);
  });

  it("ignores dependency examples in strings, templates, regexes and comments", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      [
        "const tutorial = `import { x } from '@croco/tx-drizzle';`,",
        "  multiline = `",
        "export { x } from '@croco/tx-drizzle';",
        "require('@croco/tx-drizzle');",
        "`;",
        "const quoted = \"import('drizzle-orm')\";",
        "const pattern = /require('drizzle-orm')/;",
        "// import '@croco/tx-drizzle';",
        "/* export { x } from '@croco/tx-drizzle';",
        "import('drizzle-orm'); */",
        "const metadata = { from: '@croco/tx-drizzle' };",
        "loader.require('@croco/tx-drizzle');",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({ rootDir: repo, manifest: crocoManifest() });
    expect(report.status).toBe("pass");
    expect(report.importCount).toBe(0);
    expect(report.diagnostics).toEqual([]);
  });

  it("does not hide the next import after a glob string", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      "const include = 'src/*';\nimport { x } from '@croco/tx-drizzle';\n",
    );

    const report = checkArchitecturePolicy({ rootDir: repo, manifest: crocoManifest() });
    expect(report.status).toBe("fail");
    expect(report.importCount).toBe(1);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ importSpecifier: "@croco/tx-drizzle", line: 2, column: 20 }),
    ]);
  });

  it("ignores computed module specifiers while collecting nested literal imports", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      [
        "const dynamic = import(`@croco/${name}`);",
        "const required = require('@croco/' + name);",
        "const nested = import(resolve(import('@croco/tx-drizzle')));",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({ rootDir: repo, manifest: crocoManifest() });
    expect(report.importCount).toBe(1);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ importSpecifier: "@croco/tx-drizzle", line: 3, column: 39 }),
    ]);
  });

  it("detects actual dependencies after comment-like strings at original locations", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      [
        "const include = 'src/*';",
        'const url = "https://example.test";',
        "/* prefix */ import '@croco/tx-drizzle';",
        "export {",
        "  value",
        "} from '@croco/tx-drizzle';",
        "const dynamic = import(",
        "  /* specifier */ '@croco/tx-drizzle'",
        ");",
        "const required = require(",
        "  'drizzle-orm'",
        ");",
        "const template = `result: ${import('@croco/tx-drizzle')}`;",
        "const literal = require(`drizzle-orm`);",
        "import alias = require('@croco/tx-drizzle');",
        "type Row = import('drizzle-orm').Row;",
      ].join("\r\n"),
    );

    const report = checkArchitecturePolicy({ rootDir: repo, manifest: crocoManifest() });
    expect(report.status).toBe("fail");
    expect(report.importCount).toBe(8);
    expect(
      report.diagnostics.map(({ line, column, importSpecifier, excerpt }) => ({
        line,
        column,
        importSpecifier,
        excerpt,
      })),
    ).toEqual([
      {
        line: 3,
        column: 22,
        importSpecifier: "@croco/tx-drizzle",
        excerpt: "/* prefix */ import '@croco/tx-drizzle';",
      },
      {
        line: 6,
        column: 9,
        importSpecifier: "@croco/tx-drizzle",
        excerpt: "} from '@croco/tx-drizzle';",
      },
      {
        line: 8,
        column: 20,
        importSpecifier: "@croco/tx-drizzle",
        excerpt: "/* specifier */ '@croco/tx-drizzle'",
      },
      { line: 11, column: 4, importSpecifier: "drizzle-orm", excerpt: "'drizzle-orm'" },
      {
        line: 13,
        column: 37,
        importSpecifier: "@croco/tx-drizzle",
        excerpt: "const template = `result: ${import('@croco/tx-drizzle')}`;",
      },
      {
        line: 14,
        column: 26,
        importSpecifier: "drizzle-orm",
        excerpt: "const literal = require(`drizzle-orm`);",
      },
      {
        line: 15,
        column: 25,
        importSpecifier: "@croco/tx-drizzle",
        excerpt: "import alias = require('@croco/tx-drizzle');",
      },
      {
        line: 16,
        column: 20,
        importSpecifier: "drizzle-orm",
        excerpt: "type Row = import('drizzle-orm').Row;",
      },
    ]);
  });

  it.each(["\r", "\u2028", "\u2029"])(
    "preserves original excerpts after line terminator %j",
    (terminator) => {
      const repo = createTempRepo();
      writePackage(repo, "packages/repository-core", "@croco/repository-core");
      const importedLine = "import '@croco/tx-drizzle';";
      writeFile(
        repo,
        "packages/repository-core/src/index.ts",
        `const include = 'src/*';${terminator}${importedLine}`,
      );

      const report = checkArchitecturePolicy({ rootDir: repo, manifest: crocoManifest() });
      expect(report.importCount).toBe(1);
      expect(report.diagnostics).toEqual([
        expect.objectContaining({
          importSpecifier: "@croco/tx-drizzle",
          line: 2,
          column: 9,
          excerpt: importedLine,
        }),
      ]);
    },
  );

  it("flags forbidden package manifest dependencies", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core", {
      dependencies: {
        "drizzle-orm": "^0.45.2",
      },
    });

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: crocoManifest(),
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/forbidden-import",
        file: "packages/repository-core/package.json",
        importSpecifier: "drizzle-orm",
        sourceKind: "package-manifest",
      }),
    ]);
  });

  it("enforces allowed group dependency edges for generated apps", () => {
    const repo = createTempRepo();
    writePackage(repo, "apps/api-server", "@test/api-server");
    writePackage(repo, "libs/shared/provider-rpc", "@test/provider-rpc");
    writePackage(repo, "libs/shared/provider-database", "@test/provider-database");
    writeFile(
      repo,
      "apps/api-server/src/index.ts",
      [
        'import { client } from "@test/provider-rpc";',
        'import { db } from "@test/provider-database";',
        "export const app = { client, db };",
        "",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: generatedAppManifest(),
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/disallowed-dependency-edge",
        ruleId: "generated-app-layer-edges",
        importSpecifier: "@test/provider-database",
        sourceGroup: "app",
        targetGroup: "provider",
      }),
    ]);
  });

  it("passes generated app imports that stay inside the declared policy preset", () => {
    const repo = createTempRepo();
    writePackage(repo, "apps/api-server", "@test/api-server", {
      dependencies: {
        "@croco/protocols-rest": "^0.0.2",
        "@test/provider-rpc": "workspace:*",
      },
    });
    writePackage(repo, "libs/shared/provider-rpc", "@test/provider-rpc");
    writeFile(
      repo,
      "apps/api-server/src/index.ts",
      [
        'import { Controller } from "@croco/protocols-rest";',
        'import { client } from "@test/provider-rpc";',
        "export const app = { Controller, client };",
        "",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: generatedAppManifest(),
    });

    expect(report).toMatchObject({
      status: "pass",
      packageCount: 2,
    });
  });

  it("allows external imports without allowing unmapped internal packages", () => {
    const repo = createTempRepo();
    writePackage(repo, "apps/api-server", "@test/api-server");
    writePackage(repo, "libs/shared/internal-utils", "@test/internal-utils");
    writeFile(
      repo,
      "apps/api-server/src/index.ts",
      [
        'import { randomUUID } from "node:crypto";',
        'import { value } from "@test/internal-utils";',
        "export const app = { randomUUID, value };",
        "",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: generatedAppManifest(),
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/disallowed-dependency-edge",
        ruleId: "generated-app-layer-edges",
        importSpecifier: "@test/internal-utils",
        sourceGroup: "app",
        targetGroup: null,
      }),
    ]);
  });

  it("prioritizes explicit package groups over broader path groups", () => {
    const repo = createTempRepo();
    writePackage(repo, "apps/api-server", "@test/api-server");
    writePackage(repo, "libs/shared/provider-rpc", "@test/provider-rpc");
    writeFile(
      repo,
      "apps/api-server/src/index.ts",
      'import { client } from "@test/provider-rpc";\nexport const app = client;\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["apps", "libs"],
        include: ["apps/*/src/**/*.ts", "libs/shared/*/src/**/*.ts"],
        packageGroups: {
          app: {
            paths: ["apps/*"],
          },
          "provider-contract": {
            packages: ["@test/provider-rpc"],
          },
          provider: {
            paths: ["libs/shared/provider-*"],
          },
        },
        rules: {
          allowedGroupImports: [
            {
              id: "generated-app-layer-edges",
              fromGroups: ["app"],
              allowGroups: ["provider-contract"],
            },
          ],
        },
      },
    });

    expect(report.status).toBe("pass");
  });

  it("requires every target matcher field to match", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/tx-drizzle", "@croco/tx-drizzle");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'import { tx } from "@croco/tx-drizzle";\nexport const value = tx;\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["packages"],
        include: ["packages/*/src/**/*.ts"],
        packageGroups: {
          framework: {
            packages: ["@croco/repository-core"],
          },
          provider: {
            packages: ["@croco/tx-drizzle"],
          },
        },
        rules: {
          forbiddenImports: [
            {
              id: "package-and-specifier-must-both-match",
              from: {
                groups: ["framework"],
              },
              to: {
                packages: ["@croco/tx-drizzle"],
                specifiers: ["drizzle-orm"],
              },
            },
          ],
        },
      },
    });

    expect(report.status).toBe("pass");
  });

  it("matches target paths against target package directories", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/tx-drizzle", "@croco/tx-drizzle");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'import { tx } from "@croco/tx-drizzle";\nexport const value = tx;\n',
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["packages"],
        include: ["packages/*/src/**/*.ts"],
        packageGroups: {
          framework: {
            packages: ["@croco/repository-core"],
          },
          provider: {
            paths: ["packages/tx-*"],
          },
        },
        rules: {
          forbiddenImports: [
            {
              id: "target-path-boundary",
              from: {
                groups: ["framework"],
              },
              to: {
                paths: ["packages/tx-*"],
              },
            },
          ],
        },
      },
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/forbidden-import",
        ruleId: "target-path-boundary",
        targetPackage: "@croco/tx-drizzle",
      }),
    ]);
  });

  it("rejects private package entrypoint imports and accepts declared subpath exports", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/app", "@test/app");
    writePackage(repo, "packages/feature", "@test/feature", {
      publishConfig: {
        exports: {
          ".": "./dist/index.js",
          "./public": "./dist/public.js",
        },
      },
    });
    writeFile(
      repo,
      "packages/app/src/index.ts",
      [
        'import { ok } from "@test/feature/public";',
        'import { leak } from "@test/feature/src/private";',
        "export const value = { ok, leak };",
        "",
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        packageRoots: ["packages"],
        include: ["packages/*/src/**/*.ts"],
        rules: {
          publicEntrypoints: {
            id: "public-entrypoints",
            includePackages: ["@test/*"],
          },
        },
      },
    });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "architecture-policy/private-entrypoint-import",
        importSpecifier: "@test/feature/src/private",
      }),
    ]);
  });

  it.each([
    { name: "missing root", manifest: { exports: { "./ok": "./public.js" } }, allowed: false },
    { name: "null root", manifest: { exports: { ".": null } }, allowed: false },
    { name: "string root", manifest: { exports: { ".": "./public.js" } }, allowed: true },
    {
      name: "conditional root",
      manifest: { exports: { ".": { import: "./public.js" } } },
      allowed: true,
    },
    { name: "string shorthand", manifest: { exports: "./public.js" }, allowed: true },
    {
      name: "conditional shorthand",
      manifest: { exports: { import: "./public.js" } },
      allowed: true,
    },
    { name: "empty exports", manifest: { exports: {} }, allowed: false },
    { name: "legacy main", manifest: { main: "./public.js" }, allowed: true },
    {
      name: "legacy null exports",
      manifest: { exports: null, main: "./public.js" },
      allowed: true,
    },
  ])("checks source root imports against Node resolution for $name", ({ manifest, allowed }) => {
    const repo = createTempRepo();
    writePackage(repo, "packages/app", "@test/app", { dependencies: { "@test/feature": "*" } });
    writePackage(repo, "packages/feature", "@test/feature", manifest);
    writeFile(repo, "packages/app/src/index.ts", "import '@test/feature';\n");
    writeFile(
      repo,
      "node_modules/@test/feature/package.json",
      JSON.stringify({ name: "@test/feature", ...manifest }),
    );
    writeFile(repo, "node_modules/@test/feature/public.js", "export {};\n");
    writeFile(repo, "consumer.mjs", "import '@test/feature';\n");
    const node = spawnSync(process.execPath, [join(repo, "consumer.mjs")], { encoding: "utf8" });
    expect(node.error).toBeUndefined();
    expect(node.status).toBe(allowed ? 0 : 1);
    if (!allowed) expect(node.stderr).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        rules: { publicEntrypoints: { id: "public", includePackages: ["@test/*"] } },
      },
    });
    expect(report.status).toBe(allowed ? "pass" : "fail");
    expect(report.diagnostics).toEqual(
      allowed
        ? []
        : [
            expect.objectContaining({
              code: "architecture-policy/private-entrypoint-import",
              sourceKind: "source",
              importSpecifier: "@test/feature",
              message: "@test/feature is not a declared public export.",
            }),
          ],
    );
  });

  it("allows a subpath-only dependency declaration when source uses its public subpath", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/app", "@test/app", { dependencies: { "@test/feature": "*" } });
    writePackage(repo, "packages/feature", "@test/feature", {
      publishConfig: { exports: { "./ok": "./public.js" } },
    });
    writeFile(repo, "packages/app/src/index.ts", "import '@test/feature/ok';\n");
    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        rules: { publicEntrypoints: { id: "public", includePackages: ["@test/*"] } },
      },
    });
    expect(report.checkedPackageManifestCount).toBeGreaterThan(0);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it.each([
    { name: "exact null", exports: { "./private": null }, subpath: "private", allowed: false },
    {
      name: "exact exclusion",
      exports: { "./*": "./public.js", "./private": null },
      subpath: "private",
      allowed: false,
    },
    {
      name: "pattern exclusion",
      exports: { "./*": "./public.js", "./private/*": null },
      subpath: "private/deep/item",
      allowed: false,
    },
    {
      name: "longer pattern prefix",
      exports: { "./private/*": null, "./private/open/*": "./public.js" },
      subpath: "private/open/item",
      allowed: true,
    },
    {
      name: "longer pattern suffix",
      exports: { "./*": "./public.js", "./*.private": null },
      subpath: "item.private",
      allowed: false,
    },
    {
      name: "exact public override",
      exports: { "./private/*": null, "./private/open": "./public.js" },
      subpath: "private/open",
      allowed: true,
    },
    {
      name: "conditional public",
      exports: { "./public": { import: "./public.js", default: "./public.js" } },
      subpath: "public",
      allowed: true,
    },
    {
      name: "default null before public condition",
      exports: { "./private": { default: null, import: "./public.js" } },
      subpath: "private",
      allowed: false,
    },
    {
      name: "nested unmatched default condition",
      exports: { "./public": { default: { browser: null }, import: "./public.js" } },
      subpath: "public",
      allowed: true,
    },
    {
      name: "nested empty default condition",
      exports: { "./public": { default: {}, import: "./public.js" } },
      subpath: "public",
      allowed: true,
    },
    {
      name: "unmatched array default",
      exports: { "./public": { default: [{ browser: null }], import: "./public.js" } },
      subpath: "public",
      allowed: true,
    },
    {
      name: "null array default stops fallback",
      exports: { "./private": { default: [{ browser: null }, null], import: "./public.js" } },
      subpath: "private",
      allowed: false,
    },
    {
      name: "conditional null",
      exports: { "./private": { default: null } },
      subpath: "private",
      allowed: false,
    },
    {
      name: "array fallback",
      exports: { "./public": [null, "./public.js"] },
      subpath: "public",
      allowed: true,
    },
    { name: "null array", exports: { "./private": [null] }, subpath: "private", allowed: false },
    {
      name: "public wildcard",
      exports: { "./*": "./public.js" },
      subpath: "nested/public",
      allowed: true,
    },
  ])("matches Node resolution for $name", ({ exports, subpath, allowed }) => {
    const repo = createTempRepo();
    const specifier = `@test/feature/${subpath}`;
    writePackage(repo, "packages/app", "@test/app");
    writePackage(repo, "packages/feature", "@test/feature", { exports });
    writeFile(repo, "packages/app/src/index.ts", `import '${specifier}';\n`);
    writeFile(
      repo,
      "node_modules/@test/feature/package.json",
      JSON.stringify({ name: "@test/feature", exports }),
    );
    writeFile(repo, "node_modules/@test/feature/public.js", "export {};\n");
    writeFile(repo, "consumer.mjs", `import '${specifier}';\n`);
    const node = spawnSync(process.execPath, [join(repo, "consumer.mjs")], { encoding: "utf8" });
    expect(node.error).toBeUndefined();
    expect(node.status).toBe(allowed ? 0 : 1);
    if (!allowed) expect(node.stderr).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        rules: { publicEntrypoints: { id: "public", includePackages: ["@test/*"] } },
      },
    });
    expect(report.status).toBe(allowed ? "pass" : "fail");
    expect(report.diagnostics).toEqual(
      allowed
        ? []
        : [
            expect.objectContaining({
              code: "architecture-policy/private-entrypoint-import",
              importSpecifier: specifier,
            }),
          ],
    );
  });

  it.each([
    {
      name: "omitted filter",
      includePackages: undefined,
      privateImports: ["@fixture/scoped/internal", "plain-lib/internal"],
    },
    {
      name: "explicit unscoped glob",
      includePackages: ["*"],
      privateImports: ["plain-lib/internal"],
    },
    {
      name: "explicit scoped glob",
      includePackages: ["@fixture/*"],
      privateImports: ["@fixture/scoped/internal"],
    },
    { name: "explicit empty filter", includePackages: [], privateImports: [] },
  ])("checks public entrypoints with $name", ({ includePackages, privateImports }) => {
    const repo = createTempRepo();
    writePackage(repo, "packages/app", "@fixture/app");
    for (const [directory, name] of [
      ["scoped", "@fixture/scoped"],
      ["plain", "plain-lib"],
    ]) {
      writePackage(repo, `packages/${directory}`, name, {
        exports: { ".": "./dist/index.js", "./public": "./dist/public.js" },
      });
    }
    writeFile(
      repo,
      "packages/app/src/index.ts",
      [
        'import "@fixture/scoped/public";',
        'import "@fixture/scoped/internal";',
        'import "plain-lib/public";',
        'import "plain-lib/internal";',
      ].join("\n"),
    );

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: {
        schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        rules: {
          publicEntrypoints: {
            id: "public",
            ...(includePackages === undefined ? {} : { includePackages }),
          },
        },
      },
    });

    expect(report.status).toBe(privateImports.length > 0 ? "fail" : "pass");
    expect(report.diagnostics).toEqual(
      privateImports.map((importSpecifier) =>
        expect.objectContaining({
          code: "architecture-policy/private-entrypoint-import",
          ruleId: "public",
          importSpecifier,
        }),
      ),
    );
  });

  it("sorts diagnostics by file and source location", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/repository-core", "@croco/repository-core");
    writePackage(repo, "packages/tx-drizzle", "@croco/tx-drizzle");
    writeFile(repo, "packages/repository-core/src/z.ts", 'import "@croco/tx-drizzle";\n');
    writeFile(repo, "packages/repository-core/src/a.ts", 'import "drizzle-orm";\n');

    const report = checkArchitecturePolicy({
      rootDir: repo,
      manifest: crocoManifest(),
    });

    expect(report.diagnostics.map((diagnostic) => diagnostic.file)).toEqual([
      "packages/repository-core/src/a.ts",
      "packages/repository-core/src/z.ts",
    ]);
  });

  it.each([
    [
      { rules: { publicEntrypoints: { id: "public", ignoreImports: [{ paths: 123 }] } } },
      "rules.publicEntrypoints.ignoreImports[0].paths",
    ],
    [
      { rules: { publicEntrypoints: { id: "public", ignoreImports: [{}] } } },
      "rules.publicEntrypoints.ignoreImports[0]",
    ],
    [
      { rules: { publicEntrypoints: { id: "public", ignoreImports: [{ specifiers: [] }] } } },
      "rules.publicEntrypoints.ignoreImports[0]",
    ],
    [
      {
        rules: { publicEntrypoints: { id: "public", ignoreImports: [{ specifiers: ["ok", 1] }] } },
      },
      "rules.publicEntrypoints.ignoreImports[0].specifiers",
    ],
    [{ rules: { publicEntrypoints: { ignoreImports: [] } } }, "rules.publicEntrypoints.id"],
    [{ rules: { forbiddenImports: [{}] } }, "rules.forbiddenImports[0].id"],
    [{ rules: { forbiddenImports: {} } }, "rules.forbiddenImports"],
    [
      { rules: { forbiddenImports: [{ id: "edge", from: { paths: 1 }, to: {} }] } },
      "rules.forbiddenImports[0].from.paths",
    ],
    [
      { rules: { forbiddenImports: [{ id: "edge", from: {}, to: {}, appliesTo: ["typo"] }] } },
      "rules.forbiddenImports[0].appliesTo",
    ],
    [
      { rules: { allowedGroupImports: [{ id: "edge", fromGroups: ["core"] }] } },
      "rules.allowedGroupImports[0].allowGroups",
    ],
    [
      {
        rules: {
          allowedGroupImports: [
            { id: "edge", fromGroups: [], allowGroups: [], allowExternal: "yes" },
          ],
        },
      },
      "rules.allowedGroupImports[0].allowExternal",
    ],
    [{ include: ["packages/**", null] }, "include"],
    [{ packageGroups: { core: { packages: 123 } } }, "packageGroups.core.packages"],
    [{ rules: [] }, "rules"],
    [{ rules: { forbiddenImports: [{ id: "edge", to: {} }] } }, "rules.forbiddenImports[0].from"],
    [{ rules: { forbiddenImports: [false] } }, "rules.forbiddenImports[0]"],
    [
      { rules: { forbiddenImports: [{ id: "edge", from: {}, to: {}, appliesTo: [] }] } },
      "rules.forbiddenImports[0].appliesTo",
    ],
    [{ rules: { forbiddenImport: [] } }, "rules.forbiddenImport"],
    [
      {
        rules: {
          publicEntrypoints: { id: "public", ignoreImports: [{ paths: ["**"], specifiers: null }] },
        },
      },
      "rules.publicEntrypoints.ignoreImports[0].specifiers",
    ],
  ])("rejects malformed policy field %j at %s", (fields, field) => {
    const error = captureError(() =>
      parseArchitecturePolicyManifest(
        JSON.stringify({
          schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
          ...fields,
        }),
      ),
    );
    expect(error).toBeInstanceOf(ArchitecturePolicyManifestShapeProblem);
    expect(error).toMatchObject({
      code: "architecture-policy/manifest-shape",
      extensions: { field, recovery: expect.any(String) },
    });
  });

  it.each([
    [
      { forbiddenImports: [{ id: "blocked", from: {}, to: { specifiers: new Array<string>(1) } }] },
      "rules.forbiddenImports[0].to.specifiers",
    ],
    [
      { forbiddenImports: new Array<ArchitectureForbiddenImportRule>(1) },
      "rules.forbiddenImports[0]",
    ],
    [
      { allowedGroupImports: new Array<ArchitectureAllowedGroupImportRule>(1) },
      "rules.allowedGroupImports[0]",
    ],
    [
      { publicEntrypoints: { id: "public", ignoreImports: new Array<{ paths?: string[] }>(1) } },
      "rules.publicEntrypoints.ignoreImports[0]",
    ],
  ])("rejects sparse arrays passed directly to the typed checker (%j)", (rules, field) => {
    const repo = createTempRepo();
    const manifest: ArchitecturePolicyManifest = {
      schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
      rules,
    };
    expect(captureError(() => checkArchitecturePolicy({ rootDir: repo, manifest }))).toMatchObject({
      code: "architecture-policy/manifest-shape",
      extensions: { field },
    });
  });

  it("rejects an empty ignore passed directly to the typed checker", () => {
    const repo = createTempRepo();
    writePackage(repo, "packages/consumer", "@demo/consumer");
    writePackage(repo, "packages/provider", "@demo/provider", {
      exports: { ".": "./src/index.ts" },
    });
    writeFile(repo, "packages/consumer/src/index.ts", 'import "@demo/provider/private";\n');
    const manifest: ArchitecturePolicyManifest = {
      schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
      rules: { publicEntrypoints: { id: "public", ignoreImports: [{}] } },
    };
    expect(captureError(() => checkArchitecturePolicy({ rootDir: repo, manifest }))).toMatchObject({
      code: "architecture-policy/manifest-shape",
      extensions: { field: "rules.publicEntrypoints.ignoreImports[0]" },
    });
  });

  it.each([
    ["@demo/provider", "@demo/provider/private", ["blocked"]],
    ["@demo/other", "@demo/provider/private", ["allowed", "blocked"]],
    ["@demo/provider", "@demo/provider/other", ["allowed", "blocked"]],
  ])(
    "only excludes private imports matching every ignore condition (%s, %s)",
    (targetPackage, specifier, files) => {
      const repo = createTempRepo();
      writePackage(repo, "packages/consumer", "@demo/consumer");
      writePackage(repo, "packages/provider", "@demo/provider", {
        exports: { ".": "./src/index.ts" },
      });
      for (const file of ["allowed", "blocked"]) {
        writeFile(repo, `packages/consumer/src/${file}.ts`, 'import "@demo/provider/private";\n');
      }
      const manifest = parseArchitecturePolicyManifest(
        JSON.stringify({
          schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
          rules: {
            publicEntrypoints: {
              id: "public",
              ignoreImports: [
                {
                  paths: ["**/allowed.ts"],
                  packages: [targetPackage],
                  specifiers: [specifier],
                },
              ],
            },
          },
        }),
      );
      const report = checkArchitecturePolicy({ rootDir: repo, manifest });
      expect(report.status).toBe("fail");
      expect(
        report.diagnostics.map(({ file, importSpecifier }) => ({ file, importSpecifier })),
      ).toEqual(
        files.map((name) => ({
          file: `packages/consumer/src/${name}.ts`,
          importSpecifier: "@demo/provider/private",
        })),
      );
    },
  );

  it("parses the manifest schema version explicitly", () => {
    expect(
      captureError(() =>
        parseArchitecturePolicyManifest(
          JSON.stringify({
            schemaVersion: "wrong",
          }),
        ),
      ),
    ).toMatchObject({
      code: "architecture-policy/manifest-schema-version",
      category: ProblemCategory.ValidationError,
      detail: "Architecture policy manifest schemaVersion must be 'croco.architecture-policy/v1'.",
    });
    expect(
      captureError(() =>
        parseArchitecturePolicyManifest(
          JSON.stringify({
            schemaVersion: "wrong",
          }),
        ),
      ),
    ).toBeInstanceOf(ArchitecturePolicyManifestSchemaVersionProblem);
  });

  it("parses manifest object shape failures as Problems", () => {
    const error = captureError(() => parseArchitecturePolicyManifest("[]"));

    expect(error).toBeInstanceOf(ArchitecturePolicyManifestShapeProblem);
    expect(error).toMatchObject({
      code: "architecture-policy/manifest-shape",
      category: ProblemCategory.ValidationError,
      detail: "Architecture policy manifest must be a JSON object.",
    });
  });

  it("parses manifest JSON syntax failures as Problems", () => {
    const error = captureError(() => parseArchitecturePolicyManifest("{"));

    expect(error).toBeInstanceOf(ArchitecturePolicyManifestJsonParseProblem);
    expect(error).toMatchObject({
      code: "architecture-policy/manifest-json-parse",
      category: ProblemCategory.ValidationError,
      detail: "Architecture policy manifest must contain valid JSON.",
    });
  });

  it("parses package JSON syntax failures as Problems", () => {
    const repo = createTempRepo();
    writeFile(repo, "packages/repository-core/package.json", "{");

    const error = captureError(() =>
      checkArchitecturePolicy({
        rootDir: repo,
        manifest: crocoManifest(),
      }),
    );

    expect(error).toBeInstanceOf(ArchitecturePolicyPackageJsonParseProblem);
    expect(error).toMatchObject({
      code: "architecture-policy/package-json-parse",
      category: ProblemCategory.ValidationError,
      extensions: {
        packageJsonPath: join(repo, "packages/repository-core/package.json"),
      },
    });
  });
});

function crocoManifest(): ArchitecturePolicyManifest {
  return {
    schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
    packageRoots: ["packages"],
    include: ["packages/*/src/**/*.ts"],
    packageGroups: {
      framework: {
        packages: ["@croco/*-core", "@croco/framework-*", "@croco/problems-core"],
      },
      provider: {
        packages: ["@croco/*-drizzle", "@croco/tx-drizzle"],
      },
    },
    rules: {
      forbiddenImports: [
        {
          id: "core-to-provider-package",
          from: {
            groups: ["framework"],
          },
          to: {
            packages: ["@croco/*-drizzle", "@croco/tx-drizzle"],
          },
          message: "Core/framework packages cannot import provider runtime implementations.",
        },
        {
          id: "core-to-provider-sdk",
          from: {
            groups: ["framework"],
          },
          to: {
            specifiers: ["drizzle-orm", "drizzle-orm/*"],
          },
          message: "Core/framework packages cannot import provider runtime implementations.",
        },
      ],
    },
  };
}

function generatedAppManifest(): ArchitecturePolicyManifest {
  return {
    schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
    packageRoots: ["apps", "libs"],
    include: ["apps/*/src/**/*.ts", "libs/shared/*/src/**/*.ts"],
    packageGroups: {
      app: {
        paths: ["apps/*"],
      },
      provider: {
        paths: ["libs/shared/provider-*"],
      },
      protocol: {
        packages: ["@croco/protocols-*"],
      },
    },
    rules: {
      allowedGroupImports: [
        {
          id: "generated-app-layer-edges",
          fromGroups: ["app"],
          allowGroups: ["protocol"],
          allowPackages: ["@test/provider-rpc"],
          allowExternal: true,
          message: "Generated app packages may import protocols and provider-rpc only.",
        },
      ],
      publicEntrypoints: {
        id: "generated-app-public-entrypoints",
        includePackages: ["@croco/*", "@test/*"],
      },
    },
  };
}

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-architecture-policy-"));
  tempRepos.push(repo);
  return repo;
}

function writePackage(
  repo: string,
  relativeDir: string,
  packageName: string,
  extra: Record<string, unknown> = {},
): void {
  writeFile(
    repo,
    `${relativeDir}/package.json`,
    `${JSON.stringify(
      {
        name: packageName,
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
  writeFile(repo, `${relativeDir}/src/index.ts`, "export const value = 1;\n");
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function captureError(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  expect.fail("Expected function to throw.");
}
