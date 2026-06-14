import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, exit, stdout } from "node:process";

type BumpType = "major" | "minor" | "patch";

type ParsedCommit = {
  readonly hash: string;
  readonly subject: string;
  readonly type: string | null;
  readonly scope: string | null;
  readonly isBreaking: boolean;
  readonly body: string;
};

const changesetDirectory = resolve(process.cwd(), ".changeset");
const conventionalCommitPattern =
  /^(feat|fix|chore|docs|refactor|perf|test|style|build|ci|revert)(\(.+\))?(!)?:\s/;
const bumpRank: Record<BumpType, number> = {
  patch: 0,
  minor: 1,
  major: 2,
};

function log(message: string): void {
  stdout.write(`${message}\n`);
}

function runGit(args: readonly string[]): string {
  const result = spawnSync("git", [...args], { encoding: "utf-8" });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function hasExistingChangeset(): boolean {
  if (!existsSync(changesetDirectory)) {
    return false;
  }

  return readdirSync(changesetDirectory).some(
    (file) => file.endsWith(".md") && file !== "README.md",
  );
}

function getCommitHashes(): string[] {
  const output = runGit(["rev-list", "trunk..HEAD"]);
  return output.split("\n").filter(Boolean);
}

function parseCommitBlock(block: string): ParsedCommit | null {
  const [hash, subject = "", ...bodyLines] = block.trim().split("\n");

  if (!hash) {
    return null;
  }

  const body = bodyLines.join("\n").trim();
  const match = subject.match(conventionalCommitPattern);
  const type = match?.[1] ?? null;
  const scope = match?.[2] ? match[2].slice(1, -1) : null;
  const isBreaking = match?.[3] === "!" || /^(BREAKING CHANGE|BREAKING-CHANGE):/m.test(body);

  return {
    hash,
    subject,
    type,
    scope,
    isBreaking,
    body,
  };
}

function getParsedCommits(hashes: readonly string[]): ParsedCommit[] {
  if (hashes.length === 0) {
    return [];
  }

  const output = runGit(["log", "--no-walk", "--format=%H%n%s%n%b===END===", ...hashes]);

  return output
    .split("===END===")
    .map(parseCommitBlock)
    .filter((commit): commit is ParsedCommit => commit !== null);
}

function getCommitBump(commit: ParsedCommit): BumpType {
  if (commit.isBreaking) {
    return "major";
  }

  if (commit.type === "feat") {
    return "minor";
  }

  return "patch";
}

function determineBumpType(commits: readonly ParsedCommit[]): BumpType {
  let highest: BumpType = "patch";

  for (const commit of commits) {
    const bump = getCommitBump(commit);

    if (bump === "major") {
      return "major";
    }

    if (bumpRank[bump] > bumpRank[highest]) {
      highest = bump;
    }
  }

  return highest;
}

function formatChangeset(bump: BumpType, commits: readonly ParsedCommit[]): string {
  const entries = commits.map((commit) => `- ${commit.subject}`);

  return [
    "---",
    `'@croco/framework-context': ${bump}`,
    `'create-croco-app': ${bump}`,
    "---",
    "",
    ...entries,
    "",
  ].join("\n");
}

function createChangeset(commits: readonly ParsedCommit[]): string {
  const bump = determineBumpType(commits);
  const filename = `${randomBytes(4).toString("hex")}.md`;
  const changesetPath = resolve(changesetDirectory, filename);

  writeFileSync(changesetPath, formatChangeset(bump, commits), "utf-8");

  return changesetPath;
}

function stageAndCommit(changesetPath: string): void {
  runGit(["add", changesetPath]);
  runGit(["commit", "--no-verify", "-m", "chore: add changeset [skip ci]"]);
}

function main(): void {
  try {
    const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);

    if (env.GITHUB_ACTIONS === "true") {
      log("auto-changeset: GitHub Actions environment detected (skipping)");
      exit(0);
    }

    if (branch === "trunk") {
      log("auto-changeset: on trunk branch (skipping)");
      exit(0);
    }

    if (branch.startsWith("changeset-release/")) {
      log("auto-changeset: on changeset release branch (skipping)");
      exit(0);
    }

    if (hasExistingChangeset()) {
      log("auto-changeset: existing changeset found (skipping)");
      exit(0);
    }

    const hashes = getCommitHashes();
    const commits = getParsedCommits(hashes);

    if (commits.length === 0) {
      log("auto-changeset: no commits found (skipping)");
      exit(0);
    }

    const changesetPath = createChangeset(commits);
    stageAndCommit(changesetPath);
    log(`auto-changeset: created and committed ${changesetPath}`);
    log("auto-changeset: push aborted — run 'git push' again to include the changeset");
    exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`auto-changeset: failed: ${message}`);
    exit(1);
  }
}

main();
