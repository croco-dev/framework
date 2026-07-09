#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
  readGeneratedTemplateSecretAllowlistsFromMetadata,
  type GeneratedTemplateSecretAllowlistEntry,
} from "../packages/create-croco-app/src/secret-placeholder-policy.ts";

type Options = {
  readonly explicitGitleaksConfigPath: boolean;
  readonly gitleaksConfigPath: string;
  readonly gitleaksIgnorePath: string;
  readonly metadataPath: string;
  readonly packageJsonPath: string;
  readonly rootDir: string;
  readonly today: string;
  readonly workspacePath: string;
};

type Violation = {
  readonly message: string;
  readonly recovery: string;
};

type AuditMetadataEntry = {
  readonly expiresOn?: string;
  readonly id: string;
  readonly owner: string;
  readonly pointer: string;
  readonly reason: string;
  readonly reviewBy?: string;
};

type GitleaksMetadataEntry = {
  readonly expiresOn?: string;
  readonly kind: GitleaksAllowlistKind;
  readonly owner: string;
  readonly pointer: string;
  readonly reason: string;
  readonly reviewBy?: string;
  readonly value: string;
};

type GitleaksAllowlistKind = "commit" | "fingerprint" | "path" | "regex" | "stopword";

type GitleaksAllowlistEntry = {
  readonly kind: GitleaksAllowlistKind;
  readonly source: string;
  readonly value: string;
};

type SecurityAllowlistMetadata = {
  readonly auditIgnores: readonly AuditMetadataEntry[];
  readonly generatedTemplateAllowlists: readonly GeneratedTemplateSecretAllowlistEntry[];
  readonly gitleaksAllowlists: readonly GitleaksMetadataEntry[];
  readonly gitleaksConfigPath?: string;
};

type GitleaksEffectiveAllowlists = {
  readonly entries: readonly GitleaksAllowlistEntry[];
  readonly ignoreFingerprints: readonly string[];
};

type GitleaksConfigReadResult = {
  readonly configExists: boolean;
  readonly entries: readonly GitleaksAllowlistEntry[];
  readonly hasEffectiveRules: boolean;
};

const defaultRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultMetadataPath = "scripts/security-allowlist-metadata.json";
const defaultPackageJsonPath = "package.json";
const defaultWorkspacePath = "pnpm-workspace.yaml";
const defaultGitleaksConfigPath = ".gitleaks.toml";
const defaultGitleaksIgnorePath = ".gitleaksignore";
const inlineGitleaksAllowMarker = `gitleaks${":allow"}`;
const gitleaksKeyKinds: Readonly<Record<string, GitleaksAllowlistKind>> = {
  commits: "commit",
  paths: "path",
  regexes: "regex",
  stopwords: "stopword",
};

function log(message = ""): void {
  stdout.write(`${message}\n`);
}

function parseArgs(args: readonly string[]): Options {
  let gitleaksConfigPath = defaultGitleaksConfigPath;
  let gitleaksIgnorePath = defaultGitleaksIgnorePath;
  let explicitGitleaksConfigPath = false;
  let metadataPath = defaultMetadataPath;
  let packageJsonPath = defaultPackageJsonPath;
  let rootDir = defaultRootDir;
  let today = new Date().toISOString().slice(0, 10);
  let workspacePath = defaultWorkspacePath;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      rootDir = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--metadata") {
      metadataPath = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--package-json") {
      packageJsonPath = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--workspace") {
      workspacePath = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--gitleaks-config") {
      gitleaksConfigPath = requireValue(args, index, arg);
      explicitGitleaksConfigPath = true;
      index++;
      continue;
    }

    if (arg === "--gitleaksignore") {
      gitleaksIgnorePath = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--today") {
      today = requireValue(args, index, arg);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!isValidDate(today)) {
    throw new Error(`--today must be a valid YYYY-MM-DD date, received ${today}`);
  }

  const absoluteRootDir = resolve(rootDir);

  return {
    explicitGitleaksConfigPath,
    gitleaksConfigPath: resolveFromRoot(absoluteRootDir, gitleaksConfigPath),
    gitleaksIgnorePath: resolveFromRoot(absoluteRootDir, gitleaksIgnorePath),
    metadataPath: resolveFromRoot(absoluteRootDir, metadataPath),
    packageJsonPath: resolveFromRoot(absoluteRootDir, packageJsonPath),
    rootDir: absoluteRootDir,
    today,
    workspacePath: resolveFromRoot(absoluteRootDir, workspacePath),
  };
}

function requireValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${option} requires a value`);
  }

  return value;
}

function resolveFromRoot(rootDir: string, path: string): string {
  return resolve(rootDir, path);
}

function readJsonRecord(
  path: string,
  violations: Violation[],
  description: string,
): Record<string, unknown> {
  if (!existsSync(path)) {
    violations.push({
      message: `${description} is missing at ${path}`,
      recovery: `Create ${path} with the required allowlist metadata before adding exceptions.`,
    });
    return {};
  }

  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!isRecord(parsed)) {
    violations.push({
      message: `${description} must be a JSON object`,
      recovery: `Rewrite ${path} as a JSON object.`,
    });
    return {};
  }

  return parsed;
}

function readMetadata(
  path: string,
  today: string,
  violations: Violation[],
): SecurityAllowlistMetadata {
  const root = readJsonRecord(path, violations, "security allowlist metadata");

  if (root.schemaVersion !== 1) {
    violations.push({
      message: "security allowlist metadata must declare schemaVersion 1",
      recovery: "Set scripts/security-allowlist-metadata.json#schemaVersion to 1.",
    });
  }

  const audit = isRecord(root.audit) ? root.audit : {};
  const secretScan = isRecord(root.secretScan) ? root.secretScan : {};
  const gitleaks = isRecord(secretScan.gitleaks) ? secretScan.gitleaks : {};
  const auditIgnoreGhsas = readRecordArray(
    audit.ignoreGhsas,
    "audit.ignoreGhsas",
    violations,
  ).flatMap((entry, index) =>
    readAuditMetadataEntry(entry, `audit.ignoreGhsas[${index}]`, today, violations),
  );
  const auditIgnoreCves = readRecordArray(audit.ignoreCves, "audit.ignoreCves", violations).flatMap(
    (entry, index) =>
      readAuditMetadataEntry(entry, `audit.ignoreCves[${index}]`, today, violations),
  );
  const gitleaksConfigPath = readOptionalMetadataPath(
    gitleaks,
    "configPath",
    "secretScan.gitleaks",
    violations,
  );
  const gitleaksAllowlists = readRecordArray(
    gitleaks.allowlists,
    "secretScan.gitleaks.allowlists",
    violations,
  ).flatMap((entry, index) =>
    readGitleaksAllowlistMetadataEntry(
      entry,
      `secretScan.gitleaks.allowlists[${index}]`,
      today,
      violations,
    ),
  );
  const gitleaksIgnoreFingerprints = readRecordArray(
    gitleaks.ignoreFingerprints,
    "secretScan.gitleaks.ignoreFingerprints",
    violations,
  ).flatMap((entry, index) =>
    readGitleaksFingerprintMetadataEntry(
      entry,
      `secretScan.gitleaks.ignoreFingerprints[${index}]`,
      today,
      violations,
    ),
  );
  const generatedTemplateAllowlists = readGeneratedTemplateSecretAllowlistsFromMetadata(
    root,
    today,
  );
  violations.push(...generatedTemplateAllowlists.violations);

  return {
    auditIgnores: [...auditIgnoreGhsas, ...auditIgnoreCves],
    generatedTemplateAllowlists: generatedTemplateAllowlists.allowlists,
    gitleaksAllowlists: [...gitleaksAllowlists, ...gitleaksIgnoreFingerprints],
    gitleaksConfigPath,
  };
}

function validateMetadataConfig(
  options: Options,
  metadata: SecurityAllowlistMetadata,
  violations: Violation[],
): void {
  if (
    !options.explicitGitleaksConfigPath &&
    metadata.gitleaksConfigPath !== undefined &&
    metadata.gitleaksConfigPath !== defaultGitleaksConfigPath
  ) {
    violations.push({
      message: `secretScan.gitleaks.configPath points at ${metadata.gitleaksConfigPath}, but CI scans with ${defaultGitleaksConfigPath}`,
      recovery:
        "Keep secretScan.gitleaks.configPath set to .gitleaks.toml, or update CI and the metadata gate together before moving the Gitleaks config.",
    });
  }
}

function readOptionalMetadataPath(
  entry: Record<string, unknown>,
  field: string,
  pointer: string,
  violations: Violation[],
): string | undefined {
  const value = entry[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  violations.push({
    message: `${pointer}.${field} must be a non-empty string when provided`,
    recovery: `Set ${pointer}.${field} to a repository-relative file path, or remove it to use the default.`,
  });
  return undefined;
}

function readRecordArray(
  value: unknown,
  pointer: string,
  violations: Violation[],
): readonly Record<string, unknown>[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    violations.push({
      message: `${pointer} must be an array`,
      recovery: `Set ${pointer} to an array of structured metadata objects.`,
    });
    return [];
  }

  return value.flatMap((entry, index) => {
    if (isRecord(entry)) {
      return [entry];
    }

    violations.push({
      message: `${pointer}[${index}] must be an object`,
      recovery: `Replace ${pointer}[${index}] with an object containing owner, reason, and reviewBy or expiresOn.`,
    });
    return [];
  });
}

function readAuditMetadataEntry(
  entry: Record<string, unknown>,
  pointer: string,
  today: string,
  violations: Violation[],
): readonly AuditMetadataEntry[] {
  const id = readRequiredString(entry, "id", pointer, violations);
  const owner = readRequiredString(entry, "owner", pointer, violations);
  const reason = readRequiredString(entry, "reason", pointer, violations);
  const reviewDate = readReviewDate(entry, pointer, today, violations);

  if (!id) {
    return [];
  }

  return [
    {
      id,
      owner,
      pointer,
      reason,
      ...reviewDate,
    },
  ];
}

function readGitleaksAllowlistMetadataEntry(
  entry: Record<string, unknown>,
  pointer: string,
  today: string,
  violations: Violation[],
): readonly GitleaksMetadataEntry[] {
  const kind = readRequiredString(entry, "kind", pointer, violations);
  const value = readRequiredString(entry, "value", pointer, violations);
  const owner = readRequiredString(entry, "owner", pointer, violations);
  const reason = readRequiredString(entry, "reason", pointer, violations);
  const reviewDate = readReviewDate(entry, pointer, today, violations);

  if (!value) {
    return [];
  }

  if (!isGitleaksAllowlistKind(kind) || kind === "fingerprint") {
    violations.push({
      message: `${pointer}.kind must be one of path, regex, commit, or stopword`,
      recovery: `Set ${pointer}.kind to the Gitleaks allowlist bucket that contains this value.`,
    });
    return [];
  }

  return [
    {
      kind,
      owner,
      pointer,
      reason,
      value,
      ...reviewDate,
    },
  ];
}

function readGitleaksFingerprintMetadataEntry(
  entry: Record<string, unknown>,
  pointer: string,
  today: string,
  violations: Violation[],
): readonly GitleaksMetadataEntry[] {
  const value =
    typeof entry.fingerprint === "string"
      ? entry.fingerprint.trim()
      : readRequiredString(entry, "value", pointer, violations);
  const owner = readRequiredString(entry, "owner", pointer, violations);
  const reason = readRequiredString(entry, "reason", pointer, violations);
  const reviewDate = readReviewDate(entry, pointer, today, violations);

  if (!value) {
    return [];
  }

  return [
    {
      kind: "fingerprint",
      owner,
      pointer,
      reason,
      value,
      ...reviewDate,
    },
  ];
}

function readRequiredString(
  entry: Record<string, unknown>,
  field: string,
  pointer: string,
  violations: Violation[],
): string {
  const value = entry[field];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  violations.push({
    message: `${pointer}.${field} must be a non-empty string`,
    recovery: `Add a concrete ${field} value to ${pointer}.`,
  });
  return "";
}

function readReviewDate(
  entry: Record<string, unknown>,
  pointer: string,
  today: string,
  violations: Violation[],
): { readonly expiresOn?: string; readonly reviewBy?: string } {
  const reviewBy = typeof entry.reviewBy === "string" ? entry.reviewBy.trim() : "";
  const expiresOn = typeof entry.expiresOn === "string" ? entry.expiresOn.trim() : "";

  if (!reviewBy && !expiresOn) {
    violations.push({
      message: `${pointer} must include reviewBy or expiresOn`,
      recovery: `Add a YYYY-MM-DD reviewBy or expiresOn date to ${pointer}.`,
    });
    return {};
  }

  if (reviewBy) {
    validateReviewDateField(pointer, "reviewBy", reviewBy, today, violations);
  }

  if (expiresOn) {
    validateReviewDateField(pointer, "expiresOn", expiresOn, today, violations);
  }

  return {
    ...(expiresOn ? { expiresOn } : {}),
    ...(reviewBy ? { reviewBy } : {}),
  };
}

function validateReviewDateField(
  pointer: string,
  field: "expiresOn" | "reviewBy",
  value: string,
  today: string,
  violations: Violation[],
): void {
  if (!isValidDate(value)) {
    violations.push({
      message: `${pointer}.${field} must be a valid YYYY-MM-DD date`,
      recovery: `Replace ${pointer}.${field} with a valid calendar date.`,
    });
    return;
  }

  if (value < today) {
    violations.push({
      message: `${pointer}.${field} is stale (${value} is before ${today})`,
      recovery: `Review the exception and update ${pointer}.${field}, or remove the allowlist entry.`,
    });
  }
}

function readEffectiveAuditIgnores(options: Options, violations: Violation[]): readonly string[] {
  const packageJson = readJsonRecord(options.packageJsonPath, violations, "root package.json");
  const workspaceIgnores = readWorkspaceAuditIgnores(options.workspacePath, violations);
  const scriptIgnores = readAuditScriptIgnores(packageJson, violations);
  const deadPackageIgnores = readPackageJsonAuditIgnores(packageJson);

  if (deadPackageIgnores.length > 0) {
    violations.push({
      message: `package.json#pnpm.auditConfig contains ${deadPackageIgnores.join(", ")}, but it is not the checked audit exception source`,
      recovery:
        "Move audit ignores to pnpm-workspace.yaml#auditConfig.ignoreGhsas / ignoreCves or an explicit audit:prod --ignore flag, then keep matching metadata.",
    });
  }

  return uniqueSorted([...workspaceIgnores, ...scriptIgnores]);
}

