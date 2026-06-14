import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../auto-changeset.mts");
const nullSha = "0000000000000000000000000000000000000000";
const tempRepos: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("auto-changeset.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("skips when current branch is trunk", () => {
    const repo = createTempRepo();
    const head = git(repo, ["rev-parse", "HEAD"]);
    const result = runScript(`refs/heads/trunk ${head} refs/heads/trunk ${nullSha}\n`, repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("auto-changeset: on trunk branch (skipping)");
    expect(listChangesets(repo)).toEqual([]);
  });

  it("skips in GitHub Actions", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/ci-skip");
    commitFile(repo, "feature.txt", "feature", "feat: add checkout flow");

    const result = runScript(
      newBranchStdin("feature/ci-skip", git(repo, ["rev-parse", "HEAD"])),
      repo,
      { GITHUB_ACTIONS: "true" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "auto-changeset: GitHub Actions environment detected (skipping)",
    );
    expect(listChangesets(repo)).toEqual([]);
  });

  it("skips changeset release branches", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "changeset-release/trunk");
    commitFile(repo, "version.txt", "version", "chore: version packages");

    const result = runScript(
      newBranchStdin("changeset-release/trunk", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("auto-changeset: on changeset release branch (skipping)");
    expect(listChangesets(repo)).toEqual([]);
  });

  it("skips when a feature branch has no commits ahead of trunk", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/no-commits");

    const result = runScript(
      newBranchStdin("feature/no-commits", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("auto-changeset: no commits found (skipping)");
    expect(listChangesets(repo)).toEqual([]);
  });

  it("detects feat commit → minor bump", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/minor");
    commitFile(repo, "feature.txt", "feature", "feat: add checkout flow");

    const result = runScript(
      newBranchStdin("feature/minor", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: created and committed");
    expect(result.stdout).toContain(
      "auto-changeset: push aborted — run 'git push' again to include the changeset",
    );
    expect(readOnlyChangeset(repo)).toContain("'@croco/framework-context': minor");
    expect(git(repo, ["log", "-1", "--format=%s"])).toBe("chore: add changeset [skip ci]");
  });

  it("detects fix commit → patch bump", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/patch");
    commitFile(repo, "fix.txt", "fix", "fix: handle payment timeout");

    const result = runScript(newBranchStdin("fix/patch", git(repo, ["rev-parse", "HEAD"])), repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: created and committed");
    expect(result.stdout).toContain(
      "auto-changeset: push aborted — run 'git push' again to include the changeset",
    );
    expect(readOnlyChangeset(repo)).toContain("'@croco/framework-context': patch");
  });

  it("detects feat! → major bump (BREAKING CHANGE from title)", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/breaking-title");
    commitFile(repo, "breaking-title.txt", "breaking", "feat!: replace public API");

    const result = runScript(
      newBranchStdin("feature/breaking-title", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: created and committed");
    expect(result.stdout).toContain(
      "auto-changeset: push aborted — run 'git push' again to include the changeset",
    );
    expect(readOnlyChangeset(repo)).toContain("'@croco/framework-context': major");
  });

  it("detects BREAKING CHANGE from body footer → major bump", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/breaking-body");
    commitFile(
      repo,
      "breaking-body.txt",
      "breaking",
      "feat: update runtime",
      "BREAKING CHANGE: runtime options changed",
    );

    const result = runScript(
      newBranchStdin("feature/breaking-body", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: created and committed");
    expect(result.stdout).toContain(
      "auto-changeset: push aborted — run 'git push' again to include the changeset",
    );
    expect(readOnlyChangeset(repo)).toContain("'@croco/framework-context': major");
  });

  it("skips when changeset already exists", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/existing-changeset");
    writeFileSync(join(repo, ".changeset", "existing.md"), "---\n---\n\nExisting changeset\n");
    git(repo, ["add", ".changeset/existing.md"]);
    git(repo, ["commit", "-m", "chore: add existing changeset"]);
    commitFile(repo, "feature.txt", "feature", "feat: add billing flow");

    const result = runScript(
      newBranchStdin("feature/existing-changeset", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("auto-changeset: existing changeset found (skipping)");
    expect(listChangesets(repo)).toEqual(["existing.md"]);
  });

  it("chooses minor over patch when both feat and fix present", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/mixed");
    commitFile(repo, "fix.txt", "fix", "fix: handle empty cart");
    commitFile(repo, "feature.txt", "feature", "feat: add cart summary");

    const result = runScript(
      newBranchStdin("feature/mixed", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: created and committed");
    expect(result.stdout).toContain(
      "auto-changeset: push aborted — run 'git push' again to include the changeset",
    );
    expect(readOnlyChangeset(repo)).toContain("'@croco/framework-context': minor");
  });

  it("fails when git inspection fails unexpectedly", () => {
    const repo = mkdtempSync(join(tmpdir(), "croco-auto-changeset-not-git-"));
    tempRepos.push(repo);

    const result = runScript("", repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: failed:");
    expect(result.stdout).toContain("not a git repository");
  });

  it("fails when the changeset cannot be written", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/write-failure");
    commitFile(repo, "feature.txt", "feature", "feat: add checkout flow");
    rmSync(join(repo, ".changeset"), { force: true, recursive: true });

    const result = runScript(
      newBranchStdin("feature/write-failure", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: failed:");
    expect(result.stdout).toContain(".changeset");
    expect(git(repo, ["log", "-1", "--format=%s"])).toBe("feat: add checkout flow");
  });

  it("fails when the generated changeset cannot be committed", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/commit-failure");
    commitFile(repo, "feature.txt", "feature", "feat: add checkout flow");
    const hooksPath = join(repo, "hooks");
    const prepareCommitMessageHook = join(hooksPath, "prepare-commit-msg");
    mkdirSync(hooksPath);
    writeFileSync(
      prepareCommitMessageHook,
      "#!/bin/sh\necho prepare-commit-msg hook failed >&2\nexit 1\n",
    );
    chmodSync(prepareCommitMessageHook, 0o755);
    git(repo, ["config", "core.hooksPath", hooksPath]);

    const result = runScript(
      newBranchStdin("feature/commit-failure", git(repo, ["rev-parse", "HEAD"])),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("auto-changeset: failed:");
    expect(result.stdout).toContain("prepare-commit-msg hook failed");
    expect(git(repo, ["log", "-1", "--format=%s"])).toBe("feat: add checkout flow");
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-auto-changeset-"));
  tempRepos.push(repo);

  git(repo, ["init", "--initial-branch=trunk"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test User"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  git(repo, ["config", "tag.gpgsign", "false"]);
  git(repo, ["config", "core.hooksPath", "/dev/null"]);
  git(repo, ["config", "advice.detachedHead", "false"]);
  writeFileSync(join(repo, "README.md"), "# Test repo\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "chore: initial commit"]);
  mkdirSync(join(repo, ".changeset"));

  return repo;
}

function checkoutBranch(repo: string, branch: string): void {
  git(repo, ["checkout", "-b", branch]);
}

function commitFile(
  repo: string,
  fileName: string,
  content: string,
  subject: string,
  body?: string,
): void {
  writeFileSync(join(repo, fileName), `${content}\n`);
  git(repo, ["add", fileName]);

  if (body) {
    git(repo, ["commit", "-m", subject, "-m", body]);
    return;
  }

  git(repo, ["commit", "-m", subject]);
}

function runScript(
  stdin: string,
  cwd: string,
  scriptEnv: Record<string, string> = {},
): ScriptResult {
  const { CI: _ci, GITHUB_ACTIONS: _githubActions, ...baseEnv } = process.env;
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath], {
    cwd,
    encoding: "utf-8",
    env: {
      ...baseEnv,
      ...scriptEnv,
    },
    input: stdin,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function newBranchStdin(branch: string, localSha: string): string {
  return `refs/heads/${branch} ${localSha} refs/heads/${branch} ${nullSha}\n`;
}

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", [...args], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2024-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2024-01-01T00:00:00Z",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function listChangesets(repo: string): string[] {
  return git(repo, ["ls-files", ".changeset/*.md"])
    .split("\n")
    .filter(Boolean)
    .map((file) => file.replace(".changeset/", ""));
}

function readOnlyChangeset(repo: string): string {
  const changesets = listChangesets(repo);
  expect(changesets).toHaveLength(1);

  return git(repo, ["show", `HEAD:.changeset/${changesets[0]}`]);
}
