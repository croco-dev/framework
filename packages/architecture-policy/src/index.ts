import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";

export const ARCHITECTURE_POLICY_SCHEMA_VERSION = "croco.architecture-policy/v1";

export class ArchitecturePolicyManifestShapeProblem extends Problem {
  constructor() {
    super(
      "architecture-policy/manifest-shape",
      ProblemCategory.ValidationError,
      "Architecture policy manifest must be a JSON object.",
    );
  }
}

export class ArchitecturePolicyManifestJsonParseProblem extends Problem {
  constructor(cause?: Error) {
    super(
      "architecture-policy/manifest-json-parse",
      ProblemCategory.ValidationError,
      "Architecture policy manifest must contain valid JSON.",
      { cause },
    );
  }
}

export class ArchitecturePolicyManifestSchemaVersionProblem extends Problem {
  constructor(actualSchemaVersion: unknown) {
    super(
      "architecture-policy/manifest-schema-version",
      ProblemCategory.ValidationError,
      `Architecture policy manifest schemaVersion must be '${ARCHITECTURE_POLICY_SCHEMA_VERSION}'.`,
      {
        extensions: {
          actualSchemaVersion,
          expectedSchemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
        },
      },
    );
  }
}

export class ArchitecturePolicyPackageJsonParseProblem extends Problem {
  constructor(packageJsonPath: string, cause?: Error) {
    super(
      "architecture-policy/package-json-parse",
      ProblemCategory.ValidationError,
      `Architecture policy package.json must contain valid JSON: ${packageJsonPath}.`,
      {
        cause,
        extensions: {
          packageJsonPath,
        },
      },
    );
  }
}

export type ArchitecturePolicyPackageGroup = {
  readonly description?: string;
  readonly packages?: readonly string[];
  readonly paths?: readonly string[];
};

export type ArchitecturePolicyMatcher = {
  readonly groups?: readonly string[];
  readonly packages?: readonly string[];
  readonly paths?: readonly string[];
  readonly specifiers?: readonly string[];
};

export type ArchitectureForbiddenImportRule = {
  readonly id: string;
  readonly description?: string;
  readonly from: ArchitecturePolicyMatcher;
  readonly to: ArchitecturePolicyMatcher;
  readonly message?: string;
  readonly recovery?: string;
  readonly appliesTo?: readonly ArchitectureImportSourceKind[];
};

export type ArchitectureAllowedGroupImportRule = {
  readonly id: string;
  readonly description?: string;
  readonly fromGroups: readonly string[];
  readonly allowGroups: readonly string[];
  readonly allowPackages?: readonly string[];
  readonly allowSpecifiers?: readonly string[];
  readonly allowExternal?: boolean;
  readonly allowSameGroup?: boolean;
  readonly message?: string;
  readonly recovery?: string;
  readonly appliesTo?: readonly ArchitectureImportSourceKind[];
};

export type ArchitectureEntrypointIgnore = {
  readonly paths?: readonly string[];
  readonly packages?: readonly string[];
  readonly specifiers?: readonly string[];
};

export type ArchitecturePublicEntrypointRule = {
  readonly id: string;
  readonly description?: string;
  readonly includePackages?: readonly string[];
  readonly ignoreImports?: readonly ArchitectureEntrypointIgnore[];
  readonly message?: string;
  readonly recovery?: string;
};

export type ArchitecturePolicyManifest = {
  readonly schemaVersion: typeof ARCHITECTURE_POLICY_SCHEMA_VERSION;
  readonly policyName?: string;
  readonly packageRoots?: readonly string[];
  readonly include?: readonly string[];
  readonly ignore?: readonly string[];
  readonly packageGroups?: Readonly<Record<string, ArchitecturePolicyPackageGroup>>;
  readonly rules?: {
    readonly forbiddenImports?: readonly ArchitectureForbiddenImportRule[];
    readonly allowedGroupImports?: readonly ArchitectureAllowedGroupImportRule[];
    readonly publicEntrypoints?: ArchitecturePublicEntrypointRule;
  };
};

export type ArchitectureImportSourceKind = "source" | "package-manifest";

export type ArchitecturePolicyDiagnosticCode =
  | "architecture-policy/disallowed-dependency-edge"
  | "architecture-policy/forbidden-import"
  | "architecture-policy/private-entrypoint-import";

