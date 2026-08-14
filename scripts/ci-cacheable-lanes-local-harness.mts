#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import {
  parseExperimentIdentity,
  parseProducerBundle,
  parseSplitValidationShadowEvidence,
  PRODUCER_LANES,
  validateProducerFanIn,
} from "./ci-lane-evidence.mts";
import { SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import { VERIFICATION_LANE_OWNERSHIP } from "./verification-manifest.mts";
import type {
  ExperimentIdentity,
  ProducerBundle,
  ProducerLane,
  SplitValidationShadowEvidence,
  SynthesisSecurityResult,
} from "./ci-lane-evidence.mts";
import type {
  EvidenceCheckResult,
  EvidenceStatus,
  ReleaseSpineEvidenceReport,
} from "./release-spine-evidence.mts";

export const LOCAL_EQUIVALENCE_REPORT_SCHEMA =
  "croco.ci-cacheable-lanes-local-equivalence/v1" as const;

type LocalExperimentIdentity = ExperimentIdentity;
type NormalizedOutcome = "passed" | "failed" | "not-applicable";

type NormalizedCheck = {
  readonly id: string;
  readonly selection: "selected" | "not-applicable";
  readonly semantics: "blocking" | "advisory";
  readonly outcome: NormalizedOutcome;
  readonly diagnostics: readonly string[];
};

export type LocalEquivalenceMismatch = {
  readonly code: string;
  readonly key: string;
  readonly monolithic: unknown;
  readonly split: unknown;
};

export type LocalEquivalenceReport = {
  readonly schemaVersion: typeof LOCAL_EQUIVALENCE_REPORT_SCHEMA;
  readonly status: "passed" | "failed";
  readonly identity: LocalExperimentIdentity;
  readonly comparedCheckCount: number;
  readonly comparedSecurityCount: number;
  readonly monolithicBlockingOutcome: "passed" | "failed";
  readonly splitBlockingOutcome: "passed" | "failed";
  readonly mismatches: readonly LocalEquivalenceMismatch[];
  readonly hostedOnlyMetrics: {
    readonly queueInclusiveP95: "not-measured";
    readonly runnerScheduling: "not-measured";
    readonly artifactService: "not-measured";
  };
};

export class LocalEquivalenceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LocalEquivalenceError";
    this.code = code;
  }
}

const EXPECTED_CHECK_IDS = Object.keys(VERIFICATION_LANE_OWNERSHIP);
const LOCALLY_COMPARABLE_SECURITY_IDS = new Set(
  SECURITY_OWNERSHIP.filter(({ id }) => id !== "security-upload").map(({ id }) => id),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value))
    throw new LocalEquivalenceError("INVALID_INPUT", `${path} must be an object`);
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LocalEquivalenceError("INVALID_INPUT", `${path} must be a non-empty string`);
  }
  return value;
}

export function parseLocalExperimentIdentity(value: unknown): LocalExperimentIdentity {
  const identity = parseExperimentIdentity(value);
  if (identity.architectureVersion !== "shadow-split") {
    throw new LocalEquivalenceError(
      "INVALID_IDENTITY",
      "identity.architectureVersion must be shadow-split",
    );
  }
  return identity;
}

function parseMonolithicReport(value: unknown): ReleaseSpineEvidenceReport {
  const report = requiredRecord(value, "monolithic");
  const provenance = requiredRecord(report.provenance, "monolithic.provenance");
  if (!Array.isArray(report.checks)) {
    throw new LocalEquivalenceError(
      "INVALID_MONOLITHIC_REPORT",
      "monolithic.checks must be an array",
    );
  }
  if (report.completedAt === null || typeof report.completedAt !== "string") {
    throw new LocalEquivalenceError(
      "INCOMPLETE_MONOLITHIC_REPORT",
      "monolithic report must be completed",
    );
  }
  requiredString(provenance.commitSha, "monolithic.provenance.commitSha");
  requiredString(provenance.runId, "monolithic.provenance.runId");
  requiredString(provenance.runAttempt, "monolithic.provenance.runAttempt");
  requiredString(report.profile, "monolithic.profile");
  return value as ReleaseSpineEvidenceReport;
}

function assertMonolithicIdentity(
  report: ReleaseSpineEvidenceReport,
  identity: LocalExperimentIdentity,
): void {
  const comparisons = [
    ["commitSha", report.provenance.commitSha, identity.commitSha],
    ["runId", report.provenance.runId, identity.runId],
    ["runAttempt", report.provenance.runAttempt, String(identity.runAttempt)],
    ["profile", report.profile, identity.profile],
  ] as const;
  for (const [field, actual, expected] of comparisons) {
    if (actual !== expected) {
      throw new LocalEquivalenceError(
        "MONOLITHIC_IDENTITY_MISMATCH",
        `monolithic ${field} does not match the experiment identity`,
      );
    }
  }
}

