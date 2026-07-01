#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type StrictContractDiagnostic = {
  readonly packageName: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
};

export type StrictContractPackage = {
  readonly name: string;
  readonly path: string;
  readonly tsconfig: string;
};

export type StrictContractDeferral = {
  readonly packageName: string;
  readonly reason: string;
  readonly owner: string;
};

export type StrictContractBaseline = {
  readonly version: 1;
  readonly strictOptions: readonly string[];
  readonly packages: readonly string[];
  readonly deferrals: readonly StrictContractDeferral[];
  readonly diagnostics: readonly StrictContractDiagnostic[];
};

export type StrictContractComparison = {
  readonly added: readonly StrictContractDiagnostic[];
  readonly removed: readonly StrictContractDiagnostic[];
};

export type StrictContractCollectedDiagnostics = {
  readonly targetDiagnostics: readonly StrictContractDiagnostic[];
  readonly fatalDiagnostics: readonly string[];
};

const rolloutPackages: readonly StrictContractPackage[] = [
  {
    name: "@croco/protocols-core",
    path: "packages/protocols-core",
    tsconfig: "packages/protocols-core/tsconfig.contract-strict.json",
  },
  {
    name: "@croco/protocols-rest",
    path: "packages/protocols-rest",
    tsconfig: "packages/protocols-rest/tsconfig.contract-strict.json",
  },
  {
    name: "@croco/openapi-spec",
    path: "packages/openapi-spec",
    tsconfig: "packages/openapi-spec/tsconfig.contract-strict.json",
  },
  {
    name: "@croco/rpc-codegen",
    path: "packages/rpc-codegen",
    tsconfig: "packages/rpc-codegen/tsconfig.contract-strict.json",
  },
  {
    name: "@croco/transports-http",
    path: "packages/transports-http",
    tsconfig: "packages/transports-http/tsconfig.contract-strict.json",
  },
];

const baselinePath = "tsconfig/contract-strict.baseline.json";
const strictOptions = [
  "exactOptionalPropertyTypes",
  "noUncheckedIndexedAccess",
  "noPropertyAccessFromIndexSignature",
] as const;

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function toRelativeDiagnosticFile(rootDir: string, file: string): string {
  const absoluteFile = isAbsolute(file) ? file : resolve(rootDir, file);
  return toPosixPath(relative(rootDir, absoluteFile));
}

function normalizeDiagnosticLine(
  rootDir: string,
  pkg: StrictContractPackage,
  line: string,
): StrictContractDiagnostic | null {
  const match = line.match(
    /^(?<file>.+?)\((?<line>\d+),(?<column>\d+)\): error TS(?<code>\d+): (?<message>.*)$/,
  );
  const groups = match?.groups;
  if (!groups) {
    return null;
  }

  const file = toRelativeDiagnosticFile(rootDir, groups.file ?? "");
  if (!file.startsWith(`${pkg.path}/`)) {
    return null;
  }

  return {
    packageName: pkg.name,
    file,
    line: Number(groups.line ?? 0),
    column: Number(groups.column ?? 0),
    code: `TS${groups.code ?? ""}`,
    message: groups.message ?? "",
  };
}

export function normalizeStrictContractDiagnostics(
  rootDir: string,
  pkg: StrictContractPackage,
  output: string,
): readonly StrictContractDiagnostic[] {
  return collectStrictContractDiagnostics(rootDir, pkg, output).targetDiagnostics;
}

export function collectStrictContractDiagnostics(
  rootDir: string,
  pkg: StrictContractPackage,
  output: string,
): StrictContractCollectedDiagnostics {
  const targetDiagnostics: StrictContractDiagnostic[] = [];
  const fatalDiagnostics: string[] = [];
  let previousLineWasFileDiagnostic = false;

  for (const line of output.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    if (isIgnorableToolingDiagnostic(trimmedLine)) {
      previousLineWasFileDiagnostic = false;
      continue;
    }

    if (/^.+?\(\d+,\d+\): error TS\d+: /.test(line)) {
      const diagnostic = normalizeDiagnosticLine(rootDir, pkg, line);
      if (diagnostic) {
        targetDiagnostics.push(diagnostic);
      }
      previousLineWasFileDiagnostic = true;
      continue;
    }

    if (/^\s+/.test(line) && previousLineWasFileDiagnostic) {
      continue;
    }

    previousLineWasFileDiagnostic = false;
    fatalDiagnostics.push(trimmedLine);
  }

  return {
    targetDiagnostics: targetDiagnostics.sort(compareDiagnostics),
    fatalDiagnostics,
  };
}

