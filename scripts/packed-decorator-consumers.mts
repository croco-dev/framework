#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = resolve(import.meta.dirname, "..");
const fixtureRoot = join(rootDir, "scripts", "fixtures", "packed-decorator-consumers");
const tscPath = join(rootDir, "node_modules", "typescript", "bin", "tsc");
const timeoutMs = 180_000;

const packedPackageNames = [
  "@croco/problems-core",
  "@croco/diagnostics-core",
  "@croco/framework-context",
  "@croco/protocols-core",
  "@croco/protocols-rest",
] as const;

const directInternalDependencyNames = [
  "@croco/framework-context",
  "@croco/protocols-rest",
] as const;

const expectedNegativeMarkers = [
  "return-type",
  "param-type",
  "query-type",
  "body-type",
  "method-mismatch",
  "path-key",
  "query-key",
] as const;

const consumers = [
  {
    module: "NodeNext",
    moduleKind: "ESM",
    name: "esm-positive",
    packageType: "module",
    positive: true,
  },
  {
    module: "NodeNext",
    moduleKind: "ESM",
    name: "esm-negative",
    packageType: "module",
    positive: false,
  },
  {
    module: "Node16",
    moduleKind: "CJS",
    name: "cjs-positive",
    packageType: "commonjs",
    positive: true,
  },
  {
    module: "Node16",
    moduleKind: "CJS",
    name: "cjs-negative",
    packageType: "commonjs",
    positive: false,
  },
] as const;

type CommandResult = {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

type PackageJson = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly version?: string;
  readonly [key: string]: unknown;
};

