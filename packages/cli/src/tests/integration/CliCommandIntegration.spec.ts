import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
const SPAWN_TIMEOUT_MS = 180_000;

type PackageJson = {
  readonly bin?: unknown;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly main?: unknown;
  readonly name?: string;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly peerDependenciesMeta?: Record<string, { readonly optional?: boolean }>;
  readonly private?: boolean;
  readonly publishConfig?: Record<string, unknown>;
  readonly types?: unknown;
  readonly version?: unknown;
  readonly [key: string]: unknown;
};

type PackageInfo = {
  readonly packageDir: string;
  readonly packageName: string;
  readonly packagePath: string;
  readonly publishManifest: PackageJson;
  readonly sourceManifest: PackageJson;
};

type PackedPackageInfo = PackageInfo & {
  readonly packedManifest: PackageJson;
  readonly tarballPath: string;
};

type CliHarness = {
  readonly binPaths: {
    readonly createCrocoApp: string;
    readonly croco: string;
  };
  readonly commandRoot: string;
  readonly consumerRoot: string;
  readonly packedPackages: ReadonlyMap<string, PackedPackageInfo>;
  readonly packRoot: string;
  readonly tempRoot: string;
};

type RunResult = {
  readonly stderr: string;
  readonly stdout: string;
};

