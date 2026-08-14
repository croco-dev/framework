import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { restoreExactLaneCache, writeExactLaneCache } from "../ci-cacheable-lane-cache.mts";
import {
  createCurrentRunAttestation,
  createProducerBundle,
  createReusableReceipt,
  evidenceDigest,
} from "../ci-lane-evidence.mts";
import type {
  ExactLaneCacheContext,
  LaneCacheCommandBinding,
} from "../ci-cacheable-lane-cache.mts";
import type {
  EvidenceIdentity,
  EvidenceOutput,
  ExperimentIdentity,
  ProducerBundle,
} from "../ci-lane-evidence.mts";

const COMMIT_SHA = "b".repeat(40);
const BASE_SHA = "a".repeat(40);

function identity(runId = "source-run", runAttempt = 1): ExperimentIdentity {
  return {
    architectureVersion: "shadow-split",
    commitSha: COMMIT_SHA,
    runId,
    runAttempt,
    profile: "publish",
    manifestDigest: "1".repeat(64),
    inventoryDigest: "2".repeat(64),
    toolchainDigest: "3".repeat(64),
    inputDigest: "4".repeat(64),
    verificationExperimentId: `${runId}-${runAttempt}`,
  };
}

function fixture(rootDir: string): {
  readonly bundle: ProducerBundle;
  readonly binding: LaneCacheCommandBinding;
  readonly output: EvidenceOutput;
} {
  const sourceIdentity = identity();
  const laneIdentity: EvidenceIdentity = { ...sourceIdentity, lane: "generated-apps" };
  const checkId = "generated-app-smoke";
  const commandDigest = evidenceDigest(["pnpm", "generated-app-smoke"]);
  const taskHash = evidenceDigest({ task: checkId, inputDigest: sourceIdentity.inputDigest });
  const record = {
    schemaVersion: "croco.ci-cacheable-lane-check/v1",
    identity: laneIdentity,
    checkId,
    selection: "selected",
    semantics: "blocking",
    outcome: "passed",
    commandDigest,
    execution: {
      status: "passed",
      startedAt: "2026-08-14T00:00:00.000Z",
      completedAt: "2026-08-14T00:00:01.000Z",
      durationMs: 1000,
      exitCode: 0,
      errorCode: null,
      failureReason: null,
    },
    diagnostics: [],
  };
  const path = "ci-reports/cacheable-ci/generated-apps/checks/generated-app-smoke.json";
  const absolutePath = join(rootDir, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const rendered = `${JSON.stringify(record, null, 2)}\n`;
  writeFileSync(absolutePath, rendered);
  const normalizedOutput = {
    path,
    digest: createHash("sha256").update(rendered).digest("hex"),
    bytes: Buffer.byteLength(rendered),
  };
  const receipt = createReusableReceipt({
    lane: "generated-apps",
    checkId,
    profile: sourceIdentity.profile,
    manifestDigest: sourceIdentity.manifestDigest,
    inventoryDigest: sourceIdentity.inventoryDigest,
    toolchainDigest: sourceIdentity.toolchainDigest,
    inputDigest: sourceIdentity.inputDigest,
    contentHash: evidenceDigest(record),
    taskHash,
    commandDigest,
    cache: { origin: "executed", revalidated: true, policyDigest: null },
    outputs: [normalizedOutput],
  });
  const attestation = createCurrentRunAttestation({
    commitSha: sourceIdentity.commitSha,
    runId: sourceIdentity.runId,
    runAttempt: sourceIdentity.runAttempt,
    profile: sourceIdentity.profile,
    lane: "generated-apps",
    checkId,
    manifestDigest: sourceIdentity.manifestDigest,
    inventoryDigest: sourceIdentity.inventoryDigest,
    toolchainDigest: sourceIdentity.toolchainDigest,
    inputDigest: sourceIdentity.inputDigest,
    receiptDigest: receipt.receiptDigest,
    outputDigest: evidenceDigest(receipt.outputs),
    decision: "passed",
    diagnostics: [],
    issuedAt: "2026-08-14T00:00:01.000Z",
  });
  return {
    bundle: createProducerBundle({
      ...laneIdentity,
      startedAt: "2026-08-14T00:00:00.000Z",
      completedAt: "2026-08-14T00:00:01.000Z",
      status: "success",
      checks: [
        {
          id: checkId,
          selection: "selected",
          semantics: "blocking",
          outcome: "passed",
          receiptDigest: receipt.receiptDigest,
          attestationDigest: attestation.attestationDigest,
          diagnostics: [],
        },
      ],
      receipts: [receipt],
      attestations: [attestation],
      artifactFiles: [normalizedOutput],
    }),
    binding: { checkId, commandDigest, taskHash },
    output: normalizedOutput,
  };
}

function context(
  currentIdentity: ExperimentIdentity,
  binding: LaneCacheCommandBinding,
): ExactLaneCacheContext {
  return {
    identity: currentIdentity,
    lane: "generated-apps",
    baseSha: BASE_SHA,
    changedFilesDigest: "5".repeat(64),
    outputDir: "ci-reports/cacheable-ci/generated-apps",
    commandBindings: [binding],
  };
}

describe("exact lane cache", () => {
  it("revalidates exact bytes and reissues an exact-key receipt for the current run", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "croco-exact-lane-cache-"));
    const cacheDir = join(rootDir, ".cache", "generated-apps");
    const { binding, bundle, output } = fixture(rootDir);
    writeExactLaneCache({
      rootDir,
      cacheDir,
      context: context(identity(), binding),
      bundle,
      materializations: [],
    });
    rmSync(join(rootDir, "ci-reports"), { recursive: true });

    const hit = restoreExactLaneCache({
      rootDir,
      cacheDir,
      origin: "github-exact-key",
      context: context(identity("current-run", 3), binding),
    });

    expect(hit?.receipts.get("generated-app-smoke")?.cache).toEqual({
      origin: "github-exact-key",
      revalidated: true,
      policyDigest: null,
    });
    expect(readFileSync(join(rootDir, output.path), "utf8")).toContain(
      "croco.ci-cacheable-lane-check/v1",
    );
  });

  it("rejects corrupt bytes, stale change identity, restore-prefix, and fork candidates", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "croco-exact-lane-hostile-"));
    const cacheDir = join(rootDir, ".cache", "generated-apps");
    const { binding, bundle, output } = fixture(rootDir);
    const sourceContext = context(identity(), binding);
    writeExactLaneCache({
      rootDir,
      cacheDir,
      context: sourceContext,
      bundle,
      materializations: [],
    });

    expect(() =>
      restoreExactLaneCache({
        rootDir,
        cacheDir,
        origin: "github-restore-prefix",
        context: sourceContext,
      }),
    ).toThrow(/Only a GitHub exact-key/);
    expect(() =>
      restoreExactLaneCache({ rootDir, cacheDir, origin: "fork", context: sourceContext }),
    ).toThrow(/Only a GitHub exact-key/);
    expect(() =>
      restoreExactLaneCache({
        rootDir,
        cacheDir,
        origin: "github-exact-key",
        context: { ...sourceContext, changedFilesDigest: "6".repeat(64) },
      }),
    ).toThrow(/does not match current identity/);

    const extraPath = join(
      cacheDir,
      "files",
      "ci-reports",
      "cacheable-ci",
      "generated-apps",
      "extra.txt",
    );
    mkdirSync(dirname(extraPath), { recursive: true });
    writeFileSync(extraPath, "unlisted\n");
    expect(() =>
      restoreExactLaneCache({
        rootDir,
        cacheDir,
        origin: "github-exact-key",
        context: sourceContext,
      }),
    ).toThrow(/path set does not match/);
    rmSync(extraPath);

    writeFileSync(join(cacheDir, "files", output.path), "corrupt\n");
    expect(() =>
      restoreExactLaneCache({
        rootDir,
        cacheDir,
        origin: "github-exact-key",
        context: sourceContext,
      }),
    ).toThrow(/bytes do not match/);
  });

  it("never restores coverage-security physical evidence across runs", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "croco-security-cache-forbidden-"));
    const cacheDir = join(rootDir, ".cache", "generated-apps");
    const { binding, bundle } = fixture(rootDir);
    const sourceContext = context(identity(), binding);
    writeExactLaneCache({
      rootDir,
      cacheDir,
      context: sourceContext,
      bundle,
      materializations: [],
    });

    expect(() =>
      restoreExactLaneCache({
        rootDir,
        cacheDir,
        origin: "github-exact-key",
        context: { ...sourceContext, lane: "coverage-security" },
      }),
    ).toThrow(/cannot be reused/);
  });
});
