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

describe("published rate-limit policy types", () => {
  it(
    "preserves exhaustive algorithm-specific declarations in a clean packed consumer",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-ratelimit-core-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-ratelimit-core-consumer-"));

      try {
        ensureBuilt();
        pack("@croco/problems-core", packRoot);
        pack("@croco/diagnostics-core", packRoot);
        pack("@croco/framework-context", packRoot);
        pack("@croco/ratelimit-core", packRoot);

        const problemsCoreTarball = findTarball(packRoot, "croco-problems-core-");
        const diagnosticsCoreTarball = findTarball(packRoot, "croco-diagnostics-core-");
        const frameworkContextTarball = findTarball(packRoot, "croco-framework-context-");
        const rateLimitCoreTarball = findTarball(packRoot, "croco-ratelimit-core-");
        const declarations = run(
          "tar",
          ["-xOf", rateLimitCoreTarball, "package/dist/index.d.ts"],
          rootDir,
        ).stdout;

        expect(declarations).toContain("type LegacyFixedWindowPolicy = {");
        expect(declarations).toContain("algorithm?: never;");

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify({ name: "ratelimit-core-consumer", private: true, type: "module" }, null, 2)}\n`,
        );
        writePnpmWorkspaceOverrides(consumerRoot, {
          "@croco/diagnostics-core": `file:${diagnosticsCoreTarball}`,
          "@croco/framework-context": `file:${frameworkContextTarball}`,
          "@croco/problems-core": `file:${problemsCoreTarball}`,
        });
        writeConsumerTypecheck(consumerRoot);
        run("pnpm", ["add", "--prod", rateLimitCoreTarball, "--ignore-scripts"], consumerRoot);
        run("node", [tscPath(), "-p", "tsconfig.json"], consumerRoot);
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
    { name: "@croco/framework-context", directory: resolve(rootDir, "packages/framework-context") },
    { name: "@croco/ratelimit-core", directory: packageDir },
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

  return latestInputModifiedAt(directory) > statSync(declarationPath).mtimeMs;
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
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
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
  overrides: Readonly<Record<string, string>>,
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

function writeConsumerTypecheck(consumerRoot: string): void {
  writeFileSync(
    join(consumerRoot, "contracts.ts"),
    [
      'import type { LegacyFixedWindowPolicy, RateLimitAlgorithm, RateLimitDecoratorOptions, RateLimitPolicy } from "@croco/ratelimit-core";',
      "",
      'const legacy = { name: "legacy", limit: 10, windowMs: 60_000 } satisfies LegacyFixedWindowPolicy;',
      "const legacyPolicy: RateLimitPolicy = legacy;",
      'const fixed = { name: "fixed", algorithm: "fixed", limit: 10, windowMs: 60_000 } satisfies RateLimitPolicy;',
      'const sliding = { name: "sliding", algorithm: "sliding", limit: 10, windowMs: 60_000 } satisfies RateLimitPolicy;',
      'const tokenBucket = { name: "token", algorithm: "token-bucket", capacity: 10, refillRate: 2, refillIntervalMs: 1_000 } satisfies RateLimitPolicy;',
      'const decoratorFixed = { algorithm: "fixed", limit: 10, window: "1m" } satisfies RateLimitDecoratorOptions;',
      "void [legacyPolicy, fixed, sliding, tokenBucket, decoratorFixed];",
      "",
      "// @ts-expect-error token-bucket policies require capacity and refill fields",
      'const incompleteTokenBucket: RateLimitPolicy = { name: "token", algorithm: "token-bucket", limit: 10, windowMs: 60_000 };',
      "// @ts-expect-error fixed-window policies cannot include token-bucket fields",
      'const mixedFixed: RateLimitPolicy = { name: "fixed", algorithm: "fixed", limit: 10, windowMs: 60_000, capacity: 10 };',
      "// @ts-expect-error token-bucket policies cannot include window-policy fields",
      'const mixedTokenBucket: RateLimitPolicy = { name: "token", algorithm: "token-bucket", capacity: 10, refillRate: 2, refillIntervalMs: 1_000, limit: 10, windowMs: 60_000 };',
      "const fixedWithTokenField = { ...fixed, capacity: 10 };",
      "// @ts-expect-error mixed fixed-window variables remain invalid after excess-property checks",
      "const mixedFixedVariable: RateLimitPolicy = fixedWithTokenField;",
      "const tokenWithWindowFields = { ...tokenBucket, limit: 10, windowMs: 60_000 };",
      "// @ts-expect-error mixed token-bucket variables remain invalid after excess-property checks",
      "const mixedTokenVariable: RateLimitPolicy = tokenWithWindowFields;",
      "const legacyWithTokenField = { ...legacy, capacity: 10 };",
      "// @ts-expect-error mixed legacy variables remain invalid after excess-property checks",
      "const mixedLegacyVariable: RateLimitPolicy = legacyWithTokenField;",
      "declare const algorithm: RateLimitAlgorithm;",
      "// @ts-expect-error widened algorithms must be narrowed before constructing a policy",
      'const widenedPolicy: RateLimitPolicy = { name: "widened", algorithm, limit: 10, windowMs: 60_000 };',
      "// @ts-expect-error the window decorator cannot construct a complete token-bucket policy",
      'const invalidDecorator: RateLimitDecoratorOptions = { algorithm: "token-bucket", limit: 10, window: "1m" };',
      "void [incompleteTokenBucket, mixedFixed, mixedTokenBucket, mixedFixedVariable, mixedTokenVariable, mixedLegacyVariable, widenedPolicy, invalidDecorator];",
      "",
      'type PolicyAlgorithm = Exclude<RateLimitPolicy["algorithm"], undefined>;',
      "type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;",
      "const algorithmContract: Equal<RateLimitAlgorithm, PolicyAlgorithm> = true;",
      "void algorithmContract;",
      "",
      "function policyLimit(policy: RateLimitPolicy): number {",
      "  switch (policy.algorithm) {",
      "    case undefined:",
      '    case "fixed":',
      '    case "sliding":',
      "      return policy.limit;",
      '    case "token-bucket":',
      "      return policy.capacity;",
      "    default:",
      "      return assertNever(policy);",
      "  }",
      "}",
      "",
      "function assertNever(value: never): never {",
      "  throw new Error(`Unexpected policy: ${String(value)}`);",
      "}",
      "",
      "void policyLimit;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: "ES2022",
        },
        include: ["contracts.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function tscPath(): string {
  return join(rootDir, "node_modules", "typescript", "bin", "tsc");
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
  return { stdout: result.stdout, stderr: result.stderr };
}
