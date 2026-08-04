import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
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
const commandTimeoutMs = 180_000;
const publishedContractTimeoutMs = 360_000;

type BuildTarget = {
  readonly packageName: string;
  readonly sourceDir: string;
  readonly artifacts: readonly string[];
};

type PackageTarballs = {
  readonly cacheCore: string;
  readonly diagnosticsCore: string;
  readonly frameworkContext: string;
  readonly frameworkPreset: string;
  readonly metaVite: string;
  readonly presentationPreset: string;
  readonly problemsCore: string;
};

type CommandInvocation = {
  readonly args: readonly string[];
  readonly command: string;
};

type CommandResult = {
  readonly error?: Error;
  readonly status: number | null;
  readonly stderr: string | null | undefined;
  readonly stdout: string | null | undefined;
};

const buildTargets: readonly BuildTarget[] = [
  libraryBuildTarget("problems-core"),
  libraryBuildTarget("diagnostics-core"),
  libraryBuildTarget("framework-context"),
  libraryBuildTarget("framework-preset"),
  libraryBuildTarget("cache-core"),
  libraryBuildTarget("presentation-preset"),
  {
    packageName: "@croco/meta-vite",
    sourceDir: join(packageDir, "src"),
    artifacts: [
      join(packageDir, "dist", "index.js"),
      join(packageDir, "dist", "index.mjs"),
      join(packageDir, "dist", "index.d.ts"),
      join(packageDir, "dist", "index.d.mts"),
      join(packageDir, "dist", "libs", "isr", "adapters", "index.js"),
      join(packageDir, "dist", "libs", "isr", "adapters", "index.mjs"),
      join(packageDir, "dist", "libs", "isr", "adapters", "index.d.ts"),
      join(packageDir, "dist", "libs", "isr", "adapters", "index.d.mts"),
    ],
  },
];

