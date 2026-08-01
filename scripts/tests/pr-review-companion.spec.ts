import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../pr-review-companion.mts");
const workflowPath = resolve(__dirname, "../../.github/workflows/pr-review-companion.yml");
const rootPackageJsonPath = resolve(__dirname, "../../package.json");
const tempRoots: string[] = [];
const frameworkRootScripts = {
  "architecture-policy:check": 'node -e "process.exit(0)"',
  "changeset-required:check": 'node -e "process.exit(0)"',
  check: 'node -e "process.exit(0)"',
  "create-croco-app:smoke": 'node -e "process.exit(0)"',
  "docs:api-triggers:check": 'node -e "process.exit(0)"',
  "package-manifests:check": 'node -e "process.exit(0)"',
  "problem-registry:check": 'node -e "process.exit(0)"',
  "public-api:check": 'node -e "process.exit(0)"',
};

type ScriptResult = {
  readonly report: CompanionReport;
  readonly status: number | null;
  readonly stdout: string;
};

type CompanionReport = {
  readonly annotations: readonly {
    readonly file: string | null;
    readonly level: string;
    readonly message: string;
    readonly title: string;
  }[];
  readonly changedFiles: readonly string[];
  readonly changedPackages: readonly {
    readonly commands: readonly { readonly command: string; readonly reason: string }[];
    readonly name: string;
  }[];
  readonly generatedArtifacts: readonly {
    readonly id: string;
    readonly missingArtifactsInPr: readonly string[];
    readonly status: string;
  }[];
  readonly requiredChecks: readonly {
    readonly command: string;
    readonly id: string;
    readonly output: string | null;
    readonly status: string;
  }[];
  readonly status: string;
  readonly suggestedCommands: readonly { readonly command: string; readonly reason: string }[];
};

