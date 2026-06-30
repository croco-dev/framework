#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import { type PackageInfo, readPackages } from "./package-quality-report.mts";

type CheckStatus = "pass" | "fail" | "not-applicable";
type MaturityKey = (typeof maturityOrder)[number];
type RuntimeKey = (typeof runtimeKeys)[number];
type CertificationState = (typeof certificationStates)[number];
type CommandEvidenceKey = (typeof commandEvidenceKeys)[number];

type Options = {
  readonly rootDir: string;
  readonly outputDir: string;
};

type WorkspacePackage = {
  readonly name: string;
  readonly shortName: string;
  readonly relativeDir: string;
  readonly group: string;
  readonly maturity: MaturityKey;
  readonly extensionRuntimes: readonly RuntimeKey[];
};

type CatalogEvidence = {
  readonly errors: readonly string[];
  readonly groupByPackage: ReadonlyMap<string, string>;
  readonly maturityByPackage: ReadonlyMap<string, MaturityKey>;
  readonly productionPackages: ReadonlySet<string>;
  readonly extensionGroups: ReadonlySet<string>;
  readonly extensionRuntimesByPackage: ReadonlyMap<string, readonly RuntimeKey[]>;
  readonly certification: CertificationCatalog;
};

type CertificationCatalog = {
  readonly records: ReadonlyMap<string, CertificationRecord>;
  readonly recordCount: number;
  readonly knownGapAllowances: ReadonlyMap<string, ReadonlyMap<string, KnownGapAllowance>>;
};

type CertificationRecord = {
  readonly packageName: string;
  readonly packageShortName: string;
  readonly state: CertificationState | null;
  readonly contract: string | null;
  readonly packageVersion: string | null;
  readonly runtimes: readonly RuntimeKey[];
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly knownGaps: readonly string[] | null;
  readonly errors: readonly string[];
};

type KnownGapAllowance = {
  readonly reason: string;
  readonly owner: string;
  readonly expiresAt: string | null;
};

type ProviderCertificationCheck = {
  readonly id: string;
  readonly label: string;
  readonly status: CheckStatus;
  readonly evidence: string;
  readonly recovery: string | null;
};

export type ProviderCertificationRow = {
  readonly packageName: string;
  readonly relativeDir: string;
  readonly group: string;
  readonly maturity: MaturityKey;
  readonly requiredForProduction: boolean;
  readonly state: CertificationState | "missing" | "invalid";
  readonly runtimes: readonly RuntimeKey[];
  readonly checks: readonly ProviderCertificationCheck[];
};

export type CertificationClaimViolation = {
  readonly file: string;
  readonly line: number;
  readonly excerpt: string;
  readonly message: string;
};

export type ProviderCertificationReport = {
  readonly generatedAt: string;
  readonly rootDir: string;
  readonly catalogErrors: readonly string[];
  readonly claimViolations: readonly CertificationClaimViolation[];
  readonly rows: readonly ProviderCertificationRow[];
  readonly summary: {
    readonly extensionPackageCount: number;
    readonly productionExtensionPackageCount: number;
    readonly certificationRecordCount: number;
  };
};

const reportDirectory = join("ci-reports", "package-quality");
const reportMarkdownFileName = "provider-certification.md";
const reportJsonFileName = "provider-certification.json";
const catalogMetadataPath = join("docs", "package-catalog.json");
const maturityOrder = ["production", "beta", "alpha", "deprecated"] as const;
const runtimeKeys = ["node", "lambda", "cloudflare-workers", "browser"] as const;
const certificationStates = ["uncertified", "candidate", "certified"] as const;
const commandEvidenceKeys = [
  "conformance",
  "noCredentialSmoke",
  "diagnostics",
  "redaction",
] as const;
const evidenceKeys = [...commandEvidenceKeys, "liveSmoke"] as const;
const certificationClaimPatterns: readonly RegExp[] = [
  /Croco compatible\s*:/i,
  /!\[[^\]]*\b(?:certified|certification|Croco compatible)\b[^\]]*\]/i,
  /\[[^\]]*\b(?:certified|certification|Croco compatible)\b[^\]]*\]\([^)]+\)/i,
  /\bcertified\s+(?:for|against|with)\s+(?:the\s+)?Croco\b/i,
  /\bCroco\s+certified\b/i,
];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRuntimeKey(value: string): value is RuntimeKey {
  return runtimeKeys.includes(value as RuntimeKey);
}

function isCertificationState(value: string): value is CertificationState {
  return certificationStates.includes(value as CertificationState);
}

function certificationStateRank(state: CertificationState | null): number {
  if (state === "certified") {
    return 3;
  }
  if (state === "candidate") {
    return 2;
  }
  if (state === "uncertified") {
    return 1;
  }
  return 0;
}