describe("published @croco/meta-vite contract", () => {
  it("runs the Windows pnpm shim through its JavaScript entrypoint", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-meta-vite-pnpm-launcher-"));
    const pnpmHome = join(root, "node_modules", ".bin");
    const pnpmCli = join(root, "node_modules", "pnpm", "bin", "pnpm.cjs");

    try {
      mkdirSync(dirname(pnpmCli), { recursive: true });
      writeFileSync(pnpmCli, "");

      expect(resolveCommandInvocation("pnpm", ["pack"], "win32", pnpmHome)).toEqual({
        args: [pnpmCli, "pack"],
        command: process.execPath,
      });
      expect(resolveCommandInvocation("node", ["script.mjs"], "win32", pnpmHome)).toEqual({
        args: ["script.mjs"],
        command: "node",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("preserves spawn failures without captured output", () => {
    expect(
      formatCommandFailure("pnpm", ["pack"], {
        error: new Error("spawn failed"),
        status: null,
        stderr: undefined,
        stdout: undefined,
      }),
    ).toContain("Error: spawn failed");
  });

  it(
    "typechecks root server actions separately from optional Redis ISR adapters",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-meta-vite-pack-"));
      const rootConsumerRoot = mkdtempSync(join(tmpdir(), "croco-meta-vite-root-consumer-"));
      const redisConsumerRoot = mkdtempSync(join(tmpdir(), "croco-meta-vite-redis-consumer-"));

      try {
        const tarballs = packPackages(packRoot);
        const packedManifest = JSON.parse(
          run("tar", ["-xOf", tarballs.metaVite, "package/package.json"], rootDir).stdout,
        ) as {
          exports?: Record<string, unknown>;
          peerDependencies?: Record<string, string>;
          peerDependenciesMeta?: Record<string, { optional?: boolean }>;
        };

        expect(packedManifest.peerDependencies?.zod).toBe("^3.23.8");
        expect(packedManifest.peerDependencies?.ioredis).toBe("5.10.1");
        expect(packedManifest.peerDependencies?.["react-dom"]).toBe("^19.0.0");
        expect(packedManifest.peerDependencies?.vite).toBe("^6.4.3");
        expect(packedManifest.peerDependenciesMeta?.ioredis?.optional).toBe(true);
        expect(packedManifest.peerDependenciesMeta?.["react-dom"]).toBeUndefined();
        expect(packedManifest.exports?.["./isr/adapters"]).toEqual({
          import: "./dist/libs/isr/adapters/index.mjs",
          require: "./dist/libs/isr/adapters/index.js",
          types: "./dist/libs/isr/adapters/index.d.ts",
        });

        writeConsumerPackageJson(rootConsumerRoot, tarballs);
        installMetaViteConsumer(rootConsumerRoot, tarballs, [
          "@types/node@^22",
          "@types/react@^19",
          "react@^19.0.0",
          "vite@6.4.3",
          "zod@^3.23.8",
        ]);
        expect(installedPackageVersion(rootConsumerRoot, "vite")).toBe("6.4.3");
        writeFileSync(
          join(rootConsumerRoot, "index.ts"),
          [
            "import type { MetaViteRouteManifest, ServerActionConfig } from '@croco/meta-vite';",
            "import { createMetaViteRouteManifest, createServerActionSuccess, serializeMetaViteRouteManifest, type ServerActionResult } from '@croco/meta-vite';",
            "",
            "export const action: ServerActionConfig<{ email: string }, { accepted: boolean }> = {",
            "  name: 'signup',",
            "  output: { description: 'Signup response' },",
            "  problems: [{ code: 'auth/signup-closed', status: 422 }],",
            "  handler: async (data) => createServerActionSuccess({ accepted: data.email.length > 0 }),",
            "};",
            "",
            "export const result: ServerActionResult<{ accepted: boolean }> = createServerActionSuccess({ accepted: true });",
            "export const manifest: MetaViteRouteManifest = createMetaViteRouteManifest({",
            "  pages: [{ path: '/', componentRef: 'src/pages/Home.tsx#HomePage', mode: 'ssr' }],",
            "});",
            "export const manifestJson = serializeMetaViteRouteManifest(manifest);",
            "",
          ].join("\n"),
        );
        writeTypeScriptConfig(rootConsumerRoot);
        run("node", [tscPath(), "-p", join(rootConsumerRoot, "tsconfig.json")], rootConsumerRoot);

        writeConsumerPackageJson(redisConsumerRoot, tarballs);
        installMetaViteConsumer(redisConsumerRoot, tarballs, [
          "@types/node@^22",
          "@types/react@^19",
          "ioredis@5.10.1",
          "react@^19.0.0",
          "vite@6.4.3",
          "zod@^3.23.8",
        ]);
        expect(installedPackageVersion(redisConsumerRoot, "vite")).toBe("6.4.3");
        writeFileSync(
          join(redisConsumerRoot, "index.ts"),
          [
            "import { RedisCacheStoreAdapter } from '@croco/meta-vite/isr/adapters';",
            "",
            "const redis = {",
            "  del: async () => 0,",
            "  get: async () => null,",
            "  pipeline: () => ({ del: () => undefined, exec: async () => [] }),",
            "  scanStream: () => new EventTarget(),",
            "  set: async () => 'OK',",
            "  setex: async () => 'OK',",
            "} as unknown as ConstructorParameters<typeof RedisCacheStoreAdapter>[0];",
            "",
            "export const adapter = new RedisCacheStoreAdapter(redis);",
            "",
          ].join("\n"),
        );
        writeFileSync(
          join(redisConsumerRoot, "runtime.mjs"),
          [
            "import { RedisCacheStoreAdapter } from '@croco/meta-vite/isr/adapters';",
            "",
            "if (typeof RedisCacheStoreAdapter !== 'function') {",
            "  throw new Error('RedisCacheStoreAdapter export is not callable');",
            "}",
            "",
          ].join("\n"),
        );
        writeTypeScriptConfig(redisConsumerRoot);
        run("node", [tscPath(), "-p", join(redisConsumerRoot, "tsconfig.json")], redisConsumerRoot);
        run("node", [join(redisConsumerRoot, "runtime.mjs")], redisConsumerRoot);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(rootConsumerRoot, { force: true, recursive: true });
        rmSync(redisConsumerRoot, { force: true, recursive: true });
      }
    },
    publishedContractTimeoutMs,
  );
});

function packPackages(packRoot: string): PackageTarballs {
  ensureBuilt();
  run(
    "pnpm",
    ["--filter", "@croco/problems-core", "pack", "--pack-destination", packRoot],
    rootDir,
  );
  run(
    "pnpm",
    ["--filter", "@croco/diagnostics-core", "pack", "--pack-destination", packRoot],
    rootDir,
  );
  run(
    "pnpm",
    ["--filter", "@croco/framework-context", "pack", "--pack-destination", packRoot],
    rootDir,
  );
  run(
    "pnpm",
    ["--filter", "@croco/framework-preset", "pack", "--pack-destination", packRoot],
    rootDir,
  );
  run("pnpm", ["--filter", "@croco/cache-core", "pack", "--pack-destination", packRoot], rootDir);
  run(
    "pnpm",
    ["--filter", "@croco/presentation-preset", "pack", "--pack-destination", packRoot],
    rootDir,
  );
  run("pnpm", ["--filter", "@croco/meta-vite", "pack", "--pack-destination", packRoot], rootDir);

  return {
    cacheCore: findTarball(packRoot, "croco-cache-core-"),
    diagnosticsCore: findTarball(packRoot, "croco-diagnostics-core-"),
    frameworkContext: findTarball(packRoot, "croco-framework-context-"),
    frameworkPreset: findTarball(packRoot, "croco-framework-preset-"),
    metaVite: findTarball(packRoot, "croco-meta-vite-"),
    presentationPreset: findTarball(packRoot, "croco-presentation-preset-"),
    problemsCore: findTarball(packRoot, "croco-problems-core-"),
  };
}

function ensureBuilt(): void {
  if (!buildTargets.every(isBuildTargetCurrent)) {
    run("pnpm", ["--filter", "@croco/meta-vite...", "build"], rootDir);
  }

  const missingArtifacts = buildTargets.flatMap((target) =>
    target.artifacts.filter((artifact) => !existsSync(artifact)),
  );

  if (missingArtifacts.length > 0) {
    throw new Error(
      `Missing build artifacts after build:\n${missingArtifacts.map((artifact) => `- ${artifact}`).join("\n")}`,
    );
  }
}

function isBuildTargetCurrent(target: BuildTarget): boolean {
  if (!target.artifacts.every((artifact) => existsSync(artifact))) {
    return false;
  }

  const oldestArtifactMtime = Math.min(
    ...target.artifacts.map((artifact) => statSync(artifact).mtimeMs),
  );
  return newestSourceMtime(target.sourceDir) <= oldestArtifactMtime;
}

function newestSourceMtime(directory: string): number {
  let newest = 0;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtime(entryPath));
      continue;
    }

    if (entry.isFile() && isBuildInput(entry.name)) {
      newest = Math.max(newest, statSync(entryPath).mtimeMs);
    }
  }

  return newest;
}