function readPackageJsonAuditIgnores(packageJson: Record<string, unknown>): readonly string[] {
  const pnpm = isRecord(packageJson.pnpm) ? packageJson.pnpm : {};
  const auditConfig = isRecord(pnpm.auditConfig) ? pnpm.auditConfig : {};
  return uniqueSorted([
    ...readStringArrayValue(auditConfig.ignoreGhsas),
    ...readStringArrayValue(auditConfig.ignoreCves),
  ]);
}

function readAuditScriptIgnores(
  packageJson: Record<string, unknown>,
  violations: Violation[],
): readonly string[] {
  const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
  const auditProd = typeof scripts["audit:prod"] === "string" ? scripts["audit:prod"] : "";
  const ignores: string[] = [];
  const ignorePattern = /(?:^|\s)--ignore(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;

  if (hasCommandFlag(auditProd, "ignore-unfixable")) {
    violations.push({
      message:
        "package.json#scripts.audit:prod uses --ignore-unfixable, which suppresses unresolved CVEs without reviewed metadata",
      recovery:
        "Remove --ignore-unfixable and use explicit pnpm-workspace.yaml auditConfig.ignoreGhsas / ignoreCves entries or audit:prod --ignore values with matching metadata.",
    });
  }

  for (const match of auditProd.matchAll(ignorePattern)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (value) {
      ignores.push(value);
    }
  }

  return uniqueSorted(ignores);
}

function hasCommandFlag(command: string, flag: string): boolean {
  const pattern = new RegExp(`(?:^|\\s)--${escapeRegExp(flag)}(?:$|\\s|=)`);
  return pattern.test(command);
}

function readWorkspaceAuditIgnores(path: string, violations: Violation[]): readonly string[] {
  if (!existsSync(path)) {
    violations.push({
      message: `pnpm workspace file is missing at ${path}`,
      recovery: "Create pnpm-workspace.yaml or pass --workspace to the metadata check.",
    });
    return [];
  }

  const content = readFileSync(path, "utf-8");
  const anchors = readYamlStringListAnchors(content);
  return uniqueSorted([
    ...extractYamlStringList(content, "auditConfig", "ignoreGhsas", anchors),
    ...extractYamlStringList(content, "auditConfig", "ignoreCves", anchors),
  ]);
}

function extractYamlStringList(
  content: string,
  sectionName: string,
  keyName: string,
  anchors: ReadonlyMap<string, readonly string[]> = new Map(),
): readonly string[] {
  const values: string[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let sectionIndent: number | null = null;
  let keyIndent: number | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = stripYamlComment(line).trim();
    if (!trimmed) {
      continue;
    }

    const indent = leadingSpaces(line);

    if (sectionIndent !== null && indent <= sectionIndent && trimmed !== `${sectionName}:`) {
      sectionIndent = null;
      keyIndent = null;
    }

    if (trimmed.startsWith(`${sectionName}:`)) {
      const inlineSectionValue = stripLeadingYamlAnchor(
        trimmed.slice(`${sectionName}:`.length).trim(),
      );
      if (inlineSectionValue.startsWith("{")) {
        const { nextIndex, rawObject } = collectYamlFlowObject(lines, index, inlineSectionValue);
        values.push(...parseFlowObjectStringList(rawObject, keyName, anchors));
        index = nextIndex;
        sectionIndent = null;
        keyIndent = null;
        continue;
      }

      if (inlineSectionValue === "") {
        sectionIndent = indent;
        keyIndent = null;
        continue;
      }
    }

    if (sectionIndent === null || indent <= sectionIndent) {
      continue;
    }

    if (keyIndent !== null && indent <= keyIndent && !trimmed.startsWith(`${keyName}:`)) {
      keyIndent = null;
    }

    if (trimmed.startsWith(`${keyName}:`)) {
      keyIndent = indent;
      const inlineValue = stripLeadingYamlAnchor(trimmed.slice(`${keyName}:`.length).trim());
      const aliasName = parseYamlAlias(inlineValue);
      if (aliasName) {
        values.push(...(anchors.get(aliasName) ?? []));
        continue;
      }

      if (inlineValue.startsWith("[")) {
        const { nextIndex, rawArray } = collectYamlFlowArray(lines, index, inlineValue);
        values.push(...parseInlineArray(rawArray));
        index = nextIndex;
      }
      continue;
    }

    if (keyIndent !== null && indent > keyIndent && trimmed.startsWith("- ")) {
      const item = stripQuotes(trimmed.slice(2).trim());
      if (item) {
        values.push(item);
      }
    }
  }

  return uniqueSorted(values);
}

function readYamlStringListAnchors(content: string): ReadonlyMap<string, readonly string[]> {
  const anchors = new Map<string, readonly string[]>();
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = stripYamlComment(line).trim();
    if (!trimmed) {
      continue;
    }

    const anchorMatch = trimmed.match(/^[^:]+:\s*&([\w.-]+)(.*)$/);
    if (!anchorMatch?.[1] || anchorMatch[2] === undefined) {
      continue;
    }

    const anchorName = anchorMatch[1];
    const inlineValue = anchorMatch[2].trim();
    const indent = leadingSpaces(line);
    const parsed = readYamlAnchoredStringList(lines, index, inlineValue, indent);
    if (parsed.values.length > 0) {
      anchors.set(anchorName, uniqueSorted(parsed.values));
      index = parsed.nextIndex;
    }
  }

  return anchors;
}

