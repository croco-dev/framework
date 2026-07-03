#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

type DependencyField =
  | "dependencies"
  | "optionalDependencies"
  | "peerDependencies"
  | "devDependencies";

type FindingClass =
  | "runtime"
  | "runtime-peer"
  | "peer-dev-test-install"
  | "dev-test"
  | "private-tooling"
  | "generated-app"
  | "release-evidence"
  | "unknown";

type AuditAdvisory = {
  readonly id: number | string;
  readonly module_name?: string;
  readonly severity?: string;
  readonly title?: string;
  readonly url?: string;
  readonly cves?: readonly string[];
  readonly github_advisory_id?: string;
  readonly findings?: readonly {
    readonly version?: string;
    readonly paths?: readonly string[];
  }[];
};

type AuditJson = {
  readonly advisories: Record<string, AuditAdvisory>;
};

type DependencySpecMap = ReadonlyMap<string, string>;

type Manifest = {
  readonly name: string;
  readonly path: string;
  readonly private: boolean;
  readonly fields: Record<DependencyField, DependencySpecMap>;
  readonly generatedTemplate: boolean;
};

type ClassifiedFinding = {
  readonly advisory: AuditAdvisory;
  readonly classification: FindingClass;
  readonly dependencyField: DependencyField | "unknown";
  readonly directDependency: string;
  readonly importerPath: string;
  readonly metadataStatus: "reviewed" | "missing" | "invalid" | "not-required";
  readonly path: string;
  readonly reasons: readonly string[];
};

type MetadataEntry = {
  readonly id: string;
  readonly owner: string;
  readonly reason: string;
  readonly reviewDate: string;
  readonly valid: boolean;
  readonly errors: readonly string[];
};

type ConfiguredSuppression = {
  readonly id: string;
  readonly key: SuppressionKey;
  readonly source: string;
};

type SuppressionKey = "ignoreGhsas" | "ignoreCves";

type DependencyAuditPolicyProblemCategory = "BadRequest" | "InternalServerError";

type DependencyAuditPolicyProblemOptions = {
  readonly cause?: Error;
};

type RunOptions = {
  readonly auditJsonPath?: string;
  readonly metadataPath?: string;
  readonly prodAuditJsonPath?: string;
  readonly reportPath?: string;
  readonly rootDir?: string;
  readonly templateAuditJsonPath?: string;
  readonly today?: string;
};

type PolicyResult = {
  readonly advisoryFindings: readonly ClassifiedFinding[];
  readonly blockingFindings: readonly ClassifiedFinding[];
  readonly configuredSuppressions: readonly ConfiguredSuppression[];
  readonly exitCode: number;
  readonly reportPath: string;
  readonly violations: readonly string[];
};

const defaultRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultMetadataPath = "scripts/security-allowlist-metadata.json";
const defaultReportPath = "ci-reports/security/dependency-audit-policy.md";
const pnpmAuditTimeoutMs = 120_000;
const blockingClasses = new Set<FindingClass>([
  "runtime",
  "runtime-peer",
  "generated-app",
  "release-evidence",
]);
const blockingSeverities = new Set(["high", "critical"]);
const releaseEvidenceDirectDependencyNames = new Set([
  "@changesets/cli",
  "oxfmt",
  "oxlint",
  "tsup",
  "turbo",
  "typescript",
]);

class DependencyAuditPolicyProblem extends Error {
  public readonly category: DependencyAuditPolicyProblemCategory;
  public readonly code = "DEPENDENCY_AUDIT_POLICY_FAILED";
  public readonly detail: string;
  public readonly cause?: Error;

