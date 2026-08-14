import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type CacheStatus = "HIT" | "MISS";

export type TurboCacheTaskResult = {
  taskId: string;
  status: CacheStatus;
  hash: string;
};

export type TurboCacheScenarioResult = {
  name: string;
  taskCount: number;
  hitCount: number;
  missCount: number;
  tasks: readonly TurboCacheTaskResult[];
};

export type TurboCacheContractResult = {
  scenarios: readonly TurboCacheScenarioResult[];
};

type TurboRunSummary = {
  tasks?: readonly {
    taskId?: string;
    hash?: string;
    inputs?: Record<string, string>;
    cache?: { status?: string };
  }[];
};

type RunOptions = {
  environmentValue?: string;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_TURBO_BINARY = resolve(REPOSITORY_ROOT, "node_modules/.bin/turbo");
const APP_BUILD_TASK = "@fixture/app#build";
const APP_TEST_TASK = "@fixture/app#test";
const DEPENDENCY_BUILD_TASK = "@fixture/dependency#build";
const DEPENDENCY_TEST_TASK = "@fixture/dependency#test";
export const TURBO_EXECUTION_TIMEOUT_MS = 10 * 60 * 1000;

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFixtureFile(root: string, path: string, contents: string): void {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function createFixture(root: string): void {
  writeJson(join(root, "package.json"), {
    name: "turbo-cache-contract-fixture",
    private: true,
    packageManager: "pnpm@10.15.0",
    workspaces: ["packages/*"],
  });
  writeFixtureFile(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  writeFixtureFile(root, ".nvmrc", readFileSync(join(REPOSITORY_ROOT, ".nvmrc"), "utf8"));
  writeFixtureFile(
    root,
    "pnpm-lock.yaml",
    "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/app:\n    dependencies:\n      '@fixture/dependency':\n        specifier: workspace:*\n        version: link:../dependency\n  packages/dependency: {}\n  packages/unrelated: {}\n",
  );
  writeFixtureFile(root, "turbo.json", readFileSync(join(REPOSITORY_ROOT, "turbo.json"), "utf8"));
  writeFixtureFile(root, ".gitignore", "**/dist\n**/.turbo\n.turbo\n");
  writeJson(join(root, "package-lock.json"), {
    name: "turbo-cache-contract-fixture",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "turbo-cache-contract-fixture",
        workspaces: ["packages/*"],
      },
      "packages/app": {
        name: "@fixture/app",
        version: "1.0.0",
        dependencies: { "@fixture/dependency": "workspace:*" },
      },
      "packages/dependency": { name: "@fixture/dependency", version: "1.0.0" },
      "packages/unrelated": { name: "@fixture/unrelated", version: "1.0.0" },
      "node_modules/@fixture/app": { resolved: "packages/app", link: true },
      "node_modules/@fixture/dependency": { resolved: "packages/dependency", link: true },
      "node_modules/@fixture/unrelated": { resolved: "packages/unrelated", link: true },
    },
  });

  for (const [directory, name, dependencies] of [
    ["app", "@fixture/app", { "@fixture/dependency": "workspace:*" }],
    ["dependency", "@fixture/dependency", undefined],
    ["unrelated", "@fixture/unrelated", undefined],
  ] as const) {
    writeJson(join(root, "packages", directory, "package.json"), {
      name,
      version: "1.0.0",
      private: true,
      scripts: { build: "node build-runner.mjs", test: "node test-runner.mjs" },
      ...(dependencies ? { dependencies } : {}),
    });
    writeFixtureFile(
      root,
      `packages/${directory}/build-runner.mjs`,
      "import { mkdirSync, writeFileSync } from 'node:fs';\nmkdirSync('dist', { recursive: true });\nwriteFileSync('dist/result.txt', 'built\\n');\n",
    );
    writeFixtureFile(
      root,
      `packages/${directory}/test-runner.mjs`,
      "process.stdout.write('passed\\n');\n",
    );
    writeFixtureFile(
      root,
      `packages/${directory}/src/index.ts`,
      `export const value = '${directory}';\n`,
    );
    writeFixtureFile(
      root,
      `packages/${directory}/tests/index.spec.ts`,
      `// ${directory} test input\n`,
    );
    writeFixtureFile(
      root,
      `packages/${directory}/vitest.config.ts`,
      `export default { test: {} };\n`,
    );
    writeFixtureFile(root, `packages/${directory}/dist/result.txt`, "built\n");
  }
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=cache-contract",
      "-c",
      "user.email=cache@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { cwd: root },
  );
}

