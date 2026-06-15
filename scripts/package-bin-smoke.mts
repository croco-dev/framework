import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPackageJsonFiles } from "./package-manifest-contracts.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultRootDir = resolve(__dirname, "..");
const mode = parseArgs(process.argv.slice(2));
const spawnTimeoutMs = 180_000;

type PackageJson = {
  readonly bin?: unknown;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly name?: string;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly peerDependenciesMeta?: Record<string, { readonly optional?: boolean }>;
  readonly private?: boolean;
  readonly publishConfig?: Record<string, unknown>;
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

type BinTarget = {
  readonly commandName: string;
  readonly target: string;
};

type SmokeCommand = {
  readonly args: readonly string[];
  readonly expectedOutput: string;
};

type PackageSmokeResult = {
  readonly binCount: number;
  readonly packageName: string;
};

type RunResult = {
  readonly stderr: string;
  readonly stdout: string;
};

main();

function main(): void {
  const rootDir = mode.rootDir;
  const packageJsonFiles = findPackageJsonFiles(join(rootDir, "packages"));
  const packageIndex = packageIndexFor(packageJsonFiles);
  const binPackages = Array.from(packageIndex.values()).filter((packageInfo) =>
    hasBinTargets(packageInfo.publishManifest),
  );
  const packRoot = mkdtempSync(join(tmpdir(), "croco-package-bin-pack-"));
  const consumerRoot = mkdtempSync(join(tmpdir(), "croco-package-bin-consumer-"));

  try {
    const packedPackages = new Map<string, PackedPackageInfo>();
    const packageResults: PackageSmokeResult[] = [];
    let checkedBinCount = 0;

    for (const packageInfo of binPackages) {
      const graph = collectInternalRuntimeGraph(packageInfo, packageIndex);
      for (const graphPackage of graph) {
        packPackage(graphPackage, packRoot, rootDir, packedPackages);
      }

      const packedPackage = packedPackages.get(packageInfo.packageName);
      if (!packedPackage) {
        throw new Error(`${packageInfo.packageName}: packed tarball was not created`);
      }

      const binTargets = binTargetsFor(packedPackage);
      const graphTarballs = graph.map((graphPackage) => {
        const packedGraphPackage = packedPackages.get(graphPackage.packageName);
        if (!packedGraphPackage) {
          throw new Error(`${graphPackage.packageName}: packed tarball was not created`);
        }
        return packedGraphPackage;
      });

      runPackageBinSmoke(consumerRoot, packedPackage, graphTarballs, binTargets);
      packageResults.push({
        binCount: binTargets.length,
        packageName: packageInfo.packageName,
      });
      checkedBinCount += binTargets.length;
    }

    printCoverageSummary(packageResults, checkedBinCount);
  } finally {
    rmSync(packRoot, { force: true, recursive: true });
    rmSync(consumerRoot, { force: true, recursive: true });
  }
}

function parseArgs(args: readonly string[]): { readonly rootDir: string } {
  let rootDir = defaultRootDir;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { rootDir };
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

function hasBinTargets(pkg: PackageJson): boolean {
  return binTargetsFromManifest(pkg, "package").length > 0;
}

function collectInternalRuntimeGraph(
  rootPackage: PackageInfo,
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

  visit(rootPackage);

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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

function optionalPeerDependencyNames(value: unknown): ReadonlySet<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Set();
  }

  return new Set(
    Object.entries(value)
      .filter(([, meta]) =>
        Boolean(meta && typeof meta === "object" && "optional" in meta && meta.optional === true),
      )
      .map(([dependencyName]) => dependencyName)
      .sort(),
  );
}

function packPackage(
  packageInfo: PackageInfo,
  packRoot: string,
  rootDir: string,
  packedPackages: Map<string, PackedPackageInfo>,
): void {
  if (packedPackages.has(packageInfo.packageName)) {
    return;
  }

  run("pnpm", ["pack", "--pack-destination", packRoot], packageInfo.packageDir, {
    label: `${packageInfo.packageName}: pnpm pack`,
  });

  const tarballPath = findTarball(packRoot, packageInfo.packageName);
  const packedManifest = readPackedJson(tarballPath, "package/package.json", rootDir);
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
  return `${packageName.replace(/^@/, "").replaceAll("/", "-")}-`;
}

function readPackedJson(tarballPath: string, entryPath: string, rootDir: string): PackageJson {
  return JSON.parse(readPackedFile(tarballPath, entryPath, rootDir)) as PackageJson;
}

function readPackedFile(tarballPath: string, entryPath: string, rootDir: string): string {
  return run("tar", ["-xOf", tarballPath, entryPath], rootDir, {
    label: `${tarballPath}: read ${entryPath}`,
  }).stdout;
}

function binTargetsFor(packageInfo: PackedPackageInfo): BinTarget[] {
  const binTargets = binTargetsFromManifest(packageInfo.packedManifest, packageInfo.packageName);

  if (binTargets.length === 0) {
    throw new Error(`${packageInfo.packageName}: packed manifest does not include bin entries`);
  }

  for (const binTarget of binTargets) {
    if (!binTarget.target.startsWith("./")) {
      throw new Error(
        `${packageInfo.packageName}: bin ${binTarget.commandName} must point at a relative package file path`,
      );
    }

    const packedCli = readPackedFile(
      packageInfo.tarballPath,
      `package/${binTarget.target.slice(2)}`,
      packageInfo.packageDir,
    );
    const firstLine = packedCli.split(/\r?\n/, 1)[0];
    if (firstLine !== "#!/usr/bin/env node") {
      throw new Error(
        `${packageInfo.packageName}: bin ${binTarget.commandName} is missing the Node shebang in ${binTarget.target}`,
      );
    }
  }

  return binTargets;
}

function binTargetsFromManifest(pkg: PackageJson, packageName: string): BinTarget[] {
  const bin = pkg.bin;

  if (typeof bin === "string") {
    return [{ commandName: defaultBinCommandName(packageName), target: bin }];
  }

  if (!bin || typeof bin !== "object" || Array.isArray(bin)) {
    return [];
  }

  return Object.entries(bin)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([commandName, target]) => ({ commandName, target }))
    .sort((left, right) => left.commandName.localeCompare(right.commandName));
}

