#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";

type ChangesetsConfig = {
  readonly fixed?: unknown;
  readonly linked?: unknown;
};

type PackageCatalog = {
  readonly spine?: {
    readonly packages?: unknown;
  };
};

type AuditSurfaceCategory = "configuration" | "decoder" | "lifecycle" | "fallback" | "verification";

type AuditDisposition =
  | "implemented-tested"
  | "unsupported-rejected"
  | "compatibility-fallback-tested"
  | "remove-deprecate";

type AuditEvidence = {
  readonly path?: unknown;
  readonly identifier?: unknown;
};

type AuditSurface = {
  readonly id?: unknown;
  readonly category?: unknown;
  readonly disposition?: unknown;
  readonly status?: unknown;
  readonly members?: unknown;
  readonly source?: AuditEvidence;
  readonly test?: AuditEvidence;
  readonly sources?: unknown;
  readonly tests?: unknown;
  readonly issue?: unknown;
  readonly regressionTest?: unknown;
};

type AuditCoverage = {
  readonly status?: unknown;
  readonly surfaceIds?: unknown;
  readonly reviewPaths?: unknown;
  readonly searchTerms?: unknown;
};

type AuditPackage = {
  readonly package?: unknown;
  readonly coverage?: unknown;
  readonly surfaces?: unknown;
};

type SilentSuccessAudit = {
  readonly schemaVersion?: unknown;
  readonly sourceIssue?: unknown;
  readonly packages?: unknown;
};

type VersioningMode = "independent" | "fixed" | "linked" | "fixed-and-linked";

const MIGRATION_MATRIX_HEADING = "## 0.x-to-1.0 Migration Matrix";
const MIGRATION_MATRIX_LINK = "docs/release/croco-1.0-spine.md#0x-to-10-migration-matrix";
const REQUIRED_MIGRATION_MATRIX_TERMS = [
  "package entrypoints",
  "generated app templates",
  "manifests",
  "ContractGraph",
  "Problem codes",
  "runtime capability",
  "croco doctor",
  "croco upgrade",
  "renamed",
  "deprecated",
  "removed",
] as const;
const AUDIT_CATEGORIES = [
  "configuration",
  "decoder",
  "lifecycle",
  "fallback",
  "verification",
] as const satisfies readonly AuditSurfaceCategory[];
const AUDIT_DISPOSITIONS = new Set<AuditDisposition>([
  "implemented-tested",
  "unsupported-rejected",
  "compatibility-fallback-tested",
  "remove-deprecate",
]);
const GITHUB_ISSUE_URL = /^https:\/\/github\.com\/croco-dev\/framework\/issues\/\d+$/;

function log(message: string): void {
  stdout.write(`${message}\n`);
}

