import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildPublicApiReportMarkdown,
  createPublicApiSnapshot,
  diffPublicApiSnapshots,
  parsePublicApiSnapshot,
  type PublicApiCodeEntrypoint,
  type PublicApiCompatibilityGroup,
  type PublicApiPackage,
  type PublicApiSnapshot,
  summarizePublicApiDiff,
} from "../public-api-surface.mts";

const scriptPath = resolve(__dirname, "../public-api-surface.mts");
const tempRepos: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("public-api-surface.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("extracts runtime exports separately from type-only exports", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      [
        'export { RuntimeThing, type InlineType as RenamedInlineType } from "./runtime";',
        'export type { TypeThing } from "./types";',
        'export * from "./runtime-star";',
        'export type * from "./type-star";',
        'export * as RuntimeNamespace from "./namespace";',
        "export interface LocalType {}",
        "export const localValue = 1;",
        "export class LocalClass {}",
      ].join("\n"),
    );

    const snapshot = createPublicApiSnapshot(repo);
    const pkg = snapshot.packages[0];
    const root = getCodeEntrypoint(pkg);

    expect(pkg.packageName).toBe("@croco/alpha");
    expect(root.runtimeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exportKind: "named", name: "RuntimeThing", source: "./runtime" }),
        expect.objectContaining({ exportKind: "star", name: "*", source: "./runtime-star" }),
        expect.objectContaining({
          exportKind: "namespace",
          name: "RuntimeNamespace",
          source: "./namespace",
        }),
        expect.objectContaining({ declarationKind: "const", name: "localValue", source: null }),
        expect.objectContaining({ declarationKind: "class", name: "LocalClass", source: null }),
      ]),
    );
    expect(root.typeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exportKind: "named",
          localName: "InlineType",
          name: "RenamedInlineType",
          source: "./runtime",
        }),
        expect.objectContaining({ exportKind: "named", name: "TypeThing", source: "./types" }),
        expect.objectContaining({ exportKind: "star", name: "*", source: "./type-star" }),
        expect.objectContaining({ declarationKind: "interface", name: "LocalType", source: null }),
      ]),
    );
  });

  it("preserves a legacy root entrypoint for a published CLI without an exports map", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/package.json",
      `${JSON.stringify(
        {
          bin: { alpha: "./dist/index.js" },
          name: "@croco/alpha",
          publishConfig: { access: "public" },
          version: "0.0.0",
        },
        null,
        2,
      )}\n`,
    );
    writeFile(repo, "packages/alpha/src/index.ts", "export const cli = 1;\n");

    const snapshot = createPublicApiSnapshot(repo);
    const root = getCodeEntrypoint(snapshot.packages[0]);

    expect(root.targets).toEqual([{ conditions: [], target: "./dist/index.js" }]);
    expect(root.runtimeExports).toEqual([
      expect.objectContaining({ declarationKind: "const", name: "cli", source: null }),
    ]);
  });

  it.each([
    [".mjs", ".mts"],
    [".cjs", ".cts"],
  ])(
    "resolves NodeNext %s re-exports to %s source declarations",
    (exportExtension, sourceExtension) => {
      const repo = createTempRepo();
      writePackage(
        repo,
        "alpha",
        "@croco/alpha",
        `export { assertContract } from "./contract${exportExtension}";\n`,
      );
      writeFile(
        repo,
        `packages/alpha/src/contract${sourceExtension}`,
        "export function assertContract(): void {}\n",
      );

      expect(
        getCodeEntrypoint(createPublicApiSnapshot(repo).packages[0]).runtimeExports,
      ).toContainEqual(
        expect.objectContaining({
          declarationKind: "function",
          name: "assertContract",
          source: `./contract${exportExtension}`,
        }),
      );
    },
  );

  it("fails closed when a public package has no published root mapping", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/package.json",
      `${JSON.stringify({ name: "@croco/alpha", version: "0.0.0" }, null, 2)}\n`,
    );
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");

    expect(() => createPublicApiSnapshot(repo)).toThrow(
      /must declare publishConfig\.exports or a legacy main\/bin root target/,
    );
  });

  it("rejects an explicitly malformed exports map instead of using legacy metadata", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/package.json",
      `${JSON.stringify(
        {
          main: "./dist/index.js",
          name: "@croco/alpha",
          publishConfig: { exports: null },
          version: "0.0.0",
        },
        null,
        2,
      )}\n`,
    );
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");

    expect(() => createPublicApiSnapshot(repo)).toThrow(/publishConfig\.exports must include/);
  });

  it("expands local star re-exports into runtime and type symbols", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      'export * from "./internal";\nexport type * from "./type-only";\n',
    );
    writeFile(
      repo,
      "packages/alpha/src/internal.ts",
      "export const runtimeValue = 1;\nexport interface RuntimeFileType {}\n",
    );
    writeFile(
      repo,
      "packages/alpha/src/type-only.ts",
      "export const hiddenRuntime = 1;\nexport interface StarType {}\n",
    );

    const snapshot = createPublicApiSnapshot(repo);
    const pkg = snapshot.packages[0];
    const root = getCodeEntrypoint(pkg);

    expect(root.runtimeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          declarationKind: "const",
          name: "runtimeValue",
          source: "./internal",
        }),
      ]),
    );
    expect(root.runtimeExports).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "hiddenRuntime" })]),
    );
    expect(root.typeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          declarationKind: "interface",
          name: "RuntimeFileType",
          source: "./internal",
        }),
        expect.objectContaining({
          declarationKind: "interface",
          name: "StarType",
          source: "./type-only",
        }),
      ]),
    );
  });

  it("renders package-level public API diffs for reviewers", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      'export { OldRuntime } from "./old";\nexport type { OldType } from "./old-types";\n',
    );
    const previous = createPublicApiSnapshot(repo);
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      'export { NewRuntime } from "./new";\nexport type { NewType } from "./new-types";\n',
    );
    const current = createPublicApiSnapshot(repo);
    const diff = diffPublicApiSnapshots(previous, current);
    const summary = summarizePublicApiDiff(
      current,
      diff,
      "public-api-surface.snapshot.json",
      "ci-reports/package-quality/public-api-diff.md",
    );
    const markdown = buildPublicApiReportMarkdown(summary, diff);

    expect(summary).toEqual(
      expect.objectContaining({
        changedPackages: 1,
        runtimeAdded: 1,
        runtimeRemoved: 1,
        typeAdded: 1,
        typeRemoved: 1,
      }),
    );
    expect(markdown).toContain("### @croco/alpha");
    expect(markdown).toContain("`+ NewRuntime from ./new`");
    expect(markdown).toContain("`- OldRuntime from ./old`");
    expect(markdown).toContain("`+ NewType from ./new-types`");
    expect(markdown).toContain("`- OldType from ./old-types`");
    expect(markdown).toContain("`pnpm public-api:write`");
  });

  it("classifies framework-context exports into compatibility groups with coverage metadata", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "framework-context", "@croco/framework-context", {
      ".": "./dist/index.js",
      "./diagnostics": "./dist/diagnostics.js",
    });
    writeFile(
      repo,
      "packages/framework-context/src/index.ts",
      [
        'export { Container } from "./libs/Container";',
        'export { Context } from "./libs/Context";',
        'export { definePolicy } from "./libs/RuntimePolicy";',
        'export { createRuntimeCapabilityManifest } from "./libs/runtimeCapabilities";',
        'export { RuntimeInspector } from "./libs/RuntimeInspector";',
        'export { MiddlewareChain } from "./libs/Middleware";',
        'export { ShutdownManager } from "./libs/ShutdownManager";',
        'export type { RequestContext, RuntimeContext, RuntimeCapabilities } from "./libs/types";',
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/framework-context/src/diagnostics.ts",
      "export const inspectContext = () => undefined;\n",
    );

    const snapshot = createPublicApiSnapshot(repo);
    const pkg = snapshot.packages[0];
    const root = getCodeEntrypoint(pkg);

    expect(pkg.compatibilityGroups?.map((group) => group.id)).toEqual([
      "di",
      "context",
      "runtime-policy",
      "runtime-capability",
      "runtime-inspector",
      "middleware",
      "shutdown",
    ]);
    expect(root.runtimeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ compatibilityGroup: "di", name: "Container" }),
        expect.objectContaining({ compatibilityGroup: "context", name: "Context" }),
        expect.objectContaining({ compatibilityGroup: "runtime-policy", name: "definePolicy" }),
        expect.objectContaining({
          compatibilityGroup: "runtime-capability",
          name: "createRuntimeCapabilityManifest",
        }),
        expect.objectContaining({
          compatibilityGroup: "runtime-inspector",
          name: "RuntimeInspector",
        }),
        expect.objectContaining({ compatibilityGroup: "middleware", name: "MiddlewareChain" }),
        expect.objectContaining({ compatibilityGroup: "shutdown", name: "ShutdownManager" }),
      ]),
    );
    expect(root.typeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ compatibilityGroup: "context", name: "RequestContext" }),
        expect.objectContaining({ compatibilityGroup: "context", name: "RuntimeContext" }),
        expect.objectContaining({
          compatibilityGroup: "runtime-capability",
          name: "RuntimeCapabilities",
        }),
      ]),
    );
    expect(
      pkg.compatibilityGroups?.find((group) => group.id === "runtime-policy")?.coverage,
    ).toEqual(expect.arrayContaining(["croco runtime-policy check"]));
    expect(getCodeEntrypoint(pkg, "./diagnostics").runtimeExports).toEqual([
      expect.not.objectContaining({ compatibilityGroup: expect.any(String) }),
    ]);
  });

  it("fails configured grouped packages when a public export is unclassified", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "framework-context",
      "@croco/framework-context",
      'export { PublicButUnclassified } from "./libs/PublicButUnclassified";\n',
    );

    const result = runScript(repo, "--write");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "public API compatibility contract for @croco/framework-context does not classify PublicButUnclassified",
    );
  }, 20000);

  it("writes snapshots larger than the default subprocess buffer", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      Array.from({ length: 10_000 }, (_, index) => `export const value${index} = ${index};`).join(
        "\n",
      ),
    );

    const result = runScript(repo, "--write");
    const snapshot = readFileSync(join(repo, "public-api-surface.snapshot.json"));

    expect(result.status).toBe(0);
    expect(snapshot.byteLength).toBeGreaterThan(1024 * 1024);
  }, 30_000);

  it("fails configured grouped packages when a known source exports a new unclassified symbol", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "framework-context",
      "@croco/framework-context",
      'export { UnreviewedRuntimePolicyExport } from "./libs/RuntimePolicy";\n',
    );

    const result = runScript(repo, "--write");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "public API compatibility contract for @croco/framework-context does not classify UnreviewedRuntimePolicyExport from ./libs/RuntimePolicy",
    );
  }, 20000);

  it("reports compatibility group metadata changes as public API drift", () => {
    const previousGroupMetadata: readonly PublicApiCompatibilityGroup[] = [
      {
        id: "di",
        title: "DI and dependency graph",
        owner: "Old DI owner",
        breakingChangePolicy: "Old DI policy.",
        coverage: ["old grouped snapshot"],
      },
    ];
    const currentGroupMetadata: readonly PublicApiCompatibilityGroup[] = [
      {
        id: "di",
        title: "DI and dependency graph",
        owner: "New DI owner",
        breakingChangePolicy: "New DI policy.",
        coverage: ["new grouped snapshot"],
      },
    ];
    const packageBase = {
      packageName: "@croco/framework-context",
      relativeDir: "packages/framework-context",
      entrypoints: [
        codeEntrypoint([
          {
            compatibilityGroup: "di",
            exportKind: "named",
            name: "Container",
            source: "./libs/Container",
          },
        ]),
      ],
    } satisfies Omit<PublicApiSnapshot["packages"][number], "compatibilityGroups">;
    const previous: PublicApiSnapshot = {
      schemaVersion: 2,
      packages: [{ ...packageBase, compatibilityGroups: previousGroupMetadata }],
    };
    const current: PublicApiSnapshot = {
      schemaVersion: 2,
      packages: [{ ...packageBase, compatibilityGroups: currentGroupMetadata }],
    };

    const diff = diffPublicApiSnapshots(previous, current);
    const summary = summarizePublicApiDiff(
      current,
      diff,
      "public-api-surface.snapshot.json",
      "ci-reports/package-quality/public-api-diff.md",
    );
    const markdown = buildPublicApiReportMarkdown(summary, diff);

    expect(summary.status).toBe("fail");
    expect(summary.changedPackages).toBe(1);
    expect(diff.packages[0].compatibilityGroupMetadata.changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          current: expect.objectContaining({ owner: "New DI owner" }),
          groupId: "di",
          previous: expect.objectContaining({ owner: "Old DI owner" }),
        }),
      ]),
    );
    expect(markdown).toContain("Compatibility group metadata drift");
    expect(markdown).toContain("Old DI policy.");
    expect(markdown).toContain("new grouped snapshot");
  });

  it("reports compatibility group movements as public API drift", () => {
    const groupMetadata: readonly PublicApiCompatibilityGroup[] = [
      {
        id: "di",
        title: "DI and dependency graph",
        owner: "DI owner",
        breakingChangePolicy: "DI moves require review.",
        coverage: ["public-api:check grouped snapshot"],
      },
      {
        id: "context",
        title: "Request and runtime context",
        owner: "Context owner",
        breakingChangePolicy: "Context moves require migration notes.",
        coverage: ["generated app request context imports"],
      },
    ];
    const packageBase: PublicApiSnapshot["packages"][number] = {
      packageName: "@croco/framework-context",
      relativeDir: "packages/framework-context",
      compatibilityGroups: groupMetadata,
      entrypoints: [
        codeEntrypoint([
          {
            compatibilityGroup: "di",
            exportKind: "named",
            name: "Container",
            source: "./libs/Container",
          },
        ]),
      ],
    };
    const previous: PublicApiSnapshot = {
      schemaVersion: 2,
      packages: [packageBase],
    };
    const current: PublicApiSnapshot = {
      schemaVersion: 2,
      packages: [
        {
          ...packageBase,
          entrypoints: [
            codeEntrypoint([
              {
                compatibilityGroup: "context",
                exportKind: "named",
                name: "Container",
                source: "./libs/Container",
              },
            ]),
          ],
        },
      ],
    };

    const diff = diffPublicApiSnapshots(previous, current);
    const summary = summarizePublicApiDiff(
      current,
      diff,
      "public-api-surface.snapshot.json",
      "ci-reports/package-quality/public-api-diff.md",
    );
    const markdown = buildPublicApiReportMarkdown(summary, diff);

    expect(diff.packages[0].runtime.removed).toEqual(
      expect.arrayContaining([expect.objectContaining({ compatibilityGroup: "di" })]),
    );
    expect(diff.packages[0].runtime.added).toEqual(
      expect.arrayContaining([expect.objectContaining({ compatibilityGroup: "context" })]),
    );
    expect(markdown).toContain("Compatibility group impact");
    expect(markdown).toContain("DI and dependency graph (di)");
    expect(markdown).toContain("Request and runtime context (context)");
    expect(markdown).toContain("DI moves require review.");
    expect(markdown).toContain("generated app request context imports");
  });

  it("fails check mode on drift without updating the committed snapshot", () => {
    const repo = createTempRepo();
    writePackage(repo, "alpha", "@croco/alpha", "export const initialValue = 1;\n");

    const writeResult = runScript(repo, "--write");
    const snapshotPath = join(repo, "public-api-surface.snapshot.json");
    const committedSnapshot = readFileSync(snapshotPath, "utf-8");

    expect(committedSnapshot).toContain('"conditions": ["import"]');

    writePackage(repo, "alpha", "@croco/alpha", "export const nextValue = 2;\n");
    const checkResult = runScript(repo, "--check");
    const report = readFileSync(
      join(repo, "ci-reports", "package-quality", "public-api-diff.md"),
      "utf-8",
    );

    expect(writeResult.status).toBe(0);
    expect(checkResult.status).toBe(1);
    expect(checkResult.stdout).toContain("snapshot drift detected");
    expect(readFileSync(snapshotPath, "utf-8")).toBe(committedSnapshot);
    expect(report).toContain("`+ nextValue (const)`");
    expect(report).toContain("`- initialValue (const)`");
  }, 20000);

  it("captures sorted subpaths while preserving conditional target order", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      "./jobs": { types: "./dist/jobs.d.ts", import: "./dist/jobs.js" },
      ".": {
        import: "./dist/index.mjs",
        require: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const root = 1;\n");
    writeFile(repo, "packages/alpha/src/jobs.ts", "export const job = 1;\n");

    const pkg = createPublicApiSnapshot(repo).packages[0];

    expect(pkg.entrypoints.map((entrypoint) => entrypoint.exportPath)).toEqual([".", "./jobs"]);
    expect(pkg.entrypoints[0].targets).toEqual([
      { conditions: ["import"], target: "./dist/index.mjs" },
      { conditions: ["require"], target: "./dist/index.js" },
      { conditions: ["types"], target: "./dist/index.d.ts" },
    ]);
  });

  it("tracks a type-only subpath and focuses type-symbol drift on that subpath", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./types": { types: "./dist/types.d.ts" },
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const root = 1;\n");
    writeFile(repo, "packages/alpha/src/types.ts", "export type Before = string;\n");
    const previous = createPublicApiSnapshot(repo);
    const typesEntrypoint = getCodeEntrypoint(previous.packages[0], "./types");

    expect(typesEntrypoint.targets).toEqual([
      { conditions: ["types"], target: "./dist/types.d.ts" },
    ]);
    expect(typesEntrypoint.runtimeExports).toEqual([]);
    expect(typesEntrypoint.typeExports).toEqual([expect.objectContaining({ name: "Before" })]);

    writeFile(repo, "packages/alpha/src/types.ts", "export type After = number;\n");
    const diff = diffPublicApiSnapshots(previous, createPublicApiSnapshot(repo));

    expect(diff.packages[0].entrypoints).toEqual([
      expect.objectContaining({
        exportPath: "./types",
        runtime: { added: [], removed: [] },
        type: {
          added: [expect.objectContaining({ name: "After" })],
          removed: [expect.objectContaining({ name: "Before" })],
        },
      }),
    ]);
  });

  it("represents shared-source subpaths independently", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./alias": "./dist/index.mjs",
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");

    const entrypoints = createPublicApiSnapshot(repo).packages[0].entrypoints;

    expect(entrypoints).toHaveLength(2);
    expect(
      entrypoints.every(
        (entrypoint) =>
          entrypoint.kind === "code" &&
          entrypoint.sourceEntrypoint === "packages/alpha/src/index.ts",
      ),
    ).toBe(true);
  });

  it("tracks JSON and CSS assets without TypeScript extraction", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./data.json": "./dist/data.json",
      "./styles.css": "./dist/styles.css",
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");

    const entrypoints = createPublicApiSnapshot(repo).packages[0].entrypoints;

    expect(entrypoints[1]).toMatchObject({ assetKind: "json", kind: "asset" });
    expect(entrypoints[2]).toMatchObject({ assetKind: "css", kind: "asset" });
  });

  it("focuses asset target drift on the affected subpath", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./data.json": "./dist/data.json",
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");
    const previous = createPublicApiSnapshot(repo);
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./data.json": "./dist/data-v2.json",
    });

    const diff = diffPublicApiSnapshots(previous, createPublicApiSnapshot(repo));

    expect(diff.packages[0].entrypoints).toEqual([
      expect.objectContaining({ exportPath: "./data.json", targetsChanged: true }),
    ]);
  });

  it("fails when conditional code targets resolve to divergent sources", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": { import: "./dist/index.js", types: "./dist/types.d.ts" },
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");
    writeFile(repo, "packages/alpha/src/types.ts", "export type Value = string;\n");

    expect(() => createPublicApiSnapshot(repo)).toThrow(
      /@croco\/alpha \..*divergent sources.*import=.*index\.ts.*types=.*types\.ts/,
    );
  });

  it("fails with package, subpath, and condition evidence for a missing source", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./jobs": { import: "./dist/missing.js" },
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const value = 1;\n");

    expect(() => createPublicApiSnapshot(repo)).toThrow(
      /@croco\/alpha \.\/jobs \(import\).*found 0/,
    );
  });

  it("fails when a target maps ambiguously to a source file and directory index", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./jobs": "./dist/jobs.js",
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const root = 1;\n");
    writeFile(repo, "packages/alpha/src/jobs.ts", "export const fileJob = 1;\n");
    writeFile(repo, "packages/alpha/src/jobs/index.ts", "export const directoryJob = 1;\n");

    expect(() => createPublicApiSnapshot(repo)).toThrow(
      /@croco\/alpha \.\/jobs \(default\).*found 2.*jobs\.ts.*jobs\/index\.ts/,
    );
  });

  it("rejects traversal-like export paths and targets", () => {
    const targetRepo = createTempRepo();
    writePackageWithExports(targetRepo, "alpha", "@croco/alpha", {
      ".": "./dist/../outside.js",
    });
    writeFile(targetRepo, "packages/alpha/src/index.ts", "export const value = 1;\n");

    expect(() => createPublicApiSnapshot(targetRepo)).toThrow(/invalid export target/);

    const pathRepo = createTempRepo();
    writePackageWithExports(pathRepo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./../outside": "./dist/outside.js",
    });
    writeFile(pathRepo, "packages/alpha/src/index.ts", "export const value = 1;\n");
    writeFile(pathRepo, "packages/alpha/src/outside.ts", "export const outside = 1;\n");

    expect(() => createPublicApiSnapshot(pathRepo)).toThrow(/invalid export path/);
  });

  it("reports secondary symbol drift and entrypoint removal by exact path", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./jobs": "./dist/jobs.js",
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const root = 1;\n");
    writeFile(repo, "packages/alpha/src/jobs.ts", "export const before = 1;\n");
    const previous = createPublicApiSnapshot(repo);
    writeFile(repo, "packages/alpha/src/jobs.ts", "export const after = 1;\n");
    const symbolDiff = diffPublicApiSnapshots(previous, createPublicApiSnapshot(repo));

    expect(symbolDiff.packages[0].entrypoints[0]).toMatchObject({
      entrypointStatus: "changed",
      exportPath: "./jobs",
    });

    writePackageWithExports(repo, "alpha", "@croco/alpha", { ".": "./dist/index.js" });
    const current = createPublicApiSnapshot(repo);
    const removalDiff = diffPublicApiSnapshots(previous, current);
    const summary = summarizePublicApiDiff(current, removalDiff, "snapshot.json", "diff.md");
    const markdown = buildPublicApiReportMarkdown(summary, removalDiff);

    expect(markdown).toContain("#### ./jobs");
    expect(markdown).toContain("Entrypoint status: removed");
  });

  it("canonicalizes export-path order but treats condition order as drift", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      "./jobs": "./dist/jobs.js",
      ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const root = 1;\n");
    writeFile(repo, "packages/alpha/src/jobs.ts", "export const job = 1;\n");
    const previous = createPublicApiSnapshot(repo);
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./jobs": "./dist/jobs.js",
    });
    const current = createPublicApiSnapshot(repo);
    const diff = diffPublicApiSnapshots(previous, current);

    expect(current.packages[0].entrypoints.map((entrypoint) => entrypoint.exportPath)).toEqual([
      ".",
      "./jobs",
    ]);
    expect(diff.packages[0].entrypoints).toEqual([
      expect.objectContaining({ exportPath: ".", targetsChanged: true }),
    ]);
  });

  it("strictly rejects schema v1 and duplicate entrypoints", () => {
    expect(() => parsePublicApiSnapshot({ packages: [], schemaVersion: 1 })).toThrow(
      /schemaVersion 2/,
    );
    expect(() =>
      parsePublicApiSnapshot({
        packages: [
          {
            entrypoints: [assetEntrypoint("."), assetEntrypoint(".")],
            packageName: "@croco/alpha",
            relativeDir: "packages/alpha",
          },
        ],
        schemaVersion: 2,
      }),
    ).toThrow(/unique entrypoints/);

    const duplicatePackage = {
      entrypoints: [assetEntrypoint(".")],
      packageName: "@croco/alpha",
      relativeDir: "packages/alpha",
    };
    expect(() =>
      parsePublicApiSnapshot({
        packages: [duplicatePackage, duplicatePackage],
        schemaVersion: 2,
      }),
    ).toThrow(/duplicate package names/);

    expect(() =>
      parsePublicApiSnapshot({
        packages: [
          {
            ...duplicatePackage,
            entrypoints: [
              {
                ...assetEntrypoint("."),
                targets: [{ conditions: [], target: "./dist/../secret.json" }],
              },
            ],
          },
        ],
        schemaVersion: 2,
      }),
    ).toThrow(/invalid export target/);

    expect(() =>
      parsePublicApiSnapshot({
        packages: [
          {
            ...duplicatePackage,
            entrypoints: [assetEntrypoint("./../secret")],
          },
        ],
        schemaVersion: 2,
      }),
    ).toThrow(/invalid export path/);
  });

  it("check mode reports removed subpaths without rewriting the snapshot", () => {
    const repo = createTempRepo();
    writePackageWithExports(repo, "alpha", "@croco/alpha", {
      ".": "./dist/index.js",
      "./jobs": "./dist/jobs.js",
    });
    writeFile(repo, "packages/alpha/src/index.ts", "export const root = 1;\n");
    writeFile(repo, "packages/alpha/src/jobs.ts", "export const job = 1;\n");
    expect(runScript(repo, "--write").status).toBe(0);
    const snapshotPath = join(repo, "public-api-surface.snapshot.json");
    const before = readFileSync(snapshotPath, "utf-8");
    writePackageWithExports(repo, "alpha", "@croco/alpha", { ".": "./dist/index.js" });

    const result = runScript(repo, "--check");
    const report = readFileSync(
      join(repo, "ci-reports", "package-quality", "public-api-diff.md"),
      "utf-8",
    );

    expect(result.status).toBe(1);
    expect(readFileSync(snapshotPath, "utf-8")).toBe(before);
    expect(report).toContain("#### ./jobs");
    expect(report).toContain("Entrypoint status: removed");
  }, 20000);
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-public-api-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  return repo;
}

