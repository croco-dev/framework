#!/usr/bin/env node

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import {
  createSplitValidationShadowEvidence,
  splitValidationShadowReportPath,
} from "./ci-lane-evidence.mts";
import {
  CACHEABLE_INJECTED_FAILURE_CODE,
  injectedFailureCommandId,
  parseCacheableFailureClass,
} from "./ci-cacheable-failure-injection.mts";
import {
  createPackageQualityReport,
  writePackageQualityReport,
} from "./package-quality-report.mts";
import {
  createProductionReadyReport,
  hasProductionReadyFailures,
  writeProductionReadyReport,
} from "./production-ready-check.mts";
import {
  createSpinePromotionReport,
  hasSpinePromotionFailures,
  writeSpinePromotionReport,
} from "./spine-promotion-check.mts";
import { parseSynthesisInput } from "./ci-synthesis-input.mts";
import { ADVISORY_CHECK_IDS, SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import { reconcileTestEvidence } from "./test-evidence-reconcile.mts";
import { VERIFICATION_LANE_OWNERSHIP } from "./verification-manifest.mts";
import type {
  SplitValidationShadowEvidence,
  SynthesisCheckResult,
  SynthesisSecurityResult,
} from "./ci-lane-evidence.mts";
import type { CacheableFailureClass } from "./ci-cacheable-failure-injection.mts";
import type { PromotionEvidenceContext } from "./spine-promotion-check.mts";
import type { SynthesisInput } from "./ci-synthesis-input.mts";
import { VerificationProblem } from "./verification-problem.mts";

const PACKAGE_QUALITY_OUTPUT = join("ci-reports", "package-quality");
const SECURITY_OUTPUT = join("ci-reports", "security");

export type SplitSynthesisRunResult = {
  readonly evidence: SplitValidationShadowEvidence;
  readonly failed: boolean;
};

type RunOptions = {
  readonly input: SynthesisInput;
  readonly rootDir: string;
  readonly reportPath?: string;
  readonly now?: () => string;
  readonly injectedFailure?: CacheableFailureClass;
};

function atomicWrite(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, contents);
  renameSync(temporaryPath, path);
}

function diagnostic(message: string): readonly string[] {
  return [message];
}

function outcome(
  id: string,
  selection: SynthesisCheckResult["selection"],
  result: SynthesisCheckResult["outcome"],
  diagnostics: readonly string[] = [],
  semantics: SynthesisCheckResult["semantics"] = ADVISORY_CHECK_IDS.includes(id as never)
    ? "advisory"
    : "blocking",
): SynthesisCheckResult {
  return {
    id,
    selection,
    semantics,
    outcome: result,
    diagnostics: [...new Set(diagnostics)].sort(),
  };
}

function producerChecks(input: SynthesisInput): readonly SynthesisCheckResult[] {
  return input.producerResults.map((result) =>
    outcome(result.id, result.selection, result.outcome, result.diagnostics, result.semantics),
  );
}

function resultMap(results: readonly SynthesisCheckResult[]): Map<string, SynthesisCheckResult> {
  return new Map(results.map((result) => [result.id, result]));
}

type ExecutionStatus = "passed" | "failed" | "not_applicable" | "skipped_prerequisite";

function executionStatus(result: SynthesisCheckResult): ExecutionStatus {
  if (result.outcome === "passed") return "passed";
  if (result.outcome === "not-applicable") return "not_applicable";
  return result.diagnostics.some((entry) =>
    entry.startsWith(`${result.id}:Skipped because prerequisite check(s) did not pass:`),
  )
    ? "skipped_prerequisite"
    : "failed";
}

function failedPrerequisites(
  dependencies: readonly string[],
  results: ReadonlyMap<string, SynthesisCheckResult>,
): readonly { readonly id: string; readonly status: ExecutionStatus }[] {
  return dependencies.flatMap((dependency) => {
    const result = results.get(dependency);
    if (!result || result.outcome !== "failed") return [];
    return [{ id: dependency, status: executionStatus(result) }];
  });
}

function testEvidenceDiagnostics(
  report: ReturnType<typeof reconcileTestEvidence>,
): readonly string[] {
  return report.diagnostics.map(({ code, message }) => `${code}: ${message}`).sort();
}

