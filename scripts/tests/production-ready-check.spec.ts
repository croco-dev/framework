import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildProductionReadyMarkdown,
  createProductionReadyReport,
  hasProductionReadyFailures,
  parseArgs,
  writeProductionReadyReport,
} from "../production-ready-check.mts";
import { inventoryDigest, readTestInventory } from "../test-inventory.mts";

const tempRepos: string[] = [];

describe("production-ready-check.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("passes for production packages with README, API docs, tests, scripts, and public API snapshot evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);
    writeTurboSummaries(repo, ["@croco/stable"]);

    const report = createReport(repo, { requireTaskSummaries: true });

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(buildProductionReadyMarkdown(report)).toContain("| `@croco/stable` | Core | pass:");
  });

  it("uses the public API snapshot only as package inventory", () => {
    const repo = createReadyRepo();
    const before = createReport(repo);
    const snapshotPath = join(repo, "public-api-surface.snapshot.json");
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8")) as {
      packages: Array<{ entrypoints: unknown[] }>;
    };
    snapshot.packages[0].entrypoints.push({
      assetKind: "json",
      exportPath: "./data.json",
      kind: "asset",
      targets: [{ conditions: [], target: "./dist/data-v2.json" }],
    });
    writeJson(snapshotPath, snapshot);

    expect(createReport(repo)).toEqual(before);
  });

  it("fails a structural-only production spine package without behavioral evidence", () => {
    const repo = createReadyRepo({ behavioralEvidencePackages: {} });

    const markdown = buildProductionReadyMarkdown(createReport(repo));

    expect(markdown).toContain("spine.behavioralEvidence.packages.stable is missing or invalid");
  });

  it("does not require behavioral evidence for a production package outside the spine", () => {
    const repo = createReadyRepo({
      behavioralEvidencePackages: {},
      spinePackages: [],
    });

    const report = createReport(repo);

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(buildProductionReadyMarkdown(report)).toContain(
      "@croco/stable is not in the Croco spine",
    );
  });

  it("rejects incomplete and non-Node behavioral evidence records", () => {
    const repo = createReadyRepo({
      behavioralEvidencePackages: {
        stable: {
          runtime: "cloudflare-workers",
          positive: {
            testFile: "src/tests/Behavior.spec.ts",
            testName: "proves public success",
          },
        },
      },
    });

    const markdown = buildProductionReadyMarkdown(createReport(repo));

    expect(markdown).toContain('.runtime must be the literal "node"');
    expect(hasProductionReadyFailures(createReport(repo))).toBe(true);
  });

  it("rejects stale evidence files and test names", () => {
    const repo = createReadyRepo({
      behavioralEvidencePackages: {
        stable: behavioralEvidence({
          negative: {
            testFile: "src/tests/Missing.spec.ts",
            testName: "renamed failure",
          },
        }),
      },
    });

    const markdown = buildProductionReadyMarkdown(createReport(repo));

    expect(markdown).toContain("negative.testFile src/tests/Missing.spec.ts does not exist");
  });

  it.each([
    ["absolute", "/tmp/Behavior.spec.ts"],
    ["traversing", "src/tests/../../../other.spec.ts"],
    ["internal traversal", "src/tests/../libs/Behavior.spec.ts"],
    ["non-test", "src/Behavior.ts"],
    ["wrong-package", "../other/src/tests/Behavior.spec.ts"],
    ["backslash", "src\\tests\\Behavior.spec.ts"],
  ])("rejects %s behavioral evidence paths", (_label, testFile) => {
    const repo = createReadyRepo({
      behavioralEvidencePackages: {
        stable: behavioralEvidence({
          positive: { testFile, testName: "proves public success" },
        }),
      },
    });

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "positive.testFile must be a package-scoped src/tests/**/*.spec.ts path",
    );
  });

  it("rejects private-only and mixed public/private package imports", () => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      'import { fixture } from "../index";\nimport { privateFixture } from "../libs/private";\nimport { expect, it } from "vitest";\nit("proves public success", () => expect(fixture).toBe(true));\nit("proves public failure", () => expect(privateFixture).toBe(false));\n',
    );

    const markdown = buildProductionReadyMarkdown(createReport(repo));

    expect(markdown).toContain("imports same-package private module ../libs/private");
  });

  it.each([
    ["comment-only", '// it("proves public success", () => {});\n'],
    ["dynamic", 'const title = "proves public success";\nit(title, () => {});\n'],
    [
      "duplicate",
      'it("proves public success", () => {});\nit("proves public success", () => {});\n',
    ],
    ["skipped", 'it.skip("proves public success", () => {});\n'],
    ["todo", 'it.todo("proves public success");\n'],
    ["missing handler", 'it("proves public success");\n'],
    ["undefined handler", 'it("proves public success", undefined);\n'],
    ["asserted undefined handler", 'it("proves public success", undefined as never);\n'],
    ["skipped options overload", 'it("proves public success", { skip: true }, () => {});\n'],
    ["unsupported modifier", 'it.custom("proves public success", () => {});\n'],
    ["focused", 'it.only("proves public success", () => {});\n'],
    [
      "inactive function",
      'function register() { it("proves public success", () => {}); }\nvoid register;\n',
    ],
    ["inactive conditional", 'if (false) { it("proves public success", () => {}); }\n'],
    [
      "skipped parent",
      'describe.skip("suite", () => { it("proves public success", () => {}); });\n',
    ],
    ["todo parent", 'describe.todo("suite", () => { it("proves public success", () => {}); });\n'],
    [
      "disabled suite parent",
      'xsuite("suite", () => { it("proves public success", () => {}); });\n',
    ],
  ])("rejects %s test identity evidence", (_label, declaration) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      `import { fixture } from "../index";\nimport { describe, expect, it } from "vitest";\nvoid fixture;\n${declaration}\nit("proves public failure", () => expect(() => { throw new Error("x"); }).toThrow());\n`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain("positive.testName");
  });

  it("rejects local test functions that are not imported from Vitest", () => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      'import { fixture } from "../index";\nfunction it(_name: string, _handler: () => void) {}\nvoid fixture;\nit("proves public success", () => {});\nit("proves public failure", () => {});\n',
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain("positive.testName");
  });

  it.each([
    [
      "test binding",
      'describe("suite", () => { const it = (_name: string, _handler: () => void) => {}; it("proves public success", () => {}); it("proves public failure", () => {}); });\nit("unrelated", () => {});\n',
    ],
    [
      "suite binding",
      'const describe = (_name: string, callback: () => void) => callback();\ndescribe("suite", () => { it("proves public success", () => {}); it("proves public failure", () => {}); });\nit("unrelated", () => {});\n',
    ],
  ])("rejects shadowed Vitest %s", (_label, declarations) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      `import { fixture } from "../index";\nimport { describe, it } from "vitest";\nvoid fixture;\n${declarations}`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "must not shadow imported Vitest bindings",
    );
  });

  it("rejects unrelated focused declarations that suppress mapped evidence", () => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      'import { fixture } from "../index";\nimport { expect, it } from "vitest";\nit.only("other", () => {});\nit("proves public success", () => expect(fixture).toBe(true));\nit("proves public failure", () => expect(fixture).toBe(false));\n',
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "must not contain focused Vitest declarations",
    );
  });

  it.each([
    ["element access focus", 'it["only"]("other", () => {});\n'],
    ["options overload focus", 'it("other", { only: true }, () => {});\n'],
  ])("rejects %s that suppresses mapped evidence", (_label, focusedDeclaration) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      `import { fixture } from "../index";\nimport { expect, it } from "vitest";\n${focusedDeclaration}it("proves public success", () => expect(fixture).toBe(true));\nit("proves public failure", () => expect(fixture).toBe(false));\n`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "must not contain focused Vitest declarations",
    );
  });

  it("rejects dynamic Vitest options that can focus unrelated tests", () => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      'import { fixture } from "../index";\nimport { expect, it } from "vitest";\nconst focus = { only: true };\nit("other", focus, () => {});\nit("proves public success", () => expect(fixture).toBe(true));\nit("proves public failure", () => expect(fixture).toBe(false));\n',
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "must not use Vitest test options overloads",
    );
  });

  it.each([
    [
      "type-only root",
      'import type { Fixture } from "../index";\nvoid (0 as unknown as Fixture);\n',
    ],
    ["side-effect root", 'import "../index";\n'],
    ["package subpath", 'import { fixture } from "@croco/stable/private";\nvoid fixture;\n'],
    [
      "dynamic private",
      'import { fixture } from "../index";\nvoid import("../libs/private");\nvoid fixture;\n',
    ],
    [
      "template dynamic private",
      'import { fixture } from "../index";\nvoid import(`../libs/private`);\nvoid fixture;\n',
    ],
  ])("rejects %s public package evidence imports", (_label, packageImport) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/src/tests/Behavior.spec.ts",
      `${packageImport}import { expect, it } from "vitest";\nit("proves public success", () => expect(true).toBe(true));\nit("proves public failure", () => expect(false).toBe(false));\n`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toMatch(
      /does not import|imports same-package private module/,
    );
  });

  it("rejects stale evidence records for non-production, non-spine, and missing packages", () => {
    const repo = createReadyRepo({
      behavioralEvidencePackages: {
        beta: behavioralEvidence(),
        missing: behavioralEvidence(),
        stable: behavioralEvidence(),
      },
      extraPackages: ["beta"],
      spinePackages: ["stable"],
    });

    const errors = createReport(repo).catalogErrors.join("\n");

    expect(errors).toContain("beta is not a spine package");
    expect(errors).toContain("missing package");
  });

  it.each(["vitest", "vitest run src/tests/Other.spec.ts", "vitest run --exclude src/tests/**"])(
    "rejects unsupported package test script %s",
    (testScript) => {
      const repo = createReadyRepo({ testScript });

      expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
        'test script must be exactly "vitest run"',
      );
    },
  );

  it("accepts a lane-aware test contract that isolates published tests from the default lane", () => {
    const repo = createReadyRepo({
      testScript: "vitest run --exclude src/tests/PublishedContract.spec.ts",
    });
    addInventoryTest(repo, "stable", "src/tests/PublishedContract.spec.ts", "published");
    updatePackageScripts(repo, "stable", {
      "test:published": "vitest run src/tests/PublishedContract.spec.ts",
    });

    expect(hasProductionReadyFailures(createReport(repo))).toBe(false);
  });

  it("rejects a default test script that leaks a special lane", () => {
    const repo = createReadyRepo();
    addInventoryTest(repo, "stable", "src/tests/PublishedContract.spec.ts", "published");
    updatePackageScripts(repo, "stable", {
      "test:published": "vitest run src/tests/PublishedContract.spec.ts",
    });

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      'test script must be exactly "vitest run --exclude src/tests/PublishedContract.spec.ts"',
    );
  });

  it("rejects production packages without deterministic fast tests", () => {
    const repo = createReadyRepo({
      testScript: "vitest run --exclude src/tests/Behavior.spec.ts",
    });
    setInventoryLane(repo, "stable", "src/tests/Behavior.spec.ts", "published");
    updatePackageScripts(repo, "stable", {
      "test:published": "vitest run src/tests/Behavior.spec.ts",
    });

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "test-inventory.json has no deterministic fast test for @croco/stable",
    );
  });

  it("rejects package-local Vitest configuration that can exclude the mapped spec", () => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/vitest.config.ts",
      'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: ["src/tests/Other.spec.ts"] } });\n',
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "does not statically include package spec tests",
    );
  });

  it.each([
    [
      "spread override",
      'const hidden = { include: ["src/tests/Other.spec.ts"] };\nexport default defineConfig({ test: { include: ["src/**/*.spec.ts"], ...hidden } });\n',
      "contains unsupported execution or selection properties",
    ],
    [
      "duplicate include",
      'export default defineConfig({ test: { include: ["src/**/*.spec.ts"], include: ["src/tests/Other.spec.ts"] } });\n',
      "has duplicate test.include properties",
    ],
    [
      "negated include",
      'export default defineConfig({ test: { environment: "node", include: ["src/**/*.spec.ts", "!src/tests/Behavior.spec.ts"] } });\n',
      "does not statically include package spec tests",
    ],
    [
      "duplicate environment",
      'export default defineConfig({ test: { environment: "node", environment: "jsdom", include: ["src/**/*.spec.ts"] } });\n',
      "has duplicate test.environment properties",
    ],
  ])("rejects package-local Vitest %s", (_label, config, expected) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/vitest.config.ts",
      `import { defineConfig } from "vitest/config";\n${config}`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(expected);
  });

  it.each([
    [
      "dead safe config",
      'defineConfig({ test: { include: ["src/**/*.spec.ts"] } });\nexport default defineConfig({ test: { include: ["src/tests/Other.spec.ts"] } });\n',
      "does not statically include package spec tests",
    ],
    [
      "root spread override",
      'const hidden = { test: { include: ["src/tests/Other.spec.ts"] } };\nexport default defineConfig({ test: { include: ["src/**/*.spec.ts"] }, ...hidden });\n',
      "root config must expose one static test property",
    ],
  ])("validates the exported Vitest config for %s", (_label, config, expected) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/vitest.config.ts",
      `import { defineConfig } from "vitest/config";\n${config}`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(expected);
  });

  it.each([
    [
      "root relocation",
      'export default defineConfig({ root: "../other", test: { environment: "node", include: ["src/**/*.spec.ts"] } });\n',
      "root config must expose one static test property",
    ],
    [
      "test directory",
      'export default defineConfig({ test: { environment: "node", dir: "src/other", include: ["src/**/*.spec.ts"] } });\n',
      "contains unsupported execution or selection properties",
    ],
    [
      "test name filter",
      'export default defineConfig({ test: { environment: "node", testNamePattern: "unrelated", include: ["src/**/*.spec.ts"] } });\n',
      "contains unsupported execution or selection properties",
    ],
    [
      "focused test allowance",
      'export default defineConfig({ test: { environment: "node", allowOnly: true, include: ["src/**/*.spec.ts"] } });\n',
      "contains unsupported execution or selection properties",
    ],
    [
      "browser mode",
      'export default defineConfig({ test: { environment: "node", browser: true, include: ["src/**/*.spec.ts"] } });\n',
      "contains unsupported execution or selection properties",
    ],
    [
      "non-Node environment",
      'export default defineConfig({ test: { environment: "jsdom", include: ["src/**/*.spec.ts"] } });\n',
      "must use the static Node test environment",
    ],
  ])("rejects Vitest %s", (_label, config, expected) => {
    const repo = createReadyRepo();
    writeFile(
      repo,
      "packages/stable/vitest.config.ts",
      `import { defineConfig } from "vitest/config";\n${config}`,
    );

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(expected);
  });

  it("rejects symlinked evidence files", () => {
    const repo = createReadyRepo();
    const evidencePath = join(repo, "packages/stable/src/tests/Behavior.spec.ts");
    writeFile(repo, "outside.spec.ts", readFileSync(evidencePath, "utf-8"));
    rmSync(evidencePath);
    symlinkSync(join(repo, "outside.spec.ts"), evidencePath);

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "must not escape the package through a symlink",
    );
  });

  it("rejects evidence paths that resolve outside src/tests", () => {
    const repo = createReadyRepo();
    const testsDir = join(repo, "packages/stable/src/tests");
    const evidence = readFileSync(join(testsDir, "Behavior.spec.ts"), "utf-8");
    writeFile(repo, "packages/stable/src/libs/Behavior.spec.ts", evidence);
    rmSync(join(testsDir, "Behavior.spec.ts"));
    symlinkSync(join(repo, "packages/stable/src/libs"), join(testsDir, "linked"));

    const catalogPath = join(repo, "docs/package-catalog.json");
    const catalog = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
      spine: {
        behavioralEvidence: {
          packages: { stable: ReturnType<typeof behavioralEvidence> };
        };
      };
    };
    catalog.spine.behavioralEvidence.packages.stable = behavioralEvidence({
      positive: {
        testFile: "src/tests/linked/Behavior.spec.ts",
        testName: "proves public success",
      },
      negative: {
        testFile: "src/tests/linked/Behavior.spec.ts",
        testName: "proves public failure",
      },
    });
    writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

    expect(buildProductionReadyMarkdown(createReport(repo))).toContain(
      "must not escape the package through a symlink",
    );
  });

  it("requires the mapped package test to pass when task summaries are required", () => {
    const repo = createReadyRepo();
    writeTurboSummaries(repo, ["@croco/stable"]);
    rmSync(join(repo, ".turbo", "runs", "test.json"));

    const markdown = buildProductionReadyMarkdown(
      createReport(repo, { requireTaskSummaries: true }),
    );

    expect(markdown).toContain("@croco/stable#test must pass in the current Turbo summary");
  });

  it("fails when a production package is missing README evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable", { readme: false });
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("packages/stable/README.md is missing");
  });

  it("fails when a production package is missing API docs without a temporary exception", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("packages/docs/src/content/docs/api/stable is missing");
  });

  it("allows a production package missing API docs only with a temporary justified exception", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo, {
      temporaryProductionApiDocExceptions: {
        stable: "TypeDoc generation is blocked by a short-lived upstream parser issue.",
      },
    });
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(markdown).toContain("temporary production API-docs exception");
  });

  it("fails when a temporary production API docs exception is stale", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo, {
      temporaryProductionApiDocExceptions: {
        stable: "TypeDoc generation is blocked by a short-lived upstream parser issue.",
      },
    });
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("temporaryProductionApiDocExceptions still contains stable");
  });

  it("fails when a production package is missing package tests", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable", { tests: false });
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("packages/stable/src/tests and src/__tests__ are missing");
  });

  it("reports non-production package gaps without failing the production-ready gate", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writePackage(repo, "beta", { readme: false, tests: false });
    writeCatalogMetadata(repo, ["stable", "beta"], {
      productionPackages: ["stable"],
    });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable", "@croco/beta"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(markdown).toContain("Non-production packages are reported for visibility");
    expect(markdown).toContain("| beta | 1 | 1 | 1 | 1 |");
  });

  it("fails CI-level task reporting when required Turbo summaries are missing", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo, { requireTaskSummaries: true });
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("build status is not-collected");
  });

  it("uses authoritative fast-lane evidence when a later narrow Turbo run shadows the full summary", () => {
    const repo = createReadyRepo();
    writeTurboSummaries(repo, ["@croco/stable"]);
    writeJson(join(repo, ".turbo", "runs", "later-narrow-test.json"), {
      execution: {
        command: "turbo run test --filter=@croco/other --summarize",
        endTime: 400,
        exitCode: 0,
      },
      tasks: [
        {
          taskId: "@croco/other#test",
          task: "test",
          package: "@croco/other",
          directory: "packages/other",
          execution: { exitCode: 0 },
          cache: { status: "MISS" },
        },
      ],
    });
    const fastTestLaneReportPath = writeFastTestLaneReport(repo, ["stable"]);

    expect(hasProductionReadyFailures(createReport(repo, { requireTaskSummaries: true }))).toBe(
      true,
    );
    expect(
      hasProductionReadyFailures(
        createReport(repo, { fastTestLaneReportPath, requireTaskSummaries: true }),
      ),
    ).toBe(false);
  });

  it("rejects fast-lane evidence whose paths do not match the current inventory plan", () => {
    const repo = createReadyRepo();
    writeTurboSummaries(repo, ["@croco/stable"]);
    const fastTestLaneReportPath = writeFastTestLaneReport(repo, ["stable"], {
      paths: ["src/tests/Other.spec.ts"],
    });

    const report = createReport(repo, { fastTestLaneReportPath, requireTaskSummaries: true });

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(buildProductionReadyMarkdown(report)).toContain("does not match the fast-lane plan");
  });

  it("accepts the pnpm CLI separator before CI-only options", () => {
    const repo = createTempRepo();

    const laneReportPath = join(repo, "fast-test-lane.json");
    const options = parseArgs([
      "--",
      "--root",
      repo,
      "--require-task-summaries",
      "--fast-test-lane-report",
      laneReportPath,
    ]);

    expect(options.rootDir).toBe(repo);
    expect(options.requireTaskSummaries).toBe(true);
    expect(options.fastTestLaneReportPath).toBe(laneReportPath);
  });

  it("requires adapter and provider maturity evidence in reference docs for production packages", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeGeneratedApiDocs(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      extensionGroups: ["Provider"],
      groupName: "Provider",
      productionPackages: ["provider"],
    });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/provider"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("missing @croco/provider reference");
  });

  it("writes the production-ready markdown report artifact", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdownPath = writeProductionReadyReport(
      report,
      join(repo, "ci-reports", "package-quality"),
    );
    const markdown = readFileSync(markdownPath, "utf-8");

    expect(markdownPath).toBe(join(repo, "ci-reports", "package-quality", "production-ready.md"));
    expect(markdown).toContain("# Production-Ready Package Gate");
  });
});