function toShortPackageName(packageName: string): string {
  return packageName.replace(/^@croco\//, "");
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function normalizeRelativePath(path: string): string {
  return toPosixPath(path).replace(/^\.\//, "");
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
}

function parseCatalogGroups(groupsValue: unknown, errors: string[]): ReadonlyMap<string, string> {
  const groupByPackage = new Map<string, string>();

  if (!isRecord(groupsValue)) {
    errors.push(`${catalogMetadataPath}: groups must be an object`);
    return groupByPackage;
  }

  for (const [groupName, groupValue] of Object.entries(groupsValue)) {
    if (!isRecord(groupValue)) {
      errors.push(`${catalogMetadataPath}: groups.${groupName} must be an object`);
      continue;
    }

    if (!isStringArray(groupValue.packages)) {
      errors.push(`${catalogMetadataPath}: groups.${groupName}.packages must be a string array`);
      continue;
    }

    for (const packageName of groupValue.packages) {
      const previousGroup = groupByPackage.get(packageName);
      if (previousGroup) {
        errors.push(
          `${catalogMetadataPath}: package ${packageName} appears in multiple groups (${previousGroup}, ${groupName})`,
        );
        continue;
      }
      groupByPackage.set(packageName, groupName);
    }
  }

  return groupByPackage;
}

function readMaturityPackages(
  maturityValue: unknown,
  maturity: MaturityKey,
  errors: string[],
): readonly string[] {
  if (!isRecord(maturityValue)) {
    errors.push(`${catalogMetadataPath}: maturity.${maturity} must be an object`);
    return [];
  }

  if (!isStringArray(maturityValue.packages)) {
    errors.push(`${catalogMetadataPath}: maturity.${maturity}.packages must be a string array`);
    return [];
  }

  return maturityValue.packages;
}

function parseCatalogMaturity(
  maturityRoot: unknown,
  errors: string[],
): {
  readonly maturityByPackage: ReadonlyMap<string, MaturityKey>;
  readonly productionPackages: ReadonlySet<string>;
} {
  const maturityByPackage = new Map<string, MaturityKey>();
  let productionPackages: readonly string[] = [];

  if (!isRecord(maturityRoot)) {
    errors.push(`${catalogMetadataPath}: maturity must be an object`);
    return { maturityByPackage, productionPackages: new Set() };
  }

  for (const maturity of maturityOrder) {
    const packageNames = readMaturityPackages(maturityRoot[maturity], maturity, errors);
    if (maturity === "production") {
      productionPackages = packageNames;
    }

    for (const packageName of packageNames) {
      const previousMaturity = maturityByPackage.get(packageName);
      if (previousMaturity) {
        errors.push(
          `${catalogMetadataPath}: package ${packageName} appears in multiple maturity buckets (${previousMaturity}, ${maturity})`,
        );
        continue;
      }
      maturityByPackage.set(packageName, maturity);
    }
  }

  return { maturityByPackage, productionPackages: new Set(productionPackages) };
}

function parseRuntimeList(value: unknown, path: string, errors: string[]): readonly RuntimeKey[] {
  if (!isStringArray(value)) {
    errors.push(`${path} must be a string array`);
    return [];
  }

  const runtimes: RuntimeKey[] = [];
  for (const runtime of value) {
    if (!isRuntimeKey(runtime)) {
      errors.push(`${path} contains unsupported runtime ${runtime}`);
      continue;
    }
    runtimes.push(runtime);
  }

  return runtimes;
}

function parseExtensionMatrix(
  extensionMatrix: unknown,
  errors: string[],
): {
  readonly extensionGroups: ReadonlySet<string>;
  readonly extensionRuntimesByPackage: ReadonlyMap<string, readonly RuntimeKey[]>;
} {
  if (!isRecord(extensionMatrix)) {
    errors.push(`${catalogMetadataPath}: extensionMatrix must be an object`);
    return {
      extensionGroups: new Set(),
      extensionRuntimesByPackage: new Map(),
    };
  }

  if (!isStringArray(extensionMatrix.groups)) {
    errors.push(`${catalogMetadataPath}: extensionMatrix.groups must be a string array`);
  }

  if (!isRecord(extensionMatrix.packages)) {
    errors.push(`${catalogMetadataPath}: extensionMatrix.packages must be an object`);
    return {
      extensionGroups: new Set(isStringArray(extensionMatrix.groups) ? extensionMatrix.groups : []),
      extensionRuntimesByPackage: new Map(),
    };
  }

  const extensionRuntimesByPackage = new Map<string, readonly RuntimeKey[]>();
  for (const [packageName, packageValue] of Object.entries(extensionMatrix.packages)) {
    if (!isRecord(packageValue)) {
      errors.push(
        `${catalogMetadataPath}: extensionMatrix.packages.${packageName} must be an object`,
      );
      continue;
    }

    extensionRuntimesByPackage.set(
      packageName,
      parseRuntimeList(
        packageValue.runtimes,
        `${catalogMetadataPath}: extensionMatrix.packages.${packageName}.runtimes`,
        errors,
      ),
    );
  }

  return {
    extensionGroups: new Set(isStringArray(extensionMatrix.groups) ? extensionMatrix.groups : []),
    extensionRuntimesByPackage,
  };
}

function parseKnownGapAllowances(
  policyValue: unknown,
  errors: string[],
): ReadonlyMap<string, ReadonlyMap<string, KnownGapAllowance>> {
  if (policyValue === undefined) {
    return new Map();
  }

  if (!isRecord(policyValue)) {
    errors.push(`${catalogMetadataPath}: certification.policy must be an object`);
    return new Map();
  }

  const allowancesValue = policyValue.knownGapAllowances;
  if (allowancesValue === undefined) {
    return new Map();
  }

  if (!isRecord(allowancesValue)) {
    errors.push(
      `${catalogMetadataPath}: certification.policy.knownGapAllowances must be an object`,
    );
    return new Map();
  }

  const allowances = new Map<string, ReadonlyMap<string, KnownGapAllowance>>();
  for (const [packageName, packageAllowances] of Object.entries(allowancesValue)) {
    if (packageName === "*" || packageName === "global") {
      errors.push(
        `${catalogMetadataPath}: certification.policy.knownGapAllowances.${packageName} is a global allowance; allowances must be package-scoped`,
      );
      continue;
    }

    if (!isRecord(packageAllowances)) {
      errors.push(
        `${catalogMetadataPath}: certification.policy.knownGapAllowances.${packageName} must be an object`,
      );
      continue;
    }

    const packageAllowanceMap = new Map<string, KnownGapAllowance>();
    for (const [gapId, allowanceValue] of Object.entries(packageAllowances)) {
      if (gapId.trim().length === 0) {
        errors.push(
          `${catalogMetadataPath}: certification.policy.knownGapAllowances.${packageName} contains an empty known-gap id`,
        );
        continue;
      }

      if (!isRecord(allowanceValue)) {
        errors.push(
          `${catalogMetadataPath}: certification.policy.knownGapAllowances.${packageName}.${gapId} must be an object`,
        );
        continue;
      }

      const reason = typeof allowanceValue.reason === "string" ? allowanceValue.reason.trim() : "";
      const owner = typeof allowanceValue.owner === "string" ? allowanceValue.owner.trim() : "";
      const expiresAt =
        allowanceValue.expiresAt === undefined
          ? null
          : typeof allowanceValue.expiresAt === "string"
            ? allowanceValue.expiresAt.trim()
            : "";

      if (!reason || !owner) {
        errors.push(
          `${catalogMetadataPath}: certification.policy.knownGapAllowances.${packageName}.${gapId} requires non-empty reason and owner`,
        );
        continue;
      }

      if (expiresAt !== null && !expiresAt) {
        errors.push(
          `${catalogMetadataPath}: certification.policy.knownGapAllowances.${packageName}.${gapId}.expiresAt must be a non-empty string when present`,
        );
        continue;
      }

      packageAllowanceMap.set(gapId, { reason, owner, expiresAt });
    }

    allowances.set(packageName, packageAllowanceMap);
  }

  return allowances;
}

function parseCertificationRecord(
  index: number,
  recordValue: unknown,
  errors: string[],
): CertificationRecord | null {
  const label = `certification.records[${index}]`;
  if (!isRecord(recordValue)) {
    errors.push(`${catalogMetadataPath}: ${label} must be an object`);
    return null;
  }

  const recordErrors: string[] = [];
  const packageName =
    typeof recordValue.package === "string" && recordValue.package.trim().length > 0
      ? recordValue.package.trim()
      : null;
  const packageShortName = packageName ? toShortPackageName(packageName) : "";
  const state =
    typeof recordValue.state === "string" && isCertificationState(recordValue.state)
      ? recordValue.state
      : null;
  const contract =
    typeof recordValue.contract === "string" && recordValue.contract.trim().length > 0
      ? recordValue.contract.trim()
      : null;
  const packageVersion =
    typeof recordValue.packageVersion === "string" && recordValue.packageVersion.trim().length > 0
      ? recordValue.packageVersion.trim()
      : null;
  const runtimes = parseRuntimeList(
    recordValue.runtimes,
    `${catalogMetadataPath}: ${label}.runtimes`,
    recordErrors,
  );
  const evidence = isRecord(recordValue.evidence) ? recordValue.evidence : null;
  const knownGaps = isStringArray(recordValue.knownGaps)
    ? recordValue.knownGaps.map((gapId) => gapId.trim())
    : null;

  if (!packageName) {
    recordErrors.push(`${catalogMetadataPath}: ${label}.package must be a non-empty string`);
  }

  if (!state) {
    recordErrors.push(
      `${catalogMetadataPath}: ${label}.state must be one of ${certificationStates.join(", ")}`,
    );
  }

  if (!contract) {
    recordErrors.push(`${catalogMetadataPath}: ${label}.contract must be a non-empty string`);
  }

  if (!packageVersion) {
    recordErrors.push(`${catalogMetadataPath}: ${label}.packageVersion must be a non-empty string`);
  }

  if (!evidence) {
    recordErrors.push(`${catalogMetadataPath}: ${label}.evidence must be an object`);
  }

  if (!knownGaps) {
    recordErrors.push(`${catalogMetadataPath}: ${label}.knownGaps must be a string array`);
  } else if (knownGaps.some((gapId) => gapId.length === 0)) {
    recordErrors.push(`${catalogMetadataPath}: ${label}.knownGaps must not contain empty gap ids`);
  }

  errors.push(...recordErrors);

  return {
    packageName: packageName ?? "",
    packageShortName,
    state,
    contract,
    packageVersion,
    runtimes,
    evidence,
    knownGaps,
    errors: recordErrors,
  };
}

function parseCertificationCatalog(
  certificationValue: unknown,
  errors: string[],
): CertificationCatalog {
  if (certificationValue === undefined) {
    return {
      records: new Map(),
      recordCount: 0,
      knownGapAllowances: new Map(),
    };
  }

  if (!isRecord(certificationValue)) {
    errors.push(`${catalogMetadataPath}: certification must be an object`);
    return {
      records: new Map(),
      recordCount: 0,
      knownGapAllowances: new Map(),
    };
  }

  if (certificationValue.schemaVersion !== 1) {
    errors.push(`${catalogMetadataPath}: certification.schemaVersion must be 1`);
  }

  const knownGapAllowances = parseKnownGapAllowances(certificationValue.policy, errors);
  if (!Array.isArray(certificationValue.records)) {
    errors.push(`${catalogMetadataPath}: certification.records must be an array`);
    return {
      records: new Map(),
      recordCount: 0,
      knownGapAllowances,
    };
  }

  const records = new Map<string, CertificationRecord>();
  for (const [index, recordValue] of certificationValue.records.entries()) {
    const record = parseCertificationRecord(index, recordValue, errors);
    if (record) {
      const existing = records.get(record.packageShortName);
      if (
        !existing ||
        certificationStateRank(record.state) > certificationStateRank(existing.state)
      ) {
        records.set(record.packageShortName, record);
      }
    }
  }

  return {
    records,
    recordCount: certificationValue.records.length,
    knownGapAllowances,
  };
}

function loadCatalogEvidence(rootDir: string): CatalogEvidence {
  const errors: string[] = [];
  const catalog = readJsonFile(join(rootDir, catalogMetadataPath));

  if (!isRecord(catalog)) {
    return {
      errors: [`${catalogMetadataPath}: must contain an object`],
      groupByPackage: new Map(),
      maturityByPackage: new Map(),
      productionPackages: new Set(),
      extensionGroups: new Set(),
      extensionRuntimesByPackage: new Map(),
      certification: {
        records: new Map(),
        knownGapAllowances: new Map(),
      },
    };
  }

  const groupByPackage = parseCatalogGroups(catalog.groups, errors);
  const maturity = parseCatalogMaturity(catalog.maturity, errors);
  const extension = parseExtensionMatrix(catalog.extensionMatrix, errors);
  const certification = parseCertificationCatalog(catalog.certification, errors);

  return {
    errors,
    groupByPackage,
    maturityByPackage: maturity.maturityByPackage,
    productionPackages: maturity.productionPackages,
    extensionGroups: extension.extensionGroups,
    extensionRuntimesByPackage: extension.extensionRuntimesByPackage,
    certification,
  };
}

function toWorkspacePackage(catalog: CatalogEvidence, packageInfo: PackageInfo): WorkspacePackage {
  const shortName = toShortPackageName(packageInfo.name);

  return {
    name: packageInfo.name,
    shortName,
    relativeDir: packageInfo.relativeDir,
    group: catalog.groupByPackage.get(shortName) ?? "Unassigned",
    maturity: catalog.maturityByPackage.get(shortName) ?? "alpha",
    extensionRuntimes: catalog.extensionRuntimesByPackage.get(shortName) ?? [],
  };
}

function pass(id: string, label: string, evidence: string): ProviderCertificationCheck {
  return { id, label, status: "pass", evidence, recovery: null };
}

function fail(
  id: string,
  label: string,
  evidence: string,
  recovery: string,
): ProviderCertificationCheck {
  return { id, label, status: "fail", evidence, recovery };
}

function notApplicable(id: string, label: string, evidence: string): ProviderCertificationCheck {
  return { id, label, status: "not-applicable", evidence, recovery: null };
}

function isExtensionPackage(pkg: WorkspacePackage, catalog: CatalogEvidence): boolean {
  return (
    catalog.extensionRuntimesByPackage.has(pkg.shortName) || catalog.extensionGroups.has(pkg.group)
  );
}

function isProductionExtensionPackage(pkg: WorkspacePackage, catalog: CatalogEvidence): boolean {
  return pkg.maturity === "production" && isExtensionPackage(pkg, catalog);
}

function hasSameRuntimeSet(
  actual: readonly RuntimeKey[],
  expected: readonly RuntimeKey[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((runtime) => actual.includes(runtime)) &&
    actual.every((runtime) => expected.includes(runtime))
  );
}

function createRecordCheck(
  pkg: WorkspacePackage,
  record: CertificationRecord | undefined,
  requiredForProduction: boolean,
): ProviderCertificationCheck {
  if (!record) {
    if (requiredForProduction) {
      return fail(
        "record",
        "Certification record",
        `${pkg.name} is production-ready and has no certification.records.${pkg.shortName} entry`,
        `Add docs/package-catalog.json certification.records.${pkg.shortName} with state certified and package-scoped evidence.`,
      );
    }

    return notApplicable(
      "record",
      "Certification record",
      "not required until the extension package claims certification or enters production-ready maturity",
    );
  }

  if (record.errors.length > 0) {
    return fail(
      "record",
      "Certification record",
      record.errors.join("; "),
      `Fix docs/package-catalog.json certification.records.${pkg.shortName}.`,
    );
  }

  return pass("record", "Certification record", `certification.records.${pkg.shortName} exists`);
}

function createStateCheck(
  pkg: WorkspacePackage,
  record: CertificationRecord | undefined,
  requiredForProduction: boolean,
): ProviderCertificationCheck {
  if (!record) {
    return notApplicable("state", "State", "no certification record");
  }

  if (!record.state) {
    return fail(
      "state",
      "State",
      "state is invalid",
      `Use one of ${certificationStates.join(", ")} for ${pkg.name}.`,
    );
  }

  if (requiredForProduction && record.state !== "certified") {
    return fail(
      "state",
      "State",
      `${pkg.name} is production-ready but certification state is ${record.state}`,
      "Production-ready extension packages must use certification state certified.",
    );
  }

  return pass("state", "State", record.state);
}

function createRuntimeCheck(
  pkg: WorkspacePackage,
  record: CertificationRecord | undefined,
  requiresCompleteEvidence: boolean,
): ProviderCertificationCheck {
  if (!record) {
    return notApplicable("runtimes", "Runtimes", "no certification record");
  }

  if (record.runtimes.length === 0) {
    return fail(
      "runtimes",
      "Runtimes",
      "certification record has no valid runtimes",
      `List the certified runtime keys for ${pkg.name}.`,
    );
  }

  if (
    requiresCompleteEvidence &&
    pkg.extensionRuntimes.length > 0 &&
    !hasSameRuntimeSet(record.runtimes, pkg.extensionRuntimes)
  ) {
    return fail(
      "runtimes",
      "Runtimes",
      `record runtimes ${record.runtimes.join(", ")} do not match extension matrix runtimes ${pkg.extensionRuntimes.join(", ")}`,
      `Update certification.records.${pkg.shortName}.runtimes or extensionMatrix.packages.${pkg.shortName}.runtimes so certified scope is explicit.`,
    );
  }

  return pass("runtimes", "Runtimes", record.runtimes.join(", "));
}

function isPackageScopedPath(pkg: WorkspacePackage, path: string): boolean {
  const normalizedPath = normalizeRelativePath(path);
  return normalizedPath === pkg.relativeDir || normalizedPath.startsWith(`${pkg.relativeDir}/`);
}

function isSafeRelativePath(path: string): boolean {
  const normalizedPath = normalizeRelativePath(path);
  return !normalizedPath.startsWith("/") && !normalizedPath.split("/").includes("..");
}

function isPackageScopedCommand(pkg: WorkspacePackage, command: string): boolean {
  return [
    `--filter ${pkg.name}`,
    `--filter=${pkg.name}`,
    `--filter ${pkg.name}...`,
    `--filter=${pkg.name}...`,
    pkg.relativeDir,
  ].some((needle) => command.includes(needle));
}

function isTestOrSmokeCommand(command: string): boolean {
  return /(?:^|\s)(?:test(?::[\w-]+)?|vitest|smoke(?::[\w-]+)?)(?:\s|$)/i.test(command);
}

function isTestOrSmokeEvidencePath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.includes("/src/tests/") ||
    lowerPath.includes("/src/__tests__/") ||
    /(?:\.spec|\.test)\.[cm]?[tj]sx?$/.test(lowerPath) ||
    lowerPath.includes("smoke")
  );
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function catalogEvidenceKey(key: CommandEvidenceKey): string {
  return key === "redaction" ? "redactionTests" : key;
}

function createCommandEvidenceCheck(
  rootDir: string,
  pkg: WorkspacePackage,
  record: CertificationRecord | undefined,
  key: CommandEvidenceKey,
  requiresCompleteEvidence: boolean,
): ProviderCertificationCheck {
  if (!record) {
    return notApplicable(key, key, "no certification record");
  }

  if (!requiresCompleteEvidence) {
    return notApplicable(
      key,
      key,
      "complete evidence is required only for certified or production-ready extension packages",
    );
  }

  const recordEvidenceKey = catalogEvidenceKey(key);
  const evidenceValue = record.evidence?.[recordEvidenceKey];
  if (!isRecord(evidenceValue)) {
    return fail(
      key,
      key,
      `evidence.${recordEvidenceKey} is missing`,
      `Add certification.records.${pkg.shortName}.evidence.${recordEvidenceKey} with package-scoped command and artifact.`,
    );
  }

  const status = readNonEmptyString(evidenceValue.status);
  const command = readNonEmptyString(evidenceValue.command);
  const evidencePath =
    readNonEmptyString(evidenceValue.path) ?? readNonEmptyString(evidenceValue.artifact);

  if (status && status !== "present") {
    return fail(
      key,
      key,
      `evidence.${recordEvidenceKey} status is ${status}`,
      `Mark ${pkg.name} ${recordEvidenceKey} evidence present only after command and artifact evidence exist.`,
    );
  }

  if (!command || !evidencePath) {
    return fail(
      key,
      key,
      `evidence.${recordEvidenceKey} must include non-empty command and artifact`,
      `Add package-scoped command and artifact for ${pkg.name} ${recordEvidenceKey} evidence.`,
    );
  }

  const normalizedPath = normalizeRelativePath(evidencePath);
  if (!isSafeRelativePath(normalizedPath)) {
    return fail(
      key,
      key,
      `${normalizedPath} is not a safe repository-relative path`,
      `Use a repository-relative evidence path under ${pkg.relativeDir} for ${pkg.name}.`,
    );
  }

  if (!isPackageScopedPath(pkg, normalizedPath)) {
    return fail(
      key,
      key,
      `${normalizedPath} is not package-scoped to ${pkg.relativeDir}`,
      `Use a path under ${pkg.relativeDir} for ${pkg.name} ${key} evidence.`,
    );
  }

  if (!existsSync(join(rootDir, normalizedPath))) {
    return fail(
      key,
      key,
      `${normalizedPath} does not exist`,
      `Commit the evidence file for ${pkg.name} ${key} or update the catalog path.`,
    );
  }

  if (!isPackageScopedCommand(pkg, command)) {
    return fail(
      key,
      key,
      `${command} is not package-scoped to ${pkg.name}`,
      `Use a package-scoped command such as pnpm --filter ${pkg.name} test.`,
    );
  }

  if (!isTestOrSmokeCommand(command)) {
    return fail(
      key,
      key,
      `${command} does not run a test or smoke command`,
      `Use a package-scoped test or smoke command for ${pkg.name} ${key} evidence.`,
    );
  }

  if (!isTestOrSmokeEvidencePath(normalizedPath)) {
    return fail(
      key,
      key,
      `${normalizedPath} is not a test or smoke evidence file`,
      `Point ${pkg.name} ${key} evidence at a package test, spec, or smoke artifact.`,
    );
  }

  return pass(key, key, `${command} -> ${normalizedPath}`);
}

function createLiveSmokeCheck(
  rootDir: string,
  pkg: WorkspacePackage,
  record: CertificationRecord | undefined,
  requiresCompleteEvidence: boolean,
): ProviderCertificationCheck {
  if (!record) {
    return notApplicable("liveSmoke", "liveSmoke", "no certification record");
  }

  if (!requiresCompleteEvidence) {
    return notApplicable(
      "liveSmoke",
      "liveSmoke",
      "complete evidence is required only for certified or production-ready extension packages",
    );
  }

  const evidenceValue = record.evidence?.liveSmoke;
  if (!isRecord(evidenceValue)) {
    return fail(
      "liveSmoke",
      "liveSmoke",
      "evidence.liveSmoke is missing",
      `Add certification.records.${pkg.shortName}.evidence.liveSmoke with documented live-smoke behavior.`,
    );
  }

  const status = readNonEmptyString(evidenceValue.status);
  const documentation =
    readNonEmptyString(evidenceValue.documentation) ?? readNonEmptyString(evidenceValue.artifact);
  const behavior =
    readNonEmptyString(evidenceValue.behavior) ??
    readNonEmptyString(evidenceValue.description) ??
    readNonEmptyString(evidenceValue.reason);

  if (status && status !== "present") {
    return fail(
      "liveSmoke",
      "liveSmoke",
      `evidence.liveSmoke status is ${status}`,
      `Mark ${pkg.name} liveSmoke evidence present only after live-smoke behavior is documented.`,
    );
  }

  if (!documentation || !behavior) {
    return fail(
      "liveSmoke",
      "liveSmoke",
      "evidence.liveSmoke must include non-empty artifact and behavior description",
      `Document live-smoke behavior for ${pkg.name}, including skip or env-gated behavior.`,
    );
  }

  const normalizedPath = normalizeRelativePath(documentation);
  if (!isSafeRelativePath(normalizedPath)) {
    return fail(
      "liveSmoke",
      "liveSmoke",
      `${normalizedPath} is not a safe repository-relative path`,
      `Use a repository-relative live-smoke documentation path under ${pkg.relativeDir}.`,
    );
  }

  if (!isPackageScopedPath(pkg, normalizedPath)) {
    return fail(
      "liveSmoke",
      "liveSmoke",
      `${normalizedPath} is not package-scoped to ${pkg.relativeDir}`,
      `Document ${pkg.name} live-smoke behavior under ${pkg.relativeDir}.`,
    );
  }

  if (!existsSync(join(rootDir, normalizedPath))) {
    return fail(
      "liveSmoke",
      "liveSmoke",
      `${normalizedPath} does not exist`,
      `Commit the live-smoke documentation file for ${pkg.name} or update the catalog path.`,
    );
  }

  if (!/(credential|env|optional|skip|skipped)/i.test(behavior)) {
    return fail(
      "liveSmoke",
      "liveSmoke",
      "behavior does not describe credential, env-gated, optional, or skipped live smoke",
      `Describe how ${pkg.name} live smoke behaves when credentials are absent.`,
    );
  }

  return pass("liveSmoke", "liveSmoke", `${normalizedPath}: ${behavior}`);
}

function createKnownGapsCheck(
  pkg: WorkspacePackage,
  record: CertificationRecord | undefined,
  catalog: CatalogEvidence,
  blocksKnownGaps: boolean,
): ProviderCertificationCheck {
  if (!record) {
    return notApplicable("knownGaps", "Known gaps", "no certification record");
  }

  if (!record.knownGaps) {
    return fail(
      "knownGaps",
      "Known gaps",
      "knownGaps is invalid",
      `Set certification.records.${pkg.shortName}.knownGaps to an array.`,
    );
  }

  if (record.knownGaps.length === 0) {
    return pass("knownGaps", "Known gaps", "none");
  }

  if (!blocksKnownGaps) {
    return pass(
      "knownGaps",
      "Known gaps",
      `non-blocking before production/certified: ${record.knownGaps.join(", ")}`,
    );
  }

  const packageAllowances = catalog.certification.knownGapAllowances.get(pkg.shortName);
  const missingAllowances = record.knownGaps.filter((gapId) => !packageAllowances?.has(gapId));

  if (missingAllowances.length > 0) {
    return fail(
      "knownGaps",
      "Known gaps",
      `blocking known gaps without package-scoped allowance: ${missingAllowances.join(", ")}`,
      `Close the gaps or add certification.policy.knownGapAllowances.${pkg.shortName}.<gap> with non-empty reason and owner.`,
    );
  }

  return pass(
    "knownGaps",
    "Known gaps",
    `allowed by package-scoped policy: ${record.knownGaps.join(", ")}`,
  );
}

function createCertificationRow(
  rootDir: string,
  pkg: WorkspacePackage,
  catalog: CatalogEvidence,
): ProviderCertificationRow {
  const record = catalog.certification.records.get(pkg.shortName);
  const requiredForProduction = isProductionExtensionPackage(pkg, catalog);
  const requiresCompleteEvidence = requiredForProduction || record?.state === "certified";
  const checks = [
    createRecordCheck(pkg, record, requiredForProduction),
    createStateCheck(pkg, record, requiredForProduction),
    createRuntimeCheck(pkg, record, requiresCompleteEvidence),
    ...commandEvidenceKeys.map((key) =>
      createCommandEvidenceCheck(rootDir, pkg, record, key, requiresCompleteEvidence),
    ),
    createLiveSmokeCheck(rootDir, pkg, record, requiresCompleteEvidence),
    createKnownGapsCheck(
      pkg,
      record,
      catalog,
      requiredForProduction || record?.state === "certified",
    ),
  ];

  return {
    packageName: pkg.name,
    relativeDir: pkg.relativeDir,
    group: pkg.group,
    maturity: pkg.maturity,
    requiredForProduction,
    state: record?.state ?? (record ? "invalid" : "missing"),
    runtimes: record?.runtimes ?? [],
    checks,
  };
}

function shouldSkipDirectory(name: string): boolean {
  return name === "node_modules" || name === ".git" || name === "dist" || name === ".turbo";
}

function collectMarkdownFilesUnder(rootDir: string, relativeDir: string, files: Set<string>): void {
  const absoluteDir = join(rootDir, relativeDir);
  if (!existsSync(absoluteDir)) {
    return;
  }

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      collectMarkdownFilesUnder(rootDir, join(relativeDir, entry.name), files);
      continue;
    }

    if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      files.add(toPosixPath(join(relativeDir, entry.name)));
    }
  }
}