function productionReadyDiagnostics(
  report: ReturnType<typeof createProductionReadyReport>,
): readonly string[] {
  return [
    ...report.catalogErrors,
    ...report.productionRows.flatMap((row) =>
      row.checks.flatMap((check) =>
        check.status === "fail" ? [`${row.packageName}/${check.id}: ${check.detail}`] : [],
      ),
    ),
  ].sort();
}

function promotionDiagnostics(
  report: ReturnType<typeof createSpinePromotionReport>,
): readonly string[] {
  return [
    ...report.catalogErrors,
    ...report.betaSpineRows.flatMap((row) =>
      row.status === "blocked"
        ? row.evidenceFailures.map((failure) => `${row.packageName}: ${failure}`)
        : [],
    ),
  ].sort();
}

function packageQualityDiagnostics(
  report: ReturnType<typeof createPackageQualityReport>,
): readonly string[] {
  return [
    ...report.compatibilityTrain.rangeDrift.map(
      (entry) => `${entry.packageName}/${entry.section}/${entry.dependencyName}: ${entry.range}`,
    ),
    ...report.compatibilityTrain.generatedAppDependencies.flatMap((entry) =>
      entry.status === "fail" ? [entry.failureReason ?? `${entry.packageName}: failed`] : [],
    ),
    ...report.bundleSize.artifacts.flatMap((entry) =>
      entry.blocking && entry.blockingReason
        ? [`${entry.packageName}: ${entry.blockingReason}`]
        : [],
    ),
  ].sort();
}

function dashboardStatus(result: SynthesisCheckResult | undefined): string {
  if (!result || result.outcome === "not-applicable") return "skipped";
  return result.outcome === "passed" ? "success" : "failure";
}

function createPromotionContext(
  input: SynthesisInput,
  results: ReadonlyMap<string, SynthesisCheckResult>,
  startedAt: string,
  completedAt: string,
): PromotionEvidenceContext {
  const producerByLane = new Map(input.producers.map((producer) => [producer.lane, producer]));
  const fastCommands = input.facts.tests.fast?.commands ?? [];
  return {
    schemaVersion: 1,
    source: "release",
    commitSha: input.identity.commitSha,
    runId: input.identity.runId,
    runAttempt: String(input.identity.runAttempt),
    startedAt,
    completedAt,
    commands: input.producerResults.map((producerResult) => {
      const check = results.get(producerResult.id);
      const producer = producerByLane.get(producerResult.lane);
      const selected = check?.selection === "selected";
      return {
        artifacts: input.facts.promotionArtifacts
          .filter(({ commandId }) => commandId === producerResult.id)
          .map((artifact) => ({
            exists: true,
            fresh: true,
            path: artifact.path,
            semanticStatus: artifact.semanticStatus,
          })),
        blocking: producerResult.semantics === "blocking",
        commandId: producerResult.id,
        completedAt: selected && producer?.status === "success" ? completedAt : null,
        outcome:
          check?.outcome === "passed"
            ? "passed"
            : check?.outcome === "failed"
              ? "failed"
              : "skipped",
        runAttempt: String(input.identity.runAttempt),
        runId: input.identity.runId,
        startedAt: selected ? startedAt : null,
        testTasks:
          producerResult.id === "test"
            ? fastCommands.map(({ owner }) => ({
                packageName: owner,
                status: "passed" as const,
                taskId: `${owner}#test`,
              }))
            : [],
      };
    }),
  };
}

