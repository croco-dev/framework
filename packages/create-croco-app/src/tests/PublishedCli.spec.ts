import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProblemFactory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;
// These tarballs cover the packed CLI's local Croco runtime dependency graph, including transitive deps.
const packedRuntimeWorkspacePackages = ["problems-core", "diagnostics-core", "telemetry-sdk-node"];
const requiredPackageArtifacts = [
  ...packedRuntimeWorkspacePackages.flatMap((packageName) => requiredLibraryArtifacts(packageName)),
  join(packageDir, "dist", "index.js"),
  join(packageDir, "dist", "index.d.ts"),
];

describe("published create-croco-app CLI", () => {
  it(
    "prints the package manifest version from the installed package",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-create-app-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-create-app-consumer-"));

      try {
        ensureBuilt();
        assertTenantModelHelpersBundled();
        packRuntimeWorkspacePackages(packRoot);
        run(
          "pnpm",
          ["--filter", "create-croco-app", "pack", "--pack-destination", packRoot],
          rootDir,
        );

        const problemsCoreTarball = findTarball(packRoot, "croco-problems-core-");
        const diagnosticsCoreTarball = findTarball(packRoot, "croco-diagnostics-core-");
        const telemetrySdkNodeTarball = findTarball(packRoot, "croco-telemetry-sdk-node-");
        const createCrocoAppTarball = findTarball(packRoot, "create-croco-app-");

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify(
            {
              name: "create-croco-app-consumer",
              private: true,
              type: "module",
            },
            null,
            2,
          )}\n`,
        );
        writePnpmWorkspaceOverrides(consumerRoot, {
          "@croco/problems-core": `file:${problemsCoreTarball}`,
          "@croco/diagnostics-core": `file:${diagnosticsCoreTarball}`,
          "@croco/telemetry-sdk-node": `file:${telemetrySdkNodeTarball}`,
        });

        run("pnpm", ["add", "--prod", createCrocoAppTarball, "--ignore-scripts"], consumerRoot);

        const packageVersion = readPackageVersion();
        const version = run("pnpm", ["exec", "create-croco-app", "--version"], consumerRoot);

        expect(version.stdout.trim()).toBe(packageVersion);
        verifyJsonFailureOutput(consumerRoot);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    spawnTimeoutMs,
  );
});

function packRuntimeWorkspacePackages(packRoot: string): void {
  for (const packageName of packedRuntimeWorkspacePackages) {
    run(
      "pnpm",
      ["--filter", `@croco/${packageName}`, "pack", "--pack-destination", packRoot],
      rootDir,
    );
  }
}

function ensureBuilt(): void {
  if (requiredPackageArtifacts.every((artifact) => existsSync(artifact))) {
    return;
  }

  run("pnpm", ["--filter", "create-croco-app...", "build"], rootDir);

  const missingArtifacts = requiredPackageArtifacts.filter((artifact) => !existsSync(artifact));
  if (missingArtifacts.length > 0) {
    throw ProblemFactory.internalServerError(
      "create-croco-app/missing-build-artifacts",
      `Missing build artifacts after build:\n${missingArtifacts.map((artifact) => `- ${artifact}`).join("\n")}`,
    );
  }
}

function requiredLibraryArtifacts(packageName: string): string[] {
  const distDir = join(rootDir, "packages", packageName, "dist");

  return ["index.js", "index.mjs", "index.d.ts", "index.d.mts"].map((filename) =>
    join(distDir, filename),
  );
}

function assertTenantModelHelpersBundled(): void {
  const distDir = join(packageDir, "dist");
  const builtSources = readdirSync(distDir)
    .filter((filename) => filename.endsWith(".js"))
    .map((filename) => readFileSync(join(distDir, filename), "utf8"))
    .join("\n");

  expect(builtSources).not.toMatch(
    /(?:from\s+|import\()["']@croco\/tenant-core(?:\/tenant-model)?["']/,
  );
}

function findTarball(directory: string, prefix: string): string {
  const filename = readdirSync(directory).find(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"),
  );

  if (!filename) {
    throw ProblemFactory.internalServerError(
      "create-croco-app/missing-packed-tarball",
      `Missing packed tarball with prefix ${prefix}`,
    );
  }

  return join(directory, filename);
}

function readPackageVersion(): string {
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
    version?: unknown;
  };

  if (typeof manifest.version !== "string") {
    throw ProblemFactory.internalServerError(
      "create-croco-app/missing-package-version",
      "Missing package version in package.json",
    );
  }

  return manifest.version;
}

function writePnpmWorkspaceOverrides(
  consumerRoot: string,
  overrides: Record<string, string>,
): void {
  const lines = [
    "packages:",
    "  - .",
    "overrides:",
    ...Object.entries(overrides).map(
      ([packageName, range]) => `  ${JSON.stringify(packageName)}: ${JSON.stringify(range)}`,
    ),
  ];

  writeFileSync(join(consumerRoot, "pnpm-workspace.yaml"), `${lines.join("\n")}\n`);
}

function verifyJsonFailureOutput(consumerRoot: string): void {
  const fakeBinDir = join(consumerRoot, "fake-bin");
  const fakePnpmModule = join(fakeBinDir, "fake-pnpm.mjs");
  mkdirSync(fakeBinDir, { recursive: true });
  writeFileSync(
    fakePnpmModule,
    [
      "const args = process.argv.slice(2);",
      "const failure = process.env.CROCO_FAKE_PNPM_FAILURE;",
      'const { writeSync } = await import("node:fs");',
      'if (args[0] === "--version") { console.log("11.9.0"); process.exit(0); }',
      'if (failure === "dependency-install" && args.includes("--no-frozen-lockfile")) {',
      '  writeSync(2, "x".repeat(1_100_000));',
      '  writeSync(2, "NPM_TOKEN=supersecretvalue\\n");',
      '  writeSync(2, "npmAuthToken=npm-auth-secret\\n");',
      '  writeSync(2, "authorization=Bearer bearer-secret\\n");',
      '  writeSync(2, \'{"token":"json-file-secret","npmAuthToken":"camel-secret"}\\n\');',
      '  writeSync(2, "git=https://username-only-secret@example.com/repository.git\\n");',
      '  writeSync(2, "opaque=" + process.env.CROCO_TEST_SECRET + "\\n");',
      '  writeSync(2, "FAKE_PNPM_INSTALL_FAILURE\\n");',
      "  process.exit(1);",
      "}",
      'if (failure === "lockfile-validation" && args.includes("--frozen-lockfile")) {',
      '  writeSync(2, "x".repeat(1_100_000));',
      '  writeSync(2, "NODE_AUTH_TOKEN=node-auth-secret\\n");',
      '  writeSync(2, "registry=https://user:registry-secret@example.com\\n");',
      '  writeSync(2, "FAKE_PNPM_LOCKFILE_FAILURE\\n");',
      "  process.exit(1);",
      "}",
      'writeSync(2, "x".repeat(1_100_000));',
      "process.exit(0);",
      "",
    ].join("\n"),
  );
  const fakePnpm = join(fakeBinDir, "pnpm");
  writeFileSync(fakePnpm, '#!/bin/sh\nexec node "$(dirname "$0")/fake-pnpm.mjs" "$@"\n');
  chmodSync(fakePnpm, 0o755);
  writeFileSync(join(fakeBinDir, "pnpm.cmd"), '@node "%~dp0fake-pnpm.mjs" %*\r\n');

  for (const failure of ["dependency-install", "lockfile-validation"] as const) {
    const targetDir = join(consumerRoot, `json-${failure}`);
    const failed = runInstalledCli(consumerRoot, fakeBinDir, targetDir, failure);

    expect(failed.status).toBe(1);
    expect(failed.stdout).toBe("");
    const failureResult = JSON.parse(failed.stderr) as {
      readonly code: string;
      readonly diagnostic: Record<string, unknown>;
      readonly destination: { readonly untouched: boolean; readonly state: string };
      readonly retryCommand: { readonly command: string; readonly args: readonly string[] };
      readonly diagnosticCommand: { readonly command: string; readonly args: readonly string[] };
    };
    expect(failureResult.code).toBe(
      failure === "dependency-install"
        ? "create-croco-app/dependency-install-failed"
        : "create-croco-app/lockfile-validation-failed",
    );
    expect(failureResult.destination).toMatchObject({ state: "absent", untouched: true });
    expect(failureResult.diagnostic).not.toHaveProperty("pnpmOutput");
    for (const secret of [
      "supersecretvalue",
      "npm-auth-secret",
      "bearer-secret",
      "environment-secret",
      "node-auth-secret",
      "registry-secret",
      "json-file-secret",
      "camel-secret",
      "username-only-secret",
    ]) {
      expect(failed.stderr).not.toContain(secret);
    }
    expect(failureResult.retryCommand).toEqual({
      command: "create-croco-app",
      args: [targetDir, "--preset", "blank", "--scope", "@test", "--no-git", "--json"],
    });
    expect(failureResult.diagnosticCommand).toEqual({
      command: "create-croco-app",
      args: [targetDir, "--preset", "blank", "--scope", "@test", "--no-git"],
    });
    expect(existsSync(targetDir)).toBe(false);

    const repeated = runInstalledCli(consumerRoot, fakeBinDir, targetDir, failure);
    const repeatedFailure = JSON.parse(repeated.stderr) as {
      readonly diagnosticCommand: { readonly command: string; readonly args: readonly string[] };
    };
    expect(repeated.status).toBe(1);
    expect(repeatedFailure.diagnosticCommand.args).not.toContain("--json");
    expect(existsSync(targetDir)).toBe(false);

    const retried = runInstalledCli(consumerRoot, fakeBinDir, targetDir);
    expect(retried.status).toBe(0);
    expect(JSON.parse(retried.stdout)).toMatchObject({ ok: true, targetDir });
    expect(retried.stderr).toBe("");
    expect(existsSync(join(targetDir, "package.json"))).toBe(true);
  }
}

function runInstalledCli(
  consumerRoot: string,
  fakeBinDir: string,
  targetDir: string,
  failure?: "dependency-install" | "lockfile-validation",
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  const result = spawnSync(
    process.execPath,
    [
      join(consumerRoot, "node_modules", "create-croco-app", "dist", "index.js"),
      targetDir,
      "--preset",
      "blank",
      "--scope",
      "@test",
      "--no-git",
      "--json",
    ],
    {
      cwd: consumerRoot,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: spawnTimeoutMs,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}${delimiter}${process.env.PATH ?? ""}`,
        CROCO_TEST_SECRET: "environment-secret",
        ...(failure ? { CROCO_FAKE_PNPM_FAILURE: failure } : {}),
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  };
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
    throw ProblemFactory.internalServerError(
      "create-croco-app/command-failed",
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
