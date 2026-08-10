#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = resolve(import.meta.dirname, "..");
const fixtureDir = join(rootDir, "scripts", "fixtures", "decorator-signature-spike");
const tscPath = join(rootDir, "node_modules", "typescript", "bin", "tsc");
const zodTypesRoot = join(rootDir, "packages", "protocols-rest", "node_modules", "zod");
const timeoutMs = 180_000;
const performanceInstantiationBudget = 250_000;

type CommandResult = {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

type CompilerMetrics = {
  readonly checkTimeSeconds: number;
  readonly instantiations: number;
};

export function runDecoratorSignatureSpike(): void {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "croco-decorator-signature-spike-"));

  try {
    verifyPositiveAndNegativeFixtures();
    const negativeAssertionCount = verifyNegativeFixtureSensitivity(temporaryRoot);
    verifyRepresentativeDiagnostics();
    const declarationPath = verifyDeclarationEmit(temporaryRoot);
    verifyPackedConsumer(temporaryRoot, declarationPath);
    const performance = compareTypecheckPerformance(temporaryRoot);

    console.log("decorator-signature-spike: TypeScript 6 legacy decorator feasibility verified");
    console.log(
      `decorator-signature-spike: ${negativeAssertionCount} negative assertions fail with broad signatures; inheritance limitation compiled as documented`,
    );
    console.log(
      "decorator-signature-spike: overload declaration snapshot and strict/loose packed ESM/CJS consumer passed",
    );
    console.log(
      `decorator-signature-spike: broad ${performance.broad.instantiations} instantiations / ${performance.broad.checkTimeSeconds.toFixed(2)}s check, strict ${performance.strict.instantiations} instantiations / ${performance.strict.checkTimeSeconds.toFixed(2)}s check`,
    );
    console.log(
      `decorator-signature-spike: strict instantiation delta ${performance.delta} within ${performanceInstantiationBudget} budget`,
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function verifyPositiveAndNegativeFixtures(): void {
  const result = runTypeScript(["-p", join(fixtureDir, "tsconfig.json")]);
  assertSucceeded("positive and @ts-expect-error fixture compilation", result);
}

function verifyNegativeFixtureSensitivity(temporaryRoot: string): number {
  const sensitivityRoot = join(temporaryRoot, "negative-sensitivity");
  if (!existsSync(zodTypesRoot)) {
    throw new Error(`zod types were not found at ${zodTypesRoot}; install workspace dependencies`);
  }
  mkdirSync(sensitivityRoot, { recursive: true });
  const negativeSource = readFileSync(join(fixtureDir, "negative.ts"), "utf8");
  copyFileSync(join(fixtureDir, "negative.ts"), join(sensitivityRoot, "negative.ts"));
  writeFileSync(
    join(sensitivityRoot, "prototype.ts"),
    [
      "export declare function contractMethod<Expected>(): MethodDecorator;",
      "export declare function contractParameter<Expected>(): ParameterDecorator;",
      "",
    ].join("\n"),
  );
  writeJson(join(sensitivityRoot, "tsconfig.json"), {
    compilerOptions: {
      experimentalDecorators: true,
      module: "Preserve",
      moduleResolution: "Bundler",
      noEmit: true,
      paths: {
        zod: [zodTypesRoot],
      },
      skipLibCheck: true,
      strict: true,
      target: "ES2022",
    },
    files: ["negative.ts", "prototype.ts"],
  });

  const result = runTypeScript(["-p", join(sensitivityRoot, "tsconfig.json")]);
  const output = `${result.stdout}${result.stderr}`;
  const expectedUnusedDirectives = negativeSource.match(/@ts-expect-error/g)?.length ?? 0;
  const actualUnusedDirectives = output.match(/TS2578/g)?.length ?? 0;
  const otherDiagnostics = output.match(/error TS(?!2578)\d+/g) ?? [];
  if (
    result.status === 0 ||
    actualUnusedDirectives !== expectedUnusedDirectives ||
    otherDiagnostics.length > 0
  ) {
    throw new Error(
      `broad decorator signatures did not invalidate all ${expectedUnusedDirectives} negative assertions\n${output}`,
    );
  }
  return expectedUnusedDirectives;
}

function verifyRepresentativeDiagnostics(): void {
  const result = runTypeScript(["-p", join(fixtureDir, "tsconfig.diagnostics.json")]);
  if (result.status === 0) {
    throw new Error("representative invalid decorators unexpectedly compiled");
  }

  const actual = normalizeDiagnostics(`${result.stdout}${result.stderr}`);
  const expected = normalizeDiagnostics(
    readFileSync(join(fixtureDir, "diagnostics.snapshot.txt"), "utf8"),
  );
  if (actual !== expected) {
    throw new Error(
      `representative diagnostics drifted\n--- expected ---\n${expected}\n--- actual ---\n${actual}`,
    );
  }

  const diagnosticBlocks = actual.split(/\n(?=scripts\/fixtures\/)/);
  if (
    diagnosticBlocks.length !== 3 ||
    !actual.includes("TS1241") ||
    !actual.includes("TS1239") ||
    diagnosticBlocks.some((block) => block.length > 360)
  ) {
    throw new Error("representative diagnostics no longer have the reviewed codes or size");
  }
}

function verifyDeclarationEmit(temporaryRoot: string): string {
  const declarationRoot = join(temporaryRoot, "declaration");
  const result = runTypeScript([
    "-p",
    join(fixtureDir, "tsconfig.declaration.json"),
    "--outDir",
    declarationRoot,
  ]);
  assertSucceeded("prototype declaration emit", result);

  const declarationPath = join(declarationRoot, "prototype.d.ts");
  const actual = readFileSync(declarationPath, "utf8");
  const expected = readFileSync(join(fixtureDir, "prototype.snapshot.d.ts"), "utf8");
  if (actual !== expected) {
    throw new Error("prototype declaration emit drifted from prototype.snapshot.d.ts");
  }
  if (
    !actual.includes("ContractMethodDecorator<Expected>") ||
    !actual.includes("ContractParameterDecorator<Expected>") ||
    !actual.includes("route(path?: string): MethodDecorator") ||
    !actual.includes("parameter(name: string): ParameterDecorator")
  ) {
    throw new Error("prototype declaration omitted a contract-bound decorator signature");
  }

  return declarationPath;
}

function verifyPackedConsumer(temporaryRoot: string, declarationPath: string): void {
  const packageRoot = join(temporaryRoot, "package");
  const distRoot = join(packageRoot, "dist");
  const packRoot = join(temporaryRoot, "pack");
  const consumerRoot = join(temporaryRoot, "consumer");
  mkdirSync(distRoot, { recursive: true });
  mkdirSync(packRoot, { recursive: true });
  mkdirSync(consumerRoot, { recursive: true });
  writeFileSync(join(packageRoot, "pnpm-workspace.yaml"), "packages: []\n");
  writeFileSync(join(consumerRoot, "pnpm-workspace.yaml"), "packages: []\n");
  copyFileSync(declarationPath, join(distRoot, "index.d.ts"));
  writeFileSync(
    join(distRoot, "index.mjs"),
    "export const definePrototypeContract = () => ({ kind: 'contract' });\nexport const parameter = () => () => undefined;\nexport const route = () => () => undefined;\n",
  );
  writeFileSync(
    join(distRoot, "index.cjs"),
    "exports.definePrototypeContract = () => ({ kind: 'contract' });\nexports.parameter = () => () => undefined;\nexports.route = () => () => undefined;\n",
  );
  writeJson(join(packageRoot, "package.json"), {
    name: "@croco/decorator-signature-prototype",
    version: "0.0.0",
    files: ["dist"],
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.mjs",
        require: "./dist/index.cjs",
      },
    },
  });

  assertSucceeded(
    "prototype package packing",
    runCommand("pnpm", ["pack", "--pack-destination", packRoot], packageRoot),
  );
  const tarballName = readdirSync(packRoot).find((entry) => entry.endsWith(".tgz"));
  if (!tarballName) throw new Error("prototype package tarball was not created");
  const tarballPath = join(packRoot, tarballName);

  writeJson(join(consumerRoot, "package.json"), {
    name: "decorator-signature-packed-consumer",
    private: true,
    type: "module",
  });
  assertSucceeded(
    "prototype package installation",
    runCommand("pnpm", ["add", "--offline", "--ignore-scripts", tarballPath], consumerRoot),
  );
  copyFileSync(join(fixtureDir, "packed-consumer.ts"), join(consumerRoot, "consumer.ts"));
  writeJson(join(consumerRoot, "tsconfig.json"), {
    compilerOptions: {
      experimentalDecorators: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: "ES2022",
    },
    files: ["consumer.ts"],
  });
  assertSucceeded(
    "packed TypeScript 6 consumer",
    runCommand(
      process.execPath,
      [tscPath, "--pretty", "false", "-p", "tsconfig.json"],
      consumerRoot,
    ),
  );

  writeFileSync(
    join(consumerRoot, "runtime.mjs"),
    "import { definePrototypeContract, parameter, route } from '@croco/decorator-signature-prototype';\nif (typeof definePrototypeContract !== 'function' || typeof parameter !== 'function' || typeof route !== 'function') process.exitCode = 1;\n",
  );
  writeFileSync(
    join(consumerRoot, "runtime.cjs"),
    "const { definePrototypeContract, parameter, route } = require('@croco/decorator-signature-prototype');\nif (typeof definePrototypeContract !== 'function' || typeof parameter !== 'function' || typeof route !== 'function') process.exitCode = 1;\n",
  );
  assertSucceeded("packed ESM entry", runCommand(process.execPath, ["runtime.mjs"], consumerRoot));
  assertSucceeded("packed CJS entry", runCommand(process.execPath, ["runtime.cjs"], consumerRoot));
}