  public constructor(
    detail: string,
    category: DependencyAuditPolicyProblemCategory = "InternalServerError",
    options?: DependencyAuditPolicyProblemOptions,
  ) {
    super(detail);
    this.category = category;
    this.detail = detail;
    this.name = new.target.name;

    if (options?.cause && this.cause === undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function runDependencyAuditPolicy(options: RunOptions = {}): PolicyResult {
  const rootDir = resolve(options.rootDir ?? defaultRootDir);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const reportPath = resolveFromRoot(rootDir, options.reportPath ?? defaultReportPath);
  const manifests = readWorkspaceManifests(rootDir);
  const metadata = readMetadata(rootDir, options.metadataPath ?? defaultMetadataPath, today);
  const configuredSuppressions = readConfiguredSuppressions(rootDir);
  const violations = configuredSuppressions.flatMap((suppression) => {
    const metadataEntry = metadata.get(suppression.id);
    if (isUnsupportedCveSuppression(suppression)) {
      return [
        `${suppression.source} configures ${suppression.id} via ${suppression.key}; pnpm 11 audit policy requires GHSA IDs under ignoreGhsas because ignoreCves/CVE suppressions are not recognized by pnpm audit.`,
      ];
    }
    if (suppression.source.endsWith("package.json#pnpm.auditConfig")) {
      return [
        `${suppression.source} configures ${suppression.id}; package.json pnpm auditConfig is ignored/dead policy state and must be removed.`,
      ];
    }
    if (!metadataEntry?.valid) {
      return [
        `${suppression.source} configures ${suppression.id} without reviewed #1144-compatible owner, reason, and review date metadata.`,
      ];
    }
    return [];
  });
  const auditJson = readAuditJson(rootDir, manifests, options);
  const findings = classifyAuditJson(auditJson, manifests, metadata);
  const blockingFindings = findings.filter(isBlockingFinding);

  writeReport(reportPath, findings, blockingFindings, configuredSuppressions, violations);

  return {
    advisoryFindings: findings,
    blockingFindings,
    configuredSuppressions,
    exitCode: blockingFindings.length > 0 || violations.length > 0 ? 1 : 0,
    reportPath,
    violations,
  };
}

function parseArgs(args: readonly string[]): RunOptions {
  const options: Record<string, string> = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (
      arg === "--audit-json" ||
      arg === "--metadata" ||
      arg === "--prod-audit-json" ||
      arg === "--report" ||
      arg === "--root" ||
      arg === "--template-audit-json" ||
      arg === "--today"
    ) {
      const value = args[index + 1];
      if (!value) {
        throw new DependencyAuditPolicyProblem(`${arg} requires a value`, "BadRequest");
      }
      options[arg.slice(2)] = value;
      index++;
      continue;
    }
    throw new DependencyAuditPolicyProblem(`Unknown option: ${arg}`, "BadRequest");
  }

  return {
    auditJsonPath: options["audit-json"],
    metadataPath: options.metadata,
    prodAuditJsonPath: options["prod-audit-json"],
    reportPath: options.report,
    rootDir: options.root,
    templateAuditJsonPath: options["template-audit-json"],
    today: options.today,
  };
}

function readAuditJson(
  rootDir: string,
  manifests: ReadonlyMap<string, Manifest>,
  options: RunOptions,
): AuditJson {
  if (options.auditJsonPath) {
    return mergeAuditJsons([
      readAuditJsonFile(rootDir, options.auditJsonPath, "--audit-json"),
      options.prodAuditJsonPath
        ? readAuditJsonFile(rootDir, options.prodAuditJsonPath, "--prod-audit-json")
        : emptyAuditJson(),
      options.templateAuditJsonPath
        ? readAuditJsonFile(rootDir, options.templateAuditJsonPath, "--template-audit-json")
        : emptyAuditJson(),
    ]);
  }

  return mergeAuditJsons([
    runPnpmAudit(rootDir, [], "pnpm audit --json"),
    runPnpmAudit(rootDir, ["--prod"], "pnpm audit --prod --json"),
    runGeneratedTemplateAudit(rootDir, manifests),
  ]);
}

function readAuditJsonFile(rootDir: string, auditJsonPath: string, label: string): AuditJson {
  return parseAuditJson(
    readFileSync(resolveFromRoot(rootDir, auditJsonPath), "utf-8"),
    `${label} ${auditJsonPath}`,
  );
}

function runPnpmAudit(rootDir: string, extraArgs: readonly string[], label: string): AuditJson {
  const result = spawnSync("pnpm", ["audit", "--audit-level", "high", ...extraArgs, "--json"], {
    cwd: rootDir,
    encoding: "utf-8",
    timeout: pnpmAuditTimeoutMs,
  });
  if (result.error) {
    throw new DependencyAuditPolicyProblem(
      processFailureMessage(label, result),
      "InternalServerError",
      { cause: result.error },
    );
  }
  const stdoutText = result.stdout.trim();
  if (!stdoutText) {
    throw new DependencyAuditPolicyProblem(
      `${label} produced no JSON output: ${result.stderr.trim()}`,
    );
  }
  return parseAuditJson(stdoutText, label);
}

function parseAuditJson(source: string, label: string): AuditJson {
  const parsed = JSON.parse(source) as unknown;
  if (!isRecord(parsed)) {
    throw new DependencyAuditPolicyProblem(`${label} did not return a JSON object`);
  }
  if (isRecord(parsed.error)) {
    const code = stringValue(parsed.error.code);
    const message = stringValue(parsed.error.message);
    throw new DependencyAuditPolicyProblem(
      `${label} returned ${code || "an audit error"}${message ? `: ${message}` : ""}`,
    );
  }
  if (!isRecord(parsed.advisories)) {
    throw new DependencyAuditPolicyProblem(`${label} JSON is missing the advisories object`);
  }
  return {
    advisories: Object.fromEntries(
      Object.entries(parsed.advisories).filter((entry): entry is [string, AuditAdvisory] =>
        isRecord(entry[1]),
      ),
    ),
  };
}

function emptyAuditJson(): AuditJson {
  return { advisories: {} };
}

function mergeAuditJsons(auditJsons: readonly AuditJson[]): AuditJson {
  const advisories = new Map<string, AuditAdvisory>();
  for (const auditJson of auditJsons) {
    for (const advisory of Object.values(auditJson.advisories)) {
      const key = advisoryKey(advisory);
      const existing = advisories.get(key);
      advisories.set(key, existing ? mergeAdvisories(existing, advisory) : advisory);
    }
  }
  return { advisories: Object.fromEntries(advisories) };
}

function advisoryKey(advisory: AuditAdvisory): string {
  return advisory.github_advisory_id || advisory.cves?.[0] || String(advisory.id);
}

function mergeAdvisories(left: AuditAdvisory, right: AuditAdvisory): AuditAdvisory {
  const paths = new Set<string>();
  for (const advisory of [left, right]) {
    for (const finding of advisory.findings ?? []) {
      for (const path of finding.paths ?? []) {
        paths.add(path);
      }
    }
  }
  return {
    ...left,
    ...right,
    cves: [...new Set([...(left.cves ?? []), ...(right.cves ?? [])])],
    findings: [
      {
        paths: [...paths].sort(),
      },
    ],
    github_advisory_id: left.github_advisory_id ?? right.github_advisory_id,
  };
}

function classifyAuditJson(
  auditJson: AuditJson,
  manifests: ReadonlyMap<string, Manifest>,
  metadata: ReadonlyMap<string, MetadataEntry>,
): readonly ClassifiedFinding[] {
  const findings: ClassifiedFinding[] = [];

  for (const advisory of Object.values(auditJson.advisories)) {
    for (const finding of advisory.findings ?? []) {
      for (const path of finding.paths ?? []) {
        const parsedPath = parseAuditPath(path);
        const manifest = manifests.get(parsedPath.importerPath);
        const field = manifest
          ? dependencyFieldFor(manifest, parsedPath.directDependency)
          : "unknown";
        const classification = classifyPath(manifest, parsedPath.directDependency, field);
        const metadataEntry = metadataEntryFor(advisory, metadata);
        const metadataRequired = blockingClasses.has(classification) && isHighRisk(advisory);
        const metadataStatus = metadataRequired
          ? metadataEntry?.valid
            ? "reviewed"
            : metadataEntry
              ? "invalid"
              : "missing"
          : "not-required";

        findings.push({
          advisory,
          classification,
          dependencyField: field,
          directDependency: parsedPath.directDependency,
          importerPath: parsedPath.importerPath,
          metadataStatus,
          path,
          reasons: classificationReasons(
            manifest,
            parsedPath.directDependency,
            field,
            classification,
          ),
        });
      }
    }
  }

  return findings;
}

function parseAuditPath(path: string): {
  readonly importerPath: string;
  readonly directDependency: string;
} {
  const [importerToken = ".", directDependency = ""] = path.split(">");
  if (importerToken === ".") {
    return { importerPath: ".", directDependency: stripPackageVersionSuffix(directDependency) };
  }
  return {
    directDependency: stripPackageVersionSuffix(directDependency),
    importerPath: importerToken.replaceAll("__", "/"),
  };
}

function stripPackageVersionSuffix(packageSegment: string): string {
  const versionSeparatorIndex = packageSegment.lastIndexOf("@");
  if (versionSeparatorIndex <= 0) {
    return packageSegment;
  }
  if (packageSegment.startsWith("@") && versionSeparatorIndex < packageSegment.indexOf("/")) {
    return packageSegment;
  }
  return packageSegment.slice(0, versionSeparatorIndex);
}

function classifyPath(
  manifest: Manifest | undefined,
  directDependency: string,
  field: DependencyField | "unknown",
): FindingClass {
  if (!manifest) {
    return "unknown";
  }

  if (
    manifest.generatedTemplate &&
    (field === "dependencies" || field === "optionalDependencies" || field === "peerDependencies")
  ) {
    return "generated-app";
  }

  if (isReleaseEvidenceEdge(manifest, directDependency, field)) {
    return "release-evidence";
  }

  if (isCreateCrocoAppRuntimeEdge(manifest, field)) {
    return "generated-app";
  }

  if (!manifest.private && (field === "dependencies" || field === "optionalDependencies")) {
    return "runtime";
  }

  if (!manifest.private && field === "peerDependencies") {
    if (manifest.fields.devDependencies.has(directDependency)) {
      return "peer-dev-test-install";
    }
    return "runtime-peer";
  }

  if (field === "devDependencies") {
    return "dev-test";
  }

  if (manifest.private || manifest.path === ".") {
    return "private-tooling";
  }

  return "unknown";
}

function isCreateCrocoAppRuntimeEdge(
  manifest: Manifest,
  field: DependencyField | "unknown",
): boolean {
  return (
    manifest.name === "create-croco-app" &&
    (field === "dependencies" || field === "optionalDependencies")
  );
}

function isReleaseEvidenceEdge(
  manifest: Manifest,
  directDependency: string,
  field: DependencyField | "unknown",
): boolean {
  return (
    (manifest.path === "." || manifest.name === "croco") &&
    field === "devDependencies" &&
    releaseEvidenceDirectDependencyNames.has(directDependency)
  );
}

function dependencyFieldFor(
  manifest: Manifest,
  dependencyName: string,
): DependencyField | "unknown" {
  if (manifest.fields.peerDependencies.has(dependencyName)) {
    return "peerDependencies";
  }
  for (const field of ["dependencies", "optionalDependencies", "devDependencies"] as const) {
    if (manifest.fields[field].has(dependencyName)) {
      return field;
    }
  }
  return "unknown";
}

function isBlockingFinding(finding: ClassifiedFinding): boolean {
  return (
    blockingClasses.has(finding.classification) &&
    isHighRisk(finding.advisory) &&
    finding.metadataStatus !== "reviewed"
  );
}

function isHighRisk(advisory: AuditAdvisory): boolean {
  return blockingSeverities.has((advisory.severity ?? "").toLowerCase());
}

function metadataEntryFor(
  advisory: AuditAdvisory,
  metadata: ReadonlyMap<string, MetadataEntry>,
): MetadataEntry | undefined {
  const candidateIds = [advisory.github_advisory_id].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  return candidateIds
    .map((id) => metadata.get(id))
    .find((entry): entry is MetadataEntry => !!entry);
}

function isUnsupportedCveSuppression(suppression: ConfiguredSuppression): boolean {
  return suppression.key === "ignoreCves" || /^CVE-/i.test(suppression.id);
}

function classificationReasons(
  manifest: Manifest | undefined,
  directDependency: string,
  field: DependencyField | "unknown",
  classification: FindingClass,
): readonly string[] {
  if (!manifest) {
    return ["Audit path importer does not map to a workspace manifest."];
  }
  if (classification === "generated-app" && manifest.generatedTemplate) {
    return [`${manifest.path}/package.json.hbs declares ${directDependency} in ${field}.`];
  }
  if (classification === "release-evidence") {
    return [`${directDependency} is an explicit release evidence direct dependency.`];
  }
  return [`${manifest.name} declares ${directDependency || "<missing>"} in ${field}.`];
}

function readWorkspaceManifests(rootDir: string): ReadonlyMap<string, Manifest> {
  const manifests = new Map<string, Manifest>();
  addManifest(manifests, ".", join(rootDir, "package.json"), false);
  for (const parent of ["packages", "examples"]) {
    const parentPath = join(rootDir, parent);
    if (!existsSync(parentPath)) {
      continue;
    }
    for (const child of readdirSync(parentPath)) {
      const childPath = join(parentPath, child);
      if (statSync(childPath).isDirectory()) {
        addManifest(manifests, `${parent}/${child}`, join(childPath, "package.json"), false);
      }
    }
  }
  for (const templatePath of findTemplatePackageManifests(
    join(rootDir, "packages", "create-croco-app", "templates"),
  )) {
    addManifest(manifests, relative(rootDir, dirname(templatePath)), templatePath, true);
  }
  return manifests;
}

function runGeneratedTemplateAudit(
  rootDir: string,
  manifests: ReadonlyMap<string, Manifest>,
): AuditJson {
  const templateManifests = [...manifests.values()].filter(
    (manifest) => manifest.generatedTemplate,
  );
  const tempRoot = mkdtempSync(join(tmpdir(), "croco-generated-template-audit-"));

  try {
    const packagePaths: string[] = [];
    for (const manifest of templateManifests) {
      const dependencies = generatedTemplateRuntimeDependencies(manifest);
      if (Object.keys(dependencies).length === 0) {
        continue;
      }
      packagePaths.push(manifest.path);
      writeFileSync(
        joinAndCreate(tempRoot, manifest.path, "package.json"),
        `${JSON.stringify(
          {
            dependencies,
            name: generatedTemplateAuditPackageName(manifest.path),
            private: true,
            version: "0.0.0",
          },
          null,
          2,
        )}\n`,
      );
    }

    if (packagePaths.length === 0) {
      return emptyAuditJson();
    }

    writeFileSync(
      join(tempRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/create-croco-app/templates/**\n",
    );
    const installResult = spawnSync("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], {
      cwd: tempRoot,
      encoding: "utf-8",
      timeout: pnpmAuditTimeoutMs,
    });
    if (installResult.error) {
      throw new DependencyAuditPolicyProblem(
        processFailureMessage("generated template pnpm install --lockfile-only", installResult),
        "InternalServerError",
        { cause: installResult.error },
      );
    }
    if (installResult.status !== 0) {
      throw new DependencyAuditPolicyProblem(
        `generated template pnpm install --lockfile-only failed: ${installResult.stderr.trim() || installResult.stdout.trim()}`,
      );
    }

    return runPnpmAudit(tempRoot, [], "generated template pnpm audit --json");
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

function generatedTemplateRuntimeDependencies(manifest: Manifest): Record<string, string> {
  const dependencies: Record<string, string> = {};
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
    for (const [name, spec] of manifest.fields[field]) {
      if (isRegistryAuditSpec(spec)) {
        dependencies[name] = spec;
      }
    }
  }
  return dependencies;
}

function isRegistryAuditSpec(spec: string): boolean {
  const normalized = spec.trim();
  return (
    normalized.length > 0 &&
    !normalized.includes("template-placeholder") &&
    !/^(catalog|file|git\+|github|http|https|link|patch|portal|workspace):/.test(normalized)
  );
}

function generatedTemplateAuditPackageName(path: string): string {
  const normalized = path
    .replace(/^packages\/create-croco-app\/templates\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `@croco-generated-template-audit/${normalized || "root"}`;
}

function joinAndCreate(root: string, ...parts: readonly string[]): string {
  const path = join(root, ...parts);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

function addManifest(
  manifests: Map<string, Manifest>,
  manifestPath: string,
  fullPath: string,
  generatedTemplate: boolean,
): void {
  if (!existsSync(fullPath)) {
    return;
  }
  const parsed = generatedTemplate
    ? parseTemplatePackageJson(readFileSync(fullPath, "utf-8"))
    : JSON.parse(readFileSync(fullPath, "utf-8"));
  const record = isRecord(parsed) ? parsed : {};
  const path = manifestPath === "." ? "." : manifestPath.replaceAll("\\", "/");
  manifests.set(path, {
    fields: {
      dependencies: dependencySpecs(record.dependencies),
      optionalDependencies: dependencySpecs(record.optionalDependencies),
      peerDependencies: dependencySpecs(record.peerDependencies),
      devDependencies: dependencySpecs(record.devDependencies),
    },
    generatedTemplate,
    name: typeof record.name === "string" ? record.name : path,
    path,
    private: record.private === true || path === ".",
  });
}

function findTemplatePackageManifests(root: string): readonly string[] {
  if (!existsSync(root)) {
    return [];
  }
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        visit(path);
      } else if (entry === "package.json.hbs") {
        found.push(path);
      }
    }
  };
  visit(root);
  return found;
}

function parseTemplatePackageJson(source: string): unknown {
  const normalized = source.replace(/{{[^}]+}}/g, "template-placeholder");
  return JSON.parse(normalized);
}

function dependencySpecs(value: unknown): DependencySpecMap {
  return new Map(
    isRecord(value)
      ? Object.entries(value).flatMap(([name, spec]) =>
          typeof spec === "string" ? [[name, spec] as const] : [],
        )
      : [],
  );
}

function readMetadata(
  rootDir: string,
  metadataPath: string,
  today: string,
): ReadonlyMap<string, MetadataEntry> {
  const fullPath = resolveFromRoot(rootDir, metadataPath);
  if (!existsSync(fullPath)) {
    return new Map();
  }
  const root = JSON.parse(readFileSync(fullPath, "utf-8")) as unknown;
  const metadata = new Map<string, MetadataEntry>();
  if (!isRecord(root) || root.schemaVersion !== 1 || !isRecord(root.audit)) {
    return metadata;
  }

  for (const key of ["ignoreGhsas", "ignoreCves"] as const) {
    const entries = Array.isArray(root.audit[key]) ? root.audit[key] : [];
    for (const rawEntry of entries) {
      const entry = readMetadataEntry(rawEntry, today);
      if (entry.id) {
        metadata.set(entry.id, entry);
      }
    }
  }
  return metadata;
}

function readMetadataEntry(rawEntry: unknown, today: string): MetadataEntry {
  const entry = isRecord(rawEntry) ? rawEntry : {};
  const id = stringValue(entry.id);
  const owner = stringValue(entry.owner);
  const reason = stringValue(entry.reason);
  const reviewDate =
    stringValue(entry.reviewDate) || stringValue(entry.reviewBy) || stringValue(entry.expiresOn);
  const errors = [
    id ? "" : "id is required",
    owner ? "" : "owner is required",
    reason ? "" : "reason is required",
    isValidDate(reviewDate) ? "" : "reviewDate/reviewBy/expiresOn must be YYYY-MM-DD",
    isValidDate(reviewDate) && reviewDate >= today ? "" : "reviewDate/reviewBy/expiresOn is stale",
  ].filter(Boolean);

  return {
    errors,
    id,
    owner,
    reason,
    reviewDate,
    valid: errors.length === 0,
  };
}

function readConfiguredSuppressions(rootDir: string): readonly ConfiguredSuppression[] {
  const suppressions: ConfiguredSuppression[] = [];
  for (const manifest of [
    join(rootDir, "package.json"),
    ...findPackageJsonFiles(join(rootDir, "packages")),
    ...findPackageJsonFiles(join(rootDir, "examples")),
  ]) {
    if (!existsSync(manifest)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(manifest, "utf-8")) as unknown;
    const auditConfig =
      isRecord(parsed) && isRecord(parsed.pnpm) ? parsed.pnpm.auditConfig : undefined;
    if (!isRecord(auditConfig)) {
      continue;
    }
    for (const suppression of readSuppressionIds(auditConfig)) {
      suppressions.push({
        ...suppression,
        source: `${relative(rootDir, manifest) || "package.json"}#pnpm.auditConfig`,
      });
    }
  }
  suppressions.push(...readWorkspaceSuppressions(rootDir));
  return suppressions;
}

function readWorkspaceSuppressions(rootDir: string): readonly ConfiguredSuppression[] {
  const workspacePath = join(rootDir, "pnpm-workspace.yaml");
  if (!existsSync(workspacePath)) {
    return [];
  }
  const text = readFileSync(workspacePath, "utf-8");
  const suppressions = readWorkspaceSuppressionIds(text);
  return suppressions.map((suppression) => ({
    ...suppression,
    source: "pnpm-workspace.yaml#auditConfig",
  }));
}

function readWorkspaceSuppressionIds(
  source: string,
): readonly Omit<ConfiguredSuppression, "source">[] {
  const suppressions: Omit<ConfiguredSuppression, "source">[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let auditConfigIndent: number | null = null;
  let listIndent: number | null = null;
  let activeListKey: SuppressionKey | null = null;

  for (const line of lines) {
    const trimmed = stripYamlComment(line).trim();
    if (!trimmed) {
      continue;
    }
    const indent = leadingSpaces(line);

    if (
      auditConfigIndent !== null &&
      indent <= auditConfigIndent &&
      !trimmed.startsWith("auditConfig:")
    ) {
      auditConfigIndent = null;
      listIndent = null;
      activeListKey = null;
    }

    if (trimmed.startsWith("auditConfig:")) {
      const inlineValue = trimmed.slice("auditConfig:".length).trim();
      if (inlineValue.startsWith("{")) {
        suppressions.push(...readFlowAuditSuppressions(inlineValue));
        auditConfigIndent = null;
        listIndent = null;
        activeListKey = null;
        continue;
      }
      if (!inlineValue) {
        auditConfigIndent = indent;
        listIndent = null;
        activeListKey = null;
      }
      continue;
    }

    if (auditConfigIndent === null || indent <= auditConfigIndent) {
      continue;
    }

    if (activeListKey && listIndent !== null && indent <= listIndent) {
      activeListKey = null;
      listIndent = null;
    }

    const key = suppressionKeyFromYamlLine(trimmed);
    if (key) {
      activeListKey = key;
      listIndent = indent;
      suppressions.push(
        ...readYamlInlineStringList(trimmed.slice(`${key}:`.length).trim()).map((id) => ({
          id,
          key,
        })),
      );
      continue;
    }

    if (activeListKey && trimmed.startsWith("- ")) {
      suppressions.push(
        ...readYamlInlineStringList(trimmed.slice(2).trim()).map((id) => ({
          id,
          key: activeListKey,
        })),
      );
    }
  }

  return uniqueSuppressions(suppressions);
}

function suppressionKeyFromYamlLine(line: string): SuppressionKey | null {
  if (line.startsWith("ignoreGhsas:")) {
    return "ignoreGhsas";
  }
  if (line.startsWith("ignoreCves:")) {
    return "ignoreCves";
  }
  return null;
}

function readFlowAuditSuppressions(
  value: string,
): readonly Omit<ConfiguredSuppression, "source">[] {
  return (["ignoreGhsas", "ignoreCves"] as const).flatMap((key) => {
    const match = value.match(new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`));
    return match
      ? readYamlInlineStringList(`[${match[1] ?? ""}]`).map((id) => ({
          id,
          key,
        }))
      : [];
  });
}

function readYamlInlineStringList(value: string): readonly string[] {
  const normalized = value.trim();
  if (!normalized || normalized === "[]") {
    return [];
  }
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1).split(",").map(normalizeYamlScalar).filter(Boolean);
  }
  return [normalizeYamlScalar(normalized)].filter(Boolean);
}

function normalizeYamlScalar(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function stripYamlComment(value: string): string {
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
    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, index);
    }
  }

  return value;
}

function leadingSpaces(value: string): number {
  return value.length - value.trimStart().length;
}

function isSuppressionId(value: string): boolean {
  return /^GHSA-[a-z0-9-]+$/i.test(value) || /^CVE-\d{4}-\d+$/i.test(value);
}

function readSuppressionIds(
  auditConfig: Record<string, unknown>,
): readonly Omit<ConfiguredSuppression, "source">[] {
  return (["ignoreGhsas", "ignoreCves"] as const).flatMap((key) =>
    Array.isArray(auditConfig[key])
      ? auditConfig[key]
          .filter((id): id is string => typeof id === "string")
          .filter(isSuppressionId)
          .map((id) => ({ id, key }))
      : [],
  );
}

function uniqueSuppressions(
  suppressions: readonly Omit<ConfiguredSuppression, "source">[],
): readonly Omit<ConfiguredSuppression, "source">[] {
  return [
    ...new Map(
      suppressions
        .filter((suppression) => isSuppressionId(suppression.id))
        .map((suppression) => [`${suppression.key}:${suppression.id}`, suppression]),
    ).values(),
  ].sort((left, right) => left.id.localeCompare(right.id) || left.key.localeCompare(right.key));
}

function findPackageJsonFiles(root: string): readonly string[] {
  if (!existsSync(root)) {
    return [];
  }
  const found: string[] = [];
  for (const child of readdirSync(root)) {
    const fullPath = join(root, child, "package.json");
    if (existsSync(fullPath)) {
      found.push(fullPath);
    }
  }
  return found;
}

function writeReport(
  reportPath: string,
  findings: readonly ClassifiedFinding[],
  blockingFindings: readonly ClassifiedFinding[],
  configuredSuppressions: readonly ConfiguredSuppression[],
  violations: readonly string[],
): void {
  mkdirSync(dirname(reportPath), { recursive: true });
  const advisoryFindings = findings.filter((finding) => !isBlockingFinding(finding));
  const lines = [
    "# Dependency Audit Policy",
    "",
    `- Blocking findings: ${blockingFindings.length}`,
    `- Advisory findings: ${advisoryFindings.length}`,
    `- Configured audit suppressions: ${configuredSuppressions.length}`,
    `- Policy violations: ${violations.length}`,
    "",
  ];

  if (violations.length > 0) {
    lines.push("## Policy Violations", "", ...violations.map((violation) => `- ${violation}`), "");
  }
  lines.push(
    "## Findings",
    "",
    "| Severity | Advisory | Package | Class | Path | Metadata |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const finding of [...blockingFindings, ...advisoryFindings]) {
    lines.push(
      [
        finding.advisory.severity ?? "unknown",
        finding.advisory.github_advisory_id ?? String(finding.advisory.id),
        finding.advisory.module_name ?? "unknown",
        finding.classification,
        `\`${finding.path}\``,
        finding.metadataStatus,
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");
  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

function resolveFromRoot(rootDir: string, path: string): string {
  return resolve(rootDir, path);
}

function processFailureMessage(
  label: string,
  result: {
    readonly error?: Error;
    readonly stderr: string;
    readonly stdout: string;
  },
): string {
  const output = result.stderr.trim() || result.stdout.trim();
  const errorMessage = result.error?.message;
  return `${label} failed${errorMessage ? `: ${errorMessage}` : ""}${output ? `: ${output}` : ""}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function main(): void {
  try {
    const result = runDependencyAuditPolicy(parseArgs(argv.slice(2)));
    stdout.write(`dependency-audit-policy: wrote ${relative(process.cwd(), result.reportPath)}\n`);
    if (result.exitCode === 0) {
      stdout.write("dependency-audit-policy: passed\n");
    } else {
      stdout.write(
        `dependency-audit-policy: failed blocking=${result.blockingFindings.length} violations=${result.violations.length}\n`,
      );
    }
    exit(result.exitCode);
  } catch (error) {
    stdout.write(
      `dependency-audit-policy: failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