function collectPackageReadmes(rootDir: string, files: Set<string>): void {
  const packagesDir = join(rootDir, "packages");
  if (!existsSync(packagesDir)) {
    return;
  }

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const readmePath = join("packages", entry.name, "README.md");
    if (existsSync(join(rootDir, readmePath))) {
      files.add(toPosixPath(readmePath));
    }
  }
}

function collectMarkdownClaimFiles(rootDir: string): readonly string[] {
  const files = new Set<string>();

  if (existsSync(join(rootDir, "README.md"))) {
    files.add("README.md");
  }

  collectMarkdownFilesUnder(rootDir, "docs", files);
  collectPackageReadmes(rootDir, files);
  collectMarkdownFilesUnder(
    rootDir,
    join("packages", "docs", "src", "content", "docs", "en"),
    files,
  );

  return [...files].sort();
}

function isFenceToggle(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}

function hasCertificationClaim(line: string): boolean {
  return certificationClaimPatterns.some((pattern) => pattern.test(line));
}

function packageRefsForClaim(file: string, line: string): readonly string[] {
  const explicitRefs = [...line.matchAll(/@croco\/([a-z0-9-]+)/g)].map((match) => match[1]);
  if (explicitRefs.length > 0) {
    return [...new Set(explicitRefs)];
  }

  const packageReadmeMatch = file.match(/^packages\/([^/]+)\/README\.md$/);
  return packageReadmeMatch ? [packageReadmeMatch[1]] : [];
}