function createReport(
  repo: string,
  options: {
    readonly fastTestLaneReportPath?: string;
    readonly requireTaskSummaries?: boolean;
  } = {},
) {
  return createProductionReadyReport({
    fastTestLaneReportPath: options.fastTestLaneReportPath,
    generatedAt: "2026-01-01T00:00:00.000Z",
    requireTaskSummaries: options.requireTaskSummaries ?? false,
    rootDir: repo,
    summaryDir: join(repo, ".turbo", "runs"),
  });
}

type BehavioralFixture = {
  readonly runtime: string;
  readonly positive: { readonly testFile: string; readonly testName: string };
  readonly negative: { readonly testFile: string; readonly testName: string };
};

function behavioralEvidence(overrides: Partial<BehavioralFixture> = {}): BehavioralFixture {
  return {
    runtime: "node",
    positive: {
      testFile: "src/tests/Behavior.spec.ts",
      testName: "proves public success",
    },
    negative: {
      testFile: "src/tests/Behavior.spec.ts",
      testName: "proves public failure",
    },
    ...overrides,
  };
}

function createReadyRepo(
  options: {
    readonly behavioralEvidencePackages?: Readonly<Record<string, unknown>>;
    readonly extraPackages?: readonly string[];
    readonly spinePackages?: readonly string[];
    readonly testScript?: string;
  } = {},
): string {
  const repo = createTempRepo();
  writePackage(repo, "stable", {
    scripts: {
      build: "tsup",
      test: options.testScript ?? "vitest run",
      typecheck: "tsc --noEmit",
    },
  });
  writeGeneratedApiDocs(repo, "stable");
  for (const packageName of options.extraPackages ?? []) {
    writePackage(repo, packageName);
  }
  const packageNames = ["stable", ...(options.extraPackages ?? [])];
  writeCatalogMetadata(repo, packageNames, {
    behavioralEvidencePackages: options.behavioralEvidencePackages,
    productionPackages: ["stable"],
    spinePackages: options.spinePackages,
  });
  writeDocsBaseline(repo);
  writePublicApiSnapshot(
    repo,
    packageNames.map((packageName) => `@croco/${packageName}`),
  );
  return repo;
}

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-production-ready-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  mkdirSync(join(repo, ".turbo", "runs"), { recursive: true });
  writeReferenceDocs(repo);
  return repo;
}