function readYamlAnchoredStringList(
  lines: readonly string[],
  startIndex: number,
  inlineValue: string,
  indent: number,
): { readonly nextIndex: number; readonly values: readonly string[] } {
  if (inlineValue.startsWith("[")) {
    const { nextIndex, rawArray } = collectYamlFlowArray(lines, startIndex, inlineValue);
    return {
      nextIndex,
      values: parseInlineArray(rawArray),
    };
  }

  if (inlineValue === "") {
    return collectYamlBlockStringList(lines, startIndex, indent);
  }

  return {
    nextIndex: startIndex,
    values: [],
  };
}

function collectYamlBlockStringList(
  lines: readonly string[],
  startIndex: number,
  parentIndent: number,
): { readonly nextIndex: number; readonly values: readonly string[] } {
  const values: string[] = [];
  let nextIndex = startIndex;

  for (let index = startIndex + 1; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = stripYamlComment(line).trim();
    if (!trimmed) {
      continue;
    }

    const indent = leadingSpaces(line);
    if (indent <= parentIndent) {
      break;
    }

    if (!trimmed.startsWith("- ")) {
      break;
    }

    const item = stripQuotes(trimmed.slice(2).trim());
    if (item) {
      values.push(item);
      nextIndex = index;
    }
  }

  return {
    nextIndex,
    values,
  };
}