function compareTypecheckPerformance(temporaryRoot: string): {
  readonly broad: CompilerMetrics;
  readonly delta: number;
  readonly strict: CompilerMetrics;
} {
  const performanceRoot = join(temporaryRoot, "performance");
  mkdirSync(performanceRoot, { recursive: true });
  copyFileSync(join(fixtureDir, "prototype.ts"), join(performanceRoot, "strict-prototype.ts"));
  writeFileSync(
    join(performanceRoot, "broad-prototype.ts"),
    [
      "export declare function contractMethod<Expected>(): MethodDecorator;",
      "export declare function contractParameter<Expected>(): ParameterDecorator;",
      "",
    ].join("\n"),
  );
  writeFileSync(join(performanceRoot, "broad.ts"), performanceSource("./broad-prototype"));
  writeFileSync(join(performanceRoot, "strict.ts"), performanceSource("./strict-prototype"));

  const broad = compilePerformanceFixture(join(performanceRoot, "broad.ts"));
  const strict = compilePerformanceFixture(join(performanceRoot, "strict.ts"));
  const delta = strict.instantiations - broad.instantiations;
  if (delta > performanceInstantiationBudget) {
    throw new Error(
      `strict decorator prototype added ${delta} type instantiations, exceeding ${performanceInstantiationBudget}`,
    );
  }
  return { broad, delta, strict };
}

