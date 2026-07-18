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
  readonly slug: string;
  readonly path: string;
  readonly tsconfig: string;
};

export type StrictContractDebt = "staged-rollout" | "accepted-release-debt";

export type StrictContractDebtTarget = {
  readonly expiresOn?: string;
  readonly targetMilestone?: string;
};

export type StrictContractDeferral = StrictContractDebtTarget & {
  readonly packageName: string;
  readonly reason: string;
  readonly owner: string;
  readonly debt: StrictContractDebt;
};

export type StrictContractExemption = StrictContractDebtTarget & {
  readonly packageName: string;
  readonly reason: string;
  readonly owner: string;
};

export type StrictContractBaseline = {
  readonly version: 1;
  readonly strictOptions: readonly string[];
  readonly packages: readonly string[];
  readonly exemptions: readonly StrictContractExemption[];
  readonly deferrals: readonly StrictContractDeferral[];
  readonly diagnostics: readonly StrictContractDiagnostic[];
};

export type StrictContractComparison = {
  readonly added: readonly StrictContractDiagnostic[];
  readonly removed: readonly StrictContractDiagnostic[];
  readonly unchanged: readonly StrictContractDiagnostic[];
};

export type StrictContractCollectedDiagnostics = {
  readonly targetDiagnostics: readonly StrictContractDiagnostic[];
  readonly fatalDiagnostics: readonly string[];
};

export type StrictContractCliOptions = {
  readonly rc: boolean;
};

const baselinePath = "tsconfig/contract-strict.baseline.json";
const packageCatalogPath = "docs/package-catalog.json";
const strictConfigFileName = "tsconfig.contract-strict.json";
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

function normalizeDiagnosticMessage(rootDir: string, message: string): string {
  const rootPrefix = `${toPosixPath(resolve(rootDir))}/`;
  return toPosixPath(message).split(rootPrefix).join("");
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
    message: normalizeDiagnosticMessage(rootDir, groups.message ?? ""),
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
    unchanged: current.filter((diagnostic) => baselineKeys.has(diagnosticKey(diagnostic))),
  };
}

function readJsonFile(rootDir: string, path: string): unknown {
  return JSON.parse(readFileSync(join(rootDir, path), "utf-8"));
}

function readBaseline(rootDir: string): StrictContractBaseline {
  return readJsonFile(rootDir, baselinePath) as StrictContractBaseline;
}

export function resolveStrictContractSpinePackages(
  rootDir: string,
): readonly StrictContractPackage[] {
  const catalog = readJsonFile(rootDir, packageCatalogPath);
  if (!isRecord(catalog) || !isRecord(catalog.spine) || !Array.isArray(catalog.spine.packages)) {
    throw new Error(`Package catalog must include spine.packages: ${packageCatalogPath}`);
  }

  const slugs = catalog.spine.packages;
  const seenSlugs = new Set<string>();
  const seenPackageNames = new Set<string>();
  const packages: StrictContractPackage[] = [];

  for (const value of slugs) {
    if (!hasText(value)) {
      throw new Error(
        `Package catalog spine package slug must be non-empty: ${packageCatalogPath}`,
      );
    }
    const slug = value.trim();
    if (seenSlugs.has(slug)) {
      throw new Error(`Package catalog spine package slug is duplicated: ${slug}`);
    }
    seenSlugs.add(slug);

    const path = `packages/${slug}`;
    const packageJsonPath = `${path}/package.json`;
    const manifest = readJsonFile(rootDir, packageJsonPath);
    if (!isRecord(manifest) || !hasText(manifest.name)) {
      throw new Error(`Spine package manifest must include name: ${packageJsonPath}`);
    }

    const packageName = manifest.name.trim();
    if (seenPackageNames.has(packageName)) {
      throw new Error(`Spine package publish name is duplicated: ${packageName}`);
    }
    seenPackageNames.add(packageName);

    packages.push({
      name: packageName,
      slug,
      path,
      tsconfig: `${path}/${strictConfigFileName}`,
    });
  }

  return packages;
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

function uniqueNameSet(kind: string, values: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const value of values) {
    if (!hasText(value)) {
      throw new Error(`${kind} must be a non-empty package name`);
    }
    if (names.has(value)) {
      throw new Error(`${kind} is duplicated for package: ${value}`);
    }
    names.add(value);
  }
  return names;
}

function requireDebtTarget(kind: string, target: StrictContractDebtTarget): void {
  const hasExpiresOn = hasText(target.expiresOn);
  const hasTargetMilestone = hasText(target.targetMilestone);
  if (!hasExpiresOn && !hasTargetMilestone) {
    throw new Error(`${kind} must include expiresOn or targetMilestone`);
  }
  if (hasExpiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(target.expiresOn ?? "")) {
    throw new Error(`${kind} expiresOn must use YYYY-MM-DD format`);
  }
}

function isStrictContractDebt(value: unknown): value is StrictContractDebt {
  return value === "staged-rollout" || value === "accepted-release-debt";
}