type CommandEnvelope = {
  readonly json: unknown | null;
  readonly rerun: {
    readonly command: string;
    readonly cwd: string;
  };
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

let activeHarness: CliHarness | undefined;

describe("installed CLI command integration", () => {
  beforeAll(() => {
    activeHarness = createCliHarness();
  }, 600_000);

  afterAll(() => {
    const harness = activeHarness;
    activeHarness = undefined;

    if (harness) {
      rmSync(harness.tempRoot, { force: true, recursive: true });
    }
  });

  it("installs published package graphs and resolves bins under the temp consumer", () => {
    const harness = getHarness();
    const consumerBinDir = join(harness.consumerRoot, "node_modules", ".bin");

    expect(existsSync(harness.binPaths.croco)).toBe(true);
    expect(existsSync(harness.binPaths.createCrocoApp)).toBe(true);
    expect(dirname(harness.binPaths.croco)).toBe(consumerBinDir);
    expect(dirname(harness.binPaths.createCrocoApp)).toBe(consumerBinDir);

    expect([
      installedPackageSummary(harness, "@croco/cli"),
      installedPackageSummary(harness, "create-croco-app"),
      installedPackageSummary(harness, "@croco/protocols-core"),
      installedPackageSummary(harness, "@croco/openapi-spec"),
      installedPackageSummary(harness, "@croco/rpc-codegen"),
      installedPackageSummary(harness, "@croco/migration-runner"),
    ]).toMatchInlineSnapshot(`
      [
        {
          "bin": {
            "croco": "./dist/bin/croco.js",
          },
          "exports": {
            ".": {
              "import": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
            "./jobs": {
              "import": "./dist/jobs.js",
              "types": "./dist/jobs.d.ts",
            },
            "./ops": {
              "import": "./dist/ops.js",
              "types": "./dist/ops.d.ts",
            },
          },
          "main": "./dist/index.js",
          "name": "@croco/cli",
          "types": "./dist/index.d.ts",
        },
        {
          "bin": {
            "create-croco-app": "./dist/bin.js",
          },
          "exports": {
            ".": {
              "import": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
            "./dist/verification.js": {
              "import": "./dist/verification.js",
              "types": "./dist/verification.d.ts",
            },
            "./programmatic": {
              "import": "./dist/programmatic.js",
              "types": "./dist/programmatic.d.ts",
            },
          },
          "main": "./dist/index.js",
          "name": "create-croco-app",
          "types": "./dist/index.d.ts",
        },
        {
          "bin": null,
          "exports": {
            ".": {
              "import": "./dist/index.mjs",
              "require": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
          },
          "main": "./dist/index.js",
          "name": "@croco/protocols-core",
          "types": "./dist/index.d.ts",
        },
        {
          "bin": {
            "croco-openapi-spec": "./dist/cli.js",
          },
          "exports": {
            ".": {
              "import": "./dist/index.mjs",
              "require": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
          },
          "main": "./dist/index.js",
          "name": "@croco/openapi-spec",
          "types": "./dist/index.d.ts",
        },
        {
          "bin": {
            "croco-rpc-codegen": "./dist/cli.js",
          },
          "exports": {
            ".": {
              "import": "./dist/index.js",
              "require": "./dist/index.cjs",
              "types": "./dist/index.d.ts",
            },
          },
          "main": "./dist/index.js",
          "name": "@croco/rpc-codegen",
          "types": "./dist/index.d.ts",
        },
        {
          "bin": {
            "migrate": "./dist/cli.js",
          },
          "exports": {
            ".": {
              "import": "./dist/index.mjs",
              "require": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
            "./cli": {
              "import": "./dist/cli.mjs",
              "require": "./dist/cli.js",
              "types": "./dist/cli.d.ts",
            },
          },
          "main": "./dist/index.js",
          "name": "@croco/migration-runner",
          "types": "./dist/index.d.ts",
        },
      ]
    `);
  });

  it("imports and runs the packed CLI API without import side effects", () => {
    const harness = getHarness();
    const scriptPath = join(harness.consumerRoot, "run-packed-cli-api.mjs");
    writeFileSync(
      scriptPath,
      [
        "process.exitCode = 23;",
        "const api = await import('@croco/cli');",
        "const exitCodeAfterImport = process.exitCode;",
        "const stdout = [];",
        "const stderr = [];",
        "const result = await api.runCroco(['--help'], {",
        "  cwd: '/embedded/workspace',",
        "  env: { CROCO_TEST_SENTINEL: 'present' },",
        "  stdout: (message) => stdout.push(message),",
        "  stderr: (message) => stderr.push(message),",
        "});",
        "process.exitCode = 0;",
        "console.log(JSON.stringify({",
        "  createCrocoCommand: typeof api.createCrocoCommand,",
        "  runCroco: typeof api.runCroco,",
        "  exitCodeAfterImport,",
        "  result,",
        "  stdout: stdout.join('\\n'),",
        "  stderr,",
        "}));",
        "",
      ].join("\n"),
    );

    const result = run("node", [scriptPath], harness.consumerRoot, {
      label: "run packed @croco/cli API",
    });
    const report = JSON.parse(result.stdout) as {
      readonly createCrocoCommand: string;
      readonly runCroco: string;
      readonly exitCodeAfterImport: number;
      readonly result: { readonly exitCode: number };
      readonly stdout: string;
      readonly stderr: readonly string[];
    };

    expect(report).toMatchObject({
      createCrocoCommand: "function",
      runCroco: "function",
      exitCodeAfterImport: 23,
      result: { exitCode: 0 },
      stderr: [],
    });
    expect(report.stdout).toContain("Croco framework CLI");
    expect(result.stderr).toBe("");
  });

  it("preserves packed bin help and invalid-command exit semantics", () => {
    const harness = getHarness();
    const help = runInstalledCommand(harness, "croco", ["--help"], harness.commandRoot, 0);
    const invalid = runInstalledCommand(
      harness,
      "croco",
      ["unknown-command"],
      harness.commandRoot,
      1,
    );

    expect(help.stdout).toContain("Croco framework CLI");
    expect(help.stderr).toBe("");
    expect(invalid.stdout).toContain("Croco framework CLI");
    expect(invalid.stderr).toContain("Unknown command `unknown-command`");
  });

  it("runs create-croco-app JSON success and failure through the installed package", () => {
    const harness = getHarness();
    const targetDir = join(harness.commandRoot, "blank-app");

    const created = runInstalledCommand(
      harness,
      "create-croco-app",
      [targetDir, "--json", "--no-install", "--no-git", "--scope", "@acme", "--preset", "blank"],
      harness.commandRoot,
      0,
    );
    expect(existsSync(join(targetDir, "package.json"))).toBe(true);
    expect(snapshotEnvelope(harness, created)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "code": "create-croco-app/project-created",
          "diagnosticCode": null,
          "ok": true,
          "preset": "blank",
          "projectName": "blank-app",
          "recovery": null,
          "unexpected": null,
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/create-croco-app <consumer-root>/commands/blank-app --json --no-install --no-git --scope @acme --preset blank",
          "cwd": "<consumer-root>/commands",
        },
        "status": 0,
        "stderr": "",
        "stdout": "<json>",
      }
    `);

    const failed = runInstalledCommand(
      harness,
      "create-croco-app",
      ["--json"],
      harness.commandRoot,
      1,
    );
    expect(snapshotEnvelope(harness, failed)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "code": "create-croco-app/invalid-cli-option",
          "diagnosticCode": "create-croco-app/invalid-cli-option",
          "ok": false,
          "preset": null,
          "projectName": null,
          "recovery": "Pass a target directory, --scope, and either --goal or --preset, or remove --json.",
          "unexpected": false,
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/create-croco-app --json",
          "cwd": "<consumer-root>/commands",
        },
        "status": 1,
        "stderr": "<json>",
        "stdout": "",
      }
    `);
  });

  it("runs croco doctor --json success and failure from temp workspaces", () => {
    const harness = getHarness();
    const workspace = createDoctorWorkspace(join(harness.commandRoot, "doctor-healthy"));
    const nonWorkspace = join(harness.tempRoot, "doctor-non-workspace");
    mkdirSync(nonWorkspace, { recursive: true });

    const healthy = runInstalledCommand(
      harness,
      "croco",
      ["doctor", "--json", "--cwd", join(workspace, "packages", "api")],
      harness.commandRoot,
      0,
    );
    expect(snapshotEnvelope(harness, healthy)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "diagnosticCodes": [],
          "packageCount": 2,
          "summary": "healthy",
          "version": "croco.doctor.v1",
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco doctor --json --cwd <consumer-root>/commands/doctor-healthy/packages/api",
          "cwd": "<consumer-root>/commands",
        },
        "status": 0,
        "stderr": "",
        "stdout": "<json>",
      }
    `);

    const failed = runInstalledCommand(
      harness,
      "croco",
      ["doctor", "--json", "--cwd", nonWorkspace],
      harness.commandRoot,
      1,
    );
    expect(snapshotEnvelope(harness, failed)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "diagnosticCodes": [
            "CROCO_CLI_DOCTOR_001",
          ],
          "packageCount": 0,
          "summary": "issues_detected",
          "version": "croco.doctor.v1",
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco doctor --json --cwd <temp-root>/doctor-non-workspace",
          "cwd": "<consumer-root>/commands",
        },
        "status": 1,
        "stderr": "",
        "stdout": "<json>",
      }
    `);
  });

  it("runs contract checks and OpenAPI/RPC generation through installed croco wrappers", () => {
    const harness = getHarness();
    const fixtures = writeControllerFixtures(join(harness.consumerRoot, "fixtures"));

    const contracts = runInstalledCommand(
      harness,
      "croco",
      ["contracts", "check", "--controllers", fixtures.validGlob, "--json"],
      harness.commandRoot,
      0,
    );
    expect(snapshotEnvelope(harness, contracts)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "diagnosticCodes": [],
          "operationIds": [
            "UsersController_listUsers",
          ],
          "routeCount": 1,
          "snapshotVersion": "croco.contract-graph.snapshot.v1",
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco contracts check --controllers <consumer-root>/fixtures/controllers/UsersController.ts --json",
          "cwd": "<consumer-root>/commands",
        },
        "status": 0,
        "stderr": "",
        "stdout": "<json>",
      }
    `);

    const strictContracts = runInstalledCommand(
      harness,
      "croco",
      ["contracts", "check", "--controllers", fixtures.weakGlob, "--json", "--strict-schemas"],
      harness.commandRoot,
      1,
    );
    expect(snapshotEnvelope(harness, strictContracts)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "diagnosticCodes": [
            "contract-route-missing-body-schema",
            "contract-route-missing-response-schema",
          ],
          "operationIds": [
            "WeakController_createWeak",
          ],
          "routeCount": 1,
          "snapshotVersion": "croco.contract-graph.snapshot.v1",
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco contracts check --controllers <consumer-root>/fixtures/controllers/WeakController.ts --json --strict-schemas",
          "cwd": "<consumer-root>/commands",
        },
        "status": 1,
        "stderr": "",
        "stdout": "<json>",
      }
    `);

    const openapiOut = join(harness.commandRoot, "generated", "openapi.json");
    mkdirSync(dirname(openapiOut), { recursive: true });
    const openapi = runInstalledCommand(
      harness,
      "croco",
      [
        "codegen",
        "openapi",
        "--controllers",
        fixtures.validGlob,
        "--out",
        openapiOut,
        "--compatibility-schemas",
        "--compatibility-problems",
      ],
      harness.commandRoot,
      0,
    );
    expect(readJsonFile(openapiOut)).toMatchObject({
      info: { title: "Croco API", version: "1.0.0" },
      openapi: "3.1.0",
    });
    expect(snapshotEnvelope(harness, openapi)).toMatchInlineSnapshot(`
      {
        "jsonSummary": null,
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco codegen openapi --controllers <consumer-root>/fixtures/controllers/UsersController.ts --out <consumer-root>/commands/generated/openapi.json --compatibility-schemas --compatibility-problems",
          "cwd": "<consumer-root>/commands",
        },
        "status": 0,
        "stderr": "",
        "stdout": "",
      }
    `);

    const rpcOut = join(harness.commandRoot, "generated", "rpc-client");
    const rpc = runInstalledCommand(
      harness,
      "croco",
      [
        "codegen",
        "rpc",
        "--controllers",
        fixtures.validGlob,
        "--out",
        rpcOut,
        "--compatibility-schemas",
        "--compatibility-problems",
      ],
      harness.commandRoot,
      0,
    );
    expect(existsSync(join(rpcOut, "index.ts"))).toBe(true);
    expect(existsSync(join(rpcOut, "rpc.ts"))).toBe(true);
    expect(existsSync(join(rpcOut, "users.ts"))).toBe(true);
    expect(snapshotEnvelope(harness, rpc)).toMatchInlineSnapshot(`
      {
        "jsonSummary": null,
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco codegen rpc --controllers <consumer-root>/fixtures/controllers/UsersController.ts --out <consumer-root>/commands/generated/rpc-client --compatibility-schemas --compatibility-problems",
          "cwd": "<consumer-root>/commands",
        },
        "status": 0,
        "stderr": "",
        "stdout": "<consumer-root>/commands/generated/rpc-client/users.ts
      <consumer-root>/commands/generated/rpc-client/rpc.ts
      <consumer-root>/commands/generated/rpc-client/index.ts",
      }
    `);
  });

  it("runs upgrade JSON success and migrate failure through the installed croco command", () => {
    const harness = getHarness();
    const upgradeWorkspace = createUpgradeWorkspace(join(harness.commandRoot, "upgrade-workspace"));

    const upgrade = runInstalledCommand(
      harness,
      "croco",
      ["upgrade", "--json", "--cwd", upgradeWorkspace, "apps/api-server/src"],
      harness.commandRoot,
      0,
    );
    expect(snapshotEnvelope(harness, upgrade)).toMatchInlineSnapshot(`
      {
        "jsonSummary": {
          "findingCodes": [
            "CROCO_CLI_UPGRADE_003",
          ],
          "mode": "dry-run",
          "summary": {
            "appliedCodemods": 0,
            "filesScanned": 1,
            "findings": 1,
            "manualConfirmations": 0,
            "safeCodemods": 1,
          },
          "version": "croco.upgrade.report.v1",
        },
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco upgrade --json --cwd <consumer-root>/commands/upgrade-workspace apps/api-server/src",
          "cwd": "<consumer-root>/commands",
        },
        "status": 0,
        "stderr": "",
        "stdout": "<json>",
      }
    `);

    const migrate = runInstalledCommand(
      harness,
      "croco",
      ["migrate", "status"],
      harness.commandRoot,
      1,
    );
    expect(snapshotEnvelope(harness, migrate)).toMatchInlineSnapshot(`
      {
        "jsonSummary": null,
        "rerun": {
          "command": "<consumer-root>/node_modules/.bin/croco migrate status",
          "cwd": "<consumer-root>/commands",
        },
        "status": 1,
        "stderr": "Status check failed: migration-runner/database-url-required (400 Bad Request): Database connection URL required. Use --connection or set DATABASE_URL",
        "stdout": "",
      }
    `);
  });
});

