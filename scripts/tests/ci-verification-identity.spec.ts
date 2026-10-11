import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertVerificationIdentity,
  resolveVerificationIdentity,
  verifyRecordedVerificationIdentity,
} from "../ci-verification-identity.mts";
import type { VerificationEventName, VerificationIdentity } from "../ci-verification-identity.mts";

const repositories: string[] = [];
const IDENTITY_SCRIPT = resolve(import.meta.dirname, "../ci-verification-identity.mts");

function git(root: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function commit(root: string, file: string, content: string, message: string): string {
  writeFileSync(join(root, file), content);
  git(root, "add", file);
  git(root, "commit", "--message", message);
  return git(root, "rev-parse", "HEAD");
}

function temporaryDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-ci-verification-identity-"));
  repositories.push(root);
  return root;
}

function createRepository(): string {
  const root = temporaryDirectory();
  git(root, "init", "--initial-branch=trunk");
  git(root, "config", "user.email", "fixture@croco.dev");
  git(root, "config", "user.name", "Croco fixture");
  return root;
}

function mergeCandidate(root: string, baseSha: string, headSha: string): string {
  git(root, "switch", "--detach", baseSha);
  git(root, "merge", "--no-ff", "--no-edit", headSha);
  return git(root, "rev-parse", "HEAD");
}

function createPullRequestCandidate(): {
  readonly root: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly candidateSha: string;
} {
  const root = createRepository();
  const baseSha = commit(root, "base.txt", "base\n", "base");
  git(root, "switch", "--create", "pull-request");
  const headSha = commit(root, "head.txt", "head\n", "head");
  const candidateSha = mergeCandidate(root, baseSha, headSha);
  return { root, baseSha, headSha, candidateSha };
}

function createPullRequestCandidateAfterBaseAdvance(): {
  readonly root: string;
  readonly eventBaseSha: string;
  readonly candidateBaseSha: string;
  readonly headSha: string;
  readonly candidateSha: string;
} {
  const root = createRepository();
  const eventBaseSha = commit(root, "base.txt", "base\n", "base");
  git(root, "switch", "--create", "pull-request");
  const headSha = commit(root, "head.txt", "head\n", "head");
  git(root, "switch", "trunk");
  const candidateBaseSha = commit(root, "new-base.txt", "new base\n", "advance trunk");
  git(root, "merge", "--no-ff", "--no-edit", headSha);
  const candidateSha = git(root, "rev-parse", "HEAD");
  return { root, eventBaseSha, candidateBaseSha, headSha, candidateSha };
}

function shallowClone(origin: string): string {
  const clone = temporaryDirectory();
  git(clone, "clone", "--depth", "1", pathToFileURL(origin).href, ".");
  return clone;
}