function parseRoot(args: readonly string[]): string {
  let rootDir = process.cwd();

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return rootDir;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readSpinePackages(catalog: PackageCatalog): string[] {
  const packages = catalog.spine?.packages;
  if (!Array.isArray(packages)) {
    throw new Error("docs/package-catalog.json spine.packages must be an array");
  }

  return packages.map((packageName, packageIndex) => {
    if (typeof packageName !== "string" || packageName.length === 0) {
      throw new Error(
        `docs/package-catalog.json spine.packages[${packageIndex}] must be a package slug`,
      );
    }

    return packageName;
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readStringArray(value: unknown, allowEmpty = false): string[] | null {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(isNonEmptyString)
    ? value
    : null;
}

function validateRepositoryEvidence(
  rootDir: string,
  evidence: AuditEvidence | undefined,
  label: string,
): string[] {
  if (!evidence || !isNonEmptyString(evidence.path) || !isNonEmptyString(evidence.identifier)) {
    return [`${label} must include non-empty path and identifier fields.`];
  }

  if (isAbsolute(evidence.path)) {
    return [`${label}.path must be repository-relative.`];
  }

  const resolvedPath = resolve(rootDir, evidence.path);
  if (relative(rootDir, resolvedPath).startsWith("..")) {
    return [`${label}.path must stay inside the repository.`];
  }

  if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
    return [`${label}.path must reference an existing file: ${evidence.path}.`];
  }

  if (relative(realpathSync(rootDir), realpathSync(resolvedPath)).startsWith("..")) {
    return [`${label}.path must stay inside the repository.`];
  }

  if (!readFileSync(resolvedPath, "utf-8").includes(evidence.identifier)) {
    return [`${label}.identifier must occur in ${evidence.path}: ${evidence.identifier}.`];
  }

  return [];
}

function validateRepositoryEvidenceList(rootDir: string, value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length === 0) {
    return [`${label} must be a non-empty evidence array when provided.`];
  }

  return value.flatMap((entry, index) =>
    validateRepositoryEvidence(
      rootDir,
      entry && typeof entry === "object" ? (entry as AuditEvidence) : undefined,
      `${label}[${index}]`,
    ),
  );
}

function collectSilentSuccessAuditErrors(
  rootDir: string,
  audit: SilentSuccessAudit,
  spinePackageSlugs: readonly string[],
): string[] {
  const errors: string[] = [];
  if (audit.schemaVersion !== 1) {
    errors.push("docs/release/silent-success-audit.json schemaVersion must be 1.");
  }
  if (audit.sourceIssue !== "https://github.com/croco-dev/framework/issues/1332") {
    errors.push("docs/release/silent-success-audit.json sourceIssue must reference issue #1332.");
  }
  if (!Array.isArray(audit.packages)) {
    return [...errors, "docs/release/silent-success-audit.json packages must be an array."];
  }

  const expectedPackages = new Set(spinePackageSlugs);
  const packageCounts = new Map<string, number>();

  for (const [packageIndex, rawPackage] of audit.packages.entries()) {
    if (!rawPackage || typeof rawPackage !== "object") {
      errors.push(`audit packages[${packageIndex}] must be an object.`);
      continue;
    }
    const packageRecord = rawPackage as AuditPackage;
    if (!isNonEmptyString(packageRecord.package)) {
      errors.push(`audit packages[${packageIndex}].package must be a package slug.`);
      continue;
    }
    const packageName = packageRecord.package;
    packageCounts.set(packageName, (packageCounts.get(packageName) ?? 0) + 1);
    if (!expectedPackages.has(packageName)) {
      errors.push(
        `audit package ${packageName} is not in docs/package-catalog.json spine.packages.`,
      );
    }

    if (!Array.isArray(packageRecord.surfaces) || packageRecord.surfaces.length === 0) {
      errors.push(`audit package ${packageName} must include at least one surface record.`);
      continue;
    }
    const surfaceIds = new Set<string>();
    const surfacesById = new Map<string, AuditSurface>();
    for (const [surfaceIndex, rawSurface] of packageRecord.surfaces.entries()) {
      if (!rawSurface || typeof rawSurface !== "object") {
        errors.push(`audit package ${packageName} surfaces[${surfaceIndex}] must be an object.`);
        continue;
      }
      const surface = rawSurface as AuditSurface;
      const label = `audit package ${packageName} surfaces[${surfaceIndex}]`;
      if (!isNonEmptyString(surface.id)) {
        errors.push(`${label}.id must be non-empty.`);
        continue;
      }
      if (surfaceIds.has(surface.id)) {
        errors.push(`audit package ${packageName} must not repeat surface id ${surface.id}.`);
      }
      surfaceIds.add(surface.id);
      surfacesById.set(surface.id, surface);
      if (!AUDIT_CATEGORIES.includes(surface.category as AuditSurfaceCategory)) {
        errors.push(`${label}.category must be one of ${AUDIT_CATEGORIES.join(", ")}.`);
      }
      if (!AUDIT_DISPOSITIONS.has(surface.disposition as AuditDisposition)) {
        errors.push(`${label}.disposition is invalid.`);
      }
      if (surface.status !== "complete" && surface.status !== "unresolved") {
        errors.push(`${label}.status must be complete or unresolved.`);
      }
      if (!readStringArray(surface.members)) {
        errors.push(`${label}.members must be a non-empty string array.`);
      }
      errors.push(...validateRepositoryEvidence(rootDir, surface.source, `${label}.source`));
      errors.push(...validateRepositoryEvidence(rootDir, surface.test, `${label}.test`));
      errors.push(...validateRepositoryEvidenceList(rootDir, surface.sources, `${label}.sources`));
      errors.push(...validateRepositoryEvidenceList(rootDir, surface.tests, `${label}.tests`));
      if (surface.status === "unresolved") {
        if (!isNonEmptyString(surface.issue) || !GITHUB_ISSUE_URL.test(surface.issue)) {
          errors.push(`${label}.issue must link a focused croco-dev/framework issue.`);
        }
        if (!isNonEmptyString(surface.regressionTest)) {
          errors.push(`${label}.regressionTest must name the owning-package acceptance boundary.`);
        }
      }
    }

    if (!packageRecord.coverage || typeof packageRecord.coverage !== "object") {
      errors.push(`audit package ${packageName}.coverage must cover all required surface classes.`);
      continue;
    }
    const coverage = packageRecord.coverage as Record<string, AuditCoverage>;
    const coveredSurfaceIds = new Set<string>();
    for (const category of AUDIT_CATEGORIES) {
      const entry = coverage[category];
      const label = `audit package ${packageName}.coverage.${category}`;
      if (!entry || (entry.status !== "reviewed" && entry.status !== "none-found")) {
        errors.push(`${label}.status must be reviewed or none-found.`);
        continue;
      }
      const ids = readStringArray(entry.surfaceIds, entry.status === "none-found");
      const reviewPaths = readStringArray(entry.reviewPaths);
      const searchTerms = readStringArray(entry.searchTerms);
      if (!reviewPaths || !searchTerms) {
        errors.push(`${label} must include non-empty reviewPaths and searchTerms.`);
      } else {
        for (const reviewPath of reviewPaths) {
          const resolvedPath = resolve(rootDir, reviewPath);
          if (
            isAbsolute(reviewPath) ||
            relative(rootDir, resolvedPath).startsWith("..") ||
            !existsSync(resolvedPath) ||
            relative(realpathSync(rootDir), realpathSync(resolvedPath)).startsWith("..")
          ) {
            errors.push(
              `${label}.reviewPaths must stay in the repository and exist: ${reviewPath}.`,
            );
          }
        }
      }
      if (entry.status === "reviewed") {
        if (!ids) {
          errors.push(`${label}.surfaceIds must be non-empty when reviewed.`);
          continue;
        }
        for (const id of ids) {
          coveredSurfaceIds.add(id);
          if (!surfacesById.has(id)) {
            errors.push(`${label}.surfaceIds references unknown surface ${id}.`);
          } else if (surfacesById.get(id)?.category !== category) {
            errors.push(`${label}.surfaceIds references ${id} with a different category.`);
          }
        }
      } else if (Array.isArray(entry.surfaceIds) && entry.surfaceIds.length > 0) {
        errors.push(`${label}.surfaceIds must be empty when status is none-found.`);
      }
    }
    for (const surfaceId of surfaceIds) {
      if (!coveredSurfaceIds.has(surfaceId)) {
        errors.push(
          `audit package ${packageName} surface ${surfaceId} must be listed by its coverage class.`,
        );
      }
    }
  }

  for (const [packageName, count] of packageCounts) {
    if (count > 1) errors.push(`audit must not repeat package ${packageName}.`);
  }
  for (const packageName of spinePackageSlugs) {
    if (!packageCounts.has(packageName)) {
      errors.push(
        `audit must include ${packageName} from docs/package-catalog.json spine.packages.`,
      );
    }
  }
  return errors;
}

function readGroups(value: unknown, fieldName: "fixed" | "linked"): string[][] {
  if (!Array.isArray(value)) {
    throw new Error(`.changeset/config.json ${fieldName} must be an array`);
  }

  return value.map((group, groupIndex) => {
    if (!Array.isArray(group)) {
      throw new Error(`.changeset/config.json ${fieldName}[${groupIndex}] must be an array`);
    }

    return group.map((packageName, packageIndex) => {
      if (typeof packageName !== "string" || packageName.length === 0) {
        throw new Error(
          `.changeset/config.json ${fieldName}[${groupIndex}][${packageIndex}] must be a package name`,
        );
      }

      return packageName;
    });
  });
}

function getVersioningMode(
  fixedGroups: readonly string[][],
  linkedGroups: readonly string[][],
): VersioningMode {
  if (fixedGroups.length > 0 && linkedGroups.length > 0) {
    return "fixed-and-linked";
  }

  if (fixedGroups.length > 0) {
    return "fixed";
  }

  if (linkedGroups.length > 0) {
    return "linked";
  }

  return "independent";
}

function groupPackages(groups: readonly string[][]): string[] {
  return groups.flatMap((group) => group);
}

function toSpinePackageName(slug: string): string {
  return slug === "create-croco-app" ? slug : `@croco/${slug}`;
}

function splitMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizePackageTableCell(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function extractMarkdownSection(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join("\n");
}

function includesTerm(content: string, term: string): boolean {
  return content.toLowerCase().includes(term.toLowerCase());
}

function collectMigrationMatrixTableErrors(
  matrixSection: string,
  spinePackageSlugs: readonly string[],
): string[] {
  const errors: string[] = [];
  const lines = matrixSection.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => splitMarkdownTableRow(line)?.[0] === "Package");
  if (headerIndex === -1) {
    return ["docs/release/croco-1.0-spine.md migration matrix must include a Package table."];
  }

  const headerCells = splitMarkdownTableRow(lines[headerIndex]) ?? [];
  const separatorCells = splitMarkdownTableRow(lines[headerIndex + 1] ?? "");
  if (!separatorCells || !isMarkdownTableSeparator(separatorCells)) {
    errors.push(
      "docs/release/croco-1.0-spine.md migration matrix Package table must include a markdown separator row.",
    );
  }

  if (headerCells.length < 4) {
    errors.push(
      "docs/release/croco-1.0-spine.md migration matrix Package table must include package, surface, migration, and recovery columns.",
    );
  }

  const expectedPackageNames = new Set(spinePackageSlugs.map(toSpinePackageName));
  const tablePackageNames = new Map<string, number>();

  for (let index = headerIndex + 2; index < lines.length; index++) {
    const cells = splitMarkdownTableRow(lines[index]);
    if (!cells) {
      break;
    }

    if (isMarkdownTableSeparator(cells)) {
      continue;
    }

    if (cells.length !== headerCells.length) {
      errors.push(
        `docs/release/croco-1.0-spine.md migration matrix Package table row ${index + 1} must have ${headerCells.length} column(s).`,
      );
      continue;
    }

    const packageName = normalizePackageTableCell(cells[0]);
    if (!packageName) {
      errors.push(
        `docs/release/croco-1.0-spine.md migration matrix Package table row ${index + 1} must name a package.`,
      );
      continue;
    }

    if (cells.slice(1).some((cell) => cell.length === 0)) {
      errors.push(
        `docs/release/croco-1.0-spine.md migration matrix Package table row for ${packageName} must have non-empty surface, migration, and recovery cells.`,
      );
    }

    tablePackageNames.set(packageName, (tablePackageNames.get(packageName) ?? 0) + 1);
  }

  for (const [packageName, count] of tablePackageNames) {
    if (count > 1) {
      errors.push(
        `docs/release/croco-1.0-spine.md migration matrix Package table must not repeat ${packageName}.`,
      );
    }

    if (!expectedPackageNames.has(packageName)) {
      errors.push(
        `docs/release/croco-1.0-spine.md migration matrix Package table includes ${packageName}, which is not in docs/package-catalog.json spine.packages.`,
      );
    }
  }

  for (const packageSlug of spinePackageSlugs) {
    const packageName = toSpinePackageName(packageSlug);
    if (!tablePackageNames.has(packageName)) {
      errors.push(
        `docs/release/croco-1.0-spine.md migration matrix Package table must include ${packageName} from docs/package-catalog.json spine.packages.`,
      );
    }
  }

  return errors;
}

function collectMigrationMatrixErrors(
  releaseGuide: string,
  spineDocs: string,
  spinePackageSlugs: readonly string[],
): string[] {
  const errors: string[] = [];
  const hasReleaseGuideLink =
    releaseGuide.includes("RC release notes") &&
    releaseGuide.includes(MIGRATION_MATRIX_LINK) &&
    releaseGuide.includes("renamed/deprecated/removed") &&
    releaseGuide.includes("croco doctor") &&
    releaseGuide.includes("croco upgrade --dry-run");
  if (!hasReleaseGuideLink) {
    errors.push(
      "RELEASING.md must require RC release notes to link the 0.x-to-1.0 migration matrix and name doctor/upgrade recovery paths.",
    );
  }

  const matrixSection = extractMarkdownSection(spineDocs, MIGRATION_MATRIX_HEADING);
  if (!matrixSection) {
    errors.push("docs/release/croco-1.0-spine.md must include `## 0.x-to-1.0 Migration Matrix`.");
    return errors;
  }

  errors.push(...collectMigrationMatrixTableErrors(matrixSection, spinePackageSlugs));

  for (const term of REQUIRED_MIGRATION_MATRIX_TERMS) {
    if (!includesTerm(matrixSection, term)) {
      errors.push(`docs/release/croco-1.0-spine.md migration matrix must mention ${term}.`);
    }
  }

  return errors;
}

function collectErrors(
  rootDir: string,
  docs: string,
  spineDocs: string,
  audit: SilentSuccessAudit,
  spinePackageSlugs: readonly string[],
  mode: VersioningMode,
  fixedGroups: readonly string[][],
  linkedGroups: readonly string[][],
): string[] {
  const errors: string[] = [];

  if (!spineDocs.includes("silent-success-audit.json")) {
    errors.push("docs/release/croco-1.0-spine.md must link silent-success-audit.json.");
  }

  if (!docs.includes("`.changeset/config.json`")) {
    errors.push("RELEASING.md must identify .changeset/config.json as the source of truth.");
  }

  if (!docs.includes("NPM_CONFIG_PROVENANCE")) {
    errors.push("RELEASING.md must document the npm provenance publish configuration.");
  }

  if (!docs.includes("npm audit signatures")) {
    errors.push("RELEASING.md must document the npm provenance CLI verification command.");
  }

  if (!docs.includes("Version field")) {
    errors.push("RELEASING.md must document npmjs.com provenance UI verification.");
  }

  if (!docs.includes("pnpm alpha-release:smoke")) {
    errors.push("RELEASING.md must document the alpha release smoke command.");
  }

  if (!docs.includes("ci-reports/release/alpha-release-smoke.md")) {
    errors.push("RELEASING.md must document the alpha release smoke evidence artifact.");
  }

  if (!docs.includes("alpha stability and compatibility expectations")) {
    errors.push(
      "RELEASING.md must require alpha stability and compatibility expectations in release notes.",
    );
  }

  const hasDoctorJsonBreakingChangeRule =
    docs.includes("`croco.doctor.v1`") &&
    docs.includes("doctor JSON") &&
    docs.includes("Breaking changes") &&
    docs.includes("version the report schema") &&
    docs.includes("release notes") &&
    docs.includes("migration path");
  if (!hasDoctorJsonBreakingChangeRule) {
    errors.push(
      "RELEASING.md must require release notes or schema versioning for breaking doctor JSON changes.",
    );
  }

  if (!docs.includes("fixed") || !docs.includes("linked")) {
    errors.push("RELEASING.md must describe fixed/linked group behavior.");
  }

  errors.push(...collectMigrationMatrixErrors(docs, spineDocs, spinePackageSlugs));
  errors.push(...collectSilentSuccessAuditErrors(rootDir, audit, spinePackageSlugs));

  if (mode === "independent") {
    if (!docs.includes("**Mode**: Independent")) {
      errors.push(
        "RELEASING.md must state `**Mode**: Independent` when fixed and linked groups are empty.",
      );
    }

    if (/Fixed Mode|모든\s+`?@croco\/\*`?\s+패키지가\s+동일\s+버전/.test(docs)) {
      errors.push(
        "RELEASING.md still describes fixed-mode versioning, but config has no fixed groups.",
      );
    }

    if (!docs.includes("publishable package를 각각")) {
      errors.push(
        "RELEASING.md must tell contributors to select each changed publishable package.",
      );
    }

    return errors;
  }

  if (fixedGroups.length > 0 && !docs.includes("**Mode**: Fixed")) {
    errors.push("RELEASING.md must state `**Mode**: Fixed` when fixed groups are configured.");
  }

  if (linkedGroups.length > 0 && !docs.includes("linked group")) {
    errors.push(
      "RELEASING.md must describe linked group behavior when linked groups are configured.",
    );
  }

  for (const packageName of groupPackages(fixedGroups)) {
    if (!docs.includes(packageName)) {
      errors.push(`RELEASING.md must mention fixed-group package ${packageName}.`);
    }
  }

  for (const packageName of groupPackages(linkedGroups)) {
    if (!docs.includes(packageName)) {
      errors.push(`RELEASING.md must mention linked-group package ${packageName}.`);
    }
  }

  return errors;
}

function main(): void {
  try {
    const rootDir = parseRoot(argv.slice(2));
    const config = readJson<ChangesetsConfig>(join(rootDir, ".changeset/config.json"));
    const packageCatalog = readJson<PackageCatalog>(join(rootDir, "docs/package-catalog.json"));
    const docs = readFileSync(join(rootDir, "RELEASING.md"), "utf-8");
    const spineDocs = readFileSync(join(rootDir, "docs/release/croco-1.0-spine.md"), "utf-8");
    const audit = readJson<SilentSuccessAudit>(
      join(rootDir, "docs/release/silent-success-audit.json"),
    );
    const fixedGroups = readGroups(config.fixed ?? [], "fixed");
    const linkedGroups = readGroups(config.linked ?? [], "linked");
    const mode = getVersioningMode(fixedGroups, linkedGroups);
    const spinePackageSlugs = readSpinePackages(packageCatalog);
    const errors = collectErrors(
      rootDir,
      docs,
      spineDocs,
      audit,
      spinePackageSlugs,
      mode,
      fixedGroups,
      linkedGroups,
    );

    if (errors.length === 0) {
      log(`release-docs: Changesets config and release guide agree on ${mode} versioning.`);
      exit(0);
    }

    log("release-docs: Changesets config and release guide disagree.");
    for (const error of errors) {
      log(`- ${error}`);
    }
    exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`release-docs: failed: ${message}`);
    exit(1);
  }
}

main();
