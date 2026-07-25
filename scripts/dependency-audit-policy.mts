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
  | "unclassified"
  | "unknown";

type UnclassifiedEvidence =
  | "findings-empty"
  | "findings-missing"
  | "findings-non-array"
  | "paths-empty"
  | "paths-missing"
  | "paths-non-array"
  | "path-blank"
  | "path-non-string";

type AuditAdvisory = {
  readonly id?: number | string;
  readonly module_name?: string;
  readonly severity?: string;
  readonly title?: string;
  readonly url?: string;
  readonly cves?: readonly string[];
  readonly github_advisory_id?: string;
  readonly paths: readonly string[];
  readonly unclassifiedEvidence: readonly UnclassifiedEvidence[];
};

type AuditSeverity = "critical" | "high" | "low" | "moderate";

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
  readonly diagnostic: string;
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
  readonly code?: string;
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
const unclassifiedDiagnosticCode = "DEPENDENCY_AUDIT_EVIDENCE_UNCLASSIFIED";
const unclassifiedPath = "<unclassified>";
const blockingClasses = new Set<FindingClass>([
  "runtime",
  "runtime-peer",
  "generated-app",
  "release-evidence",
]);
const blockingSeverities = new Set(["high", "critical"]);
const severityRank: Readonly<Record<AuditSeverity, number>> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};
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
  public readonly code: string;
  public readonly detail: string;
  public readonly cause?: Error;

  public constructor(
    detail: string,
    category: DependencyAuditPolicyProblemCategory = "InternalServerError",
    options?: DependencyAuditPolicyProblemOptions,
  ) {
    super(detail);
    this.category = category;
    this.code = options?.code ?? "DEPENDENCY_AUDIT_POLICY_FAILED";
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
      Object.entries(parsed.advisories).map(([advisoryId, advisory]) => {
        if (!isRecord(advisory)) {
          const code = "DEPENDENCY_AUDIT_SCHEMA_UNSUPPORTED";
          throw new DependencyAuditPolicyProblem(
            `${code}: ${label} advisory ${advisoryId} is not a JSON object`,
            "InternalServerError",
            { code },
          );
        }
        return [advisoryId, normalizeAdvisory(advisory, advisoryId)];
      }),
    ),
  };
}

function emptyAuditJson(): AuditJson {
  return { advisories: {} };
}

function mergeAuditJsons(auditJsons: readonly AuditJson[]): AuditJson {
  const groups: { advisory: AuditAdvisory; aliases: Set<string> }[] = [];
  for (const auditJson of auditJsons) {
    for (const advisory of Object.values(auditJson.advisories)) {
      const aliases = new Set(advisoryKeys(advisory));
      let merged = advisory;

      for (let index = groups.length - 1; index >= 0; index -= 1) {
        const group = groups[index];
        if (group && [...aliases].some((alias) => group.aliases.has(alias))) {
          merged = mergeAdvisories(group.advisory, merged);
          for (const alias of group.aliases) {
            aliases.add(alias);
          }
          groups.splice(index, 1);
        }
      }

      groups.push({ advisory: merged, aliases });
    }
  }
  return {
    advisories: Object.fromEntries(
      groups
        .map(({ advisory, aliases }) => [minimumAdvisoryKey(aliases), advisory] as const)
        .sort(([leftKey], [rightKey]) => compareStrings(leftKey, rightKey)),
    ),
  };
}

function advisoryKeys(advisory: AuditAdvisory): readonly string[] {
  const keys: string[] = [];
  if (advisory.github_advisory_id) {
    keys.push(`ghsa:${advisory.github_advisory_id}`);
  }
  for (const cve of advisory.cves ?? []) {
    keys.push(`cve:${cve}`);
  }
  if (advisory.id !== undefined) {
    keys.push(`audit:${String(advisory.id)}`);
  }
  if (keys.length > 0) {
    return keys;
  }
  throw new DependencyAuditPolicyProblem(
    "Invalid audit advisory identity: expected GHSA, CVE, or audit id",
    "BadRequest",
  );
}

function minimumAdvisoryKey(aliases: ReadonlySet<string>): string {
  const [key] = [...aliases].sort(compareStrings);
  if (key) {
    return key;
  }
  throw new DependencyAuditPolicyProblem(
    "Invalid audit advisory identity: expected GHSA, CVE, or audit id",
    "BadRequest",
  );
}