function createCliHarness(): CliHarness {
  const tempRoot = mkdtempSync(join(tmpdir(), "croco-cli-command-integration-"));
  const packRoot = join(tempRoot, "packs");
  const consumerRoot = join(tempRoot, "consumer");
  const commandRoot = join(consumerRoot, "commands");
  mkdirSync(packRoot, { recursive: true });
  mkdirSync(commandRoot, { recursive: true });

  const packageIndex = packageIndexFor(findPackageJsonFiles(join(REPO_ROOT, "packages")));
  const rootPackages = ["@croco/cli", "create-croco-app"].map((packageName) =>
    requiredPackage(packageIndex, packageName),
  );
  run(
    "pnpm",
    ["--filter", "@croco/cli...", "--filter", "create-croco-app...", "build"],
    REPO_ROOT,
    { label: "build CLI runtime package graph" },
  );

  const graphPackages = collectInternalRuntimeGraphs(rootPackages, packageIndex);
  const packedPackages = new Map<string, PackedPackageInfo>();
  for (const packageInfo of graphPackages) {
    packPackage(packageInfo, packRoot, packedPackages);
  }

  writeConsumerWorkspace(consumerRoot, Array.from(packedPackages.values()));
  const rootTarballs = rootPackages.map((packageInfo) =>
    requiredPackedPackage(packedPackages, packageInfo.packageName),
  );
  const internalPeerTarballs = internalPeerPackagesFor(Array.from(packedPackages.values()));
  run(
    "pnpm",
    [
      "add",
      "--prod",
      ...rootTarballs.map((packageInfo) => packageInfo.tarballPath),
      ...internalPeerTarballs.map((packageInfo) => packageInfo.tarballPath),
      "--ignore-scripts",
    ],
    consumerRoot,
    { label: "install packed CLI packages into temp consumer" },
  );

  return {
    binPaths: {
      createCrocoApp: join(consumerRoot, "node_modules", ".bin", "create-croco-app"),
      croco: join(consumerRoot, "node_modules", ".bin", "croco"),
    },
    commandRoot,
    consumerRoot,
    packedPackages,
    packRoot,
    tempRoot,
  };
}