function assertExactCheckSet(report: ReleaseSpineEvidenceReport): void {
  const ids = report.checks.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new LocalEquivalenceError(
      "DUPLICATE_MONOLITHIC_CHECK",
      "monolithic report contains duplicate check IDs",
    );
  }
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...EXPECTED_CHECK_IDS].sort())) {
    throw new LocalEquivalenceError(
      "MONOLITHIC_CHECK_SET_MISMATCH",
      "monolithic report must contain exactly all 53 verification check IDs",
    );
  }
}

function parseMonolithicSecurity(value: unknown): readonly SynthesisSecurityResult[] {
  if (!Array.isArray(value)) {
    throw new LocalEquivalenceError(
      "INVALID_MONOLITHIC_SECURITY",
      "monolithic security evidence must be an array",
    );
  }
  const expectedById = new Map(SECURITY_OWNERSHIP.map((entry) => [entry.id, entry]));
  const parsed = value.map((entry, index): SynthesisSecurityResult => {
    const record = requiredRecord(entry, `monolithicSecurity[${index}]`);
    const actualKeys = Object.keys(record).sort();
    const expectedKeys = ["diagnostics", "id", "outcome", "owner", "semantics"];
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new LocalEquivalenceError(
        "INVALID_MONOLITHIC_SECURITY",
        `monolithicSecurity[${index}] keys do not match the security contract`,
      );
    }
    const id = requiredString(record.id, `monolithicSecurity[${index}].id`);
    const expected = expectedById.get(id);
    if (!expected || record.owner !== expected.owner || record.semantics !== expected.semantics) {
      throw new LocalEquivalenceError(
        "MONOLITHIC_SECURITY_OWNERSHIP_MISMATCH",
        `${id} does not match the exact security ownership contract`,
      );
    }
    if (
      record.outcome !== "passed" &&
      record.outcome !== "failed" &&
      record.outcome !== "not-applicable"
    ) {
      throw new LocalEquivalenceError("INVALID_MONOLITHIC_SECURITY", `${id}.outcome is invalid`);
    }
    if (
      !Array.isArray(record.diagnostics) ||
      !record.diagnostics.every((diagnostic) => typeof diagnostic === "string")
    ) {
      throw new LocalEquivalenceError(
        "INVALID_MONOLITHIC_SECURITY",
        `${id}.diagnostics must be a string array`,
      );
    }
    const diagnostics = record.diagnostics as readonly string[];
    if (JSON.stringify(diagnostics) !== JSON.stringify([...diagnostics].sort())) {
      throw new LocalEquivalenceError(
        "UNSTABLE_MONOLITHIC_SECURITY_DIAGNOSTICS",
        `${id}.diagnostics must be sorted`,
      );
    }
    return {
      id,
      owner: expected.owner,
      semantics: expected.semantics,
      outcome: record.outcome,
      diagnostics,
    };
  });
  const ids = parsed.map(({ id }) => id);
  if (
    new Set(ids).size !== ids.length ||
    JSON.stringify([...ids].sort()) !==
      JSON.stringify(SECURITY_OWNERSHIP.map(({ id }) => id).sort())
  ) {
    throw new LocalEquivalenceError(
      "MONOLITHIC_SECURITY_SET_MISMATCH",
      "monolithic security evidence must contain the exact five results",
    );
  }
  return parsed;
}

function stableDiagnostics(check: EvidenceCheckResult): readonly string[] {
  if (check.status === "passed" || check.status === "not_applicable") return [];
  return [
    `${check.id}:${check.errorCode ?? check.failureReason ?? check.status}`
      .replace(/\s+/g, " ")
      .trim(),
  ];
}

function outcome(status: EvidenceStatus): NormalizedOutcome {
  if (status === "passed") return "passed";
  if (status === "not_applicable") return "not-applicable";
  return "failed";
}

function normalizeMonolithicCheck(check: EvidenceCheckResult): NormalizedCheck {
  return {
    id: check.id,
    selection: check.status === "not_applicable" ? "not-applicable" : "selected",
    semantics: check.id === "core-coverage-warning" ? "advisory" : "blocking",
    outcome: outcome(check.status),
    diagnostics: stableDiagnostics(check),
  };
}

function blockingOutcome(checks: readonly NormalizedCheck[]): "passed" | "failed" {
  return checks.some(
    ({ semantics, outcome: checkOutcome }) => semantics === "blocking" && checkOutcome === "failed",
  )
    ? "failed"
    : "passed";
}

function securityBlockingOutcome(results: readonly SynthesisSecurityResult[]): "passed" | "failed" {
  return results.some(
    ({ id, semantics, outcome: resultOutcome }) =>
      LOCALLY_COMPARABLE_SECURITY_IDS.has(id) &&
      semantics === "blocking" &&
      resultOutcome === "failed",
  )
    ? "failed"
    : "passed";
}