export type ArchitecturePolicyDiagnostic = {
  readonly code: ArchitecturePolicyDiagnosticCode;
  readonly ruleId: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly excerpt: string;
  readonly importSpecifier: string;
  readonly sourceKind: ArchitectureImportSourceKind;
  readonly sourcePackage: string | null;
  readonly sourceGroup: string | null;
  readonly targetPackage: string | null;
  readonly targetGroup: string | null;
  readonly recovery?: string;
};

export type ArchitecturePolicyReport = {
  readonly status: "pass" | "fail";
  readonly policyName: string | null;
  readonly packageCount: number;
  readonly checkedFileCount: number;
  readonly checkedPackageManifestCount: number;
  readonly importCount: number;
  readonly diagnostics: readonly ArchitecturePolicyDiagnostic[];
};

export type ArchitecturePolicyCheckOptions = {
  readonly rootDir: string;
  readonly manifest: ArchitecturePolicyManifest;
};

type PackageInfo = {
  readonly name: string;
  readonly relativeDir: string;
  readonly group: string | null;
  readonly packageJsonPath: string;
  readonly packageJson: Record<string, unknown>;
  readonly exportSubpaths: readonly string[];
};

type ImportRecord = {
  readonly sourceKind: ArchitectureImportSourceKind;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly excerpt: string;
  readonly specifier: string;
  readonly importedPackageName: string | null;
  readonly importedSubpath: string | null;
  readonly sourcePackage: PackageInfo | null;
};

type NormalizedPolicy = {
  readonly rootDir: string;
  readonly manifest: ArchitecturePolicyManifest;
  readonly includePatterns: readonly string[];
  readonly ignorePatterns: readonly string[];
  readonly packageGroups: Readonly<Record<string, ArchitecturePolicyPackageGroup>>;
};

const sourceFilePattern = /\.[cm]?[jt]sx?$/;
const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export function parseArchitecturePolicyManifest(content: string): ArchitecturePolicyManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new ArchitecturePolicyManifestJsonParseProblem(
      error instanceof Error ? error : undefined,
    );
  }

  if (!isRecord(parsed)) {
    throw new ArchitecturePolicyManifestShapeProblem();
  }

  if (parsed.schemaVersion !== ARCHITECTURE_POLICY_SCHEMA_VERSION) {
    throw new ArchitecturePolicyManifestSchemaVersionProblem(parsed.schemaVersion);
  }

  return {
    schemaVersion: ARCHITECTURE_POLICY_SCHEMA_VERSION,
    policyName: readOptionalString(parsed.policyName),
    packageRoots: readStringArray(parsed.packageRoots),
    include: readStringArray(parsed.include),
    ignore: readStringArray(parsed.ignore),
    packageGroups: readPackageGroups(parsed.packageGroups),
    rules: readRules(parsed.rules),
  };
}

export function readArchitecturePolicyManifest(path: string): ArchitecturePolicyManifest {
  return parseArchitecturePolicyManifest(readFileSync(path, "utf-8"));
}

export function checkArchitecturePolicy(
  options: ArchitecturePolicyCheckOptions,
): ArchitecturePolicyReport {
  const normalized = normalizePolicy(options);
  const packages = readPackages(normalized);
  const imports = [
    ...collectSourceImports(normalized, packages),
    ...collectPackageManifestImports(normalized, packages),
  ].sort(compareImportRecords);
  const diagnostics = [...runPolicyRules(normalized, packages, imports)].sort(compareDiagnostics);

  return {
    status: diagnostics.length > 0 ? "fail" : "pass",
    policyName: normalized.manifest.policyName ?? null,
    packageCount: packages.length,
    checkedFileCount: new Set(
      imports.filter((entry) => entry.sourceKind === "source").map((entry) => entry.file),
    ).size,
    checkedPackageManifestCount: new Set(
      imports.filter((entry) => entry.sourceKind === "package-manifest").map((entry) => entry.file),
    ).size,
    importCount: imports.length,
    diagnostics,
  };
}

export function formatArchitecturePolicyDiagnostic(
  diagnostic: ArchitecturePolicyDiagnostic,
): string {
  const target = diagnostic.targetPackage ? ` target=${diagnostic.targetPackage}` : "";
  const group = diagnostic.sourceGroup ? ` sourceGroup=${diagnostic.sourceGroup}` : "";

  return `ERROR ${diagnostic.code} ${diagnostic.file}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.message} import='${diagnostic.importSpecifier}'${target}${group}`;
}

