import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertVerificationIdentity,
  resolveVerificationIdentity,
} from "../ci-verification-identity.mts";

const repositories: string[] = [];

function git(root: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function commit(root: string, file: string, content: string, message: string): string {
  writeFileSync(join(root, file), content);
  git(root, "add", file);
  git(root, "commit", "--message", message);
  return git(root, "rev-parse", "HEAD");
}

function createPullRequestCandidate(): {
  readonly root: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly candidateSha: string;
} {
  const root = mkdtempSync(join(tmpdir(), "croco-ci-verification-identity-"));
  repositories.push(root);
  git(root, "init", "--initial-branch=trunk");
  git(root, "config", "user.email", "fixture@croco.dev");
  git(root, "config", "user.name", "Croco fixture");
  const baseSha = commit(root, "base.txt", "base\n", "base");
  git(root, "switch", "--create", "pull-request");
  const headSha = commit(root, "head.txt", "head\n", "head");
  git(root, "switch", "--detach", baseSha);
  git(root, "merge", "--no-ff", "--no-edit", headSha);
  const candidateSha = git(root, "rev-parse", "HEAD");
  return { root, baseSha, headSha, candidateSha };
}

describe("immutable CI verification identity", () => {
  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      rmSync(repository, { force: true, recursive: true });
    }
  });

  it("keeps an old merge candidate bound to its event base after trunk advances", () => {
    const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
    const identity = resolveVerificationIdentity({
      rootDir: root,
      eventName: "pull_request",
      eventBaseSha: baseSha,
      eventHeadSha: headSha,
      candidateRef: candidateSha,
    });

    git(root, "switch", "trunk");
    const advancedBaseSha = commit(root, "new-base.txt", "new base\n", "advance trunk");
    git(root, "switch", "--detach", candidateSha);

    expect(advancedBaseSha).not.toBe(baseSha);
    expect(
      assertVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        baseSha: identity.baseSha,
        headSha: identity.headSha,
        candidateSha: identity.candidateSha,
        checkoutRef: "HEAD",
      }),
    ).toEqual(identity);
  });

  it("rejects a merge candidate whose parents do not match the event identity", () => {
    const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
    git(root, "switch", "trunk");
    const advancedBaseSha = commit(root, "new-base.txt", "new base\n", "advance trunk");
    git(root, "switch", "--detach", candidateSha);

    expect(() =>
      assertVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        baseSha: advancedBaseSha,
        headSha,
        candidateSha,
        checkoutRef: "HEAD",
      }),
    ).toThrow(expect.objectContaining({ code: "VERIFICATION_CANDIDATE_PARENT_MISMATCH" }));
    expect(baseSha).not.toBe(advancedBaseSha);
  });

  it("rejects a downstream checkout that differs from the published candidate", () => {
    const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
    git(root, "switch", "--detach", headSha);

    expect(() =>
      assertVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        baseSha,
        headSha,
        candidateSha,
        checkoutRef: "HEAD",
      }),
    ).toThrow(expect.objectContaining({ code: "VERIFICATION_CANDIDATE_CHECKOUT_MISMATCH" }));
  });

  it("rejects a resolver checkout that differs from the event candidate", () => {
    const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
    git(root, "switch", "--detach", headSha);

    expect(() =>
      resolveVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        eventBaseSha: baseSha,
        eventHeadSha: headSha,
        candidateRef: candidateSha,
        checkoutRef: "HEAD",
      }),
    ).toThrow(expect.objectContaining({ code: "VERIFICATION_CANDIDATE_CHECKOUT_MISMATCH" }));
  });

  it("rejects a tracked worktree that differs from the candidate", () => {
    const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
    writeFileSync(join(root, "head.txt"), "mutated\n");

    expect(() =>
      assertVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        baseSha,
        headSha,
        candidateSha,
        checkoutRef: "HEAD",
        verifyWorktree: true,
      }),
    ).toThrow(expect.objectContaining({ code: "VERIFICATION_CANDIDATE_WORKTREE_MISMATCH" }));
  });

  it("uses exact candidate and parent OIDs for non-pull-request runs", () => {
    const { root, headSha: candidateSha } = createPullRequestCandidate();
    git(root, "switch", "--detach", candidateSha);

    const identity = resolveVerificationIdentity({
      rootDir: root,
      eventName: "workflow_dispatch",
      eventHeadSha: candidateSha,
      candidateRef: "HEAD",
    });

    expect(identity).toMatchObject({
      headSha: candidateSha,
      candidateSha,
    });
    expect(identity.baseSha).toBe(git(root, "rev-parse", `${candidateSha}^`));
  });
});