function readGitleaksEffectiveAllowlists(
  options: Options,
  violations: Violation[],
): GitleaksEffectiveAllowlists {
  const config = readGitleaksConfigAllowlists(
    options.gitleaksConfigPath,
    violations,
    options.rootDir,
  );
  const ignoreFingerprints = readGitleaksIgnoreFingerprints(options.gitleaksIgnorePath);

  if (config.configExists && !config.hasEffectiveRules) {
    violations.push({
      message: `Gitleaks config ${options.gitleaksConfigPath} has no effective detection rules`,
      recovery: "Add [extend] useDefault = true or at least one [[rules]] detection rule.",
    });
  }

  return {
    entries: config.entries,
    ignoreFingerprints,
  };
}

function readGitleaksConfigAllowlists(
  path: string,
  violations: Violation[],
  invocationDir: string,
  pathStack: readonly string[] = [],
): GitleaksConfigReadResult {
  const absolutePath = resolve(path);

  if (pathStack.includes(absolutePath)) {
    violations.push({
      message: `Gitleaks config extend cycle includes ${absolutePath}`,
      recovery: "Remove the recursive Gitleaks [extend] path before adding allowlist metadata.",
    });
    return { configExists: true, entries: [], hasEffectiveRules: false };
  }

  if (!existsSync(absolutePath)) {
    return { configExists: false, entries: [], hasEffectiveRules: false };
  }

  const content = readFileSync(absolutePath, "utf-8").replace(/\r\n/g, "\n");
  const lines = content.split("\n");
  const entries: GitleaksAllowlistEntry[] = [];
  const extendPaths: string[] = [];
  let extendsDefaultRules = false;
  let hasDetectionRules = false;
  let section = "";

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = stripTomlComment(line).trim();
    const sectionMatch = trimmed.match(/^\[+([^\]]+)\]+$/);
    if (sectionMatch?.[1]) {
      section = sectionMatch[1].trim();
      if (section === "rules") {
        hasDetectionRules = true;
      }
      continue;
    }

    const assignment = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
    if (!assignment?.[1] || assignment[2] === undefined) {
      continue;
    }

    if (section === "extend" && assignment[1] === "useDefault") {
      extendsDefaultRules = assignment[2].trim() === "true";
      continue;
    }

    if (section === "extend" && assignment[1] === "path") {
      const extendPath = parseTomlStringValue(assignment[2]);
      if (extendPath) {
        extendPaths.push(resolve(invocationDir, extendPath));
      } else {
        violations.push({
          message: `Gitleaks config ${absolutePath} has an unparsable [extend].path value`,
          recovery: "Use a TOML string for [extend].path or remove the extended config reference.",
        });
      }
      continue;
    }

    if (!isGitleaksAllowlistSection(section)) {
      continue;
    }

    const kind = gitleaksKeyKinds[assignment[1]];
    if (!kind) {
      continue;
    }

    const { rawArray, nextIndex } = collectTomlArray(lines, index, assignment[2]);
    index = nextIndex;

    for (const value of parseTomlStringArray(rawArray)) {
      entries.push({
        kind,
        source: absolutePath,
        value,
      });
    }
  }

  let hasEffectiveRules = extendsDefaultRules || hasDetectionRules;

  for (const extendPath of extendPaths) {
    const extendedConfig = readGitleaksConfigAllowlists(extendPath, violations, invocationDir, [
      ...pathStack,
      absolutePath,
    ]);
    entries.push(...extendedConfig.entries);
    hasEffectiveRules ||= extendedConfig.hasEffectiveRules;
  }

  const duplicateKeys = duplicateValues(
    entries.map((entry) => gitleaksKey(entry.kind, entry.value)),
  );
  for (const duplicateKey of duplicateKeys) {
    violations.push({
      message: `Gitleaks allowlist config contains duplicate ${duplicateKey}`,
      recovery: "Remove duplicate Gitleaks allowlist entries before adding metadata.",
    });
  }

  return {
    configExists: true,
    entries,
    hasEffectiveRules,
  };
}

function collectTomlArray(
  lines: readonly string[],
  startIndex: number,
  initialValue: string,
): { readonly nextIndex: number; readonly rawArray: string } {
  let rawArray = stripTomlComment(initialValue).trim();
  let index = startIndex;

  while (!isBalancedTomlArray(rawArray) && index + 1 < lines.length) {
    index++;
    rawArray = `${rawArray}\n${stripTomlComment(lines[index]).trim()}`;
  }

  return {
    nextIndex: index,
    rawArray,
  };
}

function parseTomlStringArray(rawArray: string): readonly string[] {
  const values: string[] = [];
  const pattern = /'''([\s\S]*?)'''|"""([\s\S]*?)"""|'([^']*)'|"((?:\\.|[^"])*)"/g;

  for (const match of rawArray.matchAll(pattern)) {
    const rawValue = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    values.push(match[4] !== undefined ? unescapeDoubleQuotedTomlString(rawValue) : rawValue);
  }

  return values;
}

function parseTomlStringValue(value: string): string | null {
  const trimmed = stripTomlComment(value).trim();
  const match = /^(?:'''([\s\S]*?)'''|"""([\s\S]*?)"""|'([^']*)'|"((?:\\.|[^"])*)")$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const rawValue = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
  return match[4] !== undefined ? unescapeDoubleQuotedTomlString(rawValue) : rawValue;
}