describe("pr-review-companion.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("detects changed packages and suggests affected validation commands", () => {
    const root = createTempRoot();
    writeRootPackage(root);
    writePackage(root, "retry-core", "@croco/retry-core");
    writeChangedFiles(root, ["packages/retry-core/src/index.ts"]);

    const result = runScript(root, ["--github-annotations"]);

    expect(result.status).toBe(0);
    expect(result.report.status).toBe("needs-checks");
    expect(result.report.changedFiles).toEqual(["packages/retry-core/src/index.ts"]);
    expect(result.report.changedPackages).toHaveLength(1);
    expect(result.report.changedPackages[0]?.name).toBe("@croco/retry-core");
    expect(result.report.changedPackages[0]?.commands.map(({ command }) => command)).toEqual([
      "pnpm --filter @croco/retry-core test",
      "pnpm --filter @croco/retry-core typecheck",
      "pnpm --filter @croco/retry-core build",
    ]);
    expect(result.report.requiredChecks.map(({ id }) => id)).toEqual([
      "architecture-policy",
      "changeset-required",
      "public-api",
      "repository-policy",
    ]);
    expect(result.stdout).toContain(
      "::notice file=packages/retry-core/src/index.ts,title=Architecture policy violations::",
    );
  });

  it("writes stable markdown and JSON summaries for generated artifact review", () => {
    const root = createTempRoot();
    writeRootPackage(root);
    writePackage(root, "problems-core", "@croco/problems-core");
    writeFile(
      root,
      "packages/problems-core/src/WidgetProblem.ts",
      [
        "import { Problem, ProblemCategory } from '@croco/problems-core';",
        "",
        "export class WidgetProblem extends Problem {",
        "  readonly code = 'widget/problem';",
        "  readonly category = ProblemCategory.VALIDATION;",
        "}",
        "",
      ].join("\n"),
    );
    writeChangedFiles(root, ["packages/problems-core/src/WidgetProblem.ts"]);

    const result = runScript(root);
    const markdown = readFileSync(
      join(root, "ci-reports", "pr-review-companion", "report.md"),
      "utf-8",
    );

    expect(result.status).toBe(0);
    expect(
      result.report.generatedArtifacts.find(({ id }) => id === "problem-registry"),
    ).toMatchObject({
      missingArtifactsInPr: [
        "docs/problem-code-registry.json",
        "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md",
      ],
      status: "not-run",
    });
    expect(markdown).toMatchInlineSnapshot(`
      "# Croco PR Review Companion

      - Status: needs-checks
      - Compared refs: \`origin/trunk...HEAD\`
      - Changed files: 1
      - Changed packages: 1

      ## Changed Packages
      | Package | Path | Visibility | Changed files | Suggested commands |
      | --- | --- | --- | ---: | --- |
      | \`@croco/problems-core\` | \`packages/problems-core\` | public | 1 | \`pnpm --filter @croco/problems-core test\`<br>\`pnpm --filter @croco/problems-core typecheck\`<br>\`pnpm --filter @croco/problems-core build\` |

      ## Required Checks
      | Check | Status | Command | Evidence |
      | --- | --- | --- | --- |
      | Architecture policy violations | not-run | \`pnpm architecture-policy:check\` | architecture manifest, package manifest, or package source changes can violate layer boundaries |
      | Changeset requirement | not-run | \`pnpm changeset-required:check -- --base origin/trunk --head HEAD\` | publishable package behavior files changed without a visible non-README changeset in the PR file set |
      | Problem Registry drift | not-run | \`pnpm problem-registry:check\` | Problem source or generated registry artifacts changed |
      | Public API snapshot drift | not-run | \`pnpm public-api:check\` | public package source or manifest changes can drift the public API snapshot |
      | Repository policy gate | not-run | \`pnpm check\` | changed packages or root quality surfaces need the repository policy gate |

      ## Generated Artifact Drift
      | Artifact surface | Status | Command | Missing artifact paths in PR |
      | --- | --- | --- | --- |
      | Problem Registry | not-run | \`pnpm problem-registry:check\` | \`docs/problem-code-registry.json\`, \`packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md\` |
      | Public API snapshot | not-run | \`pnpm public-api:check\` | \`public-api-surface.snapshot.json\` |
      | Contract Graph, OpenAPI/RPC, and Project Map | not-applicable | \`pnpm create-croco-app:smoke\` | none |
      | Generated API docs triggers | not-applicable | \`pnpm docs:api-triggers:check\` | none |

      ## Suggested Commands
      - \`pnpm --filter @croco/problems-core build\` - @croco/problems-core changed and defines a build script
      - \`pnpm --filter @croco/problems-core test\` - @croco/problems-core changed and defines a test script
      - \`pnpm --filter @croco/problems-core typecheck\` - @croco/problems-core changed and defines a typecheck script
      - \`pnpm architecture-policy:check\` - Architecture policy violations
      - \`pnpm changeset-required:check -- --base origin/trunk --head HEAD\` - Changeset requirement
      - \`pnpm check\` - Repository policy gate
      - \`pnpm problem-registry:check\` - Problem Registry drift
      - \`pnpm public-api:check\` - Public API snapshot drift
      "
    `);
  });

  it("exits non-zero and records output when a required check fails", () => {
    const root = createTempRoot();
    writeRootPackage(root, {
      "architecture-policy:check": 'node -e "process.exit(0)"',
      check: 'node -e "process.exit(0)"',
      "problem-registry:check": "node -e \"console.log('registry drift'); process.exit(1)\"",
    });
    writePackage(root, "internal-problems", "@croco/internal-problems", true);
    writeFile(
      root,
      "packages/internal-problems/src/InternalProblem.ts",
      "export class InternalProblem extends Problem { readonly code = 'internal/problem'; }\n",
    );
    writeChangedFiles(root, ["packages/internal-problems/src/InternalProblem.ts"]);

    const result = runScript(root, ["--run-required-checks"]);

    expect(result.status).toBe(1);
    expect(result.report.status).toBe("fail");
    const problemRegistryCheck = result.report.requiredChecks.find(
      ({ id }) => id === "problem-registry",
    );
    expect(problemRegistryCheck).toMatchObject({ status: "fail" });
    expect(problemRegistryCheck?.output).toContain("registry drift");
    expect(result.stdout).toContain("pr-review-companion: fail");
  });

  it("uses generated-app workspace patterns and local contract checks", () => {
    const root = createTempRoot();
    writeRootPackage(root, {
      "ci:contracts": "node -e \"console.log('contract ok')\"",
      test: 'node -e "process.exit(0)"',
      typecheck: 'node -e "process.exit(0)"',
    });
    writeWorkspaceFile(root, ["apps/*", "libs/*", "api-worker", "ssr-worker"]);
    writeWorkspacePackage(root, "apps/api-server", "@fixture/api-server");
    writeWorkspacePackage(root, "libs/provider-rpc", "@fixture/provider-rpc");
    writeWorkspacePackage(root, "api-worker", "@fixture/api-worker");
    writeWorkspacePackage(root, "ssr-worker", "@fixture/ssr-worker");
    writeChangedFiles(root, [
      "apps/api-server/src/controllers/UserController.ts",
      "api-worker/src/index.ts",
    ]);

    const result = runScript(root, ["--run-required-checks"]);

    expect(result.status).toBe(0);
    expect(result.report.status).toBe("pass");
    expect(result.report.changedPackages.map(({ name }) => name)).toEqual([
      "@fixture/api-server",
      "@fixture/api-worker",
    ]);
    expect(result.report.requiredChecks).toEqual([
      expect.objectContaining({
        command: "pnpm ci:contracts",
        id: "contract-project-map-generated-app",
        status: "pass",
      }),
    ]);
    expect(
      result.report.generatedArtifacts.find(
        ({ id }) => id === "contract-project-map-generated-app",
      ),
    ).toMatchObject({
      missingArtifactsInPr: [
        "contract-graph.snapshot.json",
        "contract-graph.coverage.json",
        "openapi.json",
        "croco.project-map.json",
        "libs/shared/provider-rpc/src",
      ],
      status: "pass",
    });
    expect(result.report.suggestedCommands.map(({ command }) => command)).toContain(
      "pnpm ci:contracts",
    );
  });

  it("projects a non-breaking ContractGraph diff into Markdown and a separate artifact", () => {
    const root = createContractDiffFixture({
      baselineRouteCount: 1,
      currentRouteCount: 3,
      changes: [
        {
          code: "contract-route-added",
          message: "Route 'UsersController.createUser' was added to the contract graph.",
          routeId: "UsersController.createUser",
          severity: "non-breaking",
        },
        {
          code: "contract-controller-added",
          message: "Controller 'AdminController' was added to the contract graph.",
          routeId: "AdminController",
          severity: "non-breaking",
        },
      ],
    });

    const before = git(root, ["diff", "--no-ext-diff", "HEAD"]);
    const result = runScript(root, ["--base", "HEAD^", "--head", "HEAD"]);
    const markdown = readFileSync(
      join(root, "ci-reports", "pr-review-companion", "report.md"),
      "utf-8",
    );
    const diff = JSON.parse(
      readFileSync(join(root, "ci-reports", "pr-review-companion", "contract-diff.json"), "utf-8"),
    ) as Record<string, unknown>;

    expect(result.status).toBe(0);
    expect(result.report.status).toBe("pass");
    expect(result.report).not.toHaveProperty("contractDiff");
    expect(diff).toMatchObject({
      baselineRouteCount: 1,
      breakingChangeCount: 0,
      currentRouteCount: 3,
      nonBreakingChangeCount: 2,
    });
    expect(markdown).toContain("## Contract Changes");
    expect(markdown).toContain("- Routes: 1 → 3");
    expect(markdown).toContain(
      "| non-breaking | contract-route-added | UsersController.createUser | Route 'UsersController.createUser' was added to the contract graph. |",
    );
    expect(markdown.indexOf("contract-controller-added")).toBeLessThan(
      markdown.indexOf("contract-route-added"),
    );
    runScript(root, ["--base", "HEAD^", "--head", "HEAD"]);
    expect(
      readFileSync(join(root, "ci-reports", "pr-review-companion", "report.md"), "utf-8"),
    ).toBe(markdown);
    expect(git(root, ["diff", "--no-ext-diff", "HEAD"])).toBe(before);
  });

  it("warns about breaking ContractGraph changes without changing the report status", () => {
    const root = createContractDiffFixture({
      baselineRouteCount: 1,
      currentRouteCount: 0,
      changes: [
        {
          code: "contract-route-removed",
          message: "Route 'UsersController.listUsers' was removed from the contract graph.",
          routeId: "UsersController.listUsers",
          severity: "breaking",
        },
      ],
    });

    const result = runScript(root, ["--base", "HEAD^", "--head", "HEAD", "--github-annotations"]);

    expect(result.status).toBe(0);
    expect(result.report.status).toBe("pass");
    expect(result.report.annotations).toContainEqual(
      expect.objectContaining({
        file: "contract-graph.snapshot.json",
        level: "warning",
        title: "Breaking ContractGraph changes",
      }),
    );
    expect(result.stdout).toContain(
      "::warning file=contract-graph.snapshot.json,title=Breaking ContractGraph changes::",
    );
  });

  it("reports missing baseline snapshots as unavailable", () => {
    const root = createTempRoot();
    writeRootPackage(root, {});
    writeFakeContractDiffCli(root);
    initializeGit(root);
    commitAll(root, "base");
    writeContractSnapshot(root, 1, []);
    commitAll(root, "add snapshot");
    writeChangedFiles(root, ["contract-graph.snapshot.json"]);

    const result = runScript(root, ["--base", "HEAD^", "--head", "HEAD"]);
    const markdown = readFileSync(
      join(root, "ci-reports", "pr-review-companion", "report.md"),
      "utf-8",
    );

    expect(result.status).toBe(0);
    expect(result.report.status).toBe("pass");
    expect(markdown).toContain("- Status: unavailable: baseline snapshot missing");
    expect(result.report.annotations).toContainEqual(
      expect.objectContaining({ title: "ContractGraph semantic diff unavailable" }),
    );
  });

  it("reports invalid current snapshots without an uncaught exception", () => {
    const root = createTempRoot();
    writeRootPackage(root, {});
    writeFakeContractDiffCli(root);
    initializeGit(root);
    writeContractSnapshot(root, 1, []);
    commitAll(root, "base snapshot");
    writeFile(root, "contract-graph.snapshot.json", "{ invalid json\n");
    commitAll(root, "invalid snapshot");
    writeChangedFiles(root, ["contract-graph.snapshot.json"]);

    const result = runScript(root, ["--base", "HEAD^", "--head", "HEAD"]);
    const markdown = readFileSync(
      join(root, "ci-reports", "pr-review-companion", "report.md"),
      "utf-8",
    );

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("pr-review-companion: failed:");
    expect(markdown).toContain("- Status: unavailable: contract diff command failed:");
  });

  it("treats an exit code that contradicts the diff as unavailable", () => {
    const root = createContractDiffFixture({
      baselineRouteCount: 1,
      currentRouteCount: 2,
      exitCode: 1,
      changes: [
        {
          code: "contract-route-added",
          message: "Route 'UsersController.createUser' was added to the contract graph.",
          routeId: "UsersController.createUser",
          severity: "non-breaking",
        },
      ],
    });

    const result = runScript(root, ["--base", "HEAD^", "--head", "HEAD"]);
    const markdown = readFileSync(
      join(root, "ci-reports", "pr-review-companion", "report.md"),
      "utf-8",
    );

    expect(result.status).toBe(0);
    expect(result.report.status).toBe("pass");
    expect(markdown).toContain("returned status 1, expected status 0 for a non-breaking result");
    expect(result.report.annotations).toContainEqual(
      expect.objectContaining({ title: "ContractGraph semantic diff unavailable" }),
    );
  });

  it("is wired into a GitHub Actions smoke workflow with report artifacts", () => {
    const workflow = readFileSync(workflowPath, "utf-8");
    const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8")) as {
      readonly scripts?: Record<string, string>;
    };
    const companionJob = workflow.match(/^ {2}companion:\n(?:^(?: {4,}.*)?$\n?)*/m)?.[0];

    expect(rootPackageJson.scripts?.["pr-review-companion"]).toBe(
      "node --experimental-strip-types scripts/pr-review-companion.mts",
    );
    expect(companionJob).toContain("timeout-minutes: 30");
    expect(workflow).toContain("pnpm pr-review-companion --");
    expect(workflow).toContain("pnpm --filter @croco/cli... build");
    expect(workflow).toContain("--run-required-checks --github-annotations");
    expect(workflow).toContain(
      'cat ci-reports/pr-review-companion/report.md >> "$GITHUB_STEP_SUMMARY"',
    );
    expect(workflow).toContain("name: pr-review-companion-report");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-pr-review-companion-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"), { recursive: true });
  return root;
}

