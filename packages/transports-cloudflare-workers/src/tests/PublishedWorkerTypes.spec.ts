import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;
const workspaceDependencyDirs = [
  "diagnostics-core",
  "events-core",
  "framework-config",
  "framework-context",
  "framework-logger",
  "health-core",
  "problems-core",
  "protocols-core",
  "protocols-rest",
  "ratelimit-core",
  "transports-http",
];

type PackageManifest = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly name?: string;
  readonly publishConfig?: Record<string, unknown>;
};

type InstalledPackage = {
  readonly manifest: PackageManifest;
  readonly packageDir: string;
};

describe("published Workers type contract", () => {
  it(
    "typechecks exported handler declarations in a clean packed consumer",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-workers-types-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-workers-types-consumer-"));

      try {
        ensureBuilt();
        run(
          "pnpm",
          [
            "--filter",
            "@croco/transports-cloudflare-workers",
            "pack",
            "--pack-destination",
            packRoot,
          ],
          rootDir,
        );

        const workerTarball = findTarball(packRoot, "croco-transports-cloudflare-workers-");
        const packedManifest = installPackedPackage(consumerRoot, workerTarball);
        expect(packedManifest.dependencies?.["@cloudflare/workers-types"]).toBe("^4.0.0");
        expect(packedManifest.devDependencies?.["@cloudflare/workers-types"]).toBeUndefined();

        const installedPackages = [
          {
            manifest: packedManifest,
            packageDir,
          },
          ...workspaceDependencyDirs.map((directory) => {
            const workspacePackageDir = join(rootDir, "packages", directory);
            return {
              manifest: installWorkspacePackage(consumerRoot, workspacePackageDir),
              packageDir: workspacePackageDir,
            };
          }),
        ];
        installExternalDependencies(consumerRoot, installedPackages);
        writeConsumerTypecheck(consumerRoot);

        run("node", [tscPath(), "-p", join(consumerRoot, "tsconfig.json")], consumerRoot);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    spawnTimeoutMs,
  );
});

function ensureBuilt(): void {
  if (
    existsBuiltPackage("transports-cloudflare-workers") &&
    workspaceDependencyDirs.every(existsBuiltPackage)
  ) {
    return;
  }

  run("pnpm", ["--filter", "@croco/transports-cloudflare-workers...", "build"], rootDir);
}

function existsBuiltPackage(directory: string): boolean {
  return existsSync(join(rootDir, "packages", directory, "dist", "index.d.ts"));
}

function findTarball(directory: string, prefix: string): string {
  const filename = readdirSync(directory).find(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"),
  );

  if (!filename) {
    throw new Error(`Missing packed tarball with prefix ${prefix}`);
  }

  return join(directory, filename);
}

function installPackedPackage(consumerRoot: string, tarball: string): PackageManifest {
  const manifest = JSON.parse(
    run("tar", ["-xOf", tarball, "package/package.json"], rootDir).stdout,
  ) as PackageManifest;
  const name = packageNameFor(manifest);
  const targetDir = packageInstallDir(consumerRoot, name);
  mkdirSync(targetDir, { recursive: true });
  run("tar", ["-xzf", tarball, "--strip-components", "1", "-C", targetDir], rootDir);
  return manifest;
}

function installWorkspacePackage(
  consumerRoot: string,
  workspacePackageDir: string,
): PackageManifest {
  const sourceManifest = JSON.parse(
    readFileSync(join(workspacePackageDir, "package.json"), "utf-8"),
  ) as PackageManifest;
  const publishManifest = publishManifestFor(sourceManifest);
  const targetDir = packageInstallDir(consumerRoot, packageNameFor(sourceManifest));
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(workspacePackageDir, "dist"), join(targetDir, "dist"), { recursive: true });
  writeFileSync(join(targetDir, "package.json"), `${JSON.stringify(publishManifest, null, 2)}\n`);
  return publishManifest;
}

function publishManifestFor(sourceManifest: PackageManifest): PackageManifest {
  const publishManifest = {
    ...sourceManifest,
    ...sourceManifest.publishConfig,
  };
  delete publishManifest.publishConfig;
  return publishManifest;
}

function installExternalDependencies(
  consumerRoot: string,
  packages: readonly InstalledPackage[],
): void {
  const externalDependencyDirs = new Map<string, string>();

  for (const installedPackage of packages) {
    for (const dependencyName of Object.keys(installedPackage.manifest.dependencies ?? {})) {
      if (dependencyName.startsWith("@croco/")) {
        continue;
      }
      const sourceDir = installedDependencyDir(installedPackage.packageDir, dependencyName);
      const currentSourceDir = externalDependencyDirs.get(dependencyName);
      if (!currentSourceDir || (!existsSync(currentSourceDir) && existsSync(sourceDir))) {
        externalDependencyDirs.set(dependencyName, sourceDir);
      }
    }
  }

  for (const [dependencyName, sourceDir] of Array.from(externalDependencyDirs).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const targetDir = packageInstallDir(consumerRoot, dependencyName);
    if (!existsSync(sourceDir)) {
      throw new Error(
        `${dependencyName}: declared dependency is missing from package and root node_modules`,
      );
    }

    mkdirSync(dirname(targetDir), { recursive: true });
    symlinkSync(sourceDir, targetDir, "dir");
  }
}

function installedDependencyDir(packageDir: string, dependencyName: string): string {
  const dependencyPathParts = dependencyName.split("/");
  const candidateDirs = [
    join(packageDir, "node_modules", ...dependencyPathParts),
    join(rootDir, "node_modules", ...dependencyPathParts),
  ];

  return candidateDirs.find((candidateDir) => existsSync(candidateDir)) ?? candidateDirs[0];
}

function writeConsumerTypecheck(consumerRoot: string): void {
  writeFileSync(
    join(consumerRoot, "types.ts"),
    [
      'import type { ExecutionContext } from "@cloudflare/workers-types";',
      'import { toWorkersHandler, type WorkersFetchHandler } from "@croco/transports-cloudflare-workers";',
      "",
      "declare const app: Parameters<typeof toWorkersHandler>[0];",
      "declare const ctx: ExecutionContext;",
      "declare const handler: WorkersFetchHandler;",
      "",
      'const request = new Request("https://example.com/api/hello");',
      "handler.fetch(request, {}, ctx);",
      "toWorkersHandler(app).fetch(request, {}, ctx);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ["ES2022", "DOM"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2022",
        },
        include: ["types.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function packageNameFor(manifest: PackageManifest): string {
  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    throw new Error("Package manifest is missing a name");
  }

  return manifest.name;
}

function packageInstallDir(consumerRoot: string, packageName: string): string {
  return join(consumerRoot, "node_modules", ...packageName.split("/"));
}

function tscPath(): string {
  return join(rootDir, "node_modules", "typescript", "lib", "tsc.js");
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
): { stdout: string; stderr: string } {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