function writePackage(
  repo: string,
  dirName: string,
  options: {
    readonly readme?: boolean;
    readonly scripts?: Record<string, string>;
    readonly tests?: boolean;
  } = {},
): void {
  const packageDir = join(repo, "packages", dirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFile(
    repo,
    `packages/${dirName}/src/index.ts`,
    "export const fixture = true;\nexport type Fixture = { readonly value: string };\n",
  );

  if (options.readme !== false) {
    writeFile(repo, `packages/${dirName}/README.md`, `# @croco/${dirName}\n\nFixture package.\n`);
  }

  if (options.tests !== false) {
    mkdirSync(join(packageDir, "src", "tests"), { recursive: true });
    writeFile(
      repo,
      `packages/${dirName}/src/tests/Behavior.spec.ts`,
      `import { fixture } from "../index";\nimport { describe, expect, it } from "vitest";\n\ndescribe("behavior", () => {\n  it("proves public success", () => {\n    expect(fixture).toBe(true);\n  });\n\n  it("proves public failure", () => {\n    expect(() => { throw new TypeError("failure"); }).toThrow(TypeError);\n  });\n});\n`,
    );
  }

  writeJson(join(packageDir, "package.json"), {
    name: `@croco/${dirName}`,
    scripts: options.scripts ?? {
      build: "tsup",
      test: "vitest run",
      typecheck: "tsc --noEmit",
    },
  });

  const inventoryPath = join(repo, "test-inventory.json");
  const inventory = JSON.parse(
    existsSync(inventoryPath)
      ? readFileSync(inventoryPath, "utf-8")
      : '{"version":1,"tests":[],"exceptions":[]}',
  ) as {
    version: 1;
    tests: Array<{
      path: string;
      lane: "fast";
      qualifiers: string[];
      owner: string;
    }>;
    exceptions: unknown[];
  };
  inventory.tests = inventory.tests.filter((entry) => entry.owner !== `@croco/${dirName}`);
  if (options.tests !== false) {
    inventory.tests.push({
      path: `packages/${dirName}/src/tests/Behavior.spec.ts`,
      lane: "fast",
      qualifiers: [],
      owner: `@croco/${dirName}`,
    });
  }
  writeJson(inventoryPath, inventory);
}

function writeGeneratedApiDocs(repo: string, dirName: string): void {
  mkdirSync(join(repo, "packages", "docs", "src", "content", "docs", "api", dirName), {
    recursive: true,
  });
}

function writeCatalogMetadata(
  repo: string,
  packageNames: readonly string[],
  options: {
    readonly behavioralEvidencePackages?: Readonly<Record<string, unknown>>;
    readonly extensionGroups?: readonly string[];
    readonly groupName?: string;
    readonly productionPackages?: readonly string[];
    readonly spinePackages?: readonly string[];
  } = {},
): void {
  const groupName = options.groupName ?? "Core";
  const productionPackages = options.productionPackages ?? [];
  const productionSet = new Set(productionPackages);
  const spinePackages = options.spinePackages ?? productionPackages;
  const behavioralEvidencePackages =
    options.behavioralEvidencePackages ??
    Object.fromEntries(
      spinePackages
        .filter((packageName) => productionSet.has(packageName))
        .map((packageName) => [
          packageName,
          {
            runtime: "node",
            positive: {
              testFile: "src/tests/Behavior.spec.ts",
              testName: "proves public success",
            },
            negative: {
              testFile: "src/tests/Behavior.spec.ts",
              testName: "proves public failure",
            },
          },
        ]),
    );

  writeJson(join(repo, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    groups: {
      [groupName]: {
        description: "Fixture packages",
        packages: packageNames,
      },
    },
    maturity: {
      production: {
        label: "production-ready",
        packages: productionPackages,
      },
      beta: {
        label: "beta",
        packages: packageNames.filter((packageName) => !productionSet.has(packageName)),
      },
      alpha: {
        label: "alpha",
        packages: [],
      },
      deprecated: {
        label: "deprecated",
        packages: [],
      },
    },
    extensionMatrix: {
      groups: options.extensionGroups ?? [],
      packages: {},
    },
    spine: {
      packages: spinePackages,
      behavioralEvidence: {
        packages: behavioralEvidencePackages,
      },
    },
  });
}

function writeDocsBaseline(
  repo: string,
  options: {
    readonly temporaryProductionApiDocExceptions?: Record<string, string>;
  } = {},
): void {
  writeJson(join(repo, "docs", "package-docs-baseline.json"), {
    schemaVersion: 1,
    allowedMissingReadme: [],
    allowedMissingApiDocs: [],
    allowedMissingTests: [],
    temporaryProductionApiDocExceptions: options.temporaryProductionApiDocExceptions ?? {},
  });
}

function writePublicApiSnapshot(repo: string, packageNames: readonly string[]): void {
  writeJson(join(repo, "public-api-surface.snapshot.json"), {
    schemaVersion: 2,
    packages: packageNames.map((packageName) => ({
      packageName,
      relativeDir: `packages/${packageName.replace(/^@croco\//, "")}`,
      entrypoints: [
        {
          exportPath: ".",
          kind: "code",
          targets: [{ conditions: ["import"], target: "./dist/index.js" }],
          sourceEntrypoint: `packages/${packageName.replace(/^@croco\//, "")}/src/index.ts`,
          runtimeExports: [],
          typeExports: [],
        },
      ],
    })),
  });
}

function writeTurboSummaries(repo: string, packageNames: readonly string[]): void {
  for (const taskName of ["build", "typecheck", "test"]) {
    writeJson(join(repo, ".turbo", "runs", `${taskName}.json`), {
      execution: {
        command: `turbo run ${taskName} --summarize`,
        endTime: taskName === "build" ? 100 : taskName === "typecheck" ? 200 : 300,
        exitCode: 0,
      },
      tasks: packageNames.map((packageName) => ({
        taskId: `${packageName}#${taskName}`,
        task: taskName,
        package: packageName,
        directory: `packages/${packageName.replace(/^@croco\//, "")}`,
        execution: {
          exitCode: 0,
        },
        cache: {
          status: "MISS",
        },
      })),
    });
  }
}

function writeFastTestLaneReport(
  repo: string,
  packageNames: readonly string[],
  overrides: { readonly paths?: readonly string[] } = {},
): string {
  const inventory = readTestInventory(join(repo, "test-inventory.json")).inventory;
  const commands = packageNames.map((packageName) => ({
    owner: `@croco/${packageName}`,
    cwd: `packages/${packageName}`,
    paths: overrides.paths ?? ["src/tests/Behavior.spec.ts"],
    command: ["pnpm", "run", "test"],
    durationMs: 1,
    exitCode: 0,
    status: "passed" as const,
    cacheStatus: "miss" as const,
    executedPaths: overrides.paths ?? ["src/tests/Behavior.spec.ts"],
    executionState: "executed" as const,
    cacheHash: `${packageName}-test-hash`,
  }));
  const reportPath = join(repo, "fast-test-lane.json");
  writeJson(reportPath, {
    schemaVersion: "croco.test-lane-report/v1",
    inventoryVersion: 1,
    inventoryDigest: inventoryDigest(inventory),
    lane: "fast",
    allowLive: false,
    selectedOwners: [],
    executedPaths: commands.map(({ cwd, paths }) => `${cwd}/${paths[0]}`),
    status: "passed",
    diagnostics: [],
    commands,
  });
  return reportPath;
}

function writeReferenceDocs(repo: string): void {
  const referenceRoot = join(repo, "packages", "docs", "src", "content", "docs", "en", "reference");
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/adapter-ecosystem.md",
    "# Adapter Ecosystem\n\nEvidence for other adapters.\n",
  );
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/extension-matrix.md",
    "# Extension Matrix\n\nEvidence for other adapters.\n",
  );
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/presentation-runtime-support.md",
    "# Presentation Runtime Support\n\nEvidence for other adapters.\n",
  );
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/provider-maturity.md",
    "# Provider Maturity\n\nEvidence for other adapters.\n",
  );
  mkdirSync(referenceRoot, { recursive: true });
}