function isIgnorableToolingDiagnostic(line: string): boolean {
  return line.startsWith('[WARN] The "pnpm" field in package.json is no longer read by pnpm.');
}

function diagnosticKey(diagnostic: StrictContractDiagnostic): string {
  return [
    diagnostic.packageName,
    diagnostic.file,
    String(diagnostic.line),
    String(diagnostic.column),
    diagnostic.code,
    diagnostic.message,
  ].join("\u0000");
}

function compareDiagnostics(a: StrictContractDiagnostic, b: StrictContractDiagnostic): number {
  return diagnosticKey(a).localeCompare(diagnosticKey(b));
}

export function compareStrictContractDiagnostics(
  baseline: readonly StrictContractDiagnostic[],
  current: readonly StrictContractDiagnostic[],
): StrictContractComparison {
  const baselineKeys = new Set(baseline.map(diagnosticKey));
  const currentKeys = new Set(current.map(diagnosticKey));

  return {
    added: current.filter((diagnostic) => !baselineKeys.has(diagnosticKey(diagnostic))),
    removed: baseline.filter((diagnostic) => !currentKeys.has(diagnosticKey(diagnostic))),
  };
}

function readBaseline(rootDir: string): StrictContractBaseline {
  return JSON.parse(readFileSync(join(rootDir, baselinePath), "utf-8")) as StrictContractBaseline;
}

function describeList(values: readonly string[]): string {
  return values.length === 0 ? "<empty>" : values.join(", ");
}