function verifyRecordedRun(options: {
  readonly root: string;
  readonly eventName: VerificationEventName;
  readonly runHeadSha: string;
  readonly recorded: Pick<VerificationIdentity, "baseSha" | "headSha" | "candidateSha">;
  readonly defaultBranchRef?: string;
}): VerificationIdentity {
  const pullRequest = options.eventName === "pull_request";
  const candidateSha = pullRequest ? options.recorded.candidateSha : options.runHeadSha;
  return verifyRecordedVerificationIdentity({
    rootDir: options.root,
    eventName: options.eventName,
    ...(pullRequest ? { eventBaseSha: options.recorded.baseSha } : {}),
    eventHeadSha: options.runHeadSha,
    candidateRef: candidateSha,
    checkoutRef: candidateSha,
    recordedBaseSha: options.recorded.baseSha,
    recordedHeadSha: options.recorded.headSha,
    recordedCandidateSha: options.recorded.candidateSha,
    defaultBranchRef: options.defaultBranchRef ?? "trunk",
  });
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

  it("binds to an immutable merge candidate whose base advanced after the event", () => {
    const { root, eventBaseSha, candidateBaseSha, headSha, candidateSha } =
      createPullRequestCandidateAfterBaseAdvance();

    expect(
      resolveVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        eventBaseSha,
        eventHeadSha: headSha,
        candidateRef: candidateSha,
      }),
    ).toEqual({
      schemaVersion: "croco.ci-verification-identity/v1",
      eventName: "pull_request",
      baseSha: candidateBaseSha,
      headSha,
      candidateSha,
    });
  });

  it("rejects a candidate base outside the event base history", () => {
    const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
    git(root, "switch", "--detach", baseSha);
    const divergentBaseSha = commit(root, "divergent.txt", "divergent\n", "divergent");
    git(root, "switch", "--detach", candidateSha);

    expect(() =>
      resolveVerificationIdentity({
        rootDir: root,
        eventName: "pull_request",
        eventBaseSha: divergentBaseSha,
        eventHeadSha: headSha,
        candidateRef: candidateSha,
      }),
    ).toThrow(expect.objectContaining({ code: "VERIFICATION_EVENT_BASE_NOT_ANCESTOR" }));
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

  describe("recorded identity re-verification", () => {
    it("accepts a pull-request run whose base advanced after the pull request opened", () => {
      const { root, eventBaseSha, candidateBaseSha, headSha, candidateSha } =
        createPullRequestCandidateAfterBaseAdvance();
      git(root, "switch", "trunk");
      commit(root, "later.txt", "later\n", "advance trunk after the run");

      expect(candidateBaseSha).not.toBe(eventBaseSha);
      expect(
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha: candidateBaseSha, headSha, candidateSha },
        }),
      ).toEqual({
        schemaVersion: "croco.ci-verification-identity/v1",
        eventName: "pull_request",
        baseSha: candidateBaseSha,
        headSha,
        candidateSha,
      });
    });

    it("verifies a superseded run against its recorded candidate after the pull request is re-pushed", () => {
      const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
      git(root, "switch", "pull-request");
      const repushedHeadSha = commit(root, "head.txt", "re-pushed head\n", "re-push");
      const currentCandidateSha = mergeCandidate(root, baseSha, repushedHeadSha);

      expect(currentCandidateSha).not.toBe(candidateSha);
      expect(
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha, headSha, candidateSha },
        }),
      ).toMatchObject({ eventName: "pull_request", baseSha, headSha, candidateSha });
    });

    it("rejects a recorded candidate whose parents do not match the source run", () => {
      const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
      git(root, "switch", "pull-request");
      const repushedHeadSha = commit(root, "head.txt", "re-pushed head\n", "re-push");

      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: repushedHeadSha,
          recorded: { baseSha, headSha: repushedHeadSha, candidateSha },
        }),
      ).toThrow(expect.objectContaining({ code: "VERIFICATION_CANDIDATE_PARENT_MISMATCH" }));
      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha, headSha, candidateSha: headSha },
        }),
      ).toThrow(expect.objectContaining({ code: "VERIFICATION_CANDIDATE_PARENT_COUNT_MISMATCH" }));
    });

    it("rejects a recorded candidate with valid parents but a forged merge tree", () => {
      const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
      const expectedTree = git(root, "rev-parse", `${candidateSha}^{tree}`);
      commit(root, "injected.txt", "not in either parent\n", "injected content");
      const forgedTree = git(root, "rev-parse", "HEAD^{tree}");
      const forgedCandidate = git(
        root,
        "commit-tree",
        forgedTree,
        "-p",
        baseSha,
        "-p",
        headSha,
        "-m",
        "forged merge",
      );

      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha, headSha, candidateSha: forgedCandidate },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "VERIFICATION_CANDIDATE_TREE_MISMATCH",
          category: "contract",
          message: expect.stringContaining(
            `tree ${forgedTree} must equal merged parent tree ${expectedTree}`,
          ),
        }),
      );
    });

    it("reports conflicting parent trees instead of accepting a manually resolved candidate", () => {
      const root = createRepository();
      commit(root, "shared.txt", "initial\n", "initial");
      git(root, "switch", "--create", "pull-request");
      const headSha = commit(root, "shared.txt", "head\n", "head");
      git(root, "switch", "trunk");
      const baseSha = commit(root, "shared.txt", "base\n", "base");
      const tree = git(root, "rev-parse", `${headSha}^{tree}`);
      const candidateSha = git(
        root,
        "commit-tree",
        tree,
        "-p",
        baseSha,
        "-p",
        headSha,
        "-m",
        "resolved",
      );

      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha, headSha, candidateSha },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "VERIFICATION_CANDIDATE_MERGE_TREE_READ_FAILED",
          category: "input",
          message: expect.stringContaining(`base ${baseSha} and head ${headSha}`),
        }),
      );
    });

    it("rejects a recorded candidate whose base parent is outside the default branch", () => {
      const { root, baseSha, headSha } = createPullRequestCandidate();
      git(root, "switch", "--create", "side", baseSha);
      const sideSha = commit(root, "side.txt", "side\n", "side");
      const candidateSha = mergeCandidate(root, sideSha, headSha);

      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha: sideSha, headSha, candidateSha },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "VERIFICATION_CANDIDATE_BASE_NOT_IN_DEFAULT_BRANCH",
          category: "contract",
        }),
      );
    });

    it("reports a read failure instead of a non-ancestor verdict when the default branch check errors", () => {
      const { root, baseSha, headSha } = createPullRequestCandidate();
      git(root, "switch", "--create", "side", baseSha);
      const sideSha = commit(root, "side.txt", "side\n", "side");
      const candidateSha = mergeCandidate(root, sideSha, headSha);

      const realGitPath = execFileSync("bash", ["-c", "command -v git"], {
        encoding: "utf8",
      }).trim();
      const stubDir = temporaryDirectory();
      const gitStubPath = join(stubDir, "git");
      writeFileSync(
        gitStubPath,
        [
          "#!/usr/bin/env bash",
          'if [ "$1" = "merge-base" ] && [ "$2" = "--is-ancestor" ]; then',
          '  echo "fatal: simulated ancestry read failure" >&2',
          "  exit 128",
          "fi",
          `exec "${realGitPath}" "$@"`,
          "",
        ].join("\n"),
      );
      chmodSync(gitStubPath, 0o755);

      const originalPath = process.env.PATH;
      process.env.PATH = `${stubDir}:${originalPath ?? ""}`;
      try {
        expect(() =>
          verifyRecordedRun({
            root,
            eventName: "pull_request",
            runHeadSha: headSha,
            recorded: { baseSha: sideSha, headSha, candidateSha },
          }),
        ).toThrow(
          expect.objectContaining({
            code: "VERIFICATION_CANDIDATE_BASE_ANCESTRY_READ_FAILED",
            category: "input",
          }),
        );
      } finally {
        process.env.PATH = originalPath;
      }
    });

    it("rejects a recorded base or head that differs from the candidate parents and run head", () => {
      const { root, eventBaseSha, candidateBaseSha, headSha, candidateSha } =
        createPullRequestCandidateAfterBaseAdvance();

      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha: eventBaseSha, headSha, candidateSha },
        }),
      ).toThrow(expect.objectContaining({ code: "RECORDED_VERIFICATION_BASE_MISMATCH" }));
      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha: candidateBaseSha, headSha: eventBaseSha, candidateSha },
        }),
      ).toThrow(expect.objectContaining({ code: "RECORDED_VERIFICATION_HEAD_MISMATCH" }));
    });

    it("rejects a push run whose recorded candidate is not the source run head", () => {
      const root = createRepository();
      const previousSha = commit(root, "previous.txt", "previous\n", "previous");
      const headSha = commit(root, "head.txt", "head\n", "head");

      expect(() =>
        verifyRecordedRun({
          root,
          eventName: "push",
          runHeadSha: headSha,
          recorded: { baseSha: previousSha, headSha: previousSha, candidateSha: previousSha },
        }),
      ).toThrow(expect.objectContaining({ code: "RECORDED_VERIFICATION_CANDIDATE_MISMATCH" }));
    });

    it("uses the head and its first parent for a dispatch run on an open pull-request branch", () => {
      const { root, headSha: firstHeadSha } = createPullRequestCandidate();
      git(root, "switch", "pull-request");
      const headSha = commit(root, "second.txt", "second\n", "second");

      expect(
        verifyRecordedRun({
          root,
          eventName: "workflow_dispatch",
          runHeadSha: headSha,
          recorded: { baseSha: firstHeadSha, headSha, candidateSha: headSha },
        }),
      ).toEqual({
        schemaVersion: "croco.ci-verification-identity/v1",
        eventName: "workflow_dispatch",
        baseSha: firstHeadSha,
        headSha,
        candidateSha: headSha,
      });
    });

    it("uses the head first parent instead of the recorded push base for a push run", () => {
      const root = createRepository();
      const beforeSha = commit(root, "before.txt", "before\n", "before");
      const parentSha = commit(root, "parent.txt", "parent\n", "parent");
      const headSha = commit(root, "head.txt", "head\n", "head");

      expect(
        verifyRecordedRun({
          root,
          eventName: "push",
          runHeadSha: headSha,
          recorded: { baseSha: beforeSha, headSha, candidateSha: headSha },
        }),
      ).toEqual({
        schemaVersion: "croco.ci-verification-identity/v1",
        eventName: "push",
        baseSha: parentSha,
        headSha,
        candidateSha: headSha,
      });
    });

    it("recovers merge candidate parents in a depth-one clone only after the tree-less unshallow fetch", () => {
      const { root: origin, baseSha, headSha, candidateSha } = createPullRequestCandidate();
      git(origin, "switch", "trunk");
      commit(origin, "later.txt", "later\n", "advance trunk after the run");
      git(origin, "config", "uploadpack.allowFilter", "true");
      const verifyClone = (clone: string) =>
        verifyRecordedRun({
          root: clone,
          eventName: "pull_request",
          runHeadSha: headSha,
          recorded: { baseSha, headSha, candidateSha },
          defaultBranchRef: "refs/remotes/origin/trunk",
        });

      const unfetchedClone = shallowClone(origin);
      expect(() => verifyClone(unfetchedClone)).toThrow(
        expect.objectContaining({ code: "VERIFICATION_IDENTITY_COMMIT_MISSING" }),
      );
      git(unfetchedClone, "fetch", "--no-tags", "--depth=1", "origin", candidateSha);
      expect(() => verifyClone(unfetchedClone)).toThrow(
        expect.objectContaining({ code: "VERIFICATION_CANDIDATE_PARENT_COUNT_MISMATCH" }),
      );

      const fetchedClone = shallowClone(origin);
      git(
        fetchedClone,
        "fetch",
        "--no-tags",
        "--filter=tree:0",
        "--unshallow",
        "origin",
        candidateSha,
        "trunk",
      );
      expect(verifyClone(fetchedClone)).toMatchObject({ baseSha, headSha, candidateSha });
      expect(git(fetchedClone, "diff", "--name-only", baseSha, candidateSha)).toBe("head.txt");
    });

    it("writes the re-verified identity from the verify-recorded command", () => {
      const { root, baseSha, headSha, candidateSha } = createPullRequestCandidate();
      const expected = {
        schemaVersion: "croco.ci-verification-identity/v1",
        eventName: "pull_request",
        baseSha,
        headSha,
        candidateSha,
      };

      const stdout = execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          IDENTITY_SCRIPT,
          "verify-recorded",
          "--root",
          root,
          "--event",
          "pull_request",
          "--event-base",
          baseSha,
          "--event-head",
          headSha,
          "--candidate",
          candidateSha,
          "--checkout",
          candidateSha,
          "--recorded-base",
          baseSha,
          "--recorded-head",
          headSha,
          "--recorded-candidate",
          candidateSha,
          "--default-branch",
          "trunk",
          "--output",
          "verification-identity.json",
        ],
        { encoding: "utf8" },
      );

      expect(JSON.parse(stdout)).toEqual(expected);
      expect(JSON.parse(readFileSync(join(root, "verification-identity.json"), "utf8"))).toEqual(
        expected,
      );
    });
  });
});