function normalizeAdvisory(
  advisory: Readonly<Record<string, unknown>>,
  advisoryMapKey: string,
): AuditAdvisory {
  const severity = normalizeSeverity(advisory.severity);
  const githubAdvisoryId = normalizeGithubAdvisoryId(advisory.github_advisory_id);
  const cves = normalizeCves(advisory.cves);
  const id = normalizeAuditId(
    advisory.id === undefined ? numericAuditMapKey(advisoryMapKey) : advisory.id,
  );
  const moduleName = canonicalOptionalString(advisory.module_name);
  const title = canonicalOptionalString(advisory.title);
  const url = canonicalOptionalString(advisory.url);
  const evidence = normalizeAdvisoryEvidence(advisory);

  if (!githubAdvisoryId && cves.length === 0 && id === undefined) {
    throw new DependencyAuditPolicyProblem(
      "Invalid audit advisory identity: expected GHSA, CVE, or audit id",
      "BadRequest",
    );
  }

  return {
    cves,
    github_advisory_id: githubAdvisoryId,
    ...(id === undefined ? {} : { id }),
    ...(moduleName === undefined ? {} : { module_name: moduleName }),
    severity,
    ...(title === undefined ? {} : { title }),
    ...(url === undefined ? {} : { url }),
    paths: evidence.paths,
    unclassifiedEvidence: evidence.unclassifiedEvidence,
  };
}

function numericAuditMapKey(value: string): string | undefined {
  return /^[1-9][0-9]*$/.test(value) ? value : undefined;
}

function normalizeAdvisoryEvidence(advisory: Readonly<Record<string, unknown>>): {
  readonly paths: readonly string[];
  readonly unclassifiedEvidence: readonly UnclassifiedEvidence[];
} {
  const paths = new Set<string>();
  const unclassifiedEvidence = new Set<UnclassifiedEvidence>();
  if (!("findings" in advisory)) {
    unclassifiedEvidence.add("findings-missing");
  } else if (!Array.isArray(advisory.findings)) {
    unclassifiedEvidence.add("findings-non-array");
  } else if (advisory.findings.length === 0) {
    unclassifiedEvidence.add("findings-empty");
  } else {
    for (const finding of advisory.findings) {
      if (!isRecord(finding) || !("paths" in finding)) {
        unclassifiedEvidence.add("paths-missing");
      } else if (!Array.isArray(finding.paths)) {
        unclassifiedEvidence.add("paths-non-array");
      } else if (finding.paths.length === 0) {
        unclassifiedEvidence.add("paths-empty");
      } else {
        for (const path of finding.paths) {
          if (typeof path !== "string") {
            unclassifiedEvidence.add("path-non-string");
          } else if (path.trim().length === 0) {
            unclassifiedEvidence.add("path-blank");
          } else {
            paths.add(path);
          }
        }
      }
    }
  }
  return {
    paths: [...paths].sort(compareStrings),
    unclassifiedEvidence: [...unclassifiedEvidence].sort(compareStrings),
  };
}

function normalizeSeverity(severity: unknown): AuditSeverity {
  const normalized = typeof severity === "string" ? severity.trim().toLowerCase() : "";
  if (Object.hasOwn(severityRank, normalized)) {
    return normalized as AuditSeverity;
  }
  throw new DependencyAuditPolicyProblem(
    "Invalid audit advisory severity: expected one of low, moderate, high, critical",
    "BadRequest",
  );
}

function normalizeGithubAdvisoryId(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new DependencyAuditPolicyProblem(
      "Invalid audit advisory github_advisory_id: expected GHSA-xxxx-xxxx-xxxx",
      "BadRequest",
    );
  }
  const trimmed = value.trim();
  if (
    !/^GHSA-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}$/i.test(
      trimmed,
    )
  ) {
    throw new DependencyAuditPolicyProblem(
      "Invalid audit advisory github_advisory_id: expected GHSA-xxxx-xxxx-xxxx",
      "BadRequest",
    );
  }
  return `GHSA-${trimmed.slice(5).toLowerCase()}`;
}

function normalizeCves(value: unknown): readonly string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new DependencyAuditPolicyProblem(
      "Invalid audit advisory cves: expected non-empty CVE-YYYY-NNNN identifier strings",
      "BadRequest",
    );
  }
  const normalized = value.map((candidate) =>
    typeof candidate === "string" ? candidate.trim().toUpperCase() : "",
  );
  if (normalized.some((candidate) => !/^CVE-[0-9]{4}-[0-9]{4,}$/.test(candidate))) {
    throw new DependencyAuditPolicyProblem(
      "Invalid audit advisory cves: expected non-empty CVE-YYYY-NNNN identifier strings",
      "BadRequest",
    );
  }
  return [...new Set(normalized)].sort();
}

function normalizeAuditId(value: unknown): number | string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value > 0) {
      return value;
    }
  } else if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) {
    const numeric = BigInt(value);
    return numeric <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
  }
  throw new DependencyAuditPolicyProblem(
    "Invalid audit advisory id: expected a positive integer or canonical unsigned decimal string",
    "BadRequest",
  );
}

function canonicalOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function mergeAdvisories(left: AuditAdvisory, right: AuditAdvisory): AuditAdvisory {
  return {
    cves: [...new Set([...(left.cves ?? []), ...(right.cves ?? [])])].sort(),
    github_advisory_id: minimumString(left.github_advisory_id, right.github_advisory_id),
    id: minimumAuditId(left.id, right.id),
    module_name: minimumString(left.module_name, right.module_name),
    paths: [...new Set([...left.paths, ...right.paths])].sort(compareStrings),
    severity: maximumSeverity(left.severity, right.severity),
    title: minimumString(left.title, right.title),
    unclassifiedEvidence: [
      ...new Set([...left.unclassifiedEvidence, ...right.unclassifiedEvidence]),
    ].sort(compareStrings),
    url: minimumString(left.url, right.url),
  };
}

function maximumSeverity(left: string | undefined, right: string | undefined): AuditSeverity {
  const normalizedLeft = normalizeSeverity(left);
  const normalizedRight = normalizeSeverity(right);
  return severityRank[normalizedLeft] >= severityRank[normalizedRight]
    ? normalizedLeft
    : normalizedRight;
}

function minimumString(left: string | undefined, right: string | undefined): string | undefined {
  return [left, right]
    .filter((value): value is string => value !== undefined)
    .sort(compareStrings)[0];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function minimumAuditId(
  left: number | string | undefined,
  right: number | string | undefined,
): number | string | undefined {
  return [left, right]
    .filter((value): value is number | string => value !== undefined)
    .sort((first, second) => {
      const firstValue = BigInt(first);
      const secondValue = BigInt(second);
      return firstValue < secondValue ? -1 : firstValue > secondValue ? 1 : 0;
    })[0];
}

function classifyAuditJson(
  auditJson: AuditJson,
  manifests: ReadonlyMap<string, Manifest>,
  metadata: ReadonlyMap<string, MetadataEntry>,
): readonly ClassifiedFinding[] {
  const findings: ClassifiedFinding[] = [];

  for (const advisory of Object.values(auditJson.advisories)) {
    for (const path of advisory.paths) {
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
        diagnostic: "",
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
    for (const evidence of advisory.unclassifiedEvidence) {
      findings.push({
        advisory,
        classification: "unclassified",
        dependencyField: "unknown",
        diagnostic: unclassifiedDiagnostic(advisory, evidence),
        directDependency: "",
        importerPath: "",
        metadataStatus: "not-required",
        path: unclassifiedPath,
        reasons: [unclassifiedEvidenceMessage(evidence)],
      });
    }
  }

  return findings.sort(compareClassifiedFindings);
}

function unclassifiedDiagnostic(advisory: AuditAdvisory, evidence: UnclassifiedEvidence): string {
  return `${unclassifiedDiagnosticCode}: Advisory ${displayAdvisoryId(advisory)} has unusable audit evidence (${unclassifiedEvidenceMessage(evidence)}).`;
}

function unclassifiedEvidenceMessage(evidence: UnclassifiedEvidence): string {
  const messages: Record<UnclassifiedEvidence, string> = {
    "findings-empty": "findings array is empty",
    "findings-missing": "findings are missing",
    "findings-non-array": "findings are not an array",
    "paths-empty": "paths array is empty",
    "paths-missing": "paths are missing",
    "paths-non-array": "paths are not an array",
    "path-blank": "path value is blank",
    "path-non-string": "path value is not a string",
  };
  return messages[evidence];
}

function displayAdvisoryId(advisory: AuditAdvisory): string {
  return advisory.github_advisory_id ?? advisory.cves?.[0] ?? String(advisory.id);
}

function compareClassifiedFindings(left: ClassifiedFinding, right: ClassifiedFinding): number {
  return (
    compareStrings(displayAdvisoryId(left.advisory), displayAdvisoryId(right.advisory)) ||
    compareStrings(left.classification, right.classification) ||
    compareStrings(left.path, right.path) ||
    compareStrings(left.diagnostic, right.diagnostic)
  );
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
  if (finding.classification === "unclassified") {
    return isHighRisk(finding.advisory);
  }
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
      "packages:\n  - packages/create-croco-app/templates/**\noverrides:\n  postcss: 8.5.18\n",
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
    "| Severity | Advisory | Package | Class | Path | Metadata | Diagnostic |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const finding of [...blockingFindings, ...advisoryFindings]) {
    lines.push(
      [
        finding.advisory.severity ?? "unknown",
        finding.advisory.github_advisory_id ??
          finding.advisory.cves?.[0] ??
          String(finding.advisory.id),
        finding.advisory.module_name ?? "unknown",
        finding.classification,
        `\`${finding.path}\``,
        finding.metadataStatus,
        finding.diagnostic,
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