function listsMatch(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateStrictContractBaselineConfiguration(
  baseline: StrictContractBaseline,
): void {
  if (baseline.version !== 1) {
    throw new Error(`Unsupported baseline version: ${baseline.version}`);
  }

  if (!listsMatch(baseline.strictOptions, strictOptions)) {
    throw new Error(
      `Baseline strictOptions mismatch. Expected: ${describeList(strictOptions)}; Actual: ${describeList(baseline.strictOptions)}`,
    );
  }

  const rolloutPackageNames = rolloutPackages.map((pkg) => pkg.name);
  if (!listsMatch(baseline.packages, rolloutPackageNames)) {
    throw new Error(
      `Baseline packages mismatch. Expected: ${describeList(rolloutPackageNames)}; Actual: ${describeList(baseline.packages)}`,
    );
  }

  if (!Array.isArray(baseline.deferrals)) {
    throw new Error("Baseline deferrals must be an array");
  }

  const rolloutPackageNameSet = new Set(rolloutPackageNames);
  const diagnosticPackageNames = new Set<string>();
  for (const diagnostic of baseline.diagnostics) {
    if (!rolloutPackageNameSet.has(diagnostic.packageName)) {
      throw new Error(
        `Baseline diagnostic references unknown rollout package: ${diagnostic.packageName}`,
      );
    }
    diagnosticPackageNames.add(diagnostic.packageName);
  }

  const deferralPackageNames = new Set<string>();
  for (const deferral of baseline.deferrals) {
    if (!rolloutPackageNameSet.has(deferral.packageName)) {
      throw new Error(
        `Baseline deferral references unknown rollout package: ${deferral.packageName}`,
      );
    }
    if (deferralPackageNames.has(deferral.packageName)) {
      throw new Error(`Baseline deferral is duplicated for package: ${deferral.packageName}`);
    }
    if (!hasText(deferral.reason)) {
      throw new Error(`Baseline deferral for ${deferral.packageName} must include a reason`);
    }
    if (!hasText(deferral.owner)) {
      throw new Error(`Baseline deferral for ${deferral.packageName} must include an owner`);
    }
    if (!diagnosticPackageNames.has(deferral.packageName)) {
      throw new Error(`Baseline deferral for ${deferral.packageName} has no matching diagnostics`);
    }
    deferralPackageNames.add(deferral.packageName);
  }

  for (const packageName of diagnosticPackageNames) {
    if (!deferralPackageNames.has(packageName)) {
      throw new Error(
        `Baseline diagnostics for ${packageName} require deferral metadata with reason and owner`,
      );
    }
  }
}

export function validateStrictContractPackageConfiguration(
  rootDir: string,
  pkg: StrictContractPackage,
): void {
  const tsconfigPath = join(rootDir, pkg.tsconfig);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Strict tsconfig missing for ${pkg.name}: ${pkg.tsconfig}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Strict tsconfig invalid for ${pkg.name}: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Strict tsconfig for ${pkg.name} must be a JSON object: ${pkg.tsconfig}`);
  }

  const compilerOptions = parsed.compilerOptions;
  if (!isRecord(compilerOptions)) {
    throw new Error(
      `Strict tsconfig for ${pkg.name} must include compilerOptions: ${pkg.tsconfig}`,
    );
  }

  for (const option of strictOptions) {
    if (compilerOptions[option] !== true) {
      throw new Error(
        `Strict tsconfig for ${pkg.name} must set compilerOptions.${option} to true: ${pkg.tsconfig}`,
      );
    }
  }
}

export function validateStrictContractPackageConfigurations(
  rootDir: string,
  packages: readonly StrictContractPackage[] = rolloutPackages,
): void {
  for (const pkg of packages) {
    validateStrictContractPackageConfiguration(rootDir, pkg);
  }
}

function runTypecheck(
  rootDir: string,
  pkg: StrictContractPackage,
): readonly StrictContractDiagnostic[] {
  const result = spawnSync("pnpm", ["exec", "tsc", "--pretty", "false", "-p", pkg.tsconfig], {
    cwd: rootDir,
    encoding: "utf-8",
  });

  if (result.error) {
    throw result.error;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const diagnostics = collectStrictContractDiagnostics(rootDir, pkg, output);

  if (result.status !== 0 && diagnostics.fatalDiagnostics.length > 0) {
    for (const diagnostic of diagnostics.fatalDiagnostics) {
      console.error(`fatal ${diagnostic}`);
    }
    throw new Error(
      `tsc exited ${result.status} for ${pkg.name} with unclassified diagnostic output`,
    );
  }

  if (result.status !== 0 && diagnostics.targetDiagnostics.length === 0 && output.trim() === "") {
    throw new Error(`tsc exited ${result.status} for ${pkg.name} without diagnostic output`);
  }

  return diagnostics.targetDiagnostics;
}

function printDiagnostic(prefix: string, diagnostic: StrictContractDiagnostic): void {
  console.error(
    `${prefix} ${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code}: ${diagnostic.message}`,
  );
}

function main(): void {
  const rootDir = process.cwd();
  const baseline = readBaseline(rootDir);
  validateStrictContractBaselineConfiguration(baseline);
  validateStrictContractPackageConfigurations(rootDir);
  const current = rolloutPackages.flatMap((pkg) => runTypecheck(rootDir, pkg));
  const comparison = compareStrictContractDiagnostics(baseline.diagnostics, current);

  console.log(
    `strict-contract-typecheck: packages ${rolloutPackages.map((pkg) => pkg.name).join(", ")}`,
  );
  console.log(`strict-contract-typecheck: options ${strictOptions.join(", ")}`);
  console.log(
    `strict-contract-typecheck: accepted baseline diagnostics ${baseline.diagnostics.length}`,
  );
  console.log(
    `strict-contract-typecheck: accepted baseline deferrals ${baseline.deferrals.length}`,
  );

  for (const diagnostic of comparison.added) {
    printDiagnostic("added", diagnostic);
  }

  for (const diagnostic of comparison.removed) {
    printDiagnostic("removed", diagnostic);
  }

  if (comparison.added.length > 0 || comparison.removed.length > 0) {
    console.error(
      `strict-contract-typecheck: ${comparison.added.length} added and ${comparison.removed.length} removed diagnostic(s) relative to ${baselinePath}`,
    );
    process.exit(1);
  }

  console.log("strict-contract-typecheck: baseline matched");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`strict-contract-typecheck: failed: ${message}`);
    process.exit(1);
  }
}