export function runPackedDecoratorConsumers(): void {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "croco-packed-decorator-consumers-"));

  try {
    verifyTypeScriptVersion();
    const tarballs = packPackages(join(temporaryRoot, "packs"));
    verifyPackedDeclarations(tarballs.get("@croco/protocols-rest"));
    verifyPackedDependencyClosure(tarballs);

    for (const consumer of consumers) {
      verifyConsumer(consumer, tarballs, temporaryRoot);
    }

    console.log("packed-decorator-consumers: declarations: strict decorator overloads preserved");
    console.log(
      "packed-decorator-consumers: install: 5 packed internal packages, no workspace paths",
    );
    console.log(
      "packed-decorator-consumers: ESM: positive build/runtime and 7 negative markers passed",
    );
    console.log(
      "packed-decorator-consumers: CJS: positive build/runtime and 7 negative markers passed",
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function verifyTypeScriptVersion(): void {
  if (!existsSync(tscPath)) {
    throw new Error(`compiler: TypeScript was not found at ${tscPath}; run pnpm install`);
  }

  const packageJson = readJson(join(rootDir, "node_modules", "typescript", "package.json"));
  if (packageJson.version !== "6.0.3") {
    throw new Error(
      `compiler: expected repository TypeScript 6.0.3, received ${packageJson.version}`,
    );
  }

  const result = runCommand(process.execPath, [tscPath, "--version"], rootDir);
  assertSucceeded("compiler: TypeScript version", result);
  if (result.stdout.trim() !== "Version 6.0.3") {
    throw new Error(`compiler: unexpected TypeScript output: ${result.stdout.trim()}`);
  }
}

function packPackages(packRoot: string): Map<string, string> {
  const tarballs = new Map<string, string>();
  mkdirSync(packRoot, { recursive: true });

  for (const packageName of packedPackageNames) {
    const packageDir = workspacePackageDir(packageName);
    const packageJson = readJson(join(packageDir, "package.json"));
    if (!existsSync(join(packageDir, "dist", "index.d.ts"))) {
      throw new Error(
        `pack: ${packageName} is not built; run its build before packed consumer verification`,
      );
    }

    const before = new Set(readdirSync(packRoot, { recursive: false }));
    const result = runCommand("pnpm", ["pack", "--pack-destination", packRoot], packageDir);
    assertSucceeded(`pack: ${packageName}`, result);
    const tarball = readdirSync(packRoot)
      .filter((entry) => entry.endsWith(".tgz") && !before.has(entry))
      .map((entry) => join(packRoot, entry))
      .find((path) => readPackedJson(path).name === packageJson.name);
    if (!tarball) throw new Error(`pack: ${packageName} did not produce a tarball`);
    tarballs.set(packageName, tarball);
  }

  return tarballs;
}

function verifyPackedDeclarations(tarballPath: string | undefined): void {
  if (!tarballPath) throw new Error("declarations: @croco/protocols-rest tarball is missing");
  const declaration = readPackedFile(tarballPath, "package/dist/index.d.ts");
  const requiredFragments = [
    "type ContractMethodDecorator<TContract extends RouteContractSpec> = {",
    "descriptor: TypedPropertyDescriptor<MethodAt<Target, Key>> & (AcceptsEveryContractReturn<MethodAt<Target, Key>, TContract> extends true ? unknown : never)",
    "type ContractParameterDecorator<Expected> = <Target extends object, Key extends PropertyKey, Index extends number>",
    "declare const Get: HttpMethodDecoratorFactory<HttpMethod.GET>;",
    "declare const Post: HttpMethodDecoratorFactory<HttpMethod.POST>;",
    "): ContractParameterDecorator<RouteHandlerPathParams<TContract>[Name]>;",
    "): ContractParameterDecorator<RouteHandlerQuery<TContract>[Name]>;",
    "declare function Body<TContract extends RouteContractWithBody>(contract: TContract): ContractParameterDecorator<RouteHandlerBody<TContract>>;",
  ];

  const missing = requiredFragments.filter((fragment) => !declaration.includes(fragment));
  if (missing.length > 0) {
    throw new Error(
      `declarations: packed public types widened or drifted; missing ${missing.join(" | ")}`,
    );
  }

  if (
    declaration.includes("declare const Get: MethodDecorator") ||
    declaration.includes("declare const Post: MethodDecorator")
  ) {
    throw new Error("declarations: packed HTTP contract decorators widened to MethodDecorator");
  }
}

function verifyPackedDependencyClosure(tarballs: ReadonlyMap<string, string>): void {
  for (const [packageName, tarballPath] of tarballs) {
    const manifest = readPackedJson(tarballPath);
    const dependencies = manifest.dependencies ?? {};
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (version.includes("workspace:") || version.includes(rootDir)) {
        throw new Error(
          `install: ${packageName} retained repository-local dependency ${dependencyName}@${version}`,
        );
      }
      if (dependencyName.startsWith("@croco/") && !tarballs.has(dependencyName)) {
        throw new Error(
          `install: ${packageName} requires unpacked internal dependency ${dependencyName}`,
        );
      }
    }
  }
}

function verifyConsumer(
  consumer: (typeof consumers)[number],
  tarballs: ReadonlyMap<string, string>,
  temporaryRoot: string,
): void {
  const consumerRoot = join(temporaryRoot, consumer.name);
  mkdirSync(consumerRoot, { recursive: true });
  cpSync(
    join(fixtureRoot, consumer.positive ? "positive.ts" : "negative.ts"),
    join(consumerRoot, "consumer.ts"),
  );
  const dependencies = Object.fromEntries([
    ...directInternalDependencyNames.map((packageName) => [
      packageName,
      `file:${requireTarball(tarballs, packageName)}`,
    ]),
    ["reflect-metadata", "0.2.2"],
    ["zod", "3.25.76"],
  ]);
  const internalOverrides = Object.fromEntries(
    [...tarballs.entries()].map(([packageName, tarballPath]) => [
      packageName,
      `file:${tarballPath}`,
    ]),
  );
  writeJson(join(consumerRoot, "package.json"), {
    dependencies,
    name: `packed-decorator-consumer-${consumer.name}`,
    private: true,
    type: consumer.packageType,
  });
  writeJson(join(consumerRoot, "tsconfig.json"), {
    compilerOptions: {
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
      lib: ["DOM", "ES2022", "ESNext.Disposable"],
      module: consumer.module,
      moduleResolution: consumer.module,
      ...(consumer.positive ? { outDir: "dist" } : { noEmit: true }),
      skipLibCheck: false,
      strict: true,
      target: "ES2022",
    },
    files: ["consumer.ts"],
  });
  writeFileSync(
    join(consumerRoot, "pnpm-workspace.yaml"),
    `packages: []\noverrides:\n${Object.entries(internalOverrides)
      .map(
        ([packageName, tarballPath]) =>
          `  ${JSON.stringify(packageName)}: ${JSON.stringify(tarballPath)}`,
      )
      .join("\n")}\n`,
  );

  const install = runCommand(
    "pnpm",
    ["install", "--offline", "--ignore-scripts", "--config.auto-install-peers=false"],
    consumerRoot,
  );
  assertSucceeded(
    `${consumer.moduleKind} ${consumer.positive ? "positive" : "negative"} install`,
    install,
  );
  verifyInstalledPackagesAreIsolated(consumerRoot, tarballs);

  const compile = runCommand(
    process.execPath,
    [tscPath, "--pretty", "false", "-p", "tsconfig.json"],
    consumerRoot,
  );
  if (consumer.positive) {
    assertSucceeded(`${consumer.moduleKind} positive build`, compile);
    assertSucceeded(
      `${consumer.moduleKind} positive runtime`,
      runCommand(process.execPath, [join("dist", "consumer.js")], consumerRoot),
    );
    return;
  }

  verifyExpectedDiagnostics(consumer.moduleKind, compile, join(consumerRoot, "consumer.ts"));
}

function verifyInstalledPackagesAreIsolated(
  consumerRoot: string,
  tarballs: ReadonlyMap<string, string>,
): void {
  const pending = directInternalDependencyNames.map((packageName) => ({
    installedRoot: realpathSync(join(consumerRoot, "node_modules", ...packageName.split("/"))),
    packageName,
  }));
  const installedPackages = new Map<string, string>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || installedPackages.has(current.packageName)) continue;
    installedPackages.set(current.packageName, current.installedRoot);

    const manifest = readJson(join(current.installedRoot, "package.json"));
    for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
      if (!dependencyName.startsWith("@croco/") || installedPackages.has(dependencyName)) continue;
      const dependencyRoot = realpathSync(
        join(current.installedRoot, "..", dependencyName.slice("@croco/".length)),
      );
      pending.push({ installedRoot: dependencyRoot, packageName: dependencyName });
    }
  }

  for (const packageName of tarballs.keys()) {
    const installedRoot = installedPackages.get(packageName);
    if (!installedRoot) {
      throw new Error(
        `install: ${packageName} was not installed through the declared dependency closure`,
      );
    }
    if (installedRoot.startsWith(`${rootDir}/`)) {
      throw new Error(`install: ${packageName} resolved into the repository at ${installedRoot}`);
    }
    const manifestText = readFileSync(join(installedRoot, "package.json"), "utf8");
    if (manifestText.includes("workspace:") || manifestText.includes(rootDir)) {
      throw new Error(
        `install: ${packageName} retained a workspace or repository-local dependency`,
      );
    }
  }
}

