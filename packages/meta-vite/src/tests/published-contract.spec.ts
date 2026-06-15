import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;

type PackageTarballs = {
  readonly cacheCore: string;
  readonly diagnosticsCore: string;
  readonly frameworkContext: string;
  readonly frameworkPreset: string;
  readonly metaVite: string;
  readonly presentationPreset: string;
  readonly problemsCore: string;
};

describe("published @croco/meta-vite contract", () => {
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
        expect(packedManifest.peerDependenciesMeta?.ioredis?.optional).toBe(true);
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
          "vite@^6.0.0",
          "zod@^3.23.8",
        ]);
        writeFileSync(
          join(rootConsumerRoot, "index.ts"),
          [
            "import type { ServerActionConfig } from '@croco/meta-vite';",
            "",
            "export const action: ServerActionConfig<{ email: string }> = {",
            "  name: 'signup',",
            "  handler: async () => new Response('ok'),",
            "};",
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
          "vite@^6.0.0",
          "zod@^3.23.8",
        ]);
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
    spawnTimeoutMs,
  );
});

function packPackages(packRoot: string): PackageTarballs {
  run("pnpm", ["--filter", "@croco/meta-vite...", "build"], rootDir);
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

function writeConsumerPackageJson(consumerRoot: string, tarballs: PackageTarballs): void {
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "croco-meta-vite-consumer",
        private: true,
        pnpm: {
          overrides: {
            "@croco/cache-core": `file:${tarballs.cacheCore}`,
            "@croco/diagnostics-core": `file:${tarballs.diagnosticsCore}`,
            "@croco/framework-context": `file:${tarballs.frameworkContext}`,
            "@croco/framework-preset": `file:${tarballs.frameworkPreset}`,
            "@croco/presentation-preset": `file:${tarballs.presentationPreset}`,
            "@croco/problems-core": `file:${tarballs.problemsCore}`,
          },
        },
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
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

function run(
  command: string,
  args: readonly string[],
  cwd: string,
): { readonly stdout: string; readonly stderr: string } {
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