function getHarness(): CliHarness {
  if (!activeHarness) {
    throw new Error("CLI integration harness was not initialized");
  }

  return activeHarness;
}

function findPackageJsonFiles(rootDir: string): string[] {
  const packageJsonFiles: string[] = [];

  function visit(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === "package.json") {
        packageJsonFiles.push(entryPath);
      }
    }
  }

  visit(rootDir);

  return packageJsonFiles.sort();
}

function packageIndexFor(packageJsonFiles: readonly string[]): ReadonlyMap<string, PackageInfo> {
  const packageIndex = new Map<string, PackageInfo>();

  for (const packagePath of packageJsonFiles) {
    const sourceManifest = readPackageJson(packagePath);
    if (sourceManifest.private === true) {
      continue;
    }

    const packageName = packageNameFor(sourceManifest, packagePath);
    packageIndex.set(packageName, {
      packageDir: dirname(packagePath),
      packageName,
      packagePath,
      publishManifest: publishManifestFor(sourceManifest),
      sourceManifest,
    });
  }

  return packageIndex;
}

function readPackageJson(packagePath: string): PackageJson {
  return JSON.parse(readFileSync(packagePath, "utf-8")) as PackageJson;
}

function packageNameFor(pkg: PackageJson, packagePath: string): string {
  if (typeof pkg.name === "string" && pkg.name.length > 0) {
    return pkg.name;
  }

  throw new Error(`${packagePath}: package name is required`);
}