function verifyExpectedDiagnostics(
  moduleKind: string,
  result: CommandResult,
  sourcePath: string,
): void {
  if (result.status === 0) throw new Error(`${moduleKind} negative compile unexpectedly succeeded`);
  const output = `${result.stdout}${result.stderr}`;
  const sourceLines = readFileSync(sourcePath, "utf8").split("\n");
  const expectedMarkers = new Map<number, string>();
  const declaredMarkerCounts = new Map<string, number>();
  sourceLines.forEach((line, index) => {
    const marker = line.match(/EXPECT_ERROR:([a-z-]+)/)?.[1];
    if (!marker) return;
    declaredMarkerCounts.set(marker, (declaredMarkerCounts.get(marker) ?? 0) + 1);
    const diagnosticLine = sourceLines.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index && candidate.trim() !== "" && !candidate.trim().startsWith("//"),
    );
    if (diagnosticLine < 0) throw new Error(`${moduleKind} marker ${marker} has no following code`);
    expectedMarkers.set(diagnosticLine + 1, marker);
  });

  const requiredMarkers = new Set<string>(expectedNegativeMarkers);
  const unexpectedMarkers = [...declaredMarkerCounts.keys()].filter(
    (marker) => !requiredMarkers.has(marker),
  );
  const missingDeclarations = expectedNegativeMarkers.filter(
    (marker) => !declaredMarkerCounts.has(marker),
  );
  const duplicateDeclarations = [...declaredMarkerCounts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([marker, count]) => `${marker} (${count})`);
  if (
    unexpectedMarkers.length > 0 ||
    missingDeclarations.length > 0 ||
    duplicateDeclarations.length > 0
  ) {
    throw new Error(
      `${moduleKind} negative fixture markers drifted; missing=${missingDeclarations.join(",") || "none"}; unexpected=${unexpectedMarkers.join(",") || "none"}; duplicates=${duplicateDeclarations.join(",") || "none"}`,
    );
  }

  const diagnostics = [...output.matchAll(/^(?:(.+?)\((\d+),(\d+)\): )?error TS(\d+):/gm)];
  const diagnosticHeaderCount = [...output.matchAll(/error TS\d+:/g)].length;
  if (diagnostics.length !== diagnosticHeaderCount) {
    throw new Error(
      `${moduleKind} negative compile contained an unparsed TypeScript diagnostic\n${output}`,
    );
  }
  if (diagnostics.length === 0) {
    throw new Error(
      `${moduleKind} negative compile failed without TypeScript fixture diagnostics\n${output}`,
    );
  }

  const observedMarkerCounts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    const file = diagnostic[1];
    const line = Number(diagnostic[2]);
    const marker = expectedMarkers.get(line);
    if (file !== "consumer.ts" || !marker) {
      throw new Error(
        `${moduleKind} negative compile had unrelated TS${diagnostic[4]} at ${file ?? "global"}:${diagnostic[2] ?? "?"}:${diagnostic[3] ?? "?"}\n${output}`,
      );
    }
    observedMarkerCounts.set(marker, (observedMarkerCounts.get(marker) ?? 0) + 1);
  }

  const missingMarkers = expectedNegativeMarkers.filter(
    (marker) => !observedMarkerCounts.has(marker),
  );
  const duplicateMarkers = [...observedMarkerCounts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([marker, count]) => `${marker} (${count})`);
  if (missingMarkers.length > 0 || duplicateMarkers.length > 0) {
    throw new Error(
      `${moduleKind} negative compile diagnostics were not one-to-one; missing=${missingMarkers.join(",") || "none"}; duplicates=${duplicateMarkers.join(",") || "none"}\n${output}`,
    );
  }
}

function requireTarball(tarballs: ReadonlyMap<string, string>, packageName: string): string {
  const tarball = tarballs.get(packageName);
  if (!tarball) throw new Error(`pack: ${packageName} tarball is missing`);
  return tarball;
}

function workspacePackageDir(packageName: string): string {
  return join(rootDir, "packages", packageName.slice("@croco/".length));
}

function readPackedJson(tarballPath: string): PackageJson {
  return JSON.parse(readPackedFile(tarballPath, "package/package.json")) as PackageJson;
}

function readPackedFile(tarballPath: string, entryPath: string): string {
  const result = runCommand("tar", ["-xOf", tarballPath, entryPath], rootDir);
  assertSucceeded(`pack: extract ${entryPath}`, result);
  return result.stdout;
}

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runCommand(command: string, arguments_: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.error) throw result.error;
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function assertSucceeded(label: string, result: CommandResult): void {
  if (result.status !== 0) {
    throw new Error(`${label}: failed\n${result.stdout}${result.stderr}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runPackedDecoratorConsumers();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`packed-decorator-consumers: failed: ${message}`);
    process.exitCode = 1;
  }
}