function normalizePolicy(options: ArchitecturePolicyCheckOptions): NormalizedPolicy {
  const rootDir = resolve(options.rootDir);

  return {
    rootDir,
    manifest: options.manifest,
    includePatterns:
      options.manifest.include && options.manifest.include.length > 0
        ? options.manifest.include
        : [
            "packages/*/src/**/*.ts",
            "packages/*/src/**/*.tsx",
            "packages/*/src/**/*.mts",
            "packages/*/src/**/*.cts",
          ],
    ignorePatterns: options.manifest.ignore ?? [],
    packageGroups: options.manifest.packageGroups ?? {},
  };
}

function readRules(value: unknown): ArchitecturePolicyManifest["rules"] {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    forbiddenImports: readForbiddenImportRules(value.forbiddenImports),
    allowedGroupImports: readAllowedGroupImportRules(value.allowedGroupImports),
    publicEntrypoints: readPublicEntrypointRule(value.publicEntrypoints),
  };
}

function readForbiddenImportRules(value: unknown): readonly ArchitectureForbiddenImportRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      return [];
    }

    return [
      {
        id: entry.id,
        description: readOptionalString(entry.description),
        from: readMatcher(entry.from),
        to: readMatcher(entry.to),
        message: readOptionalString(entry.message),
        recovery: readOptionalString(entry.recovery),
        appliesTo: readSourceKinds(entry.appliesTo),
      },
    ];
  });
}

function readAllowedGroupImportRules(
  value: unknown,
): readonly ArchitectureAllowedGroupImportRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      return [];
    }

    return [
      {
        id: entry.id,
        description: readOptionalString(entry.description),
        fromGroups: readStringArray(entry.fromGroups) ?? [],
        allowGroups: readStringArray(entry.allowGroups) ?? [],
        allowPackages: readStringArray(entry.allowPackages),
        allowSpecifiers: readStringArray(entry.allowSpecifiers),
        allowExternal: typeof entry.allowExternal === "boolean" ? entry.allowExternal : undefined,
        allowSameGroup:
          typeof entry.allowSameGroup === "boolean" ? entry.allowSameGroup : undefined,
        message: readOptionalString(entry.message),
        recovery: readOptionalString(entry.recovery),
        appliesTo: readSourceKinds(entry.appliesTo),
      },
    ];
  });
}

function readPublicEntrypointRule(value: unknown): ArchitecturePublicEntrypointRule | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }

  return {
    id: value.id,
    description: readOptionalString(value.description),
    includePackages: readStringArray(value.includePackages),
    ignoreImports: readEntrypointIgnores(value.ignoreImports),
    message: readOptionalString(value.message),
    recovery: readOptionalString(value.recovery),
  };
}

function readEntrypointIgnores(value: unknown): readonly ArchitectureEntrypointIgnore[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        paths: readStringArray(entry.paths),
        packages: readStringArray(entry.packages),
        specifiers: readStringArray(entry.specifiers),
      },
    ];
  });
}

function readMatcher(value: unknown): ArchitecturePolicyMatcher {
  if (!isRecord(value)) {
    return {};
  }

  return {
    groups: readStringArray(value.groups),
    packages: readStringArray(value.packages),
    paths: readStringArray(value.paths),
    specifiers: readStringArray(value.specifiers),
  };
}

function readPackageGroups(
  value: unknown,
): Readonly<Record<string, ArchitecturePolicyPackageGroup>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const groups: Record<string, ArchitecturePolicyPackageGroup> = {};

  for (const [groupName, groupValue] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!isRecord(groupValue)) {
      continue;
    }

    groups[groupName] = {
      description: readOptionalString(groupValue.description),
      packages: readStringArray(groupValue.packages),
      paths: readStringArray(groupValue.paths),
    };
  }

  return groups;
}