function publishManifestFor(sourceManifest: PackageJson): PackageJson {
  const publishManifest = {
    ...sourceManifest,
    ...sourceManifest.publishConfig,
  };
  delete publishManifest.publishConfig;

  return publishManifest;
}

function requiredPackage(
  packageIndex: ReadonlyMap<string, PackageInfo>,
  packageName: string,
): PackageInfo {
  const packageInfo = packageIndex.get(packageName);
  if (!packageInfo) {
    throw new Error(`${packageName}: package manifest was not found`);
  }

  return packageInfo;
}

function collectInternalRuntimeGraphs(
  rootPackages: readonly PackageInfo[],
  packageIndex: ReadonlyMap<string, PackageInfo>,
): PackageInfo[] {
  const graph = new Map<string, PackageInfo>();

  function visit(packageInfo: PackageInfo): void {
    if (graph.has(packageInfo.packageName)) {
      return;
    }

    graph.set(packageInfo.packageName, packageInfo);

    for (const dependencyName of internalRuntimeDependencyNames(packageInfo.sourceManifest)) {
      const dependencyPackage = packageIndex.get(dependencyName);
      if (dependencyPackage) {
        visit(dependencyPackage);
      }
    }
  }

  for (const rootPackage of rootPackages) {
    visit(rootPackage);
  }

  return Array.from(graph.values()).sort((left, right) =>
    left.packageName.localeCompare(right.packageName),
  );
}

function internalRuntimeDependencyNames(pkg: PackageJson): string[] {
  const optionalPeers = optionalPeerDependencyNames(pkg.peerDependenciesMeta);

  return Array.from(
    new Set([
      ...dependencyNames(pkg.dependencies),
      ...dependencyNames(pkg.optionalDependencies),
      ...dependencyNames(pkg.peerDependencies).filter((name) => !optionalPeers.has(name)),
    ]),
  ).sort();
}

function dependencyNames(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

function optionalPeerDependencyNames(value: unknown): ReadonlySet<string> {
  if (!isRecord(value)) {
    return new Set();
  }

  return new Set(
    Object.entries(value)
      .filter(([, meta]) => isRecord(meta) && meta.optional === true)
      .map(([dependencyName]) => dependencyName)
      .sort(),
  );
}

function packPackage(
  packageInfo: PackageInfo,
  packRoot: string,
  packedPackages: Map<string, PackedPackageInfo>,
): void {
  if (packedPackages.has(packageInfo.packageName)) {
    return;
  }

  run("pnpm", ["pack", "--pack-destination", packRoot], packageInfo.packageDir, {
    label: `${packageInfo.packageName}: pnpm pack`,
  });

  const tarballPath = findTarball(packRoot, packageInfo.packageName);
  const packedManifest = readPackedJson(tarballPath, "package/package.json");
  packedPackages.set(packageInfo.packageName, {
    ...packageInfo,
    packedManifest,
    tarballPath,
  });
}

function findTarball(packRoot: string, packageName: string): string {
  const prefix = tarballPrefixFor(packageName);
  const filename = readdirSync(packRoot)
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error(`${packageName}: missing packed tarball with prefix ${prefix}`);
  }

  return join(packRoot, filename);
}

function tarballPrefixFor(packageName: string): string {
  return `${replaceText(packageName.replace(/^@/, ""), "/", "-")}-`;
}

function readPackedJson(tarballPath: string, entryPath: string): PackageJson {
  return JSON.parse(readPackedFile(tarballPath, entryPath)) as PackageJson;
}

function readPackedFile(tarballPath: string, entryPath: string): string {
  return run("tar", ["-xOf", tarballPath, entryPath], REPO_ROOT, {
    label: `${tarballPath}: read ${entryPath}`,
  }).stdout;
}

