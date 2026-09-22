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
  type ArchitecturePolicyManifest,
} from "../index.js";

const tempRepos: string[] = [];

describe("architecture policy engine", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
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