function scanCertificationClaims(
  rootDir: string,
  catalog: CatalogEvidence,
): readonly CertificationClaimViolation[] {
  const violations: CertificationClaimViolation[] = [];

  for (const file of collectMarkdownClaimFiles(rootDir)) {
    const lines = readFileSync(join(rootDir, file), "utf-8").split(/\r?\n/);
    let insideFence = false;

    for (const [lineIndex, line] of lines.entries()) {
      if (isFenceToggle(line)) {
        insideFence = !insideFence;
        continue;
      }

      if (insideFence || !hasCertificationClaim(line)) {
        continue;
      }

      const packageRefs = packageRefsForClaim(file, line);
      if (packageRefs.length === 0) {
        violations.push({
          file,
          line: lineIndex + 1,
          excerpt: line.trim(),
          message: "certification claim must name @croco/<package> or live in a package README",
        });
        continue;
      }

      for (const packageName of packageRefs) {
        const record = catalog.certification.records.get(packageName);
        if (record?.state !== "certified") {
          violations.push({
            file,
            line: lineIndex + 1,
            excerpt: line.trim(),
            message: `${file}:${lineIndex + 1} claims Croco compatibility for @croco/${packageName} without a certified catalog record`,
          });
        }
      }
    }
  }

  return violations;
}

