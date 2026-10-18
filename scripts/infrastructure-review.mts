#!/usr/bin/env node

import ts from "typescript";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateCrocoSkill } from "./croco-skill.mts";
import { effectivePublishManifest } from "./package-manifest-contracts.mjs";
import { VerificationProblem, formatVerificationProblem } from "./verification-problem.mts";

export const REVIEW_DIRECTORY = "docs/infrastructure-reviews/";
const PROFILES = ["kubernetes", "aws-lambda", "cloudflare"] as const;
const RESULTS = ["supported", "conditional", "unsupported", "unverified", "not-applicable"];
const CLASSIFICATIONS = [
  "pure-contract",
  "protocol-render",
  "runtime-adapter",
  "durable-provider",
  "deployment-profile",
  "internal-pure-refactor",
];

type JsonObject = Record<string, unknown>;
export type InfrastructureReviewReport = {
  schemaVersion: 1;
  base: string;
  head: string;
  reviews: JsonObject[];
  diagnostics: { code: string; path: string; message: string }[];
};

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0)
    throw new VerificationProblem("INFRA_GIT_FAILED", "input", result.stderr);
  return result.stdout;
}
function at(root: string, ref: string, path: string): string | null {
  const result = spawnSync("git", ["show", `${ref}:${path}`], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
}
export function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function json(value: string | null): JsonObject {
  if (value === null) return {};
  const parsed: unknown = JSON.parse(value);
  if (!object(parsed))
    throw new VerificationProblem("INFRA_METADATA_INVALID", "contract", "Expected a JSON object");
  return parsed;
}
function safePath(path: unknown): path is string {
  return (
    text(path) &&
    !path.startsWith("/") &&
    !path.startsWith("-") &&
    ![...path].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    !path.includes("\\") &&
    !path.split("/").some((part) => part === ".." || part === "." || part === "")
  );
}
function onlyFormatting(path: string, before: string | null, after: string | null): boolean {
  if (before === null || after === null) return false;
  if (/\.[cm]?[jt]sx?$/.test(path)) {
    const kind = path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const printer = ts.createPrinter({ removeComments: true });
    const normalized = (content: string) =>
      printer.printFile(ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind));
    return normalized(before) === normalized(after);
  }
  if (path.endsWith(".json")) {
    try {
      return JSON.stringify(JSON.parse(before)) === JSON.stringify(JSON.parse(after));
    } catch {
      return false;
    }
  }
  return false;
}

function regularFile(root: string, ref: string, path: string): boolean {
  return /^100(?:644|755) blob /.test(git(root, ["ls-tree", ref, "--", path]));
}
function sourcePackage(path: string): string | null {
  const match =
    /^packages\/([^/]+)\/(?:src\/|package\.json$|runtime-profiles\.json$|.*(?:runtime|infrastructure|profile|capability).*manifest.*\.json$)/.exec(
      path,
    );
  if (
    !match ||
    /(?:^|\/)(?:tests?|__tests__|fixtures?)\/|\.(?:spec|test)\.|\.(?:md|mdx)$/.test(path)
  )
    return null;
  return match[1] ?? null;
}