function mismatch(
  code: string,
  key: string,
  monolithic: unknown,
  split: unknown,
): LocalEquivalenceMismatch {
  return { code, key, monolithic, split };
}

function compareCheck(
  monolithic: NormalizedCheck,
  split: NormalizedCheck,
): readonly LocalEquivalenceMismatch[] {
  const mismatches: LocalEquivalenceMismatch[] = [];
  for (const field of ["selection", "semantics", "outcome", "diagnostics"] as const) {
    if (JSON.stringify(monolithic[field]) !== JSON.stringify(split[field])) {
      mismatches.push(
        mismatch(
          `CHECK_${field.toUpperCase()}_MISMATCH`,
          `${monolithic.id}.${field}`,
          monolithic[field],
          split[field],
        ),
      );
    }
  }
  return mismatches;
}

function assertProducerMatchesShadow(
  bundles: Readonly<Record<ProducerLane, ProducerBundle>>,
  shadow: SplitValidationShadowEvidence,
): void {
  const shadowById = new Map(shadow.checks.map((check) => [check.id, check]));
  for (const lane of PRODUCER_LANES) {
    for (const producerCheck of bundles[lane].checks) {
      const synthesized = shadowById.get(producerCheck.id);
      if (
        !synthesized ||
        producerCheck.selection !== synthesized.selection ||
        producerCheck.semantics !== synthesized.semantics ||
        producerCheck.outcome !== synthesized.outcome ||
        JSON.stringify(producerCheck.diagnostics) !== JSON.stringify(synthesized.diagnostics)
      ) {
        throw new LocalEquivalenceError(
          "PRODUCER_SYNTHESIS_MISMATCH",
          `${lane} result ${producerCheck.id} does not match split synthesis`,
        );
      }
    }
  }
}

export function evaluateLocalEquivalence(input: {
  readonly identity: unknown;
  readonly monolithic: unknown;
  readonly monolithicSecurity: unknown;
  readonly producerBundles: readonly unknown[];
  readonly splitValidationShadow: unknown;
}): LocalEquivalenceReport {
  const identity = parseLocalExperimentIdentity(input.identity);
  const monolithic = parseMonolithicReport(input.monolithic);
  const monolithicSecurity = parseMonolithicSecurity(input.monolithicSecurity);
  assertMonolithicIdentity(monolithic, identity);
  assertExactCheckSet(monolithic);

  const monolithicChecks = monolithic.checks.map(normalizeMonolithicCheck);
  const selectedCheckIds = monolithicChecks
    .filter(({ selection }) => selection === "selected")
    .map(({ id }) => id);
  const parsedProducerBundles = input.producerBundles.map((bundle, index) =>
    parseProducerBundle(bundle, `producerBundles[${index}]`),
  );
  const producerBundles = validateProducerFanIn(parsedProducerBundles, {
    ...identity,
    selectedCheckIds: selectedCheckIds.filter((id) =>
      PRODUCER_LANES.includes(
        VERIFICATION_LANE_OWNERSHIP[id as keyof typeof VERIFICATION_LANE_OWNERSHIP] as ProducerLane,
      ),
    ),
  });
  const producerBundleDigests = PRODUCER_LANES.map((lane) => ({
    lane,
    bundleDigest: producerBundles[lane].bundleDigest,
  }));
  const shadow = parseSplitValidationShadowEvidence(input.splitValidationShadow, {
    ...identity,
    selectedCheckIds,
    producerBundleDigests,
  });
  assertProducerMatchesShadow(producerBundles, shadow);

  const monolithicById = new Map(monolithicChecks.map((check) => [check.id, check]));
  const splitChecks: readonly NormalizedCheck[] = shadow.checks.map((check) => ({ ...check }));
  const mismatches = splitChecks
    .flatMap((splitCheck) => {
      const monolithicCheck = monolithicById.get(splitCheck.id);
      return monolithicCheck
        ? compareCheck(monolithicCheck, splitCheck)
        : [mismatch("CHECK_MISSING", splitCheck.id, null, splitCheck)];
    })
    .sort((left, right) => `${left.key}:${left.code}`.localeCompare(`${right.key}:${right.code}`));
  const splitSecurityById = new Map(shadow.security.map((result) => [result.id, result]));
  for (const result of monolithicSecurity.filter(({ id }) =>
    LOCALLY_COMPARABLE_SECURITY_IDS.has(id),
  )) {
    const splitResult = splitSecurityById.get(result.id);
    if (!splitResult) {
      mismatches.push(mismatch("SECURITY_MISSING", result.id, result, null));
      continue;
    }
    for (const field of ["owner", "semantics", "outcome", "diagnostics"] as const) {
      if (JSON.stringify(result[field]) !== JSON.stringify(splitResult[field])) {
        mismatches.push(
          mismatch(
            `SECURITY_${field.toUpperCase()}_MISMATCH`,
            `${result.id}.${field}`,
            result[field],
            splitResult[field],
          ),
        );
      }
    }
  }
  const monolithicCheckBlockingOutcome = blockingOutcome(monolithicChecks);
  const monolithicBlockingOutcome =
    monolithicCheckBlockingOutcome === "failed" ||
    securityBlockingOutcome(monolithicSecurity) === "failed"
      ? "failed"
      : "passed";
  if ((monolithic.status === "passed") !== (monolithicCheckBlockingOutcome === "passed")) {
    mismatches.push(
      mismatch(
        "MONOLITHIC_BLOCKING_OUTCOME_MISMATCH",
        "checkBlockingOutcome",
        monolithic.status,
        monolithicCheckBlockingOutcome,
      ),
    );
  }
  if (monolithicBlockingOutcome !== shadow.blockingOutcome) {
    mismatches.push(
      mismatch(
        "BLOCKING_OUTCOME_MISMATCH",
        "blockingOutcome",
        monolithicBlockingOutcome,
        shadow.blockingOutcome,
      ),
    );
  }
  if (
    shadow.operationalFailure !== null ||
    shadow.conclusion === "cancelled" ||
    shadow.conclusion === "skipped"
  ) {
    mismatches.push(
      mismatch(
        "SPLIT_OPERATIONAL_FAILURE",
        "operationalFailure",
        null,
        shadow.operationalFailure ?? shadow.conclusion,
      ),
    );
  }
  mismatches.sort((left, right) =>
    `${left.key}:${left.code}`.localeCompare(`${right.key}:${right.code}`),
  );

  return {
    schemaVersion: LOCAL_EQUIVALENCE_REPORT_SCHEMA,
    status: mismatches.length === 0 ? "passed" : "failed",
    identity,
    comparedCheckCount: splitChecks.length,
    comparedSecurityCount: LOCALLY_COMPARABLE_SECURITY_IDS.size,
    monolithicBlockingOutcome,
    splitBlockingOutcome: shadow.blockingOutcome,
    mismatches,
    hostedOnlyMetrics: {
      queueInclusiveP95: "not-measured",
      runnerScheduling: "not-measured",
      artifactService: "not-measured",
    },
  };
}