function readGitleaksIgnoreFingerprints(path: string): readonly string[] {
  if (!existsSync(path)) {
    return [];
  }

  return uniqueSorted(
    readFileSync(path, "utf-8")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
}

function validateNoInlineGitleaksSuppressions(options: Options, violations: Violation[]): void {
  for (const match of readInlineGitleaksSuppressions(options.rootDir)) {
    violations.push({
      message: `${match} uses an inline Gitleaks suppression comment`,
      recovery:
        "Remove the inline suppression and use .gitleaks.toml or .gitleaksignore with reviewed security metadata instead.",
    });
  }
}

function readInlineGitleaksSuppressions(rootDir: string): readonly string[] {
  return uniqueSorted([
    ...readCurrentInlineGitleaksSuppressions(rootDir),
    ...(readHistoricalInlineGitleaksSuppressions(rootDir) ?? []),
  ]);
}

function readCurrentInlineGitleaksSuppressions(rootDir: string): readonly string[] {
  const files = readGitTrackedFiles(rootDir) ?? readScannableFiles(rootDir);
  const matches: string[] = [];

  for (const file of files) {
    const absolutePath = resolve(rootDir, file);
    let content = "";
    try {
      content = readFileSync(absolutePath, "utf-8").replace(/\r\n/g, "\n");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index++) {
      if (lines[index].includes(inlineGitleaksAllowMarker)) {
        matches.push(`${file}:${index + 1}`);
      }
    }
  }

  return matches;
}

function readHistoricalInlineGitleaksSuppressions(rootDir: string): readonly string[] | null {
  const logResult = spawnSync(
    "git",
    [
      "-C",
      rootDir,
      "log",
      "--all",
      `-G${inlineGitleaksAllowMarker}`,
      "--format=commit:%H",
      "--name-only",
      "--",
    ],
    {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (logResult.status !== 0) {
    return null;
  }

  const matches: string[] = [];
  for (const candidate of parseGitLogInlineSuppressionCandidates(logResult.stdout)) {
    const showResult = spawnSync(
      "git",
      ["-C", rootDir, "show", `${candidate.commit}:${candidate.path}`],
      {
        encoding: "utf-8",
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    if (showResult.status !== 0) {
      continue;
    }

    const lines = showResult.stdout.replace(/\r\n/g, "\n").split("\n");
    for (let index = 0; index < lines.length; index++) {
      if (lines[index].includes(inlineGitleaksAllowMarker)) {
        matches.push(`${candidate.commit.slice(0, 12)}:${candidate.path}:${index + 1}`);
      }
    }
  }

  return matches;
}

function parseGitLogInlineSuppressionCandidates(
  output: string,
): readonly { readonly commit: string; readonly path: string }[] {
  const candidates: { commit: string; path: string }[] = [];
  let commit = "";

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("commit:")) {
      commit = line.slice("commit:".length);
      continue;
    }

    if (commit) {
      candidates.push({ commit, path: line });
    }
  }

  return candidates;
}

function readGitTrackedFiles(rootDir: string): readonly string[] | null {
  const result = spawnSync("git", ["-C", rootDir, "ls-files"], {
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function readScannableFiles(rootDir: string): readonly string[] {
  const files: string[] = [];
  const skippedDirectories = new Set([
    ".git",
    ".next",
    ".turbo",
    "ci-reports",
    "coverage",
    "dist",
    "node_modules",
  ]);

  function walk(directory: string): void {
    for (const entry of readdirSync(directory)) {
      if (skippedDirectories.has(entry)) {
        continue;
      }

      const absolutePath = resolve(directory, entry);
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (stat.isFile()) {
        files.push(relative(rootDir, absolutePath).replace(/\\/g, "/"));
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

function validateAuditMetadata(
  effectiveIgnores: readonly string[],
  metadata: readonly AuditMetadataEntry[],
  violations: Violation[],
): void {
  const effectiveSet = new Set(effectiveIgnores);
  const metadataIds = metadata.map((entry) => entry.id);
  const metadataSet = new Set(metadataIds);

  for (const duplicateId of duplicateValues(effectiveIgnores)) {
    violations.push({
      message: `audit allowlist contains duplicate vulnerability ${duplicateId}`,
      recovery:
        "Keep each audit allowlist vulnerability once in the effective audit configuration.",
    });
  }

  for (const duplicateId of duplicateValues(metadataIds)) {
    violations.push({
      message: `audit metadata contains duplicate vulnerability ${duplicateId}`,
      recovery: "Keep one metadata object per audit vulnerability.",
    });
  }

  for (const id of effectiveSet) {
    if (!metadataSet.has(id)) {
      violations.push({
        message: `audit allowlist ${id} is missing owner/reason/review metadata`,
        recovery: `Add ${id} to scripts/security-allowlist-metadata.json#${auditMetadataArrayPointer(id)}, or remove it from the audit allowlist.`,
      });
    }
  }

  for (const entry of metadata) {
    if (!effectiveSet.has(entry.id)) {
      violations.push({
        message: `${entry.pointer} documents ${entry.id}, but that vulnerability is not in the effective audit allowlist`,
        recovery: `Remove ${entry.pointer} or add ${entry.id} to pnpm-workspace.yaml#auditConfig.${auditConfigKeyForId(entry.id)} / audit:prod --ignore.`,
      });
    }
  }
}

function validateGitleaksMetadata(
  effective: GitleaksEffectiveAllowlists,
  metadata: readonly GitleaksMetadataEntry[],
  violations: Violation[],
): void {
  const effectiveEntries = [
    ...effective.entries,
    ...effective.ignoreFingerprints.map((value): GitleaksAllowlistEntry => {
      return {
        kind: "fingerprint",
        source: defaultGitleaksIgnorePath,
        value,
      };
    }),
  ];
  const effectiveKeys = effectiveEntries.map((entry) => gitleaksKey(entry.kind, entry.value));
  const effectiveSet = new Set(effectiveKeys);
  const metadataKeys = metadata.map((entry) => gitleaksKey(entry.kind, entry.value));
  const metadataSet = new Set(metadataKeys);

  for (const duplicateKey of duplicateValues(effectiveKeys)) {
    violations.push({
      message: `Gitleaks allowlist contains duplicate ${duplicateKey}`,
      recovery: "Keep each Gitleaks exception once in the effective allowlist.",
    });
  }

  for (const duplicateKey of duplicateValues(metadataKeys)) {
    violations.push({
      message: `Gitleaks metadata contains duplicate ${duplicateKey}`,
      recovery: "Keep one metadata object per Gitleaks exception.",
    });
  }

  for (const entry of effectiveEntries) {
    const key = gitleaksKey(entry.kind, entry.value);
    if (!metadataSet.has(key)) {
      violations.push({
        message: `Gitleaks ${entry.kind} allowlist ${entry.value} is missing owner/reason/review metadata`,
        recovery: `Add matching metadata to scripts/security-allowlist-metadata.json#secretScan.gitleaks, or remove the exception from ${entry.source}.`,
      });
    }
  }

  for (const entry of metadata) {
    const key = gitleaksKey(entry.kind, entry.value);
    if (!effectiveSet.has(key)) {
      violations.push({
        message: `${entry.pointer} documents Gitleaks ${entry.kind} ${entry.value}, but it is not in the effective Gitleaks allowlist`,
        recovery: `Remove ${entry.pointer} or add the matching Gitleaks exception.`,
      });
    }
  }
}

function validateGeneratedTemplateMetadata(
  metadata: readonly GeneratedTemplateSecretAllowlistEntry[],
  violations: Violation[],
): void {
  const keys = metadata.map((entry) => `${entry.pathPattern}\u0000${entry.matchPattern}`);

  for (const duplicateKey of duplicateValues(keys)) {
    const [pathPattern, matchPattern] = duplicateKey.split("\u0000");
    violations.push({
      message: `generated template secret allowlist contains duplicate pathPattern ${pathPattern} and matchPattern ${matchPattern}`,
      recovery: "Keep one metadata object per generated template secret-scan exception.",
    });
  }
}

function printResult(
  violations: readonly Violation[],
  effectiveAuditIgnores: readonly string[],
  effectiveGitleaks: GitleaksEffectiveAllowlists,
  generatedTemplateAllowlists: readonly GeneratedTemplateSecretAllowlistEntry[],
): void {
  if (violations.length === 0) {
    log(
      `security-allowlist-metadata: passed (${effectiveAuditIgnores.length} audit ignores, ${effectiveGitleaks.entries.length} gitleaks allowlist entries, ${effectiveGitleaks.ignoreFingerprints.length} gitleaks ignore fingerprints, ${generatedTemplateAllowlists.length} generated template allowlists).`,
    );
    return;
  }

  log("security-allowlist-metadata: failed.");
  log("");
  log("Violations:");
  for (const violation of violations) {
    log(`- ${violation.message}`);
    log(`  Recovery: ${violation.recovery}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isGitleaksAllowlistKind(value: string): value is GitleaksAllowlistKind {
  return (
    value === "commit" ||
    value === "fingerprint" ||
    value === "path" ||
    value === "regex" ||
    value === "stopword"
  );
}

function isGitleaksAllowlistSection(section: string): boolean {
  return (
    section === "allowlist" || section.endsWith(".allowlist") || section.endsWith(".allowlists")
  );
}

function readStringArrayValue(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSorted(value.flatMap((item) => (typeof item === "string" ? [item] : [])));
}

function parseInlineArray(value: string): readonly string[] {
  return value
    .slice(1, -1)
    .split(",")
    .map((item) => stripQuotes(item.trim()))
    .filter((item) => item.length > 0);
}

function collectYamlFlowObject(
  lines: readonly string[],
  startIndex: number,
  initialValue: string,
): { readonly nextIndex: number; readonly rawObject: string } {
  let rawObject = stripYamlComment(initialValue).trim();
  let index = startIndex;

  while (!isBalancedFlowObject(rawObject) && index + 1 < lines.length) {
    index++;
    rawObject = `${rawObject}\n${stripYamlComment(lines[index]).trim()}`;
  }

  return {
    nextIndex: index,
    rawObject,
  };
}

function collectYamlFlowArray(
  lines: readonly string[],
  startIndex: number,
  initialValue: string,
): { readonly nextIndex: number; readonly rawArray: string } {
  let rawArray = stripYamlComment(initialValue).trim();
  let index = startIndex;

  while (!isBalancedFlowArray(rawArray) && index + 1 < lines.length) {
    index++;
    rawArray = `${rawArray}\n${stripYamlComment(lines[index]).trim()}`;
  }

  return {
    nextIndex: index,
    rawArray,
  };
}

function isBalancedFlowObject(value: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previousChar = value[index - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote && previousChar !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (char === "{") {
      depth++;
      continue;
    }

    if (char === "}") {
      depth--;
    }
  }

  return depth === 0;
}

function isBalancedFlowArray(value: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previousChar = value[index - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote && previousChar !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (char === "[") {
      depth++;
      continue;
    }

    if (char === "]") {
      depth--;
    }
  }

  return depth === 0;
}

function isBalancedTomlArray(value: string): boolean {
  let depth = 0;
  let mode: "none" | "single" | "double" | "triple-single" | "triple-double" = "none";

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previousChar = value[index - 1];
    const nextThree = value.slice(index, index + 3);

    if (mode === "triple-single") {
      if (nextThree === "'''") {
        mode = "none";
        index += 2;
      }
      continue;
    }

    if (mode === "triple-double") {
      if (nextThree === '"""' && previousChar !== "\\") {
        mode = "none";
        index += 2;
      }
      continue;
    }

    if (mode === "single") {
      if (char === "'") {
        mode = "none";
      }
      continue;
    }

    if (mode === "double") {
      if (char === '"' && previousChar !== "\\") {
        mode = "none";
      }
      continue;
    }

    if (nextThree === "'''") {
      mode = "triple-single";
      index += 2;
      continue;
    }

    if (nextThree === '"""') {
      mode = "triple-double";
      index += 2;
      continue;
    }

    if (char === "'") {
      mode = "single";
      continue;
    }

    if (char === '"') {
      mode = "double";
      continue;
    }

    if (char === "[") {
      depth++;
      continue;
    }

    if (char === "]") {
      depth--;
    }
  }

  return depth === 0 && mode === "none";
}

function parseFlowObjectStringList(
  value: string,
  keyName: string,
  anchors: ReadonlyMap<string, readonly string[]> = new Map(),
): readonly string[] {
  const keyPattern = escapeRegExp(keyName);
  const objectBody = value.slice(1, -1);
  const arrayMatch = new RegExp(
    `(?:^|,)\\s*["']?${keyPattern}["']?\\s*:\\s*(?:&[\\w.-]+\\s+)?(\\[[^\\]]*\\])`,
  ).exec(objectBody);

  if (arrayMatch?.[1]) {
    return parseInlineArray(arrayMatch[1]);
  }

  const aliasMatch = new RegExp(
    `(?:^|,)\\s*["']?${keyPattern}["']?\\s*:\\s*(?:&[\\w.-]+\\s+)?\\*([\\w.-]+)`,
  ).exec(objectBody);
  if (aliasMatch?.[1]) {
    return anchors.get(aliasMatch[1]) ?? [];
  }

  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function stripLeadingYamlAnchor(value: string): string {
  return value.replace(/^&[\w.-]+(?:\s+|$)/, "").trim();
}

function parseYamlAlias(value: string): string | null {
  const match = value.match(/^\*([\w.-]+)$/);
  return match?.[1] ?? null;
}

function stripYamlComment(value: string): string {
  return stripComment(value, "#");
}

function stripTomlComment(value: string): string {
  return stripComment(value, "#");
}

function stripComment(value: string, marker: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const previousChar = value[index - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote && previousChar !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === marker && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, index);
    }
  }

  return value;
}

function leadingSpaces(value: string): number {
  const match = value.match(/^ */);
  return match?.[0].length ?? 0;
}

function unescapeDoubleQuotedTomlString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function gitleaksKey(kind: GitleaksAllowlistKind, value: string): string {
  return `${kind}:${value}`;
}

function auditConfigKeyForId(id: string): "ignoreCves" | "ignoreGhsas" {
  return id.startsWith("CVE-") ? "ignoreCves" : "ignoreGhsas";
}

function auditMetadataArrayPointer(id: string): "audit.ignoreCves" | "audit.ignoreGhsas" {
  return id.startsWith("CVE-") ? "audit.ignoreCves" : "audit.ignoreGhsas";
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return [...duplicates].sort();
}

function main(): void {
  const violations: Violation[] = [];
  const options = parseArgs(argv.slice(2));
  const metadata = readMetadata(options.metadataPath, options.today, violations);
  validateMetadataConfig(options, metadata, violations);
  const effectiveOptions = resolveMetadataOptions(options, metadata);
  const effectiveAuditIgnores = readEffectiveAuditIgnores(options, violations);
  const effectiveGitleaks = readGitleaksEffectiveAllowlists(effectiveOptions, violations);

  validateAuditMetadata(effectiveAuditIgnores, metadata.auditIgnores, violations);
  validateGitleaksMetadata(effectiveGitleaks, metadata.gitleaksAllowlists, violations);
  validateGeneratedTemplateMetadata(metadata.generatedTemplateAllowlists, violations);
  validateNoInlineGitleaksSuppressions(options, violations);
  printResult(
    violations,
    effectiveAuditIgnores,
    effectiveGitleaks,
    metadata.generatedTemplateAllowlists,
  );

  if (violations.length > 0) {
    exit(1);
  }
}

function resolveMetadataOptions(options: Options, metadata: SecurityAllowlistMetadata): Options {
  if (options.explicitGitleaksConfigPath || metadata.gitleaksConfigPath === undefined) {
    return options;
  }

  return {
    ...options,
    gitleaksConfigPath: resolveFromRoot(options.rootDir, metadata.gitleaksConfigPath),
  };
}

main();