function writeConsumerWorkspace(
  consumerRoot: string,
  graphPackages: readonly PackedPackageInfo[],
): void {
  const overrides = Object.fromEntries(
    graphPackages.map((packageInfo) => [
      packageInfo.packageName,
      `file:${packageInfo.tarballPath}`,
    ]),
  );

  mkdirSync(consumerRoot, { recursive: true });
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "croco-cli-command-integration-consumer",
        packageManager: "pnpm@11.9.0",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerRoot, "pnpm-workspace.yaml"),
    `${JSON.stringify(
      {
        packages: [],
        overrides,
      },
      null,
      2,
    )}\n`,
  );
}

function requiredPackedPackage(
  packedPackages: ReadonlyMap<string, PackedPackageInfo>,
  packageName: string,
): PackedPackageInfo {
  const packageInfo = packedPackages.get(packageName);
  if (!packageInfo) {
    throw new Error(`${packageName}: packed package was not found`);
  }

  return packageInfo;
}

function directInternalPeerDependencyNames(packageInfo: PackageInfo): string[] {
  const optionalPeers = optionalPeerDependencyNames(
    packageInfo.sourceManifest.peerDependenciesMeta,
  );

  return dependencyNames(packageInfo.sourceManifest.peerDependencies).filter(
    (dependencyName) => !optionalPeers.has(dependencyName) && dependencyName.startsWith("@croco/"),
  );
}

function internalPeerPackagesFor(graphPackages: readonly PackedPackageInfo[]): PackedPackageInfo[] {
  const packageIndex = new Map(
    graphPackages.map((packageInfo) => [packageInfo.packageName, packageInfo]),
  );
  const peerPackages = new Map<string, PackedPackageInfo>();

  for (const packageInfo of graphPackages) {
    for (const dependencyName of directInternalPeerDependencyNames(packageInfo)) {
      const peerPackage = packageIndex.get(dependencyName);
      if (peerPackage) {
        peerPackages.set(peerPackage.packageName, peerPackage);
      }
    }
  }

  return Array.from(peerPackages.values()).sort((left, right) =>
    left.packageName.localeCompare(right.packageName),
  );
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  options: { readonly expectedExitCode?: number; readonly label: string },
): RunResult {
  const expectedExitCode = options.expectedExitCode ?? 0;
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, DATABASE_URL: "" },
    stdio: "pipe",
    timeout: SPAWN_TIMEOUT_MS,
  });

  if (result.error || result.status !== expectedExitCode) {
    throw new Error(
      formatCommandFailure(options.label, command, args, cwd, result, expectedExitCode),
    );
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runInstalledCommand(
  harness: CliHarness,
  commandName: "create-croco-app" | "croco",
  args: readonly string[],
  cwd: string,
  expectedExitCode: number,
): CommandEnvelope {
  const command =
    commandName === "croco" ? harness.binPaths.croco : harness.binPaths.createCrocoApp;
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, DATABASE_URL: "" },
    stdio: "pipe",
    timeout: SPAWN_TIMEOUT_MS,
  });
  const envelope = toCommandEnvelope(command, args, cwd, result);

  if (result.error || result.status !== expectedExitCode) {
    throw new Error(
      [
        `Installed command failed: ${envelope.rerun.command}`,
        `Expected exit code: ${expectedExitCode}`,
        `Actual exit code: ${result.status ?? "null"}`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        envelope.stdout.trim(),
        envelope.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return envelope;
}

function toCommandEnvelope(
  command: string,
  args: readonly string[],
  cwd: string,
  result: SpawnSyncReturns<string>,
): CommandEnvelope {
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  return {
    json: parseJson(stdout) ?? parseJson(stderr),
    rerun: {
      command: [command, ...args].map(quoteShellArg).join(" "),
      cwd,
    },
    status: result.status,
    stderr,
    stdout,
  };
}

function parseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function formatCommandFailure(
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
  result: SpawnSyncReturns<string>,
  expectedExitCode: number,
): string {
  return [
    `${label}: ${command} ${args.map((arg) => relativeArg(cwd, arg)).join(" ")} failed`,
    `Rerun: cd ${quoteShellArg(cwd)} && ${[command, ...args].map(quoteShellArg).join(" ")}`,
    `Expected exit code: ${expectedExitCode}`,
    `Actual exit code: ${result.status ?? "null"}`,
    result.error ? `${result.error.name}: ${result.error.message}` : undefined,
    result.stdout.trim(),
    result.stderr.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function relativeArg(cwd: string, arg: string): string {
  if (arg.startsWith(cwd)) {
    return relative(cwd, arg);
  }

  return arg;
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.split("'").join("'\\''")}'`;
}

function installedPackageSummary(
  harness: CliHarness,
  packageName: string,
): Record<string, unknown> {
  const manifestPath = findInstalledPackageManifest(harness, packageName);
  const manifest = readPackageJson(manifestPath);
  const serializedManifest = JSON.stringify(manifest);

  expect(serializedManifest).not.toContain(join(REPO_ROOT, "packages"));
  if (packageName !== "create-croco-app") {
    expect(serializedManifest).not.toContain('"./src/');
  }

  return {
    bin: manifest.bin ?? null,
    exports: manifest.exports ?? null,
    main: manifest.main ?? null,
    name: manifest.name,
    types: manifest.types ?? null,
  };
}

function findInstalledPackageManifest(harness: CliHarness, packageName: string): string {
  const directManifestPath = join(
    harness.consumerRoot,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );

  if (existsSync(directManifestPath)) {
    return directManifestPath;
  }

  const pnpmStoreRoot = join(harness.consumerRoot, "node_modules", ".pnpm");
  const suffix = join("node_modules", ...packageName.split("/"), "package.json");
  const matches: string[] = [];

  function visit(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.isFile() && entryPath.endsWith(suffix)) {
        matches.push(entryPath);
      }
    }
  }

  if (existsSync(pnpmStoreRoot)) {
    visit(pnpmStoreRoot);
  }

  const [manifestPath] = matches.sort();
  if (!manifestPath) {
    throw new Error(`${packageName}: installed package manifest was not found`);
  }

  return manifestPath;
}

function snapshotEnvelope(harness: CliHarness, envelope: CommandEnvelope): Record<string, unknown> {
  return {
    jsonSummary: summarizeJson(normalizeValue(harness, envelope.json)),
    rerun: {
      command: normalizeText(harness, envelope.rerun.command),
      cwd: normalizeText(harness, envelope.rerun.cwd),
    },
    status: envelope.status,
    stderr: snapshotStream(harness, envelope.stderr),
    stdout: snapshotStream(harness, envelope.stdout),
  };
}

function snapshotStream(harness: CliHarness, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (parseJson(trimmed) !== null) {
    return "<json>";
  }

  return normalizeText(harness, trimmed);
}

function normalizeValue(harness: CliHarness, value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeText(harness, value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(harness, item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeValue(harness, entry)]),
    );
  }

  return value;
}

