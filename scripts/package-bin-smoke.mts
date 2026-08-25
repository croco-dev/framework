import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { effectivePublishManifest, findPackageJsonFiles } from "./package-manifest-contracts.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultRootDir = resolve(__dirname, "..");
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
  readonly allowedChildPackageFile?: SmokePackageFile;
  readonly args: readonly string[];
  readonly expectedExitCode?: number;
  readonly fixtureFiles?: readonly SmokeFixtureFile[];
  readonly packageFixtureFiles?: readonly SmokePackageFixtureFile[];
  readonly expectedPaths?: readonly string[];
  readonly expectedOutput: string;
  readonly unexpectedOutputs?: readonly string[];
};

type SmokeFixtureFile = {
  readonly contents: string;
  readonly path: string;
};

type SmokePackageFile = {
  readonly packageName: string;
  readonly path: string;
};

type SmokePackageFixtureFile = SmokePackageFile & {
  readonly contents: string;
};

type PackageSmokeResult = {
  readonly binCount: number;
  readonly packageName: string;
};

type InstalledPackageFileReplacement = {
  readonly installedPath: string;
  readonly originalPath: string;
};

type RunResult = {
  readonly stderr: string;
  readonly stdout: string;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}

function main(): void {
  const rootDir = parseArgs(process.argv.slice(2)).rootDir;
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

      runPackageBinSmoke(rootDir, consumerRoot, packedPackage, graphTarballs, binTargets);
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
      publishManifest: effectivePublishManifest(sourceManifest) as PackageJson,
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
  rootDir: string,
  consumerRoot: string,
  packageInfo: PackedPackageInfo,
  graphPackages: readonly PackedPackageInfo[],
  binTargets: readonly BinTarget[],
): void {
  const packageSmokeRoot = join(consumerRoot, safeDirectoryName(packageInfo.packageName));
  mkdirSync(packageSmokeRoot, { recursive: true });
  writeConsumerPackageJson(packageSmokeRoot, graphPackages);
  copyWorkspaceLockfile(rootDir, packageSmokeRoot);

  const internalPeerTarballs = internalPeerPackagesFor(graphPackages).map(
    (packageInfo) => packageInfo.tarballPath,
  );

  run(
    "pnpm",
    [
      "add",
      "--prod",
      "--virtual-store-dir",
      "node_modules/.pnpm",
      packageInfo.tarballPath,
      ...internalPeerTarballs,
      "--ignore-scripts",
      "--prefer-offline",
    ],
    packageSmokeRoot,
    {
      label: `${packageInfo.packageName}: install packed tarball`,
    },
  );

  const networkGuardPath = writeNetworkGuard(packageSmokeRoot);

  for (const binTarget of binTargets) {
    for (const smokeCommand of smokeCommandsFor(binTarget, packageInfo)) {
      writeSmokeFixtureFiles(packageSmokeRoot, smokeCommand.fixtureFiles ?? []);
      const replacements = writeSmokePackageFixtureFiles(
        packageSmokeRoot,
        smokeCommand.packageFixtureFiles ?? [],
      );
      try {
        const allowedChildPaths = smokeCommand.allowedChildPackageFile
          ? installedPackageFilePaths(packageSmokeRoot, smokeCommand.allowedChildPackageFile)
          : [];
        const result = run(
          installedBinPath(packageSmokeRoot, binTarget.commandName),
          smokeCommand.args,
          packageSmokeRoot,
          {
            expectedExitCode: smokeCommand.expectedExitCode,
            env: smokeCommandEnvironment(packageSmokeRoot, networkGuardPath, allowedChildPaths),
            label: `${packageInfo.packageName}: ${binTarget.commandName} ${smokeCommand.args.join(" ")}`,
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

        for (const unexpectedOutput of smokeCommand.unexpectedOutputs ?? []) {
          if (output.includes(unexpectedOutput)) {
            throw new Error(
              `${packageInfo.packageName}: ${binTarget.commandName} ${smokeCommand.args.join(" ")} unexpectedly printed ${unexpectedOutput}`,
            );
          }
        }

        for (const expectedPath of smokeCommand.expectedPaths ?? []) {
          if (!existsSync(join(packageSmokeRoot, expectedPath))) {
            throw new Error(
              `${packageInfo.packageName}: ${binTarget.commandName} ${smokeCommand.args.join(" ")} did not create ${expectedPath}`,
            );
          }
        }

        console.log(
          `package-bin-smoke: ${packageInfo.packageName} ${binTarget.commandName} ${smokeCommand.args.join(" ")}`,
        );
      } finally {
        for (const replacement of [...replacements].reverse()) {
          restoreInstalledPackageFile(replacement);
        }
      }
    }
  }
}

function copyWorkspaceLockfile(rootDir: string, consumerRoot: string): void {
  const lockfilePath = join(rootDir, "pnpm-lock.yaml");
  if (existsSync(lockfilePath)) {
    copyFileSync(lockfilePath, join(consumerRoot, "pnpm-lock.yaml"));
  }
}

function installedBinPath(packageSmokeRoot: string, commandName: string): string {
  return join(
    packageSmokeRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${commandName}.CMD` : commandName,
  );
}

function writeSmokeFixtureFiles(
  packageSmokeRoot: string,
  fixtureFiles: readonly SmokeFixtureFile[],
): void {
  for (const fixtureFile of fixtureFiles) {
    const fixturePath = join(packageSmokeRoot, fixtureFile.path);
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, fixtureFile.contents);
  }
}

function writeSmokePackageFixtureFiles(
  packageSmokeRoot: string,
  fixtureFiles: readonly SmokePackageFixtureFile[],
): InstalledPackageFileReplacement[] {
  const replacements: InstalledPackageFileReplacement[] = [];
  try {
    for (const fixtureFile of fixtureFiles) {
      const installedPaths = installedPackageFilePaths(packageSmokeRoot, fixtureFile);
      if (installedPaths.length === 0) {
        throw new Error(
          `${fixtureFile.packageName}: installed package file ${fixtureFile.path} was not found`,
        );
      }
      for (const installedPath of installedPaths) {
        replacements.push(
          replaceInstalledPackageFile(packageSmokeRoot, installedPath, fixtureFile.contents),
        );
      }
    }
    return replacements;
  } catch (error) {
    for (const replacement of [...replacements].reverse()) {
      restoreInstalledPackageFile(replacement);
    }
    throw error;
  }
}

export function replaceInstalledPackageFile(
  packageSmokeRoot: string,
  filePath: string,
  contents: string,
): InstalledPackageFileReplacement {
  const smokeLocalPath = smokeLocalRealpath(packageSmokeRoot, filePath);
  const originalPath = `${smokeLocalPath}.croco-bin-smoke-original`;
  renameSync(smokeLocalPath, originalPath);
  try {
    writeFileSync(smokeLocalPath, contents);
  } catch (error) {
    rmSync(smokeLocalPath, { force: true });
    renameSync(originalPath, smokeLocalPath);
    throw error;
  }
  return { installedPath: smokeLocalPath, originalPath };
}

export function restoreInstalledPackageFile(replacement: InstalledPackageFileReplacement): void {
  if (!existsSync(replacement.originalPath)) {
    throw new Error(`package-bin-smoke/original-fixture-missing: ${replacement.originalPath}`);
  }
  rmSync(replacement.installedPath, { force: true });
  renameSync(replacement.originalPath, replacement.installedPath);
}

function installedPackageFilePaths(
  packageSmokeRoot: string,
  packageFile: SmokePackageFile,
): string[] {
  const nodeModulesPath = join(packageSmokeRoot, "node_modules");
  const packageSegments = packageFile.packageName.split("/");
  const packageRoots = [join(nodeModulesPath, ...packageSegments)];
  const pnpmPath = join(nodeModulesPath, ".pnpm");

  if (existsSync(pnpmPath)) {
    for (const entry of readdirSync(pnpmPath)) {
      packageRoots.push(join(pnpmPath, entry, "node_modules", ...packageSegments));
    }
  }

  return Array.from(
    new Set(
      packageRoots
        .map((packageRoot) => join(packageRoot, packageFile.path))
        .filter((filePath) => existsSync(filePath))
        .map((filePath) => smokeLocalRealpath(packageSmokeRoot, filePath)),
    ),
  ).sort();
}

function smokeLocalRealpath(packageSmokeRoot: string, filePath: string): string {
  const resolvedRoot = realpathSync(packageSmokeRoot);
  const resolvedPath = realpathSync(filePath);
  const pathFromRoot = relative(resolvedRoot, resolvedPath);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new Error(`package-bin-smoke/fixture-path-escaped: ${resolvedPath}`);
  }
  return resolvedPath;
}

function writeNetworkGuard(packageSmokeRoot: string): string {
  const guardPath = join(packageSmokeRoot, ".croco-bin-smoke-network-guard.mjs");
  writeFileSync(
    guardPath,
    `import childProcess from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import { realpathSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";
import workerThreads from "node:worker_threads";

const diagnostic = "package-bin-smoke/network-disabled";
const originalSpawn = childProcess.spawn.bind(childProcess);
const disabled = (operation) => function disabledOperation() {
  throw new Error(diagnostic + ": " + operation);
};
const replace = (target, name, operation) => {
  Object.defineProperty(target, name, {
    configurable: true,
    value: disabled(operation),
    writable: true,
  });
};

replace(globalThis, "fetch", "fetch");
replace(http, "get", "http.get");
replace(http, "request", "http.request");
replace(http2, "connect", "http2.connect");
replace(https, "get", "https.get");
replace(https, "request", "https.request");
replace(net, "connect", "net.connect");
replace(net, "createConnection", "net.createConnection");
replace(net.Socket.prototype, "connect", "net.Socket.connect");
replace(tls, "connect", "tls.connect");
replace(dgram, "createSocket", "dgram.createSocket");
replace(dgram, "Socket", "dgram.Socket");

const dnsOperationNames = [
  "lookup",
  "lookupService",
  "resolve",
  "resolve4",
  "resolve6",
  "resolveAny",
  "resolveCaa",
  "resolveCname",
  "resolveMx",
  "resolveNaptr",
  "resolveNs",
  "resolvePtr",
  "resolveSoa",
  "resolveSrv",
  "resolveTxt",
  "reverse",
];
const dnsTargets = [
  { label: "dns", target: dns },
  { label: "dns.promises", target: dns.promises },
  { label: "dns.Resolver", target: dns.Resolver.prototype },
  { label: "dns.promises.Resolver", target: dns.promises.Resolver.prototype },
];

for (const { label, target } of dnsTargets) {
  for (const name of dnsOperationNames) {
    if (typeof target[name] === "function") {
      replace(target, name, label + "." + name);
    }
  }
}

for (const name of ["exec", "execFile", "fork", "execSync", "execFileSync", "spawnSync"]) {
  replace(childProcess, name, "child_process." + name);
}
Object.defineProperty(childProcess, "spawn", {
  configurable: true,
  value(command, args, options) {
    const allowedChildren = new Set(JSON.parse(process.env.CROCO_BIN_SMOKE_ALLOWED_CHILDREN ?? "[]"));
    if (command === process.execPath && Array.isArray(args) && typeof args[0] === "string") {
      try {
        if (allowedChildren.has(realpathSync(args[0]))) {
          return originalSpawn(command, args, options);
        }
      } catch {
        // The standard network-disabled diagnostic below owns rejected child processes.
      }
    }
    throw new Error(diagnostic + ": child_process.spawn");
  },
  writable: true,
});
replace(workerThreads, "Worker", "worker_threads.Worker");

syncBuiltinESMExports();
`,
  );
  return guardPath;
}

function smokeCommandEnvironment(
  packageSmokeRoot: string,
  networkGuardPath: string,
  allowedChildPaths: readonly string[],
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    CI: "1",
    DATABASE_URL: "",
    HOME: packageSmokeRoot,
    NODE_OPTIONS: `--import=${pathToFileURL(networkGuardPath).href}`,
    NO_UPDATE_NOTIFIER: "1",
    USERPROFILE: packageSmokeRoot,
    npm_config_offline: "true",
  };

  if (allowedChildPaths.length > 0) {
    environment.CROCO_BIN_SMOKE_ALLOWED_CHILDREN = JSON.stringify(allowedChildPaths);
  }

  for (const name of [
    "COMSPEC",
    "LANG",
    "LC_ALL",
    "PATH",
    "Path",
    "PATHEXT",
    "SYSTEMROOT",
    "SystemRoot",
    "TEMP",
    "TMP",
    "TMPDIR",
  ]) {
    const value = process.env[name];
    if (value !== undefined) {
      environment[name] = value;
    }
  }

  return environment;
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

function smokeCommandsFor(
  binTarget: BinTarget,
  packageInfo: PackedPackageInfo,
): readonly SmokeCommand[] {
  switch (binTarget.commandName) {
    case "create-croco-app":
      return [
        {
          args: [
            "bin-smoke-app",
            "--preset",
            "blank",
            "--scope",
            "@croco-smoke",
            "--no-install",
            "--no-git",
            "--json",
          ],
          expectedPaths: ["bin-smoke-app/package.json"],
          expectedOutput: '"code": "create-croco-app/project-created"',
        },
      ];
    case "croco": {
      const migrationRunnerInstalled =
        typeof packageInfo.sourceManifest.dependencies?.["@croco/migration-runner"] === "string";
      return [
        {
          args: ["doctor", "--json"],
          expectedOutput: '"version": "croco.doctor.v1"',
        },
        {
          args: ["migrate", "up", "--help"],
          expectedOutput: "--cwd=<path>",
          unexpectedOutputs: ["--overwrite"],
        },
        {
          ...(migrationRunnerInstalled
            ? {
                allowedChildPackageFile: {
                  packageName: "@croco/migration-runner",
                  path: "dist/cli.js",
                },
                packageFixtureFiles: migrationRunnerPackageFixtureFiles(),
              }
            : {}),
          args: [
            "--cwd",
            "bin-smoke/migration-workspace",
            "--dryRun",
            "migrate",
            "up",
            "-d",
            "-migrations",
            "--target",
            "-1",
            "--connection",
            "postgres://db",
            "--dry-run",
          ],
          fixtureFiles: migrationWrapperFixtureFiles(),
          expectedOutput: "croco-migrate-wrapper-contract-ok",
        },
        ...(migrationRunnerInstalled
          ? [
              {
                allowedChildPackageFile: {
                  packageName: "@croco/migration-runner",
                  path: "dist/cli.js",
                },
                args: ["migrate", "status"],
                expectedExitCode: 1,
                expectedOutput: "migration-runner/database-url-required",
              },
            ]
          : []),
        {
          args: ["--overwrite", "migrate", "up"],
          expectedExitCode: 1,
          expectedOutput: "Unknown option: --overwrite",
        },
        {
          args: ["--cwd", "migrate", "--bogus", "up"],
          expectedExitCode: 1,
          expectedOutput: "Unknown option: --bogus",
        },
      ];
    }
    case "croco-openapi-spec":
      return [
        {
          args: [
            "--controllers",
            "bin-smoke/SmokeController.ts",
            "--check",
            "--compatibility-problems",
            "--compatibility-schemas",
          ],
          fixtureFiles: functionalControllerFixtureFiles(),
          expectedOutput: "Contract graph check passed for 1 route(s) across 1 controller(s).",
        },
      ];
    case "croco-rpc-codegen":
      return [
        {
          args: [
            "--controllers",
            "bin-smoke/SmokeController.ts",
            "--check",
            "--compatibility-problems",
            "--compatibility-schemas",
          ],
          fixtureFiles: functionalControllerFixtureFiles(),
          expectedOutput: "Contract graph check passed for 1 route(s) across 1 controller(s).",
        },
      ];
    case "migrate":
      return [
        {
          args: ["status"],
          expectedExitCode: 1,
          expectedOutput: "migration-runner/database-url-required",
        },
        {
          args: ["down", "--count", "abc"],
          expectedExitCode: 1,
          expectedOutput: "migration-runner/invalid-count",
        },
      ];
    default:
      throw new Error(
        `${packageInfo.packageName}: bin ${binTarget.commandName} is missing a functional smoke command contract`,
      );
  }
}

function migrationWrapperFixtureFiles(): readonly SmokeFixtureFile[] {
  return [
    {
      path: "bin-smoke/migration-workspace/.keep",
      contents: "",
    },
  ];
}

function migrationRunnerPackageFixtureFiles(): readonly SmokePackageFixtureFile[] {
  return [
    {
      packageName: "@croco/migration-runner",
      path: "dist/cli.js",
      contents: `#!/usr/bin/env node
const expectedArgs = [
  "up",
  "--dir",
  "-migrations",
  "--target",
  "-1",
  "--connection",
  "postgres://db",
  "--dry-run",
];
const actualArgs = process.argv.slice(2);
const normalizedCwd = process.cwd().replaceAll("\\\\", "/");

if (JSON.stringify(actualArgs) !== JSON.stringify(expectedArgs)) {
  console.error(\`unexpected child argv: \${JSON.stringify(actualArgs)}\`);
  process.exit(9);
}
if (!normalizedCwd.endsWith("/bin-smoke/migration-workspace")) {
  console.error(\`unexpected child cwd: \${normalizedCwd}\`);
  process.exit(8);
}

console.log("croco-migrate-wrapper-contract-ok");
`,
    },
  ];
}

function functionalControllerFixtureFiles(): readonly SmokeFixtureFile[] {
  return [
    {
      path: "bin-smoke/SmokeController.ts",
      contents: `const metadata = Reflect as typeof Reflect & {
  defineMetadata(key: symbol, value: unknown, target: object): void;
};

export class SmokeController {
  ping(): string {
    return "ok";
  }
}

metadata.defineMetadata(
  Symbol.for("croco:rest:controller"),
  { path: "/smoke", target: SmokeController },
  SmokeController,
);
metadata.defineMetadata(
  Symbol.for("croco:rest:routes"),
  [{ method: "GET", methodName: "ping", path: "/ping" }],
  SmokeController,
);
`,
    },
  ];
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
  options: {
    readonly env?: NodeJS.ProcessEnv;
    readonly expectedExitCode?: number;
    readonly label: string;
  },
): RunResult {
  const expectedExitCode = options.expectedExitCode ?? 0;
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    env: options.env ?? { ...process.env, DATABASE_URL: "" },
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== expectedExitCode) {
    throw new Error(
      [
        `${options.label}: ${command} ${args.map((arg) => relativeArg(cwd, arg)).join(" ")} failed`,
        `Expected exit code: ${expectedExitCode}`,
        `Actual exit code: ${result.status ?? "null"}`,
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
