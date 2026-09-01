#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type DocsCacheStatus = "HIT" | "MISS";

export type DocsCacheTaskResult = {
  readonly hash: string;
  readonly status: DocsCacheStatus;
  readonly taskId: string;
};

export type DocsCacheScenarioResult = {
  readonly hitCount: number;
  readonly missCount: number;
  readonly name: string;
  readonly taskCount: number;
  readonly tasks: readonly DocsCacheTaskResult[];
};

export type DocsCacheContractResult = {
  readonly scenarios: readonly DocsCacheScenarioResult[];
};

type FileSnapshot = {
  readonly bytes: Buffer;
  readonly executable: boolean;
};

type TurboRunSummary = {
  readonly tasks?: readonly {
    readonly cache?: { readonly status?: string };
    readonly hash?: string;
    readonly taskId?: string;
  }[];
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_TURBO_BINARY = resolve(REPOSITORY_ROOT, "node_modules/.bin/turbo");

const DEPENDENCY_MODEL_TASK = "@fixture/dependency#docs:api:model";
const CONSUMER_MODEL_TASK = "@fixture/consumer#docs:api:model";
const DOCS_RENDER_TASK = "@fixture/docs#docs:api:render";
const DOCS_BUILD_TASK = "@fixture/docs#docs:build";
const EXPECTED_TASKS = [
  DEPENDENCY_MODEL_TASK,
  CONSUMER_MODEL_TASK,
  DOCS_RENDER_TASK,
  DOCS_BUILD_TASK,
] as const;

export const DOCS_CACHE_EXECUTION_TIMEOUT_MS = 60_000;

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFixtureFile(root: string, path: string, contents: string): void {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function createPackage(
  root: string,
  directory: string,
  name: string,
  dependencies: Readonly<Record<string, string>> = {},
): void {
  writeJson(join(root, "packages", directory, "package.json"), {
    name,
    version: "1.0.0",
    private: true,
    scripts: { "docs:api:model": "node docs-model-runner.mjs" },
    ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
  });
  writeFixtureFile(
    root,
    `packages/${directory}/docs-model-runner.mjs`,
    [
      "import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
      "const source = readFileSync('src/index.ts', 'utf8');",
      "mkdirSync('.docs-api', { recursive: true });",
      `writeFileSync('.docs-api/model.json', JSON.stringify({ package: '${name}', source }) + '\\n');`,
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    root,
    `packages/${directory}/src/index.ts`,
    `export const value = '${directory}';\n`,
  );
}

function createFixture(root: string): void {
  writeJson(join(root, "package.json"), {
    name: "docs-cache-contract-fixture",
    private: true,
    packageManager: "pnpm@11.9.0",
    workspaces: ["packages/*"],
  });
  writeFixtureFile(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  writeFixtureFile(
    root,
    "pnpm-lock.yaml",
    [
      "lockfileVersion: '9.0'",
      "importers:",
      "  .: {}",
      "  packages/dependency: {}",
      "  packages/consumer:",
      "    dependencies:",
      "      '@fixture/dependency':",
      "        specifier: workspace:*",
      "        version: link:../dependency",
      "  packages/docs:",
      "    dependencies:",
      "      '@fixture/consumer':",
      "        specifier: workspace:*",
      "        version: link:../consumer",
      "      '@fixture/dependency':",
      "        specifier: workspace:*",
      "        version: link:../dependency",
      "  packages/unrelated: {}",
      "",
    ].join("\n"),
  );
  writeJson(join(root, "turbo.json"), {
    $schema: "https://turbo.build/schema.json",
    tasks: {
      "docs:api:model": {
        dependsOn: ["^docs:api:model"],
        inputs: ["src/**", "package.json", "docs-model-runner.mjs"],
        outputs: [".docs-api/**"],
      },
      "docs:api:render": {
        dependsOn: ["^docs:api:model"],
        inputs: ["render-runner.mjs"],
        outputs: [".generated-api/**"],
      },
      "docs:build": {
        dependsOn: ["docs:api:render"],
        inputs: ["build-runner.mjs"],
        outputs: ["dist/**"],
      },
    },
  });
  writeFixtureFile(
    root,
    ".gitignore",
    "node_modules\n.turbo\n**/.docs-api\n**/.generated-api\n**/dist\n",
  );

  createPackage(root, "dependency", "@fixture/dependency");
  createPackage(root, "consumer", "@fixture/consumer", {
    "@fixture/dependency": "workspace:*",
  });
  createPackage(root, "unrelated", "@fixture/unrelated");

  writeJson(join(root, "packages", "docs", "package.json"), {
    name: "@fixture/docs",
    version: "1.0.0",
    private: true,
    scripts: {
      "docs:api:render": "node render-runner.mjs",
      "docs:build": "node build-runner.mjs",
    },
    dependencies: {
      "@fixture/consumer": "workspace:*",
      "@fixture/dependency": "workspace:*",
    },
  });
  writeFixtureFile(
    root,
    "packages/docs/render-runner.mjs",
    [
      "import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
      "const dependency = JSON.parse(readFileSync('../dependency/.docs-api/model.json', 'utf8'));",
      "const consumer = JSON.parse(readFileSync('../consumer/.docs-api/model.json', 'utf8'));",
      "mkdirSync('.generated-api', { recursive: true });",
      "writeFileSync('.generated-api/index.json', JSON.stringify({ packages: [dependency, consumer] }) + '\\n');",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    root,
    "packages/docs/build-runner.mjs",
    [
      "import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
      "const api = readFileSync('.generated-api/index.json', 'utf8');",
      "mkdirSync('dist', { recursive: true });",
      "writeFileSync('dist/index.html', `<pre>${api}</pre>\\n`);",
      "",
    ].join("\n"),
  );

  runGit(root, ["init", "--quiet"]);
  runGit(root, ["add", "."]);
  runGit(root, [
    "-c",
    "user.name=docs-cache-contract",
    "-c",
    "user.email=docs-cache@example.invalid",
    "-c",
    "commit.gpgSign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  ]);
}

function runGit(root: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function snapshotTracked(root: string): ReadonlyMap<string, FileSnapshot> {
  const paths = runGit(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  return new Map(
    paths.map((path) => {
      const absolutePath = join(root, path);
      const stat = lstatSync(absolutePath);
      return [
        path,
        {
          bytes: readFileSync(absolutePath),
          executable: (stat.mode & 0o111) !== 0,
        },
      ];
    }),
  );
}

function assertTrackedUnchanged(
  scenarioName: string,
  before: ReadonlyMap<string, FileSnapshot>,
  after: ReadonlyMap<string, FileSnapshot>,
): void {
  const beforePaths = [...before.keys()].sort();
  const afterPaths = [...after.keys()].sort();
  if (JSON.stringify(beforePaths) !== JSON.stringify(afterPaths)) {
    throw new Error(`[docs-cache-contract] scenario ${scenarioName}: tracked path set changed`);
  }
  for (const path of beforePaths) {
    const previous = before.get(path);
    const current = after.get(path);
    if (!previous || !current || !previous.bytes.equals(current.bytes)) {
      throw new Error(
        `[docs-cache-contract] scenario ${scenarioName}: tracked file changed: ${path}`,
      );
    }
    if (previous.executable !== current.executable) {
      throw new Error(
        `[docs-cache-contract] scenario ${scenarioName}: tracked file mode changed: ${path}`,
      );
    }
  }
}

function summaryFiles(root: string): ReadonlySet<string> {
  const directory = join(root, ".turbo", "runs");
  return existsSync(directory) ? new Set(readdirSync(directory)) : new Set();
}

function readNewSummary(root: string, previous: ReadonlySet<string>): TurboRunSummary {
  const directory = join(root, ".turbo", "runs");
  const created = readdirSync(directory).filter((file) => !previous.has(file));
  if (created.length !== 1) {
    throw new Error(
      `[docs-cache-contract] expected one Turbo summary, found ${created.length}: ${created.sort().join(", ") || "<none>"}`,
    );
  }
  return JSON.parse(readFileSync(join(directory, created[0]), "utf8")) as TurboRunSummary;
}

function runTurbo(root: string, turboBinary: string, name: string): DocsCacheScenarioResult {
  const trackedBefore = snapshotTracked(root);
  const statusBefore = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const previousSummaries = summaryFiles(root);
  const args = [
    "run",
    "docs:build",
    "--filter=@fixture/docs...",
    "--cache=local:rw",
    "--cache-dir=.turbo/cache",
    "--env-mode=strict",
    "--output-logs=errors-only",
    "--summarize",
  ];
  try {
    execFileSync(turboBinary, args, {
      cwd: root,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
      encoding: "utf8",
      stdio: "pipe",
      timeout: DOCS_CACHE_EXECUTION_TIMEOUT_MS,
    });
  } catch (error) {
    const failure = error as { readonly stderr?: unknown; readonly stdout?: unknown };
    const text = (value: unknown): string => {
      if (typeof value === "string") return value.trim();
      if (Buffer.isBuffer(value)) return value.toString("utf8").trim();
      return "";
    };
    throw new Error(
      [
        `[docs-cache-contract] scenario ${name}: Turbo execution failed`,
        `command=${turboBinary} ${args.join(" ")}`,
        `stdout=${text(failure.stdout) || "<empty>"}`,
        `stderr=${text(failure.stderr) || "<empty>"}`,
      ].join("\n"),
      { cause: error },
    );
  }

  assertTrackedUnchanged(name, trackedBefore, snapshotTracked(root));
  const statusAfter = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (statusAfter !== statusBefore) {
    throw new Error(
      `[docs-cache-contract] scenario ${name}: worktree status changed; before=${JSON.stringify(statusBefore)} after=${JSON.stringify(statusAfter)}`,
    );
  }

  const summary = readNewSummary(root, previousSummaries);
  const tasks = (summary.tasks ?? []).map((task): DocsCacheTaskResult => {
    const taskId = task.taskId ?? "<unknown>";
    const hash = task.hash ?? "<unknown>";
    const status = task.cache?.status;
    if (status !== "HIT" && status !== "MISS") {
      throw new Error(
        `[docs-cache-contract] scenario ${name}: task ${taskId} has invalid cache status ${status ?? "<none>"}`,
      );
    }
    return { hash, status, taskId };
  });
  return {
    hitCount: tasks.filter(({ status }) => status === "HIT").length,
    missCount: tasks.filter(({ status }) => status === "MISS").length,
    name,
    taskCount: tasks.length,
    tasks,
  };
}

function replaceFixtureFile(
  root: string,
  path: string,
  replacement: string,
  run: () => void,
): void {
  const absolutePath = join(root, path);
  const original = readFileSync(absolutePath, "utf8");
  writeFileSync(absolutePath, replacement);
  try {
    run();
  } finally {
    writeFileSync(absolutePath, original);
  }
}

function taskStatus(
  scenario: DocsCacheScenarioResult,
  taskId: string,
): DocsCacheStatus | undefined {
  return scenario.tasks.find((task) => task.taskId === taskId)?.status;
}

function describeScenario(scenario: DocsCacheScenarioResult): string {
  const tasks = scenario.tasks
    .map(({ hash, status, taskId }) => `${taskId}=${status}(${hash})`)
    .sort()
    .join(", ");
  return `tasks=${scenario.taskCount} hits=${scenario.hitCount} misses=${scenario.missCount} statuses=[${tasks}]`;
}

export function assertDocsCacheContract(result: DocsCacheContractResult): void {
  const scenarios = new Map(result.scenarios.map((scenario) => [scenario.name, scenario]));
  const expectStatus = (scenarioName: string, taskId: string, expected: DocsCacheStatus): void => {
    const scenario = scenarios.get(scenarioName);
    if (!scenario) throw new Error(`[docs-cache-contract] missing scenario ${scenarioName}`);
    const actual = taskStatus(scenario, taskId);
    if (actual !== expected) {
      throw new Error(
        `[docs-cache-contract] scenario ${scenarioName}: expected ${taskId}=${expected}, observed ${actual ?? "<missing>"}; ${describeScenario(scenario)}`,
      );
    }
  };
  const expectAll = (scenarioName: string, expected: DocsCacheStatus): void => {
    for (const taskId of EXPECTED_TASKS) expectStatus(scenarioName, taskId, expected);
  };

  expectAll("initial-run", "MISS");
  expectAll("identical-second-run", "HIT");

  expectStatus("consumer-source-mutation", DEPENDENCY_MODEL_TASK, "HIT");
  for (const taskId of [CONSUMER_MODEL_TASK, DOCS_RENDER_TASK, DOCS_BUILD_TASK]) {
    expectStatus("consumer-source-mutation", taskId, "MISS");
  }

  expectStatus("dependency-source-mutation", DEPENDENCY_MODEL_TASK, "MISS");
  expectStatus("dependency-source-mutation", CONSUMER_MODEL_TASK, "MISS");
  expectStatus("dependency-source-mutation", DOCS_RENDER_TASK, "MISS");
  expectStatus("dependency-source-mutation", DOCS_BUILD_TASK, "MISS");

  expectAll("unrelated-source-mutation", "HIT");
}

export function runDocsCacheContract(
  options: { readonly turboBinary?: string } = {},
): DocsCacheContractResult {
  const root = mkdtempSync(join(tmpdir(), "croco-docs-cache-contract-"));
  const turboBinary = options.turboBinary ?? DEFAULT_TURBO_BINARY;
  const scenarios: DocsCacheScenarioResult[] = [];
  try {
    createFixture(root);
    scenarios.push(runTurbo(root, turboBinary, "initial-run"));
    scenarios.push(runTurbo(root, turboBinary, "identical-second-run"));
    replaceFixtureFile(
      root,
      "packages/consumer/src/index.ts",
      "export const value = 'consumer-mutated';\n",
      () => scenarios.push(runTurbo(root, turboBinary, "consumer-source-mutation")),
    );
    replaceFixtureFile(
      root,
      "packages/dependency/src/index.ts",
      "export const value = 'dependency-mutated';\n",
      () => scenarios.push(runTurbo(root, turboBinary, "dependency-source-mutation")),
    );
    replaceFixtureFile(
      root,
      "packages/unrelated/src/index.ts",
      "export const value = 'unrelated-mutated';\n",
      () => scenarios.push(runTurbo(root, turboBinary, "unrelated-source-mutation")),
    );

    const result = { scenarios };
    assertDocsCacheContract(result);
    return result;
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function isDirectExecution(): boolean {
  return (
    process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  const result = runDocsCacheContract();
  for (const scenario of result.scenarios) {
    console.log(`[docs-cache-contract] ${scenario.name}: ${describeScenario(scenario)}`);
  }
}