function readSourceKinds(value: unknown): readonly ArchitectureImportSourceKind[] | undefined {
  const values = readStringArray(value);
  const sourceKinds = values?.filter(
    (entry): entry is ArchitectureImportSourceKind =>
      entry === "source" || entry === "package-manifest",
  );

  return sourceKinds && sourceKinds.length > 0 ? sourceKinds : undefined;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackages(policy: NormalizedPolicy): readonly PackageInfo[] {
  const packageRoots = policy.manifest.packageRoots ?? ["packages"];
  const packageJsonFiles = packageRoots.flatMap((packageRoot) =>
    findPackageJsonFiles(join(policy.rootDir, packageRoot)),
  );

  return packageJsonFiles
    .flatMap((packageJsonPath) => {
      const packageJson = readJsonFile(packageJsonPath);
      if (!isRecord(packageJson) || typeof packageJson.name !== "string") {
        return [];
      }

      const relativeDir = toPosixPath(relative(policy.rootDir, dirname(packageJsonPath)));

      return [
        {
          name: packageJson.name,
          relativeDir,
          group: findPackageGroup(policy, packageJson.name, relativeDir),
          packageJsonPath,
          packageJson,
          exportSubpaths: readPackageExportSubpaths(packageJson),
        },
      ];
    })
    .sort((left, right) => left.relativeDir.localeCompare(right.relativeDir));
}

function findPackageJsonFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      findPackageJsonFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function readJsonFile(path: string): unknown {
  const content = readFileSync(path, "utf-8");

  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new ArchitecturePolicyPackageJsonParseProblem(
      path,
      error instanceof Error ? error : undefined,
    );
  }
}

function readPackageExportSubpaths(packageJson: Record<string, unknown>): readonly string[] {
  const publishConfig = isRecord(packageJson.publishConfig) ? packageJson.publishConfig : undefined;
  const exportsField = publishConfig?.exports ?? packageJson.exports;

  if (typeof exportsField === "string") {
    return ["."];
  }

  if (!isRecord(exportsField)) {
    return ["."];
  }

  return Object.keys(exportsField).sort();
}

function collectSourceImports(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
): readonly ImportRecord[] {
  const files = collectIncludedFiles(policy);

  return files.flatMap((filePath) => {
    const relativeFile = toPosixPath(relative(policy.rootDir, filePath));
    const sourcePackage = findSourcePackage(packages, relativeFile);
    const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
    let inBlockComment = false;

    return lines.flatMap((line, lineIndex) => {
      const stripped = stripCommentsFromLine(line, inBlockComment);
      inBlockComment = stripped.inBlockComment;
      const imports = extractImportSpecifiers(stripped.source);

      return imports.map((entry) => {
        const imported = splitPackageSpecifier(entry.specifier);

        return {
          sourceKind: "source",
          file: relativeFile,
          line: lineIndex + 1,
          column: entry.column,
          excerpt: line.trim(),
          specifier: entry.specifier,
          importedPackageName: imported.packageName,
          importedSubpath: imported.subpath,
          sourcePackage,
        } satisfies ImportRecord;
      });
    });
  });
}

function collectPackageManifestImports(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
): readonly ImportRecord[] {
  return packages.flatMap((pkg) => {
    const relativeFile = toPosixPath(relative(policy.rootDir, pkg.packageJsonPath));
    const source = readFileSync(pkg.packageJsonPath, "utf-8");
    const lines = source.split(/\r?\n/);

    return dependencySections.flatMap((section) => {
      const dependencies = pkg.packageJson[section];
      if (!isRecord(dependencies)) {
        return [];
      }

      return Object.keys(dependencies)
        .sort()
        .map((specifier) => {
          const location = findJsonPropertyLocation(lines, specifier);
          const imported = splitPackageSpecifier(specifier);

          return {
            sourceKind: "package-manifest",
            file: relativeFile,
            line: location.line,
            column: location.column,
            excerpt: lines[location.line - 1]?.trim() ?? `"${specifier}"`,
            specifier,
            importedPackageName: imported.packageName,
            importedSubpath: imported.subpath,
            sourcePackage: pkg,
          } satisfies ImportRecord;
        });
    });
  });
}

