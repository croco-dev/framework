import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { stdin, stdout, exit } from "node:process";

type BumpType = "major" | "minor" | "patch";

type PushRef = {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
};

type ParsedCommit = {
  readonly hash: string;
  readonly subject: string;
  readonly type: string | null;
  readonly scope: string | null;
  readonly isBreaking: boolean;
  readonly body: string;
};

const changesetDirectory = resolve(process.cwd(), ".changeset");
const conventionalCommitPattern = /^(feat|fix|chore|docs|refactor|perf|test|style|build|ci|revert)(\(.+\))?(!)?:\s/;
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

function parsePushRefs(lines: readonly string[]): PushRef[] {
  return lines.flatMap((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);

    if (!localRef?.startsWith("refs/heads/") || !localSha || !remoteRef || !remoteSha) {
      return [];
    }

    return [{ localRef, localSha, remoteRef, remoteSha }];
  });
}

function hasExistingChangeset(): boolean {
  if (!existsSync(changesetDirectory)) {
    return false;
  }

  return readdirSync(changesetDirectory).some((file) => file.endsWith(".md") && file !== "README.md");
}

function getCommitHashes(refs: readonly PushRef[]): string[] {
  const hashes = new Set<string>();

  for (const ref of refs) {
    const range = /^0+$/.test(ref.remoteSha)
      ? `${runGit(["merge-base", "trunk", ref.localSha])}..${ref.localSha}`
      : `${ref.remoteSha}..${ref.localSha}`;
    const output = runGit(["rev-list", range]);

    for (const hash of output.split("\n").filter(Boolean)) {
      hashes.add(hash);
    }
  }

  return [...hashes];
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
  const entries = commits.map((commit) => `- ${commit.type ?? "commit"}: ${commit.subject}`);

  return [
    "---",
    `  '@croco/*': ${bump}`,
    `  'create-croco-app': ${bump}`,
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

function main(lines: readonly string[]): void {
  try {
    const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);

    if (branch === "trunk") {
      log("auto-changeset: on trunk branch (skipping)");
      exit(0);
    }

    if (hasExistingChangeset()) {
      log("auto-changeset: existing changeset found (skipping)");
      exit(0);
    }

    const refs = parsePushRefs(lines);
    const hashes = getCommitHashes(refs);
    const commits = getParsedCommits(hashes);

    if (commits.length === 0) {
      log("auto-changeset: no commits found (skipping)");
      exit(0);
    }

    const changesetPath = createChangeset(commits);
    stageAndCommit(changesetPath);
    log(`auto-changeset: created and committed ${changesetPath}`);
    exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`auto-changeset: ${message}`);
    exit(0);
  }
}

const lines: string[] = [];
const reader = createInterface({ input: stdin });

reader.on("line", (line) => {
  lines.push(line);
});

reader.on("close", () => {
  main(lines);
});
