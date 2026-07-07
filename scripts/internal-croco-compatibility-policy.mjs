import fs from "node:fs";
import path from "node:path";

export const DEPENDENCY_RANGE_POLICY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
export const INTERNAL_CROCO_PACKAGE_PREFIX = "@croco/";
export const INTERNAL_WORKSPACE_DEPENDENCY_RANGE = "workspace:*";
export const INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH =
  "scripts/internal-peer-dependency-range-exceptions.json";

const SEMVER_NUMERIC_IDENTIFIER_PATTERN = "0|[1-9]\\d*";
const SEMVER_XRANGE_IDENTIFIER_PATTERN = `(?:${SEMVER_NUMERIC_IDENTIFIER_PATTERN}|x|X|\\*)`;
const SEMVER_NUMERIC_IDENTIFIER_RE = new RegExp(`^(?:${SEMVER_NUMERIC_IDENTIFIER_PATTERN})$`, "u");
const SEMVER_VERSION_RE = new RegExp(
  `^(?<major>${SEMVER_XRANGE_IDENTIFIER_PATTERN})(?:\\.(?<minor>${SEMVER_XRANGE_IDENTIFIER_PATTERN})(?:\\.(?<patch>${SEMVER_XRANGE_IDENTIFIER_PATTERN}))?)?(?<prerelease>-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?<build>\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
  "u",
);

export function readInternalPeerDependencyRangeExceptions(
  rootDir,
  workspacePackageNames,
  internalWorkspacePackageNames,
  violations,
) {
  const exceptionPath = path.join(rootDir, INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH);
  if (!fs.existsSync(exceptionPath)) {
    return new Map();
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(exceptionPath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    violations.push(
      `${INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH}: must contain valid JSON: ${message}`,
    );
    return new Map();
  }

  if (!Array.isArray(parsed)) {
    violations.push(`${INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH}: must be an array`);
    return new Map();
  }

  const exceptions = new Map();
  for (const [index, entry] of parsed.entries()) {
    const fieldName = `${INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH}[${index}]`;
    const exception = readInternalPeerDependencyRangeException(
      entry,
      fieldName,
      workspacePackageNames,
      internalWorkspacePackageNames,
      violations,
    );

    if (!exception) {
      continue;
    }

    if (exceptions.has(exception.key)) {
      violations.push(
        `${fieldName}: duplicate exception ${formatInternalPeerDependencyRangeException(exception)}`,
      );
      continue;
    }

    exceptions.set(exception.key, exception);
  }

  return exceptions;
}

function readInternalPeerDependencyRangeException(
  entry,
  fieldName,
  workspacePackageNames,
  internalWorkspacePackageNames,
  violations,
) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    violations.push(`${fieldName}: must be an object`);
    return undefined;
  }

  const packageName = readRequiredStringField(entry, "package", fieldName, violations);
  const sectionName = readRequiredStringField(entry, "section", fieldName, violations);
  const dependencyName = readRequiredStringField(entry, "dependency", fieldName, violations);
  const range = readRequiredStringField(entry, "range", fieldName, violations);
  const reason = readRequiredStringField(entry, "reason", fieldName, violations);
  const owner = readRequiredStringField(entry, "owner", fieldName, violations);
  const compatibilityRationale = readRequiredStringField(
    entry,
    "compatibilityRationale",
    fieldName,
    violations,
  );

  if (packageName && !workspacePackageNames.has(packageName)) {
    violations.push(
      `${fieldName}.package must name a workspace package, not ${JSON.stringify(packageName)}`,
    );
  }

  if (sectionName && sectionName !== "peerDependencies") {
    violations.push(
      `${fieldName}.section must be "peerDependencies"; internal semver exceptions are peer-only`,
    );
  }

  if (dependencyName && !internalWorkspacePackageNames.has(dependencyName)) {
    violations.push(
      `${fieldName}.dependency must name an internal @croco/* workspace package, not ${JSON.stringify(dependencyName)}`,
    );
  }

  for (const metadataField of [
    ["range", range],
    ["reason", reason],
    ["owner", owner],
    ["compatibilityRationale", compatibilityRationale],
  ]) {
    const [propertyName, value] = metadataField;
    if (value !== undefined && value.trim().length === 0) {
      violations.push(`${fieldName}.${propertyName} must be nonempty`);
    }
  }

  if (range !== undefined && range.trim().length > 0 && !isSemverCompatibilityRange(range)) {
    violations.push(`${fieldName}.range must be a semver compatibility range`);
    return undefined;
  }

  if (
    !packageName ||
    !sectionName ||
    !dependencyName ||
    !range?.trim() ||
    !reason?.trim() ||
    !owner?.trim() ||
    !compatibilityRationale?.trim()
  ) {
    return undefined;
  }

  if (
    !workspacePackageNames.has(packageName) ||
    sectionName !== "peerDependencies" ||
    !internalWorkspacePackageNames.has(dependencyName)
  ) {
    return undefined;
  }

  return {
    compatibilityRationale,
    dependencyName,
    key: internalPeerDependencyRangeExceptionKey(packageName, dependencyName, range),
    owner,
    packageName,
    range,
    reason,
    sectionName,
  };
}

function readRequiredStringField(entry, propertyName, fieldName, violations) {
  const value = entry[propertyName];
  if (typeof value !== "string") {
    violations.push(`${fieldName}.${propertyName} must be a string`);
    return undefined;
  }

  return value;
}

function isSemverCompatibilityRange(range) {
  const trimmed = range.trim();
  if (trimmed.length === 0 || trimmed.includes(":")) {
    return false;
  }

  const alternatives = trimmed.split("||").map((alternative) => alternative.trim());
  if (alternatives.some((alternative) => alternative.length === 0)) {
    return false;
  }

  return alternatives.every(isSemverCompatibilityRangeAlternative);
}

function isSemverCompatibilityRangeAlternative(alternative) {
  if (alternative === "*") {
    return true;
  }

  const hyphenRangeParts = alternative.split(/\s+-\s+/u);
  if (hyphenRangeParts.length === 2) {
    return hyphenRangeParts.every(isSemverVersionPattern);
  }

  if (hyphenRangeParts.length > 2) {
    return false;
  }

  return alternative.split(/\s+/u).every(isSemverComparatorPattern);
}

function isSemverComparatorPattern(comparator) {
  const match = comparator.match(/^(?:<=|>=|<|>|=|\^|~)?(.+)$/u);
  return Boolean(match?.[1] && isSemverVersionPattern(match[1]));
}

function isSemverVersionPattern(version) {
  const match = SEMVER_VERSION_RE.exec(version);
  if (!match?.groups) {
    return false;
  }

  const { build, major, minor, patch, prerelease } = match.groups;
  if (!hasValidWildcardOrder(major, minor, patch)) {
    return false;
  }

  const hasMetadata = Boolean(prerelease || build);
  const hasCompleteNumericVersion =
    Boolean(minor && patch) &&
    ![major, minor, patch].some((versionPart) => isSemverWildcardVersionPart(versionPart));
  if (hasMetadata && !hasCompleteNumericVersion) {
    return false;
  }

  if (!prerelease) {
    return true;
  }

  return prerelease
    .slice(1)
    .split(".")
    .every((identifier) => !isInvalidNumericPrereleaseIdentifier(identifier));
}

function hasValidWildcardOrder(major, minor, patch) {
  if (isSemverWildcardVersionPart(major) && minor && !isSemverWildcardVersionPart(minor)) {
    return false;
  }

  if (minor && isSemverWildcardVersionPart(minor) && patch && !isSemverWildcardVersionPart(patch)) {
    return false;
  }

  return true;
}

function isSemverWildcardVersionPart(versionPart) {
  return versionPart === "*" || versionPart === "x" || versionPart === "X";
}

function isInvalidNumericPrereleaseIdentifier(identifier) {
  return /^\d+$/u.test(identifier) && !SEMVER_NUMERIC_IDENTIFIER_RE.test(identifier);
}

export function validateInternalDependencyRangePolicy(pkg, policyContext, violations) {
  if (!pkg.name || typeof pkg.name !== "string") {
    return;
  }

  for (const sectionName of DEPENDENCY_RANGE_POLICY_SECTIONS) {
    const dependencyMap = pkg[sectionName];
    if (!dependencyMap || typeof dependencyMap !== "object" || Array.isArray(dependencyMap)) {
      continue;
    }

    for (const [dependencyName, range] of Object.entries(dependencyMap)) {
      if (!policyContext.internalWorkspacePackageNames.has(dependencyName)) {
        continue;
      }

      if (range === INTERNAL_WORKSPACE_DEPENDENCY_RANGE) {
        continue;
      }

      const exceptionKey = internalPeerDependencyRangeExceptionKey(pkg.name, dependencyName, range);
      if (
        sectionName === "peerDependencies" &&
        policyContext.internalPeerDependencyRangeExceptions.has(exceptionKey)
      ) {
        policyContext.usedInternalPeerDependencyRangeExceptions.add(exceptionKey);
        continue;
      }

      violations.push(
        `${sectionName}.${dependencyName} must use ${INTERNAL_WORKSPACE_DEPENDENCY_RANGE} for internal Croco workspace packages, not ${JSON.stringify(range)}`,
      );
    }
  }
}

export function internalPeerDependencyRangeExceptionKey(packageName, dependencyName, range) {
  return `${packageName}\0${dependencyName}\0${range}`;
}

export function formatInternalPeerDependencyRangeException(exception) {
  return `${exception.packageName} peerDependencies.${exception.dependencyName}=${JSON.stringify(exception.range)}`;
}