function createCatalogReferenceErrors(
  packagesByShortName: ReadonlyMap<string, WorkspacePackage>,
  catalog: CatalogEvidence,
): readonly string[] {
  const errors: string[] = [];

  for (const packageName of catalog.productionPackages) {
    if (!packagesByShortName.has(packageName)) {
      errors.push(
        `${catalogMetadataPath}: maturity.production references missing package ${packageName}`,
      );
    }
  }

  for (const packageName of catalog.extensionRuntimesByPackage.keys()) {
    if (!packagesByShortName.has(packageName)) {
      errors.push(
        `${catalogMetadataPath}: extensionMatrix.packages references missing package ${packageName}`,
      );
    }
  }

  for (const packageName of catalog.certification.records.keys()) {
    if (!packagesByShortName.has(packageName)) {
      errors.push(
        `${catalogMetadataPath}: certification.records references missing package ${packageName}`,
      );
    }
  }

  for (const packageName of catalog.certification.knownGapAllowances.keys()) {
    if (!packagesByShortName.has(packageName)) {
      errors.push(
        `${catalogMetadataPath}: certification.policy.knownGapAllowances references missing package ${packageName}`,
      );
    }
  }

  return errors;
}

export function createProviderCertificationReport(
  options: Options & { readonly generatedAt?: string },
): ProviderCertificationReport {
  const catalog = loadCatalogEvidence(options.rootDir);
  const packages = readPackages(options.rootDir).map((packageInfo) =>
    toWorkspacePackage(catalog, packageInfo),
  );
  const packagesByShortName = new Map(packages.map((pkg) => [pkg.shortName, pkg] as const));
  const extensionPackages = packages.filter((pkg) => isExtensionPackage(pkg, catalog));
  const productionExtensionPackages = extensionPackages.filter((pkg) =>
    isProductionExtensionPackage(pkg, catalog),
  );
  const rowPackages = packages.filter(
    (pkg) => isExtensionPackage(pkg, catalog) || catalog.certification.records.has(pkg.shortName),
  );
  const rows = rowPackages.map((pkg) => createCertificationRow(options.rootDir, pkg, catalog));
  const claimViolations = scanCertificationClaims(options.rootDir, catalog);

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rootDir: options.rootDir,
    catalogErrors: [
      ...catalog.errors,
      ...createCatalogReferenceErrors(packagesByShortName, catalog),
    ],
    claimViolations,
    rows,
    summary: {
      extensionPackageCount: extensionPackages.length,
      productionExtensionPackageCount: productionExtensionPackages.length,
      certificationRecordCount: catalog.certification.recordCount,
    },
  };
}

function formatTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function formatCheckCell(check: ProviderCertificationCheck): string {
  const recovery = check.recovery ? `<br>Recovery: ${check.recovery}` : "";
  return formatTableCell(`${check.status}: ${check.evidence}${recovery}`);
}

function formatSummaryCheck(row: ProviderCertificationRow, id: string): string {
  const check = row.checks.find((candidate) => candidate.id === id);
  return check ? formatCheckCell(check) : "missing check";
}

function formatEvidenceSummary(row: ProviderCertificationRow): string {
  return evidenceKeys
    .map((key) => {
      const check = row.checks.find((candidate) => candidate.id === key);
      return `${key}: ${check?.status ?? "missing"}`;
    })
    .join("<br>");
}

function formatPackageFailureDetails(report: ProviderCertificationReport): readonly string[] {
  const failures = report.rows.flatMap((row) =>
    row.checks
      .filter((check) => check.status === "fail")
      .map((check) => {
        const recovery = check.recovery ? ` Recovery: ${check.recovery}` : "";
        return `- \`${row.packageName}\` ${check.label}: ${check.evidence}.${recovery}`;
      }),
  );

  return failures.length > 0 ? failures : ["- none"];
}

export function countProviderCertificationFailures(report: ProviderCertificationReport): number {
  const packageFailures = report.rows.reduce(
    (count, row) => count + row.checks.filter((check) => check.status === "fail").length,
    0,
  );

  return report.catalogErrors.length + report.claimViolations.length + packageFailures;
}

