import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;

describe("published telemetry SDK types", () => {
  it(
    "installs OpenTelemetry instrumentation types for clean consumers",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-telemetry-sdk-node-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-telemetry-sdk-node-consumer-"));

      try {
        ensureBuilt();
        pack("@croco/problems-core", packRoot);
        pack("@croco/diagnostics-core", packRoot);
        pack("@croco/telemetry-sdk-node", packRoot);

        const problemsCoreTarball = findTarball(packRoot, "croco-problems-core-");
        const diagnosticsCoreTarball = findTarball(packRoot, "croco-diagnostics-core-");
        const telemetrySdkTarball = findTarball(packRoot, "croco-telemetry-sdk-node-");
        const packedManifest = JSON.parse(
          run("tar", ["-xOf", telemetrySdkTarball, "package/package.json"], rootDir).stdout,
        ) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        expect(packedManifest.dependencies?.["@opentelemetry/instrumentation"]).toBe("^0.220.0");
        expect(packedManifest.dependencies?.["@opentelemetry/auto-instrumentations-node"]).toBe(
          "^0.78.0",
        );
        expect(packedManifest.devDependencies?.["@opentelemetry/instrumentation"]).toBeUndefined();

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify(
            {
              name: "croco-telemetry-sdk-node-consumer",
              private: true,
              type: "module",
            },
            null,
            2,
          )}\n`,
        );
        writePnpmWorkspaceOverrides(consumerRoot, {
          "@croco/diagnostics-core": `file:${diagnosticsCoreTarball}`,
          "@croco/problems-core": `file:${problemsCoreTarball}`,
        });
        writeFileSync(
          join(consumerRoot, "index.ts"),
          [
            'import type { AutoInstrumentationConfig, TraceConfig } from "@croco/telemetry-sdk-node";',
            "",
            "const autoInstrumentation = {",
            "  customInstrumentations: [],",
            "} satisfies AutoInstrumentationConfig;",
            "",
            "const traceConfig: TraceConfig = {",
            "  instrumentations: [],",
            "  autoInstrumentation,",
            "};",
            "",
            "void traceConfig;",
            "",
          ].join("\n"),
        );
        writeFileSync(
          join(consumerRoot, "tsconfig.json"),
          `${JSON.stringify(
            {
              compilerOptions: {
                module: "ESNext",
                moduleResolution: "Bundler",
                noEmit: true,
                strict: true,
                target: "ES2022",
              },
              include: ["index.ts"],
            },
            null,
            2,
          )}\n`,
        );

        run("pnpm", ["add", "--prod", telemetrySdkTarball, "--ignore-scripts"], consumerRoot);
        run("pnpm", ["add", "--save-dev", "@types/node@^22", "--ignore-scripts"], consumerRoot);
        run(
          "node",
          [join(rootDir, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
          consumerRoot,
        );
        writeFileSync(
          join(consumerRoot, "runtime.mjs"),
          [
            'import { TelemetryRuntime } from "@croco/telemetry-sdk-node";',
            "",
            "const runtime = TelemetryRuntime.getInstance();",
            "await runtime.init({",
            '  serviceName: "packed-auto-instrumentation-smoke",',
            "  trace: {",
            '    exporterUrl: "http://127.0.0.1:4318/v1/traces",',
            '    autoInstrumentation: { modules: ["http", "https"] },',
            "  },",
            "});",
            "if (!runtime.isInitialized()) {",
            '  throw new Error("packed telemetry runtime did not initialize");',
            "}",
            "await runtime.shutdown();",
            "",
          ].join("\n"),
        );
        run("node", ["runtime.mjs"], consumerRoot);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    spawnTimeoutMs,
  );
});

function ensureBuilt(): void {
  const packages = [
    { name: "@croco/problems-core", directory: resolve(rootDir, "packages/problems-core") },
    { name: "@croco/diagnostics-core", directory: resolve(rootDir, "packages/diagnostics-core") },
    { name: "@croco/telemetry-sdk-node", directory: packageDir },
  ];
  const missingBuildPackages = packages.filter(({ directory }) => shouldBuildPackage(directory));

  if (missingBuildPackages.length === 0) {
    return;
  }

  run(
    "pnpm",
    [...missingBuildPackages.flatMap(({ name }) => ["--filter", name]), "build"],
    rootDir,
  );
}

function shouldBuildPackage(directory: string): boolean {
  const declarationPath = join(directory, "dist/index.d.ts");

  if (!existsSync(declarationPath)) {
    return true;
  }

  const declarationModifiedAt = statSync(declarationPath).mtimeMs;
  return latestInputModifiedAt(directory) > declarationModifiedAt;
}

function latestInputModifiedAt(directory: string): number {
  return Math.max(
    statSync(join(directory, "package.json")).mtimeMs,
    latestTypeScriptModifiedAt(join(directory, "src")),
  );
}

function latestTypeScriptModifiedAt(directory: string): number {
  return readdirSync(directory, { withFileTypes: true }).reduce((latest, entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return Math.max(latest, latestTypeScriptModifiedAt(entryPath));
    }

    if (!entry.isFile() || (!entry.name.endsWith(".ts") && !entry.name.endsWith(".mts"))) {
      return latest;
    }

    return Math.max(latest, statSync(entryPath).mtimeMs);
  }, 0);
}

function pack(packageName: string, packRoot: string): void {
  run("pnpm", ["--filter", packageName, "pack", "--pack-destination", packRoot], rootDir);
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