// The runner checks the exact test title and refuses zero-test and skipped-only success.
// Evidence describes the host exercised; this receipt never grants provider certification.
export function executeEvidence(root: string, evidence: JsonObject): boolean {
  const directory = mkdtempSync(join(tmpdir(), "croco-infra-proof-"));
  try {
    const output = join(directory, "vitest.json");
    const pattern = String(evidence.testName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const testPath = String(evidence.path);
    const packageDirectory = /^(packages|examples)\/[^/]+\//.exec(testPath)?.[0];
    const cwd = packageDirectory ? join(root, packageDirectory) : root;
    const selectedPath = packageDirectory ? testPath.slice(packageDirectory.length) : testPath;
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        selectedPath,
        "-t",
        `^${pattern}$`,
        "--reporter=json",
        `--outputFile=${output}`,
      ],
      {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    if (result.status !== 0 || !existsSync(output)) return false;
    const receipt = json(readFileSync(output, "utf8"));
    if (!Array.isArray(receipt.testResults)) return false;
    return receipt.testResults.some(
      (file) =>
        object(file) &&
        text(file.name) &&
        existsSync(file.name) &&
        realpathSync(file.name) === realpathSync(join(root, testPath)) &&
        Array.isArray(file.assertionResults) &&
        file.assertionResults.some(
          (test) => object(test) && test.fullName === evidence.testName && test.status === "passed",
        ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function inspectInfrastructureReview(
  root: string,
  baseRef: string,
  headRef: string,
  runEvidence = executeEvidence,
): InfrastructureReviewReport {
  const requestedBase = git(root, ["rev-parse", "--verify", baseRef]).trim();
  const head = git(root, ["rev-parse", "--verify", headRef]).trim();
  const base = git(root, ["merge-base", requestedBase, head]).trim();
  const changed = git(root, ["diff", "--name-only", "-z", "--no-renames", base, head])
    .split("\0")
    .filter(Boolean);
  const report: InfrastructureReviewReport = {
    schemaVersion: 1,
    base,
    head,
    reviews: [],
    diagnostics: [],
  };
  const diagnostic = (code: string, path: string, message: string) =>
    report.diagnostics.push({ code, path, message });
  const catalog = json(at(root, head, "docs/package-catalog.json"));
  if (object(catalog.agentCapabilities)) {
    if (
      git(root, ["rev-parse", "--verify", "HEAD"]).trim() !== head ||
      git(root, ["status", "--porcelain=v1", "--untracked-files=all"]).trim()
    ) {
      diagnostic(
        "INFRA_SKILL_CHECKOUT_REQUIRED",
        ".agents/skills/croco/SKILL.md",
        "Use a clean checkout at the reviewed head before validating generated Skill consistency.",
      );
    } else {
      for (const error of validateCrocoSkill(root))
        diagnostic("INFRA_SKILL_DRIFT", ".agents/skills/croco/SKILL.md", error);
    }
  }
  const previousCatalog = json(at(root, base, "docs/package-catalog.json"));
  const roles = object(catalog.packageRoles) ? catalog.packageRoles : {};
  const previousRoles = object(previousCatalog.packageRoles) ? previousCatalog.packageRoles : {};
  const affected = new Map<string, Set<string>>();
  const add = (pkg: string, path: string) => {
    const manifest = json(
      at(root, head, `packages/${pkg}/package.json`) ??
        at(root, base, `packages/${pkg}/package.json`),
    );
    if (manifest.private === true) return;
    const files = affected.get(pkg) ?? new Set<string>();
    files.add(path);
    affected.set(pkg, files);
  };
  for (const path of changed) {
    const pkg = sourcePackage(path);
    if (pkg) {
      if (onlyFormatting(path, at(root, base, path), at(root, head, path))) continue;
      if (path.endsWith("/package.json")) {
        const before = json(at(root, base, path));
        const after = json(at(root, head, path));
        const keys = [
          "name",
          "private",
          "type",
          "browser",
          "os",
          "cpu",
          "libc",
          "exports",
          "imports",
          "bin",
          "main",
          "module",
          "types",
          "engines",
          "dependencies",
          "peerDependencies",
          "optionalDependencies",
          "bundledDependencies",
          "bundleDependencies",
          "croco",
        ];
        const beforePublished = effectivePublishManifest(before);
        const afterPublished = effectivePublishManifest(after);
        if (
          keys.every(
            (key) =>
              JSON.stringify(before[key]) === JSON.stringify(after[key]) &&
              JSON.stringify(beforePublished[key]) === JSON.stringify(afterPublished[key]),
          )
        )
          continue;
      }
      add(pkg, path);
    }
  }
  for (const pkg of new Set([...Object.keys(roles), ...Object.keys(previousRoles)])) {
    if (JSON.stringify(roles[pkg]) !== JSON.stringify(previousRoles[pkg]))
      add(pkg, "docs/package-catalog.json");
  }
  const records: { path: string; value: JsonObject }[] = [];
  for (const path of changed.filter(
    (path) => path.startsWith(REVIEW_DIRECTORY) && path.endsWith(".json"),
  )) {
    const value = at(root, head, path);
    if (value === null) {
      diagnostic(
        "INFRA_REVIEW_REMOVED",
        path,
        "Keep the review history; supersede a record with a new review.",
      );
      continue;
    }
    try {
      const parsed = json(value);
      const previous = json(at(root, base, path));
      if (Array.isArray(previous.changes) && Array.isArray(parsed.changes)) {
        for (const old of previous.changes) {
          if (
            object(old) &&
            text(old.package) &&
            !parsed.changes.some((next) => object(next) && next.package === old.package)
          ) {
            diagnostic(
              "INFRA_REVIEW_REMOVED",
              path,
              `Retain the review for ${old.package}; supersede it explicitly.`,
            );
          }
        }
      }
      if (
        parsed.schemaVersion !== 1 ||
        !Array.isArray(parsed.changes) ||
        parsed.changes.length === 0
      ) {
        diagnostic("INFRA_REVIEW_INVALID", path, "Expected schemaVersion 1 and non-empty changes.");
        continue;
      }
      for (const value of parsed.changes) {
        if (
          !object(value) ||
          !text(value.package) ||
          !CLASSIFICATIONS.includes(String(value.classification)) ||
          !text(value.reason) ||
          !object(value.files) ||
          !object(value.profiles) ||
          !Array.isArray(value.catalogRuntimes)
        ) {
          diagnostic(
            "INFRA_REVIEW_INVALID",
            path,
            "A review needs package, classification, reason, files, catalogRuntimes and profiles.",
          );
          continue;
        }
        records.push({ path, value });
      }
    } catch (error) {
      diagnostic("INFRA_REVIEW_INVALID", path, formatVerificationProblem(error));
    }
  }
  for (const record of records) {
    const pkg = String(record.value.package);
    if (
      !/^[a-z0-9][a-z0-9-]*$/.test(pkg) ||
      (at(root, head, `packages/${pkg}/package.json`) === null &&
        at(root, base, `packages/${pkg}/package.json`) === null)
    ) {
      diagnostic("INFRA_REVIEW_INVALID", record.path, "Review package must exist in packages/.");
      continue;
    }
    if (!affected.has(pkg)) affected.set(pkg, new Set());
  }
  const ran = new Map<string, boolean>();
  for (const [pkg, files] of affected) {
    const matches = records.filter((record) => record.value.package === pkg);
    if (matches.length !== 1) {
      diagnostic(
        "INFRA_REVIEW_MISSING",
        `packages/${pkg}`,
        `Expected exactly one changed review for ${pkg}; found ${matches.length}. Internal pure refactors may use reasoned not-applicable decisions.`,
      );
      continue;
    }
    const record = matches[0];
    if (!record) continue;
    const { value, path } = record;
    report.reviews.push(value);
    const role = object(roles[pkg]) ? roles[pkg] : {};
    const runtimes = Array.isArray(role.runtimes) ? role.runtimes : [];
    if (JSON.stringify(value.catalogRuntimes) !== JSON.stringify(runtimes))
      diagnostic(
        "INFRA_RUNTIME_DRIFT",
        path,
        `catalogRuntimes must match packageRoles.${pkg}.runtimes.`,
      );
    const bindings = object(value.files) ? value.files : {};
    for (const file of files) {
      if (!(file in bindings))
        diagnostic("INFRA_SCOPE_DRIFT", path, `Missing SHA-256 for ${file}.`);
    }
    for (const file of Object.keys(bindings)) {
      if (
        !safePath(file) ||
        (!file.startsWith(`packages/${pkg}/`) && file !== "docs/package-catalog.json")
      ) {
        diagnostic("INFRA_SCOPE_DRIFT", path, `Review file is outside the package scope: ${file}`);
        continue;
      }
      const content = at(root, head, file);
      const expected = content === null ? "deleted" : contentHash(content);
      if (bindings[file] !== expected)
        diagnostic(
          "INFRA_SCOPE_DRIFT",
          path,
          `Missing or stale SHA-256 for ${file}; deleted files use "deleted".`,
        );
    }
    const profiles = object(value.profiles) ? value.profiles : {};
    for (const profile of PROFILES) {
      const decision = profiles[profile];
      if (
        !object(decision) ||
        !RESULTS.includes(String(decision.result)) ||
        !text(decision.reason) ||
        !Array.isArray(decision.providers) ||
        !decision.providers.every(text) ||
        !Array.isArray(decision.constraints) ||
        !decision.constraints.every(text) ||
        !Array.isArray(decision.references) ||
        !decision.references.length ||
        !decision.references.every((ref) => safePath(ref) && at(root, head, ref) !== null)
      ) {
        diagnostic(
          "INFRA_DECISION_INVALID",
          path,
          `${profile} needs result, reason, providers, constraints and existing file references.`,
        );
        continue;
      }
      if (value.classification === "internal-pure-refactor" && decision.result !== "not-applicable")
        diagnostic(
          "INFRA_DECISION_INVALID",
          path,
          "Internal pure refactors must use reasoned not-applicable decisions.",
        );
      if (decision.result === "supported" || decision.result === "conditional") {
        const runtime =
          profile === "kubernetes"
            ? "node"
            : profile === "aws-lambda"
              ? "lambda"
              : decision.host === "node-container"
                ? "node"
                : "cloudflare-workers";
        if (!runtimes.includes(runtime))
          diagnostic(
            "INFRA_RUNTIME_DRIFT",
            path,
            `${profile}/${runtime} is absent from catalog runtime claims.`,
          );
        if (
          profile === "cloudflare" &&
          decision.host !== "workers" &&
          decision.host !== "node-container"
        )
          diagnostic(
            "INFRA_DECISION_INVALID",
            path,
            "Cloudflare must identify workers or node-container host.",
          );
        if (decision.result === "conditional" && decision.constraints.length === 0)
          diagnostic(
            "INFRA_DECISION_INVALID",
            path,
            "Conditional support requires explicit constraints.",
          );
        if (decision.result === "supported") {
          const evidence = decision.evidence;
          if (
            !object(evidence) ||
            !safePath(evidence.path) ||
            !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(evidence.path) ||
            !text(evidence.testName) ||
            !["host-runtime", "live-infrastructure"].includes(String(evidence.kind)) ||
            evidence.runtime !== runtime ||
            at(root, head, evidence.path) === null ||
            !regularFile(root, head, evidence.path) ||
            evidence.sha256 !== contentHash(at(root, head, evidence.path) ?? "")
          ) {
            diagnostic(
              "INFRA_EXECUTION_REQUIRED",
              path,
              `${profile}: supported needs a pinned named host-runtime or live-infrastructure test; mock evidence is insufficient.`,
            );
            continue;
          }
          // Executing a different checkout would manufacture evidence for the wrong revision.
          const current = git(root, ["rev-parse", "HEAD"]).trim();
          if (
            current !== head ||
            git(root, ["status", "--porcelain=v1", "--untracked-files=all"]).trim() !== ""
          ) {
            diagnostic(
              "INFRA_EVIDENCE_CHECKOUT",
              path,
              "Execution requires a clean checkout at the reviewed head.",
            );
            continue;
          }
          const key = JSON.stringify(evidence);
          if (!ran.has(key)) {
            ran.set(key, runEvidence(root, evidence));
            if (
              git(root, ["rev-parse", "HEAD"]).trim() !== head ||
              git(root, ["status", "--porcelain=v1", "--untracked-files=all"]).trim() !== ""
            ) {
              diagnostic(
                "INFRA_EVIDENCE_CHECKOUT",
                path,
                "Execution changed the reviewed head or worktree.",
              );
            }
          }
          if (!ran.get(key))
            diagnostic(
              "INFRA_EXECUTION_FAILED",
              path,
              `${profile}: exact named test did not pass: ${evidence.path} :: ${evidence.testName}`,
            );
        }
      }
    }
  }
  return report;
}

function main(): void {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  let base = process.env.VERIFICATION_BASE;
  let head = "HEAD";
  for (let index = 0; index < args.length; index += 2) {
    const value = args[index + 1];
    if (!value || !["--base", "--head"].includes(args[index] ?? ""))
      throw new VerificationProblem(
        "INFRA_ARGUMENT_INVALID",
        "input",
        "Usage: --base <revision> [--head <revision>]",
      );
    if (args[index] === "--base") base = value;
    else head = value;
  }
  if (!base) {
    // Local review is against the tracked default branch. CI always supplies the immutable base.
    base = "origin/trunk";
  }
  const report = inspectInfrastructureReview(process.cwd(), base, head);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.diagnostics.length ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(formatVerificationProblem(error));
    process.exitCode = 1;
  }
}