type FixtureInventory = {
  version: 1;
  tests: Array<{
    path: string;
    lane: "fast" | "integration" | "published" | "live";
    qualifiers: string[];
    owner: string;
  }>;
  exceptions: unknown[];
};

function addInventoryTest(
  repo: string,
  packageName: string,
  relativeTestPath: string,
  lane: "integration" | "published" | "live",
): void {
  writeFile(
    repo,
    `packages/${packageName}/${relativeTestPath}`,
    'import { expect, it } from "vitest";\nit("runs the special contract", () => expect(true).toBe(true));\n',
  );
  const inventoryPath = join(repo, "test-inventory.json");
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf-8")) as FixtureInventory;
  inventory.tests.push({
    path: `packages/${packageName}/${relativeTestPath}`,
    lane,
    qualifiers: [],
    owner: `@croco/${packageName}`,
  });
  writeJson(inventoryPath, inventory);
}

function setInventoryLane(
  repo: string,
  packageName: string,
  relativeTestPath: string,
  lane: "published",
): void {
  const inventoryPath = join(repo, "test-inventory.json");
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf-8")) as FixtureInventory;
  const entry = inventory.tests.find(
    (candidate) => candidate.path === `packages/${packageName}/${relativeTestPath}`,
  );
  if (!entry) throw new Error(`missing fixture inventory entry: ${relativeTestPath}`);
  entry.lane = lane;
  writeJson(inventoryPath, inventory);
}

function updatePackageScripts(
  repo: string,
  packageName: string,
  scripts: Readonly<Record<string, string>>,
): void {
  const manifestPath = join(repo, "packages", packageName, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    scripts: Record<string, string>;
  };
  Object.assign(manifest.scripts, scripts);
  writeJson(manifestPath, manifest);
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