function summaryFiles(root: string): ReadonlySet<string> {
  const runsDirectory = join(root, ".turbo", "runs");
  try {
    return new Set(readdirSync(runsDirectory));
  } catch {
    return new Set();
  }
}

function readNewSummary(root: string, previousFiles: ReadonlySet<string>): TurboRunSummary {
  const runsDirectory = join(root, ".turbo", "runs");
  const newFiles = readdirSync(runsDirectory).filter((file) => !previousFiles.has(file));
  if (newFiles.length !== 1) {
    throw new Error(
      `[turbo-cache-contract] expected one run summary, found ${newFiles.length}: ${newFiles.sort().join(", ") || "<none>"}`,
    );
  }
  return JSON.parse(readFileSync(join(runsDirectory, newFiles[0]), "utf8")) as TurboRunSummary;
}

function runTurbo(
  root: string,
  turboBinary: string,
  name: string,
  options: RunOptions = {},
): TurboCacheScenarioResult {
  const previousFiles = summaryFiles(root);
  const args = [
    "run",
    "build",
    "test",
    "--filter=@fixture/app...",
    "--cache=local:rw",
    "--cache-dir=.turbo/cache",
    "--env-mode=strict",
    "--output-logs=errors-only",
    "--summarize",
    "--no-daemon",
  ];
  try {
    execFileSync(turboBinary, args, {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: options.environmentValue ?? "test",
        TURBO_TELEMETRY_DISABLED: "1",
      },
      encoding: "utf8",
      stdio: "pipe",
      timeout: TURBO_EXECUTION_TIMEOUT_MS,
    });
  } catch (error) {
    const failure = error as {
      readonly message?: string;
      readonly stderr?: unknown;
      readonly stdout?: unknown;
    };
    const output = (value: unknown): string => {
      if (typeof value === "string") return value.trim();
      if (Buffer.isBuffer(value)) return value.toString("utf8").trim();
      return "";
    };
    throw new Error(
      [
        `[turbo-cache-contract] scenario ${name}: turbo execution failed`,
        `command=${turboBinary} ${args.join(" ")}`,
        `stdout=${output(failure.stdout) || "<empty>"}`,
        `stderr=${output(failure.stderr) || "<empty>"}`,
        `cause=${failure.message ?? String(error)}`,
      ].join("\n"),
      { cause: error },
    );
  }

  const summary = readNewSummary(root, previousFiles);
  const tasks = (summary.tasks ?? []).map((task): TurboCacheTaskResult => {
    const taskId = task.taskId ?? "<unknown>";
    const hash = task.hash ?? "<unknown>";
    const status = task.cache?.status;
    if (status !== "HIT" && status !== "MISS") {
      throw new Error(
        `[turbo-cache-contract] scenario ${name}: task ${taskId} has invalid cache status ${status ?? "<none>"}`,
      );
    }
    return { taskId, status, hash };
  });
  return {
    name,
    taskCount: tasks.length,
    hitCount: tasks.filter(({ status }) => status === "HIT").length,
    missCount: tasks.filter(({ status }) => status === "MISS").length,
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

function statusFor(result: TurboCacheScenarioResult, taskId: string): CacheStatus | undefined {
  return result.tasks.find((task) => task.taskId === taskId)?.status;
}

function describeResult(result: TurboCacheScenarioResult): string {
  const statuses = result.tasks
    .map(({ taskId, status, hash }) => `${taskId}=${status}(${hash})`)
    .sort()
    .join(", ");
  return `tasks=${result.taskCount} hits=${result.hitCount} misses=${result.missCount} statuses=[${statuses}]`;
}

export function assertTurboCacheContract(result: TurboCacheContractResult): void {
  const byName = new Map(result.scenarios.map((scenario) => [scenario.name, scenario]));
  const expectStatus = (scenarioName: string, taskId: string, expected: CacheStatus): void => {
    const scenario = byName.get(scenarioName);
    if (!scenario) throw new Error(`[turbo-cache-contract] missing scenario ${scenarioName}`);
    const actual = statusFor(scenario, taskId);
    if (actual !== expected) {
      throw new Error(
        `[turbo-cache-contract] scenario ${scenarioName}: expected ${taskId}=${expected}, observed ${actual ?? "<missing>"}; ${describeResult(scenario)}`,
      );
    }
  };

  const expectApp = (
    scenarioName: string,
    expected: { build: CacheStatus; test: CacheStatus },
  ): void => {
    expectStatus(scenarioName, APP_BUILD_TASK, expected.build);
    expectStatus(scenarioName, APP_TEST_TASK, expected.test);
  };
  const expectDependency = (
    scenarioName: string,
    expected: { build: CacheStatus; test: CacheStatus },
  ): void => {
    expectStatus(scenarioName, DEPENDENCY_BUILD_TASK, expected.build);
    expectStatus(scenarioName, DEPENDENCY_TEST_TASK, expected.test);
  };

  expectApp("initial-run", { build: "MISS", test: "MISS" });
  expectDependency("initial-run", { build: "MISS", test: "MISS" });
  for (const scenarioName of ["identical-second-run", "unrelated-package-mutation"]) {
    expectApp(scenarioName, { build: "HIT", test: "HIT" });
    expectDependency(scenarioName, { build: "HIT", test: "HIT" });
  }
  expectApp("package-source-mutation", { build: "MISS", test: "MISS" });
  expectApp("package-test-mutation", { build: "HIT", test: "MISS" });
  expectApp("package-config-mutation", { build: "HIT", test: "MISS" });
  for (const scenarioName of [
    "package-source-mutation",
    "package-test-mutation",
    "package-config-mutation",
  ]) {
    expectDependency(scenarioName, { build: "HIT", test: "HIT" });
  }

  for (const scenarioName of [
    "declared-env-mutation",
    "lockfile-mutation",
    "node-version-mutation",
  ]) {
    expectApp(scenarioName, { build: "MISS", test: "MISS" });
    expectDependency(scenarioName, { build: "MISS", test: "MISS" });
  }
  expectDependency("direct-dependency-mutation", { build: "MISS", test: "MISS" });
  expectApp("direct-dependency-mutation", { build: "MISS", test: "MISS" });
}

export function runTurboCacheContract(
  options: { turboBinary?: string } = {},
): TurboCacheContractResult {
  const root = mkdtempSync(join(tmpdir(), "croco-turbo-cache-contract-"));
  const turboBinary = options.turboBinary ?? DEFAULT_TURBO_BINARY;
  const scenarios: TurboCacheScenarioResult[] = [];
  try {
    createFixture(root);
    scenarios.push(runTurbo(root, turboBinary, "initial-run"));
    scenarios.push(runTurbo(root, turboBinary, "identical-second-run"));

    const mutateAndRun = (name: string, path: string, replacement: string): void => {
      replaceFixtureFile(root, path, replacement, () => {
        scenarios.push(runTurbo(root, turboBinary, name));
      });
    };
    mutateAndRun(
      "package-source-mutation",
      "packages/app/src/index.ts",
      "export const value = 'app-mutated';\n",
    );
    mutateAndRun(
      "package-test-mutation",
      "packages/app/tests/index.spec.ts",
      "// mutated app test input\n",
    );
    mutateAndRun(
      "package-config-mutation",
      "packages/app/vitest.config.ts",
      "export default { test: { isolate: false } };\n",
    );
    scenarios.push(
      runTurbo(root, turboBinary, "declared-env-mutation", { environmentValue: "production" }),
    );
    mutateAndRun(
      "lockfile-mutation",
      "pnpm-lock.yaml",
      readFileSync(join(root, "pnpm-lock.yaml"), "utf8").replace(
        "specifier: workspace:*",
        "specifier: workspace:^",
      ),
    );
    mutateAndRun("node-version-mutation", ".nvmrc", "22.23.3\n");
    mutateAndRun(
      "direct-dependency-mutation",
      "packages/dependency/src/index.ts",
      "export const value = 'dependency-mutated';\n",
    );
    mutateAndRun(
      "unrelated-package-mutation",
      "packages/unrelated/src/index.ts",
      "export const value = 'unrelated-mutated';\n",
    );

    const result = { scenarios };
    assertTurboCacheContract(result);
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function isDirectExecution(): boolean {
  return (
    process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  const result = runTurboCacheContract();
  for (const scenario of result.scenarios) {
    console.log(`[turbo-cache-contract] ${scenario.name}: ${describeResult(scenario)}`);
  }
}