function collectIncludedFiles(policy: NormalizedPolicy): readonly string[] {
  const files = new Set<string>();

  for (const pattern of policy.includePatterns) {
    const absoluteRoot = join(policy.rootDir, getStaticPatternPrefix(pattern));
    for (const filePath of walkFiles(absoluteRoot)) {
      const relativeFile = toPosixPath(relative(policy.rootDir, filePath));
      if (
        sourceFilePattern.test(relativeFile) &&
        matchesPattern(relativeFile, pattern) &&
        !policy.ignorePatterns.some((ignorePattern) => matchesPattern(relativeFile, ignorePattern))
      ) {
        files.add(filePath);
      }
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

function walkFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  const stat = statSync(dir);
  if (stat.isFile()) {
    results.push(dir);
    return results;
  }

  if (!stat.isDirectory()) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      walkFiles(fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function shouldSkipDirectory(name: string): boolean {
  return (
    name === "node_modules" ||
    name === "dist" ||
    name === "coverage" ||
    name === ".turbo" ||
    name === ".git"
  );
}

function runPolicyRules(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
  imports: readonly ImportRecord[],
): readonly ArchitecturePolicyDiagnostic[] {
  return [
    ...runForbiddenImportRules(policy, packages, imports),
    ...runAllowedGroupImportRules(policy, packages, imports),
    ...runPublicEntrypointRule(policy, packages, imports),
  ];
}

function runForbiddenImportRules(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
  imports: readonly ImportRecord[],
): readonly ArchitecturePolicyDiagnostic[] {
  const rules = policy.manifest.rules?.forbiddenImports ?? [];

  return imports.flatMap((entry) =>
    rules.flatMap((rule) => {
      if (!ruleAppliesToSourceKind(rule.appliesTo, entry.sourceKind)) {
        return [];
      }

      const context = createImportContext(policy, packages, entry);
      if (!matchesSourceMatcher(rule.from, context) || !matchesTargetMatcher(rule.to, context)) {
        return [];
      }

      return [
        createDiagnostic(
          "architecture-policy/forbidden-import",
          rule.id,
          entry,
          context,
          rule.message ??
            `${context.sourcePackageName ?? "Unknown package"} cannot import ${entry.specifier}.`,
          rule.recovery,
        ),
      ];
    }),
  );
}

function runAllowedGroupImportRules(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
  imports: readonly ImportRecord[],
): readonly ArchitecturePolicyDiagnostic[] {
  const rules = policy.manifest.rules?.allowedGroupImports ?? [];

  return imports.flatMap((entry) =>
    rules.flatMap((rule) => {
      if (!ruleAppliesToSourceKind(rule.appliesTo, entry.sourceKind)) {
        return [];
      }

      const context = createImportContext(policy, packages, entry);
      if (!context.sourceGroup || !rule.fromGroups.includes(context.sourceGroup)) {
        return [];
      }

      if (!entry.importedPackageName) {
        return [];
      }

      if (matchesAnyPattern(entry.specifier, rule.allowSpecifiers ?? [])) {
        return [];
      }

      if (matchesAnyPattern(entry.importedPackageName, rule.allowPackages ?? [])) {
        return [];
      }

      if (
        rule.allowSameGroup !== false &&
        context.targetGroup !== null &&
        context.sourceGroup === context.targetGroup
      ) {
        return [];
      }

      if (context.targetGroup && rule.allowGroups.includes(context.targetGroup)) {
        return [];
      }

      if (
        !context.targetGroup &&
        !context.targetIsWorkspacePackage &&
        rule.allowExternal === true
      ) {
        return [];
      }

      return [
        createDiagnostic(
          "architecture-policy/disallowed-dependency-edge",
          rule.id,
          entry,
          context,
          rule.message ??
            `Group '${context.sourceGroup}' cannot import '${context.targetGroup ?? entry.importedPackageName}'.`,
          rule.recovery,
        ),
      ];
    }),
  );
}

function runPublicEntrypointRule(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
  imports: readonly ImportRecord[],
): readonly ArchitecturePolicyDiagnostic[] {
  const rule = policy.manifest.rules?.publicEntrypoints;
  if (!rule) {
    return [];
  }

  return imports.flatMap((entry) => {
    if (!entry.importedPackageName || !entry.importedSubpath) {
      return [];
    }

    if (!matchesAnyPattern(entry.importedPackageName, rule.includePackages ?? ["*"])) {
      return [];
    }

    const targetPackage = packages.find((pkg) => pkg.name === entry.importedPackageName);
    if (!targetPackage) {
      return [];
    }

    if (isEntrypointImportIgnored(rule, entry)) {
      return [];
    }

    if (isExportedSubpath(targetPackage, entry.importedSubpath)) {
      return [];
    }

    const context = createImportContext(policy, packages, entry);

    return [
      createDiagnostic(
        "architecture-policy/private-entrypoint-import",
        rule.id,
        entry,
        context,
        rule.message ??
          `${entry.importedPackageName}/${entry.importedSubpath} is not a declared public export.`,
        rule.recovery,
      ),
    ];
  });
}

function createDiagnostic(
  code: ArchitecturePolicyDiagnosticCode,
  ruleId: string,
  entry: ImportRecord,
  context: ImportContext,
  message: string,
  recovery: string | undefined,
): ArchitecturePolicyDiagnostic {
  return {
    code,
    ruleId,
    file: entry.file,
    line: entry.line,
    column: entry.column,
    message,
    excerpt: entry.excerpt,
    importSpecifier: entry.specifier,
    sourceKind: entry.sourceKind,
    sourcePackage: context.sourcePackageName,
    sourceGroup: context.sourceGroup,
    targetPackage: context.targetPackageName,
    targetGroup: context.targetGroup,
    recovery,
  };
}

type ImportContext = {
  readonly sourcePackageName: string | null;
  readonly sourceGroup: string | null;
  readonly sourcePath: string;
  readonly targetPackageName: string | null;
  readonly targetGroup: string | null;
  readonly targetPath: string | null;
  readonly targetIsWorkspacePackage: boolean;
  readonly specifier: string;
};

function createImportContext(
  policy: NormalizedPolicy,
  packages: readonly PackageInfo[],
  entry: ImportRecord,
): ImportContext {
  const targetPackage = packages.find((pkg) => pkg.name === entry.importedPackageName);
  const targetGroup = entry.importedPackageName
    ? (targetPackage?.group ?? findPackageGroup(policy, entry.importedPackageName, null))
    : null;

  return {
    sourcePackageName: entry.sourcePackage?.name ?? null,
    sourceGroup: entry.sourcePackage?.group ?? null,
    sourcePath: entry.file,
    targetPackageName: entry.importedPackageName,
    targetGroup,
    targetPath: targetPackage?.relativeDir ?? null,
    targetIsWorkspacePackage: targetPackage !== undefined,
    specifier: entry.specifier,
  };
}

function matchesSourceMatcher(matcher: ArchitecturePolicyMatcher, context: ImportContext): boolean {
  return (
    matchesOptionalPatterns(context.sourceGroup, matcher.groups) &&
    matchesOptionalPatterns(context.sourcePackageName, matcher.packages) &&
    matchesOptionalPatterns(context.sourcePath, matcher.paths)
  );
}

function matchesTargetMatcher(matcher: ArchitecturePolicyMatcher, context: ImportContext): boolean {
  const checks = [
    matcher.groups ? matchesOptionalPatterns(context.targetGroup, matcher.groups) : null,
    matcher.packages ? matchesOptionalPatterns(context.targetPackageName, matcher.packages) : null,
    matcher.paths ? matchesOptionalPatterns(context.targetPath, matcher.paths) : null,
    matcher.specifiers ? matchesOptionalPatterns(context.specifier, matcher.specifiers) : null,
  ].filter((value): value is boolean => value !== null);

  return checks.every(Boolean);
}

function matchesOptionalPatterns(
  value: string | null,
  patterns: readonly string[] | undefined,
): boolean {
  return (
    !patterns || patterns.length === 0 || (value !== null && matchesAnyPattern(value, patterns))
  );
}

function matchesAnyPattern(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(value, pattern));
}

function matchesPattern(value: string, pattern: string): boolean {
  return patternToRegExp(pattern).test(value);
}

function patternToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
        continue;
      }
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function findPackageGroup(
  policy: NormalizedPolicy,
  packageName: string,
  relativeDir: string | null,
): string | null {
  const groups = Object.entries(policy.packageGroups).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [groupName, group] of groups) {
    if (matchesAnyPattern(packageName, group.packages ?? [])) {
      return groupName;
    }
  }

  for (const [groupName, group] of groups) {
    if (relativeDir && matchesAnyPattern(relativeDir, group.paths ?? [])) {
      return groupName;
    }
  }

  return null;
}

function splitPackageSpecifier(specifier: string): {
  readonly packageName: string | null;
  readonly subpath: string | null;
} {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.length === 0) {
    return { packageName: null, subpath: null };
  }

  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    const packageName = parts.length >= 2 ? parts.slice(0, 2).join("/") : specifier;
    const subpath = parts.length > 2 ? parts.slice(2).join("/") : null;
    return { packageName, subpath };
  }

  const [packageName, ...subpathParts] = specifier.split("/");
  return {
    packageName: packageName ?? null,
    subpath: subpathParts.length > 0 ? subpathParts.join("/") : null,
  };
}