function normalizeText(harness: CliHarness, value: string): string {
  const normalizedPaths = [
    [`/private${harness.consumerRoot}`, "<consumer-root>"],
    [`/private${harness.packRoot}`, "<pack-root>"],
    [`/private${harness.tempRoot}`, "<temp-root>"],
    [REPO_ROOT, "<repo-root>"],
    [harness.consumerRoot, "<consumer-root>"],
    [harness.packRoot, "<pack-root>"],
    [harness.tempRoot, "<temp-root>"],
    [tmpdir(), "<tmpdir>"],
  ].reduce((text, [search, replacement]) => replaceText(text, search, replacement), value);

  return normalizedPaths.replace(/\(node:\d+\)/g, "(node:<pid>)");
}

function replaceText(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

function summarizeJson(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if (value.version === "croco.doctor.v1") {
    return {
      diagnosticCodes: readDiagnosticCodes(value.diagnostics),
      packageCount: value.packageCount,
      summary: value.summary,
      version: value.version,
    };
  }

  if (value.snapshotVersion === "croco.contract-graph.snapshot.v1") {
    return {
      diagnosticCodes: readDiagnosticCodes(value.diagnostics),
      operationIds: value.operationIds,
      routeCount: value.routeCount,
      snapshotVersion: value.snapshotVersion,
    };
  }

  if (value.version === "croco.upgrade.report.v1" && isRecord(value.summary)) {
    return {
      findingCodes: Array.isArray(value.findings)
        ? value.findings.flatMap((finding) => (isRecord(finding) ? [finding.code] : []))
        : [],
      mode: value.mode,
      summary: value.summary,
      version: value.version,
    };
  }

  if (typeof value.ok === "boolean") {
    return {
      code: value.code,
      diagnosticCode: isRecord(value.diagnostic) ? value.diagnostic.code : null,
      ok: value.ok,
      preset: value.preset ?? null,
      projectName: value.projectName ?? null,
      recovery: value.recovery ?? null,
      unexpected: value.unexpected ?? null,
    };
  }

  return value;
}

function readDiagnosticCodes(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((diagnostic) => {
    if (isRecord(diagnostic)) {
      return [diagnostic.code];
    }

    return [];
  });
}

function createDoctorWorkspace(root: string): string {
  mkdirSync(join(root, "packages", "repository-core", "src"), { recursive: true });
  mkdirSync(join(root, "packages", "api", "src"), { recursive: true });
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "doctor-workspace", private: true }, null, 2)}\n`,
  );
  writeWorkspacePackage(root, "repository-core", "@croco/repository-core");
  writeFileSync(
    join(root, "packages", "repository-core", "src", "index.ts"),
    "export type Repository = {};\n",
  );
  writeWorkspacePackage(root, "api", "@croco/api");
  writeFileSync(
    join(root, "packages", "api", "src", "handler.ts"),
    [
      'import { lambdaPreset, TelemetryRuntime } from "@croco/telemetry-sdk-node";',
      "const telemetry = TelemetryRuntime.getInstance();",
      "const telemetryReady = telemetry.init(lambdaPreset({ serviceName: 'api' }));",
      "export const handler = async () => {",
      "  try {",
      "    await telemetryReady;",
      "    return { statusCode: 200 };",
      "  } finally {",
      "    await telemetry.forceFlush();",
      "  }",
      "};",
      "",
    ].join("\n"),
  );

  return root;
}

function writeWorkspacePackage(root: string, name: string, packageName: string): void {
  writeFileSync(
    join(root, "packages", name, "package.json"),
    `${JSON.stringify({ name: packageName, version: "0.0.0", private: true }, null, 2)}\n`,
  );
}

function writeControllerFixtures(root: string): {
  readonly validGlob: string;
  readonly weakGlob: string;
} {
  const controllerDir = join(root, "controllers");
  mkdirSync(controllerDir, { recursive: true });
  const validPath = join(controllerDir, "UsersController.ts");
  const weakPath = join(controllerDir, "WeakController.ts");

  writeFileSync(
    validPath,
    `${controllerFixturePrelude()}