export function validateStrictContractBaselineConfiguration(
  baseline: StrictContractBaseline,
  spinePackages: readonly StrictContractPackage[] = resolveStrictContractSpinePackages(
    process.cwd(),
  ),
): void {
  if (baseline.version !== 1) {
    throw new Error(`Unsupported baseline version: ${baseline.version}`);
  }

  if (!Array.isArray(baseline.strictOptions)) {
    throw new Error("Baseline strictOptions must be an array");
  }

  if (!listsMatch(baseline.strictOptions, strictOptions)) {
    throw new Error(
      `Baseline strictOptions mismatch. Expected: ${describeList(strictOptions)}; Actual: ${describeList(baseline.strictOptions)}`,
    );
  }

  if (!Array.isArray(baseline.packages)) {
    throw new Error("Baseline packages must be an array");
  }
  if (!Array.isArray(baseline.exemptions)) {
    throw new Error("Baseline exemptions must be an array");
  }
  if (!Array.isArray(baseline.deferrals)) {
    throw new Error("Baseline deferrals must be an array");
  }
  if (!Array.isArray(baseline.diagnostics)) {
    throw new Error("Baseline diagnostics must be an array");
  }

  const spinePackageNames = spinePackages.map((pkg) => pkg.name);
  const spinePackageNameSet = new Set(spinePackageNames);
  const enrolledPackageNameSet = uniqueNameSet("Baseline package", baseline.packages);
  const exemptionPackageNames = baseline.exemptions.map((exemption) => exemption.packageName);
  const exemptionPackageNameSet = uniqueNameSet("Baseline exemption", exemptionPackageNames);

  for (const packageName of baseline.packages) {
    if (!spinePackageNameSet.has(packageName)) {
      throw new Error(`Baseline package is not in the 1.0 spine catalog: ${packageName}`);
    }
  }

  for (const exemption of baseline.exemptions) {
    if (!spinePackageNameSet.has(exemption.packageName)) {
      throw new Error(
        `Baseline exemption references package outside the 1.0 spine catalog: ${exemption.packageName}`,
      );
    }
    if (enrolledPackageNameSet.has(exemption.packageName)) {
      throw new Error(
        `Baseline package cannot be both enrolled and exempted: ${exemption.packageName}`,
      );
    }
    if (!hasText(exemption.reason)) {
      throw new Error(`Baseline exemption for ${exemption.packageName} must include a reason`);
    }
    if (!hasText(exemption.owner)) {
      throw new Error(`Baseline exemption for ${exemption.packageName} must include an owner`);
    }
    requireDebtTarget(`Baseline exemption for ${exemption.packageName}`, exemption);
  }

  const expectedEnrolledPackages = spinePackageNames.filter(
    (packageName) => !exemptionPackageNameSet.has(packageName),
  );
  if (!listsMatch(baseline.packages, expectedEnrolledPackages)) {
    throw new Error(
      `Baseline packages mismatch. Expected enrolled spine packages: ${describeList(expectedEnrolledPackages)}; Actual: ${describeList(baseline.packages)}`,
    );
  }

  const expectedExemptions = spinePackageNames.filter(
    (packageName) => !enrolledPackageNameSet.has(packageName),
  );
  if (!listsMatch(exemptionPackageNames, expectedExemptions)) {
    throw new Error(
      `Baseline exemptions mismatch. Expected exempted spine packages: ${describeList(expectedExemptions)}; Actual: ${describeList(exemptionPackageNames)}`,
    );
  }

  const diagnosticPackageNames = new Set<string>();
  for (const diagnostic of baseline.diagnostics) {
    if (!enrolledPackageNameSet.has(diagnostic.packageName)) {
      throw new Error(
        `Baseline diagnostic references package that is not enrolled in strict-contract mode: ${diagnostic.packageName}`,
      );
    }
    diagnosticPackageNames.add(diagnostic.packageName);
  }

  const deferralPackageNames = new Set<string>();
  for (const deferral of baseline.deferrals) {
    if (!enrolledPackageNameSet.has(deferral.packageName)) {
      throw new Error(
        `Baseline deferral references package that is not enrolled in strict-contract mode: ${deferral.packageName}`,
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
    if (!isStrictContractDebt(deferral.debt)) {
      throw new Error(
        `Baseline deferral for ${deferral.packageName} must set debt to staged-rollout or accepted-release-debt`,
      );
    }
    requireDebtTarget(`Baseline deferral for ${deferral.packageName}`, deferral);
    if (!diagnosticPackageNames.has(deferral.packageName)) {
      throw new Error(`Baseline deferral for ${deferral.packageName} has no matching diagnostics`);
    }
    deferralPackageNames.add(deferral.packageName);
  }

  for (const packageName of diagnosticPackageNames) {
    if (!deferralPackageNames.has(packageName)) {
      throw new Error(
        `Baseline diagnostics for ${packageName} require deferral metadata with reason, owner, debt, and expiresOn or targetMilestone`,
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
  packages: readonly StrictContractPackage[],
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
    shell: process.platform === "win32",
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

function formatDeferralList(deferrals: readonly StrictContractDeferral[]): string {
  return describeList(deferrals.map((deferral) => deferral.packageName));
}

function parseEnvRc(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function parseStrictContractCliOptions(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): StrictContractCliOptions {
  let rc = parseEnvRc(env.CROCO_STRICT_CONTRACT_RC);

  for (const arg of args) {
    if (arg === "--rc") {
      rc = true;
      continue;
    }
    throw new Error(`Unknown strict-contract-typecheck argument: ${arg}`);
  }

  return { rc };
}

export function findRcRejectedDiagnostics(
  baseline: StrictContractBaseline,
  comparison: StrictContractComparison,
): readonly StrictContractDiagnostic[] {
  const deferralByPackageName = new Map(
    baseline.deferrals.map((deferral) => [deferral.packageName, deferral]),
  );

  return comparison.unchanged.filter(
    (diagnostic) =>
      deferralByPackageName.get(diagnostic.packageName)?.debt !== "accepted-release-debt",
  );
}

function printReleaseSummary(
  mode: "staged" | "rc",
  spinePackages: readonly StrictContractPackage[],
  enrolledPackages: readonly StrictContractPackage[],
  baseline: StrictContractBaseline,
  comparison: StrictContractComparison,
): void {
  const stagedDeferrals = baseline.deferrals.filter(
    (deferral) => deferral.debt === "staged-rollout",
  );
  const acceptedReleaseDebt = baseline.deferrals.filter(
    (deferral) => deferral.debt === "accepted-release-debt",
  );

  console.log(`strict-contract-typecheck: mode ${mode}`);
  console.log(`strict-contract-typecheck: spine packages ${spinePackages.length}`);
  console.log(`strict-contract-typecheck: enrolled packages ${enrolledPackages.length}`);
  console.log(`strict-contract-typecheck: exempted packages ${baseline.exemptions.length}`);
  console.log(
    `strict-contract-typecheck: packages ${enrolledPackages.map((pkg) => pkg.name).join(", ")}`,
  );
  console.log(`strict-contract-typecheck: options ${strictOptions.join(", ")}`);
  console.log(
    `strict-contract-typecheck: accepted baseline diagnostics ${baseline.diagnostics.length}`,
  );
  console.log(
    `strict-contract-typecheck: diagnostics added ${comparison.added.length}, removed ${comparison.removed.length}, unchanged ${comparison.unchanged.length}`,
  );
  console.log(
    `strict-contract-typecheck: staged rollout deferrals ${stagedDeferrals.length} (${formatDeferralList(stagedDeferrals)})`,
  );
  console.log(
    `strict-contract-typecheck: accepted release debt deferrals ${acceptedReleaseDebt.length} (${formatDeferralList(acceptedReleaseDebt)})`,
  );

  if (baseline.exemptions.length > 0) {
    console.log(
      `strict-contract-typecheck: exemptions ${baseline.exemptions.map((exemption) => exemption.packageName).join(", ")}`,
    );
  }
}

function main(): void {
  const rootDir = process.cwd();
  const options = parseStrictContractCliOptions(process.argv.slice(2), process.env);
  const mode = options.rc ? "rc" : "staged";
  const spinePackages = resolveStrictContractSpinePackages(rootDir);
  const baseline = readBaseline(rootDir);
  validateStrictContractBaselineConfiguration(baseline, spinePackages);
  const enrolledPackageNameSet = new Set(baseline.packages);
  const enrolledPackages = spinePackages.filter((pkg) => enrolledPackageNameSet.has(pkg.name));
  validateStrictContractPackageConfigurations(rootDir, enrolledPackages);
  const current = enrolledPackages.flatMap((pkg) => runTypecheck(rootDir, pkg));
  const comparison = compareStrictContractDiagnostics(baseline.diagnostics, current);
  const rcRejectedDiagnostics = options.rc ? findRcRejectedDiagnostics(baseline, comparison) : [];

  printReleaseSummary(mode, spinePackages, enrolledPackages, baseline, comparison);

  for (const diagnostic of comparison.added) {
    printDiagnostic("added", diagnostic);
  }

  for (const diagnostic of comparison.removed) {
    printDiagnostic("removed", diagnostic);
  }

  for (const diagnostic of rcRejectedDiagnostics) {
    printDiagnostic("rc-blocked", diagnostic);
  }

  if (comparison.added.length > 0 || comparison.removed.length > 0) {
    console.error(
      `strict-contract-typecheck: ${comparison.added.length} added and ${comparison.removed.length} removed diagnostic(s) relative to ${baselinePath}`,
    );
    process.exit(1);
  }

  if (rcRejectedDiagnostics.length > 0) {
    console.error(
      `strict-contract-typecheck: rc mode rejected ${rcRejectedDiagnostics.length} staged diagnostic debt item(s); mark each deferral as accepted-release-debt or burn it down before RC`,
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
