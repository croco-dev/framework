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

export type StrictContractBaseline = {
  readonly version: 1;
  readonly strictOptions: readonly string[];
  readonly packages: readonly string[];
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
  const current = rolloutPackages.flatMap((pkg) => runTypecheck(rootDir, pkg));
  const comparison = compareStrictContractDiagnostics(baseline.diagnostics, current);

  console.log(
    `strict-contract-typecheck: packages ${rolloutPackages.map((pkg) => pkg.name).join(", ")}`,
  );
  console.log(`strict-contract-typecheck: options ${strictOptions.join(", ")}`);
  console.log(
    `strict-contract-typecheck: accepted baseline diagnostics ${baseline.diagnostics.length}`,
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