export function hasProviderCertificationFailures(report: ProviderCertificationReport): boolean {
  return countProviderCertificationFailures(report) > 0;
}

export function buildProviderCertificationMarkdown(report: ProviderCertificationReport): string {
  const failureCount = countProviderCertificationFailures(report);
  const lines = [
    "# Provider Certification Gate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Root: \`${toPosixPath(report.rootDir)}\``,
    `- Extension packages: ${report.summary.extensionPackageCount}`,
    `- Production-ready extension packages: ${report.summary.productionExtensionPackageCount}`,
    `- Certification records: ${report.summary.certificationRecordCount}`,
    `- Blocking failures: ${failureCount}`,
    "",
    "## Catalog errors",
    "",
    ...(report.catalogErrors.length > 0
      ? report.catalogErrors.map((error) => `- ${error}`)
      : ["- none"]),
    "",
    "## Manual certification claim errors",
    "",
    ...(report.claimViolations.length > 0
      ? report.claimViolations.map(
          (violation) =>
            `- ${violation.file}:${violation.line} — ${violation.message}. Excerpt: ${violation.excerpt}`,
        )
      : ["- none"]),
    "",
    "## Provider certification matrix",
    "",
    "| Package | Group | Maturity | Required | State | Runtimes | Record | State check | Runtime scope | Evidence | Known gaps |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.rows.map(
      (row) =>
        `| \`${row.packageName}\` | ${formatTableCell(row.group)} | ${row.maturity} | ${row.requiredForProduction ? "yes" : "no"} | ${row.state} | ${formatTableCell(row.runtimes.join(", ") || "none")} | ${formatSummaryCheck(row, "record")} | ${formatSummaryCheck(row, "state")} | ${formatSummaryCheck(row, "runtimes")} | ${formatTableCell(formatEvidenceSummary(row))} | ${formatSummaryCheck(row, "knownGaps")} |`,
    ),
    "",
    "## Blocking package check details",
    "",
    ...formatPackageFailureDetails(report),
    "",
    "## Recovery",
    "",
    "- Add or update `docs/package-catalog.json` `certification.records.<package>` for production-ready extension packages.",
    '- Keep certification separate from maturity: production-ready extension packages require `state: "certified"`, but beta/alpha packages may remain uncertified.',
    "- Provide package-scoped command/path evidence for conformance, no-credential smoke, diagnostics, and redaction checks.",
    "- Document package-scoped live-smoke behavior, including optional, credential, env-gated, or skipped behavior.",
    "- Close `knownGaps` before certified/production-ready promotion, or add a package-scoped allowance with non-empty reason and owner.",
    "- Remove manual `Croco compatible:` docs claims unless the named package has a certified catalog record.",
  ];

  return `${lines.join("\n")}\n`;
}