type FixtureContractChange = {
  readonly code: string;
  readonly message: string;
  readonly routeId: string;
  readonly severity: "breaking" | "non-breaking";
};

function createContractDiffFixture(input: {
  readonly baselineRouteCount: number;
  readonly changes: readonly FixtureContractChange[];
  readonly currentRouteCount: number;
  readonly exitCode?: number;
}): string {
  const root = createTempRoot();
  writeRootPackage(root, {});
  writeFakeContractDiffCli(root);
  initializeGit(root);
  writeContractSnapshot(root, input.baselineRouteCount, []);
  commitAll(root, "base snapshot");
  writeContractSnapshot(root, input.currentRouteCount, input.changes, input.exitCode);
  commitAll(root, "current snapshot");
  writeChangedFiles(root, ["contract-graph.snapshot.json"]);
  return root;
}

function initializeGit(root: string): void {
  git(root, ["init", "--initial-branch=trunk"]);
  git(root, ["config", "user.name", "Croco Test"]);
  git(root, ["config", "user.email", "croco-test@example.com"]);
}

function commitAll(root: string, message: string): void {
  git(root, ["add", "."]);
  git(root, ["commit", "--message", message]);
}

function git(root: string, args: readonly string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function writeContractSnapshot(
  root: string,
  routeCount: number,
  changes: readonly FixtureContractChange[],
  exitCode?: number,
): void {
  writeJson(join(root, "contract-graph.snapshot.json"), {
    ...(exitCode === undefined ? {} : { fixtureExitCode: exitCode }),
    fixtureChanges: changes,
    routeCount,
    snapshotVersion: "croco.contract-graph.snapshot.v1",
  });
}

function writeFakeContractDiffCli(root: string): void {
  writeFile(
    root,
    "packages/cli/dist/bin/croco.js",
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const args = process.argv.slice(2);",
      "const value = (flag) => args[args.indexOf(flag) + 1];",
      "try {",
      "  const baseline = JSON.parse(fs.readFileSync(value('--baseline'), 'utf8'));",
      "  const current = JSON.parse(fs.readFileSync(value('--current-snapshot'), 'utf8'));",
      "  if (baseline.snapshotVersion !== 'croco.contract-graph.snapshot.v1' || current.snapshotVersion !== 'croco.contract-graph.snapshot.v1') throw new Error('invalid snapshot version');",
      "  const changes = current.fixtureChanges || [];",
      "  const breakingChanges = changes.filter((change) => change.severity === 'breaking');",
      "  const nonBreakingChanges = changes.filter((change) => change.severity === 'non-breaking');",
      "  const diff = { baselineRouteCount: baseline.routeCount, currentRouteCount: current.routeCount, breakingChangeCount: breakingChanges.length, nonBreakingChangeCount: nonBreakingChanges.length, hasBreakingChanges: breakingChanges.length > 0, changes, breakingChanges, nonBreakingChanges };",
      "  const output = value('--out');",
      "  fs.mkdirSync(path.dirname(output), { recursive: true });",
      "  fs.writeFileSync(output, JSON.stringify(diff, null, 2) + '\\n');",
      "  process.exitCode = current.fixtureExitCode ?? (diff.hasBreakingChanges ? 1 : 0);",
      "} catch (error) {",
      "  console.error(error instanceof Error ? error.message : String(error));",
      "  process.exitCode = 1;",
      "}",
      "",
    ].join("\n"),
  );
}