function writePackage(repo: string, dirName: string, packageName: string, source: string): void {
  writeFile(
    repo,
    `packages/${dirName}/package.json`,
    `${JSON.stringify(
      {
        name: packageName,
        publishConfig: {
          exports: {
            ".": {
              import: "./dist/index.js",
              types: "./dist/index.d.ts",
            },
          },
        },
        version: "0.0.0",
      },
      null,
      2,
    )}\n`,
  );
  writeFile(repo, `packages/${dirName}/src/index.ts`, source);
}

function writePackageWithExports(
  repo: string,
  dirName: string,
  packageName: string,
  exportsMap: Record<string, unknown>,
): void {
  writeFile(
    repo,
    `packages/${dirName}/package.json`,
    `${JSON.stringify(
      {
        name: packageName,
        publishConfig: { exports: exportsMap },
        version: "0.0.0",
      },
      null,
      2,
    )}\n`,
  );
}

function getCodeEntrypoint(pkg: PublicApiPackage, exportPath = "."): PublicApiCodeEntrypoint {
  const entrypoint = pkg.entrypoints.find((candidate) => candidate.exportPath === exportPath);
  if (entrypoint?.kind !== "code") {
    throw new Error(`Expected ${pkg.packageName} ${exportPath} to be a code entrypoint`);
  }
  return entrypoint;
}

function codeEntrypoint(
  runtimeExports: PublicApiCodeEntrypoint["runtimeExports"],
): PublicApiCodeEntrypoint {
  return {
    exportPath: ".",
    kind: "code",
    runtimeExports,
    sourceEntrypoint: "packages/framework-context/src/index.ts",
    targets: [{ conditions: ["import"], target: "./dist/index.js" }],
    typeExports: [],
  };
}

function assetEntrypoint(exportPath: string) {
  return {
    assetKind: "json",
    exportPath,
    kind: "asset",
    targets: [{ conditions: [], target: "./dist/data.json" }],
  };
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runScript(root: string, mode: "--check" | "--write"): ScriptResult {
  const result = spawnSync(
    process.execPath,
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