export function writeProviderCertificationReport(
  report: ProviderCertificationReport,
  outputDir: string,
): {
  readonly markdownPath: string;
  readonly jsonPath: string;
} {
  mkdirSync(outputDir, { recursive: true });
  const markdownPath = join(outputDir, reportMarkdownFileName);
  const jsonPath = join(outputDir, reportJsonFileName);
  writeFileSync(markdownPath, buildProviderCertificationMarkdown(report));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  return { markdownPath, jsonPath };
}

export function parseArgs(args: readonly string[]): Options {
  let rootDir = process.cwd();
  let outputDir = join(rootDir, reportDirectory);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      outputDir = join(rootDir, reportDirectory);
      index++;
      continue;
    }

    if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a path");
      }
      outputDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    rootDir,
    outputDir,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));
  const report = createProviderCertificationReport(options);
  const { markdownPath, jsonPath } = writeProviderCertificationReport(report, options.outputDir);
  const failureCount = countProviderCertificationFailures(report);

  console.log(`provider-certification-check: wrote ${markdownPath}`);
  console.log(`provider-certification-check: wrote ${jsonPath}`);
  console.log(
    `provider-certification-check: production extension packages=${report.summary.productionExtensionPackageCount}`,
  );
  console.log(`provider-certification-check: blocking failures=${failureCount}`);

  if (failureCount > 0) {
    exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`provider-certification-check: failed: ${message}`);
    exit(1);
  });
}