function extractImportSpecifiers(
  line: string,
): readonly { readonly specifier: string; readonly column: number }[] {
  const pattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s+)?['"`]([^'"`]+)['"`]|\bfrom\s+['"`]([^'"`]+)['"`]|\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const specifiers: { specifier: string; column: number }[] = [];

  for (const match of line.matchAll(pattern)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (!specifier) {
      continue;
    }
    const quoteIndex = line.indexOf(specifier, match.index ?? 0);
    specifiers.push({
      specifier,
      column: quoteIndex >= 0 ? quoteIndex + 1 : (match.index ?? 0) + 1,
    });
  }

  return specifiers;
}

function stripCommentsFromLine(
  line: string,
  startsInBlockComment: boolean,
): { readonly source: string; readonly inBlockComment: boolean } {
  let source = "";
  let index = 0;
  let inBlockComment = startsInBlockComment;

  while (index < line.length) {
    if (inBlockComment) {
      const endIndex = line.indexOf("*/", index);
      if (endIndex === -1) {
        return { source, inBlockComment: true };
      }
      index = endIndex + 2;
      inBlockComment = false;
      continue;
    }

    const lineCommentIndex = line.indexOf("//", index);
    const blockCommentIndex = line.indexOf("/*", index);

    if (
      lineCommentIndex !== -1 &&
      (blockCommentIndex === -1 || lineCommentIndex < blockCommentIndex)
    ) {
      source += line.slice(index, lineCommentIndex);
      return { source, inBlockComment: false };
    }

    if (blockCommentIndex === -1) {
      source += line.slice(index);
      return { source, inBlockComment: false };
    }

    source += line.slice(index, blockCommentIndex);
    index = blockCommentIndex + 2;
    inBlockComment = true;
  }

  return { source, inBlockComment };
}

function findSourcePackage(
  packages: readonly PackageInfo[],
  relativeFile: string,
): PackageInfo | null {
  return (
    [...packages]
      .sort((left, right) => right.relativeDir.length - left.relativeDir.length)
      .find(
        (pkg) => relativeFile === pkg.relativeDir || relativeFile.startsWith(`${pkg.relativeDir}/`),
      ) ?? null
  );
}

function getStaticPatternPrefix(pattern: string): string {
  const wildcardIndex = pattern.search(/[*]/);
  if (wildcardIndex === -1) {
    return pattern;
  }

  const slashIndex = pattern.slice(0, wildcardIndex).lastIndexOf("/");
  return slashIndex === -1 ? "." : pattern.slice(0, slashIndex);
}

function findJsonPropertyLocation(
  lines: readonly string[],
  propertyName: string,
): { readonly line: number; readonly column: number } {
  const quotedProperty = `"${propertyName}"`;

  for (const [index, line] of lines.entries()) {
    const column = line.indexOf(quotedProperty);
    if (column !== -1) {
      return { line: index + 1, column: column + 1 };
    }
  }

  return { line: 1, column: 1 };
}

function isExportedSubpath(pkg: PackageInfo, subpath: string): boolean {
  const exportKey = `./${subpath}`;

  return pkg.exportSubpaths.some((candidate) => {
    if (candidate === exportKey) {
      return true;
    }

    if (!candidate.includes("*")) {
      return false;
    }

    return matchesPattern(exportKey, candidate);
  });
}

function isEntrypointImportIgnored(
  rule: ArchitecturePublicEntrypointRule,
  entry: ImportRecord,
): boolean {
  return (rule.ignoreImports ?? []).some((ignore) => {
    const pathMatches = !ignore.paths || matchesAnyPattern(entry.file, ignore.paths);
    const packageMatches =
      !ignore.packages ||
      (entry.importedPackageName !== null &&
        matchesAnyPattern(entry.importedPackageName, ignore.packages));
    const specifierMatches =
      !ignore.specifiers || matchesAnyPattern(entry.specifier, ignore.specifiers);

    return pathMatches && packageMatches && specifierMatches;
  });
}

function ruleAppliesToSourceKind(
  appliesTo: readonly ArchitectureImportSourceKind[] | undefined,
  sourceKind: ArchitectureImportSourceKind,
): boolean {
  return !appliesTo || appliesTo.includes(sourceKind);
}

function compareImportRecords(left: ImportRecord, right: ImportRecord): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    left.specifier.localeCompare(right.specifier)
  );
}

function compareDiagnostics(
  left: ArchitecturePolicyDiagnostic,
  right: ArchitecturePolicyDiagnostic,
): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    left.code.localeCompare(right.code) ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.importSpecifier.localeCompare(right.importSpecifier)
  );
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}