@Controller("/users")
export class UsersController {
  @Get("/")
  listUsers(): readonly string[] {
    return [];
  }
}
`,
  );
  writeFileSync(
    weakPath,
    `${controllerFixturePrelude()}

@Controller("/weak")
export class WeakController {
  @Post("/")
  createWeak(@Body() _input: unknown): unknown {
    return {};
  }
}
`,
  );

  return {
    validGlob: validPath,
    weakGlob: weakPath,
  };
}

function controllerFixturePrelude(): string {
  return String.raw`
type MetadataPropertyKey = string | symbol | undefined;
type MetadataReflect = typeof Reflect & {
  defineMetadata(key: unknown, value: unknown, target: object, propertyKey?: string | symbol): void;
  getMetadata(key: unknown, target: object, propertyKey?: string | symbol): unknown;
  getOwnMetadata(key: unknown, target: object, propertyKey?: string | symbol): unknown;
};

const metadataStore = new WeakMap<object, Map<MetadataPropertyKey, Map<unknown, unknown>>>();
const metadataReflect = Reflect as MetadataReflect;
const REST_CONTROLLER_KEY = Symbol.for("croco:rest:controller");
const REST_ROUTES_KEY = Symbol.for("croco:rest:routes");
const REST_PARAMS_KEY = Symbol.for("croco:rest:params");

metadataReflect.defineMetadata = (key, value, target, propertyKey) => {
  const targetMetadata = metadataStore.get(target) ?? new Map<MetadataPropertyKey, Map<unknown, unknown>>();
  const propertyMetadata = targetMetadata.get(propertyKey) ?? new Map<unknown, unknown>();
  propertyMetadata.set(key, value);
  targetMetadata.set(propertyKey, propertyMetadata);
  metadataStore.set(target, targetMetadata);
};
metadataReflect.getMetadata = (key, target, propertyKey) =>
  metadataStore.get(target)?.get(propertyKey)?.get(key);
metadataReflect.getOwnMetadata = metadataReflect.getMetadata;

function Controller(path: string): ClassDecorator {
  return (target) => {
    metadataReflect.defineMetadata(REST_CONTROLLER_KEY, { path, target }, target);
  };
}

function Get(path = ""): MethodDecorator {
  return createRouteDecorator("GET", path);
}

function Post(path = ""): MethodDecorator {
  return createRouteDecorator("POST", path);
}

function Body(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) return;
    const paramsMap =
      (metadataReflect.getMetadata(REST_PARAMS_KEY, target.constructor) as
        | Map<string | symbol, Array<{ readonly index: number; readonly type: string }>>
        | undefined) ?? new Map();
    const methodParams = paramsMap.get(propertyKey) ?? [];
    paramsMap.set(propertyKey, [...methodParams, { index: parameterIndex, type: "body" }]);
    metadataReflect.defineMetadata(REST_PARAMS_KEY, paramsMap, target.constructor);
  };
}

function createRouteDecorator(method: string, path: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes =
      (metadataReflect.getMetadata(REST_ROUTES_KEY, ctor) as
        | Array<{ readonly method: string; readonly methodName: string | symbol; readonly path: string }>
        | undefined) ?? [];

    metadataReflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method, methodName: propertyKey, path }], ctor);
  };
}
`;
}

function createUpgradeWorkspace(root: string): string {
  const sourceDir = join(root, "apps", "api-server", "src");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    join(sourceDir, "problemMatchers.ts"),
    `export function matches(problem: { readonly code: string }): boolean {
  return 'transports-http/security-middleware-validation' === problem.code;
}
`,
  );

  return root;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