function defaultBinCommandName(packageName: string): string {
  if (packageName.startsWith("@")) {
    return packageName.split("/")[1] ?? packageName;
  }

  return packageName;
}

function runPackageBinSmoke(
  consumerRoot: string,
  packageInfo: PackedPackageInfo,
  graphPackages: readonly PackedPackageInfo[],
  binTargets: readonly BinTarget[],
): void {
  const packageSmokeRoot = join(consumerRoot, safeDirectoryName(packageInfo.packageName));
  mkdirSync(packageSmokeRoot, { recursive: true });
  writeConsumerPackageJson(packageSmokeRoot, graphPackages);

  const internalPeerTarballs = internalPeerPackagesFor(graphPackages).map(
    (packageInfo) => packageInfo.tarballPath,
  );

  run(
    "pnpm",
    ["add", "--prod", packageInfo.tarballPath, ...internalPeerTarballs, "--ignore-scripts"],
    packageSmokeRoot,
    {
      label: `${packageInfo.packageName}: install packed tarball`,
    },
  );

  for (const binTarget of binTargets) {
    const smokeCommand = smokeCommandFor(binTarget, packageInfo);
    const result = run(
      "pnpm",
      ["exec", binTarget.commandName, ...smokeCommand.args],
      packageSmokeRoot,
      {
        label: `${packageInfo.packageName}: pnpm exec ${binTarget.commandName} ${smokeCommand.args.join(" ")}`,
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    if (!output.includes(smokeCommand.expectedOutput)) {
      throw new Error(
        [
          `${packageInfo.packageName}: ${binTarget.commandName} ${smokeCommand.args.join(" ")} did not print expected output`,
          `Expected to include: ${smokeCommand.expectedOutput}`,
          result.stdout.trim(),
          result.stderr.trim(),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    console.log(
      `package-bin-smoke: ${packageInfo.packageName} ${binTarget.commandName} ${smokeCommand.args.join(" ")}`,
    );
  }
}

function writeConsumerPackageJson(
  consumerRoot: string,
  graphPackages: readonly PackedPackageInfo[],
): void {
  const overrides = Object.fromEntries(
    graphPackages.map((packageInfo) => [
      packageInfo.packageName,
      `file:${packageInfo.tarballPath}`,
    ]),
  );

  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "croco-package-bin-smoke-consumer",
        private: true,
        pnpm: {
          overrides,
        },
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
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

function smokeCommandFor(binTarget: BinTarget, packageInfo: PackedPackageInfo): SmokeCommand {
  switch (binTarget.commandName) {
    case "create-croco-app":
      return { args: ["--version"], expectedOutput: packageVersionFor(packageInfo) };
    case "croco":
      return { args: ["--help"], expectedOutput: "Croco framework CLI" };
    case "croco-openapi-spec":
      return { args: ["--help"], expectedOutput: "Usage: croco-openapi-spec" };
    case "croco-rpc-codegen":
      return { args: ["--help"], expectedOutput: "Usage: croco-rpc-codegen" };
    case "migrate":
      return { args: ["--help"], expectedOutput: "Drizzle migration runner" };
    default:
      return { args: ["--help"], expectedOutput: binTarget.commandName };
  }
}

function packageVersionFor(packageInfo: PackedPackageInfo): string {
  if (
    typeof packageInfo.packedManifest.version === "string" &&
    packageInfo.packedManifest.version.length > 0
  ) {
    return packageInfo.packedManifest.version;
  }

  throw new Error(
    `${packageInfo.packageName}: packed manifest version is required for version smoke`,
  );
}

function safeDirectoryName(packageName: string): string {
  return packageName.replaceAll("/", "__").replaceAll("@", "");
}

function printCoverageSummary(
  packageResults: readonly PackageSmokeResult[],
  checkedBinCount: number,
): void {
  console.log("");
  console.log("package-bin-smoke: checked packages");
  for (const result of packageResults) {
    console.log(`- ${result.packageName}: bins ${result.binCount}`);
  }

  console.log("");
  console.log(
    `package-bin-smoke: summary checkedPackages=${packageResults.length} checkedBins=${checkedBinCount}`,
  );
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  options: { readonly label: string },
): RunResult {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${options.label}: ${command} ${args.map((arg) => relativeArg(cwd, arg)).join(" ")} failed`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function relativeArg(cwd: string, arg: string): string {
  if (arg.startsWith(cwd)) {
    return relative(cwd, arg);
  }

  return arg;
}
