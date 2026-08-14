import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cacheableInputDigest,
  changedFilesDigest,
  createCacheableExperimentIdentity,
  createCacheableExperimentIdentityFromRepository,
  readChangedFiles,
  resolveCommitSha,
} from "../ci-cacheable-experiment-identity.mts";
import { VerificationProblem } from "../verification-problem.mts";

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const BASE_SHA = "c".repeat(40);
const CHANGED_FILES_DIGEST = "d".repeat(64);

function digestParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return hash.digest("hex");
}

describe("cacheable CI experiment identity", () => {
  it("matches the observer toolchain and input digest contract", () => {
    const toolchainDigest = digestParts([
      "Linux",
      "X64",
      "ubuntu-latest",
      "v24.5.0",
      "11.9.0",
      "2.10.2",
      "pnpm@11.9.0",
    ]);
    const inputDigest = digestParts([
      SHA,
      DIGEST,
      "c".repeat(64),
      toolchainDigest,
      BASE_SHA,
      CHANGED_FILES_DIGEST,
    ]);

    expect(
      createCacheableExperimentIdentity({
        commitSha: SHA,
        runId: "1234",
        runAttempt: 2,
        profile: "publish",
        runnerOs: "Linux",
        runnerArch: "X64",
        runnerLabel: "ubuntu-latest",
        nodeVersion: "v24.5.0",
        pnpmVersion: "11.9.0",
        turboVersion: "2.10.2",
        packageManager: "pnpm@11.9.0",
        workflowDigest: DIGEST,
        inventoryDigest: "d".repeat(64),
        inventoryFileDigest: "c".repeat(64),
        baseSha: BASE_SHA,
        changedFilesDigest: CHANGED_FILES_DIGEST,
      }),
    ).toEqual({
      architectureVersion: "shadow-split",
      commitSha: SHA,
      runId: "1234",
      runAttempt: 2,
      profile: "publish",
      manifestDigest: DIGEST,
      inventoryDigest: "d".repeat(64),
      toolchainDigest,
      inputDigest,
      verificationExperimentId: `1234-2-${inputDigest.slice(0, 12)}`,
    });
  });

  it("changes identity when the toolchain cohort changes", () => {
    const base = {
      commitSha: SHA,
      runId: "1234",
      runAttempt: 1,
      profile: "publish" as const,
      runnerOs: "Linux",
      runnerArch: "X64",
      runnerLabel: "ubuntu-latest",
      nodeVersion: "v24.5.0",
      pnpmVersion: "11.9.0",
      turboVersion: "2.10.2",
      packageManager: "pnpm@11.9.0",
      workflowDigest: DIGEST,
      inventoryDigest: DIGEST,
      inventoryFileDigest: DIGEST,
      baseSha: BASE_SHA,
      changedFilesDigest: CHANGED_FILES_DIGEST,
    };

    expect(createCacheableExperimentIdentity(base).toolchainDigest).not.toBe(
      createCacheableExperimentIdentity({ ...base, pnpmVersion: "11.10.0" }).toolchainDigest,
    );
  });

  it("creates the same strict envelope from repository files", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-cacheable-identity-"));
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ packageManager: "pnpm@11.9.0", devDependencies: { turbo: "2.10.2" } }),
    );
    writeFileSync(join(root, ".github", "workflows", "ci.yml"), "name: CI\n");
    writeFileSync(
      join(root, "test-inventory.json"),
      JSON.stringify({ version: 1, tests: [], exceptions: [] }),
    );
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "ci@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CI"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "base"], { cwd: root });
    const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    writeFileSync(join(root, "changed.txt"), "changed\n");
    execFileSync("git", ["add", "changed.txt"], { cwd: root });
    execFileSync("git", ["commit", "-m", "head"], { cwd: root });
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();

    const result = createCacheableExperimentIdentityFromRepository([
      "--root",
      root,
      "--commit-sha",
      headSha,
      "--base",
      baseSha,
      "--head",
      headSha,
      "--run-id",
      "99",
      "--run-attempt",
      "1",
      "--profile",
      "publish",
      "--runner-os",
      "Linux",
      "--runner-arch",
      "X64",
      "--runner-label",
      "ubuntu-latest",
      "--node-version",
      "v24.5.0",
      "--pnpm-version",
      "11.9.0",
      "--output",
      "ci-reports/cacheable-ci/identity.json",
    ]);

    expect(result.identity.runId).toBe("99");
    expect(result.identity.inventoryDigest).toHaveLength(64);
    expect(result.outputPath).toBe(join(root, "ci-reports", "cacheable-ci", "identity.json"));
    expect(resolveCommitSha(root, "HEAD~1")).toBe(baseSha);
    expect(resolveCommitSha(root, "HEAD")).toBe(headSha);
    expect(readChangedFiles(root, baseSha, headSha)).toEqual(["changed.txt"]);
    expect(changedFilesDigest(["z.txt", "a.txt"])).toBe(changedFilesDigest(["a.txt", "z.txt"]));
    expect(() => readFileSync(join(root, "ci-reports", "cacheable-ci", "identity.json"))).toThrow();
  });

  it("rejects invalid profile and run attempts", () => {
    expect(() =>
      createCacheableExperimentIdentityFromRepository([
        "--commit-sha",
        SHA,
        "--run-id",
        "99",
        "--run-attempt",
        "0",
        "--profile",
        "unknown",
        "--runner-os",
        "Linux",
        "--runner-arch",
        "X64",
        "--runner-label",
        "ubuntu-latest",
        "--pnpm-version",
        "11.9.0",
      ]),
    ).toThrow("--run-attempt must be a positive integer");
  });

  it("rejects an unknown verification profile with a stable Problem", () => {
    try {
      createCacheableExperimentIdentityFromRepository([
        "--commit-sha",
        SHA,
        "--run-id",
        "99",
        "--run-attempt",
        "1",
        "--profile",
        "unknown",
        "--runner-os",
        "Linux",
        "--runner-arch",
        "X64",
        "--runner-label",
        "ubuntu-latest",
        "--pnpm-version",
        "11.9.0",
      ]);
      throw new Error("Expected profile validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(VerificationProblem);
      expect(error).toMatchObject({ code: "UNKNOWN_VERIFICATION_PROFILE", category: "input" });
    }
  });

  it("rejects a partial change identity with a stable Problem", () => {
    expect(() =>
      cacheableInputDigest({
        commitSha: SHA,
        workflowDigest: DIGEST,
        inventoryFileDigest: DIGEST,
        toolchainDigest: DIGEST,
        baseSha: BASE_SHA,
      }),
    ).toThrow(expect.objectContaining({ code: "INCOMPLETE_CHANGE_IDENTITY", category: "input" }));
  });

  it("models malformed package metadata as a configuration Problem", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-cacheable-identity-package-"));
    writeFileSync(join(root, "package.json"), "not json\n");

    expect(() => createCacheableExperimentIdentityFromRepository(["--root", root])).toThrow(
      expect.objectContaining({ code: "INVALID_PACKAGE_METADATA", category: "configuration" }),
    );
  });
});