function securityResults(
  input: SynthesisInput,
  rootDir: string,
  generatedAt: string,
): readonly SynthesisSecurityResult[] {
  const physical = new Map(input.facts.securityPhysical.map((result) => [result.id, result]));
  const physicalResults = SECURITY_OWNERSHIP.filter(
    ({ owner }) => owner === "coverage-security",
  ).map((ownership) => {
    const observed = physical.get(ownership.id);
    if (!observed) {
      throw new VerificationProblem(
        "MISSING_SECURITY_PHYSICAL_RESULT",
        "contract",
        `Synthesis security result is missing ${ownership.id}`,
      );
    }
    return observed;
  });
  const summary = {
    schemaVersion: "croco.ci-split-security-policy-summary/v1",
    generatedAt,
    results: physicalResults,
  } as const;
  atomicWrite(
    join(rootDir, SECURITY_OUTPUT, "split-security-policy-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  return [
    ...physicalResults,
    {
      id: "security-policy-summary",
      owner: "validate-synthesis",
      semantics: "report-only",
      outcome: "passed",
      diagnostics: [],
    },
    {
      id: "security-upload",
      owner: "producing-job",
      semantics: "report-transport",
      outcome: "not-applicable",
      diagnostics: ["HOSTED_TRANSPORT_NOT_OBSERVED"],
    },
  ];
}

function orderedChecks(
  results: ReadonlyMap<string, SynthesisCheckResult>,
): readonly SynthesisCheckResult[] {
  return Object.keys(VERIFICATION_LANE_OWNERSHIP).map((id) => {
    const result = results.get(id);
    if (!result) {
      throw new VerificationProblem(
        "MISSING_SYNTHESIS_RESULT",
        "contract",
        `Synthesis result is missing ${id}`,
      );
    }
    return result;
  });
}

export function runSplitValidationSynthesis(options: RunOptions): SplitSynthesisRunResult {
  const input = parseSynthesisInput(options.input);
  const rootDir = resolve(options.rootDir);
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const results = resultMap(producerChecks(input));
  const packageQualityOutput = join(rootDir, PACKAGE_QUALITY_OUTPUT);
  const injectedCommandId = injectedFailureCommandId(options.injectedFailure ?? "none");
  if (
    injectedCommandId &&
    VERIFICATION_LANE_OWNERSHIP[injectedCommandId as keyof typeof VERIFICATION_LANE_OWNERSHIP] !==
      "split-validation-shadow"
  ) {
    throw new VerificationProblem(
      "CACHEABLE_FAILURE_LANE_MISMATCH",
      "input",
      `Synthesis cannot inject the ${options.injectedFailure} producer failure class.`,
    );
  }

  for (const plan of input.synthesisPlan) {
    if (plan.selection === "not-applicable") {
      results.set(plan.id, outcome(plan.id, "not-applicable", "not-applicable"));
      continue;
    }
    const failed = failedPrerequisites(plan.dependsOn, results);
    if (failed.length > 0) {
      const blockers = failed
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(({ id, status }) => `${id} (${status})`)
        .join(", ");
      results.set(
        plan.id,
        outcome(
          plan.id,
          "selected",
          "failed",
          diagnostic(`${plan.id}:Skipped because prerequisite check(s) did not pass: ${blockers}.`),
        ),
      );
      continue;
    }

    if (plan.id === injectedCommandId) {
      results.set(
        plan.id,
        outcome(
          plan.id,
          "selected",
          "failed",
          diagnostic(`${plan.id}:${CACHEABLE_INJECTED_FAILURE_CODE}`),
        ),
      );
      continue;
    }

    if (plan.id === "test-evidence-reconcile") {
      const report = reconcileTestEvidence({
        inventory: input.facts.tests.inventory,
        profile: input.facts.tests.profile,
        reports: [
          input.facts.tests.fast,
          input.facts.tests.integration,
          input.facts.tests.published,
        ].filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        affectedOwners: input.facts.tests.affectedOwners,
        packagingOwners: input.facts.tests.packagingOwners,
        requiredGeneratedPaths: input.facts.tests.generated.requiredSourcePaths,
        generatedExecutedPaths: input.facts.tests.generated.executedSourcePaths,
      });
      atomicWrite(
        join(packageQualityOutput, "test-evidence.json"),
        `${JSON.stringify(report, null, 2)}\n`,
      );
      const diagnostics = testEvidenceDiagnostics(report);
      results.set(
        plan.id,
        outcome(plan.id, "selected", diagnostics.length === 0 ? "passed" : "failed", diagnostics),
      );
      continue;
    }

    if (plan.id === "production-ready") {
      const report = createProductionReadyReport({
        rootDir,
        summaryDir: "normalized-synthesis-input",
        requireTaskSummaries: input.facts.productionReadyRequireTaskSummaries,
        generatedAt: now(),
        fastTestLaneReport: input.facts.tests.fast,
        inventory: input.facts.tests.inventory,
        qualityRows: input.facts.packageTasks,
      });
      writeProductionReadyReport(report, packageQualityOutput);
      const diagnostics = productionReadyDiagnostics(report);
      results.set(
        plan.id,
        outcome(
          plan.id,
          "selected",
          hasProductionReadyFailures(report) ? "failed" : "passed",
          diagnostics,
        ),
      );
      continue;
    }

    if (plan.id === "spine-promotion") {
      const promotionStartedAt = startedAt;
      const promotionCompletedAt = now();
      const report = createSpinePromotionReport({
        currentCommit: input.identity.commitSha,
        evidenceContext: createPromotionContext(
          input,
          results,
          promotionStartedAt,
          promotionCompletedAt,
        ),
        generatedAt: promotionCompletedAt,
        packageNames: input.facts.spinePromotionPackages,
        rootDir,
        testInventory: (pkg) => {
          const prefix = `${pkg.relativeDir}/`;
          return input.facts.tests.inventory.tests.flatMap(({ path }) =>
            path.startsWith(prefix) ? [path.slice(prefix.length)] : [],
          );
        },
      });
      writeSpinePromotionReport(report, packageQualityOutput);
      const diagnostics = promotionDiagnostics(report);
      results.set(
        plan.id,
        outcome(
          plan.id,
          "selected",
          hasSpinePromotionFailures(report) ? "failed" : "passed",
          diagnostics,
        ),
      );
      continue;
    }

    if (plan.id !== "spine-bundle-size") {
      throw new VerificationProblem(
        "UNSUPPORTED_SYNTHESIS_CHECK",
        "contract",
        `Unsupported synthesis check ${String(plan.id)}`,
      );
    }
    const quality = createPackageQualityReport({
      rootDir,
      summaryDir: "normalized-synthesis-input",
      packageRows: input.facts.packageTasks,
      bundleSize: input.facts.bundleSize,
      publicApi: input.facts.publicApi,
      gateOutcomes: {
        "changeset-required:check": dashboardStatus(results.get("changeset-required")),
        "pnpm check":
          dashboardStatus(results.get("lint")) === "success" &&
          dashboardStatus(results.get("format")) === "success"
            ? "success"
            : "failure",
        build: dashboardStatus(results.get("build")),
        typecheck: dashboardStatus(results.get("typecheck")),
        test: dashboardStatus(results.get("test")),
        "provider-certification:check": dashboardStatus(results.get("provider-certification")),
        "production-ready:check": dashboardStatus(results.get("production-ready")),
        "spine-promotion:check": dashboardStatus(results.get("spine-promotion")),
      },
    });
    writePackageQualityReport(quality, packageQualityOutput);
    const diagnostics = packageQualityDiagnostics(quality);
    const failedQuality =
      quality.compatibilityTrain.status === "fail" ||
      quality.bundleSize.spineBlockingIssueCount > 0;
    results.set(
      plan.id,
      outcome(plan.id, "selected", failedQuality ? "failed" : "passed", diagnostics),
    );
  }

  const completedAt = now();
  const checks = orderedChecks(results);
  const security = securityResults(input, rootDir, completedAt);
  const producerBundles = input.producers.map(({ lane, bundleDigest }) => ({
    lane,
    bundleDigest,
  }));
  const hasBlockingFailure =
    checks.some(({ semantics, outcome }) => semantics === "blocking" && outcome === "failed") ||
    security.some(({ semantics, outcome }) => semantics === "blocking" && outcome === "failed");
  const evidence = createSplitValidationShadowEvidence({
    ...input.identity,
    producerBundles,
    checks,
    security,
    conclusion: hasBlockingFailure ? "failure" : "success",
    operationalFailure: null,
    startedAt,
    completedAt,
    issuedAt: completedAt,
  });
  const reportPath = resolve(rootDir, options.reportPath ?? splitValidationShadowReportPath());
  atomicWrite(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { evidence, failed: hasBlockingFailure };
}

function value(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function main(args: readonly string[]): void {
  const inputPath = value(args, "--input");
  if (!inputPath) {
    throw new VerificationProblem("INVALID_SYNTHESIS_ARGUMENTS", "input", "--input is required");
  }
  const rootDir = resolve(value(args, "--root") ?? process.cwd());
  const reportPath = value(args, "--output");
  const injectedFailure = parseCacheableFailureClass(value(args, "--inject-failure") ?? "none");
  let inputValue: unknown;
  try {
    inputValue = JSON.parse(readFileSync(resolve(rootDir, inputPath), "utf8")) as unknown;
  } catch {
    throw new VerificationProblem(
      "UNREADABLE_SYNTHESIS_INPUT",
      "input",
      "Synthesis input is missing, unreadable, or malformed JSON.",
    );
  }
  const result = runSplitValidationSynthesis({
    input: parseSynthesisInput(inputValue),
    rootDir,
    reportPath,
    injectedFailure,
  });
  if (result.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    main(argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `[ci-split-validation-synthesis] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exit(1);
  }
}