type CliOptions = {
  readonly identityPath: string;
  readonly monolithicPath: string;
  readonly monolithicSecurityPath: string;
  readonly producerPaths: readonly string[];
  readonly shadowPath: string;
  readonly outputPath?: string;
};

function parseCliOptions(args: readonly string[]): CliOptions {
  let identityPath: string | undefined;
  let monolithicPath: string | undefined;
  let monolithicSecurityPath: string | undefined;
  const producerPaths: string[] = [];
  let shadowPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new LocalEquivalenceError("CLI_INVALID", `${flag ?? "argument"} requires a value`);
    }
    if (flag === "--identity") identityPath = value;
    else if (flag === "--monolithic") monolithicPath = value;
    else if (flag === "--monolithic-security") monolithicSecurityPath = value;
    else if (flag === "--producer") producerPaths.push(value);
    else if (flag === "--shadow") shadowPath = value;
    else if (flag === "--output") outputPath = value;
    else throw new LocalEquivalenceError("CLI_INVALID", `unknown option ${flag}`);
    index += 1;
  }
  if (
    !identityPath ||
    !monolithicPath ||
    !monolithicSecurityPath ||
    !shadowPath ||
    producerPaths.length !== 4
  ) {
    throw new LocalEquivalenceError(
      "CLI_INVALID",
      "required: --identity <json> --monolithic <json> --monolithic-security <json> --producer <json> (exactly four) --shadow <json> [--output <json>]",
    );
  }
  return {
    identityPath,
    monolithicPath,
    monolithicSecurityPath,
    producerPaths,
    shadowPath,
    outputPath,
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

export function runLocalEquivalenceCli(args: readonly string[]): number {
  try {
    const options = parseCliOptions(args);
    const report = evaluateLocalEquivalence({
      identity: readJson(options.identityPath),
      monolithic: readJson(options.monolithicPath),
      monolithicSecurity: readJson(options.monolithicSecurityPath),
      producerBundles: options.producerPaths.map(readJson),
      splitValidationShadow: readJson(options.shadowPath),
    });
    const rendered = `${JSON.stringify(report, null, 2)}\n`;
    if (options.outputPath) writeFileSync(resolve(options.outputPath), rendered);
    process.stdout.write(rendered);
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`ci-cacheable-lanes-local-harness: ${message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(resolve(argv[1] ?? "")).href) {
  exit(runLocalEquivalenceCli(argv.slice(2)));
}