function performanceSource(moduleSpecifier: string): string {
  const methods = Array.from({ length: 80 }, (_, index) =>
    [
      "  @contractMethod<string>()",
      `  method${index}(@contractParameter<string>() value: string): Promise<string> {`,
      "    return Promise.resolve(value);",
      "  }",
    ].join("\n"),
  );
  return [
    `import { contractMethod, contractParameter } from '${moduleSpecifier}';`,
    "",
    "class PerformanceController {",
    ...methods,
    "}",
    "",
    "void PerformanceController;",
    "",
  ].join("\n");
}

function compilePerformanceFixture(path: string): CompilerMetrics {
  const result = runTypeScript([
    "--ignoreConfig",
    "--noEmit",
    "--strict",
    "--experimentalDecorators",
    "--skipLibCheck",
    "--moduleResolution",
    "bundler",
    "--module",
    "preserve",
    "--target",
    "ES2022",
    "--extendedDiagnostics",
    path,
  ]);
  assertSucceeded(`performance fixture ${basename(path)}`, result);
  const instantiations = metric(result.stdout, "Instantiations");
  const checkTimeSeconds = metric(result.stdout, "Check time");
  return { checkTimeSeconds, instantiations };
}

function metric(output: string, label: string): number {
  const match = output.match(new RegExp(`^${label}:\\s+([0-9.]+)`, "m"));
  if (!match?.[1]) throw new Error(`TypeScript did not report ${label}`);
  return Number(match[1]);
}

function runTypeScript(arguments_: readonly string[]): CommandResult {
  return runCommand(process.execPath, [tscPath, "--pretty", "false", ...arguments_], rootDir);
}

function runCommand(command: string, arguments_: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function assertSucceeded(label: string, result: CommandResult): void {
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stdout}${result.stderr}`);
  }
}

function normalizeDiagnostics(output: string): string {
  const normalizedRoot = rootDir.replaceAll("\\", "/");
  return output.replaceAll("\\", "/").replaceAll(`${normalizedRoot}/`, "").trim();
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runDecoratorSignatureSpike();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`decorator-signature-spike: failed: ${message}`);
    process.exitCode = 1;
  }
}