function writeRootPackage(
  root: string,
  scripts: Record<string, string> = frameworkRootScripts,
): void {
  writeJson(join(root, "package.json"), {
    name: "croco-fixture",
    private: true,
    scripts,
  });
}

function writeWorkspaceFile(root: string, patterns: readonly string[]): void {
  writeFile(
    root,
    "pnpm-workspace.yaml",
    ["packages:", ...patterns.map((pattern) => `  - ${pattern}`), ""].join("\n"),
  );
}

function writePackage(root: string, directory: string, name: string, privatePackage = false): void {
  writeWorkspacePackage(root, `packages/${directory}`, name, privatePackage);
}

function writeWorkspacePackage(
  root: string,
  directory: string,
  name: string,
  privatePackage = false,
): void {
  writeJson(join(root, directory, "package.json"), {
    name,
    private: privatePackage,
    scripts: {
      build: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      typecheck: 'node -e "process.exit(0)"',
    },
  });
  writeFile(root, `${directory}/src/index.ts`, "export const value = 1;\n");
}

function writeChangedFiles(root: string, files: readonly string[]): void {
  writeFile(root, "changed-files.txt", `${files.join("\n")}\n`);
}

function writeFile(root: string, relativePath: string, content: string): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(path: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runScript(root: string, extraArgs: readonly string[] = []): ScriptResult {
  const result = spawnSync(
    "node",
    [
      "--experimental-strip-types",
      scriptPath,
      "--root",
      root,
      "--changed-files-file",
      join(root, "changed-files.txt"),
      "--output-dir",
      "ci-reports/pr-review-companion",
      "--no-github-annotations",
      ...extraArgs,
    ],
    {
      encoding: "utf-8",
    },
  );
  const report = JSON.parse(
    readFileSync(join(root, "ci-reports", "pr-review-companion", "report.json"), "utf-8"),
  ) as CompanionReport;

  return {
    report,
    status: result.status,
    stdout: result.stdout,
  };
}