function isBuildInput(filename: string): boolean {
  return filename.endsWith(".ts") || filename.endsWith(".tsx") || filename.endsWith(".json");
}

function libraryBuildTarget(packageName: string): BuildTarget {
  return {
    packageName: `@croco/${packageName}`,
    sourceDir: join(rootDir, "packages", packageName, "src"),
    artifacts: libraryArtifacts(packageName),
  };
}

function libraryArtifacts(packageName: string): readonly string[] {
  const distDir = join(rootDir, "packages", packageName, "dist");

  return ["index.js", "index.mjs", "index.d.ts", "index.d.mts"].map((filename) =>
    join(distDir, filename),
  );
}

function writeConsumerPackageJson(consumerRoot: string, tarballs: PackageTarballs): void {
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "croco-meta-vite-consumer",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  writePnpmWorkspaceOverrides(consumerRoot, {
    "@croco/cache-core": `file:${tarballs.cacheCore}`,
    "@croco/diagnostics-core": `file:${tarballs.diagnosticsCore}`,
    "@croco/framework-context": `file:${tarballs.frameworkContext}`,
    "@croco/framework-preset": `file:${tarballs.frameworkPreset}`,
    "@croco/presentation-preset": `file:${tarballs.presentationPreset}`,
    "@croco/problems-core": `file:${tarballs.problemsCore}`,
  });
}

function installMetaViteConsumer(
  consumerRoot: string,
  tarballs: PackageTarballs,
  dependencies: readonly string[],
): void {
  run(
    "pnpm",
    ["add", "--prod", tarballs.metaVite, ...dependencies, "--ignore-scripts"],
    consumerRoot,
  );
}

function writeTypeScriptConfig(consumerRoot: string): void {
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ["ESNext", "DOM", "DOM.Iterable"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          skipLibCheck: false,
          strict: true,
          target: "ES2022",
          types: ["node", "react"],
        },
        include: ["index.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function installedPackageVersion(consumerRoot: string, packageName: string): string | undefined {
  const manifest = JSON.parse(
    readFileSync(join(consumerRoot, "node_modules", packageName, "package.json"), "utf8"),
  ) as { readonly version?: string };

  return manifest.version;
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

function tscPath(): string {
  return join(rootDir, "node_modules", "typescript", "bin", "tsc");
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
): { readonly stdout: string; readonly stderr: string } {
  const invocation = resolveCommandInvocation(command, args);
  const result = spawnSync(invocation.command, [...invocation.args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: commandTimeoutMs,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (result.error || result.status !== 0) {
    throw new Error(formatCommandFailure(command, args, result));
  }

  return {
    stdout,
    stderr,
  };
}

function resolveCommandInvocation(
  command: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  pnpmHome: string | undefined = process.env.PNPM_HOME,
): CommandInvocation {
  if (platform !== "win32" || command !== "pnpm") {
    return { args, command };
  }

  if (!pnpmHome) {
    throw new Error("PNPM_HOME is required to run pnpm from the Windows packed-consumer test");
  }

  const candidates = [
    join(pnpmHome, "pnpm.cjs"),
    join(pnpmHome, "bin", "pnpm.cjs"),
    join(pnpmHome, "node_modules", "pnpm", "bin", "pnpm.cjs"),
    join(pnpmHome, "..", "pnpm", "bin", "pnpm.cjs"),
  ];
  const pnpmCli = candidates.find(existsSync);

  if (!pnpmCli) {
    throw new Error(`Cannot locate the pnpm JavaScript entrypoint from PNPM_HOME=${pnpmHome}`);
  }

  return {
    args: [pnpmCli, ...args],
    command: process.execPath,
  };
}

function formatCommandFailure(
  command: string,
  args: readonly string[],
  result: CommandResult,
): string {
  return [
    `${command} ${args.join(" ")} failed`,
    result.error ? `${result.error.name}: ${result.error.message}` : undefined,
    result.stdout?.trim(),
    result.stderr?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}
