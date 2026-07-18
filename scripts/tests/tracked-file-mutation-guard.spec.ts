import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TRACKED_FILE_MUTATION_EXIT_CODE } from "../tracked-file-mutation-guard.mts";

const script = resolve(__dirname, "../tracked-file-mutation-guard.mts");
const repositories: string[] = [];

describe("tracked-file-mutation-guard", () => {
  afterEach(() => {
    for (const repository of repositories.splice(0))
      rmSync(repository, { force: true, recursive: true });
  });
  it("rejects malformed invocation without running a command", () => {
    const repo = createRepository();
    const result = spawnSync(process.execPath, ["--experimental-strip-types", script], {
      cwd: repo,
      encoding: "utf8",
    });

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("Usage: tracked-files:guard");
    expect(status(repo)).toBe("");
  });
  it("preserves success and ordinary failure without mutation", () => {
    const repo = createRepository();
    expect(run(repo, ["node", "-e", "process.exit(0)"]).status).toBe(0);
    expect(run(repo, ["node", "-e", "process.exit(23)"]).status).toBe(23);
  });
  it("detects rewrite and reports recovery", () => {
    const repo = createRepository();
    const result = run(repo, [
      "node",
      "-e",
      "require('fs').writeFileSync('tracked.txt','changed')",
    ]);
    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("rewritten: tracked.txt");
    expect(result.stderr).toContain("pnpm fixture:write");
    expect(result.stderr).toContain("restored the tracked worktree and index baseline");
    expect(readFileSync(join(repo, "tracked.txt"), "utf8")).toBe("original");
    expect(status(repo)).toBe("");
  });
  it("reports command failure alongside mutation", () => {
    const result = run(createRepository(), [
      "node",
      "-e",
      "require('fs').writeFileSync('tracked.txt','changed');process.exit(19)",
    ]);
    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("wrapped command exit code: 19");
  });
  it("does not trust success output when the command mutates tracked state", () => {
    const repo = createRepository();
    const result = run(repo, [
      "node",
      "-e",
      "console.log('SUCCESS');require('fs').writeFileSync('tracked.txt','changed')",
    ]);

    expect(result.stdout).toContain("SUCCESS");
    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(status(repo)).toBe("");
  });
  it("detects deletion and executable mode changes", () => {
    expect(
      run(createRepository(), ["node", "-e", "require('fs').unlinkSync('tracked.txt')"]).stderr,
    ).toContain("deleted: tracked.txt");
    expect(
      run(createRepository(), ["node", "-e", "require('fs').chmodSync('tracked.txt',0o755)"])
        .stderr,
    ).toContain("mode-changed: tracked.txt");
  });
  it("detects index additions and removals", () => {
    const addedRepo = createRepository();
    expect(
      run(addedRepo, [
        "node",
        "-e",
        "require('fs').writeFileSync('added.txt','new');require('child_process').spawnSync('git',['add','added.txt'])",
      ]).stderr,
    ).toContain("added: added.txt");
    expect(status(addedRepo)).toBe("?? added.txt");
    const removedRepo = createRepository();
    expect(run(removedRepo, ["git", "rm", "--cached", "tracked.txt"]).stderr).toContain(
      "deleted: tracked.txt",
    );
    expect(status(removedRepo)).toBe("");
  });
  it("detects and restores index-only staging of pre-existing worktree changes", () => {
    const repo = createRepository();
    writeFileSync(join(repo, "tracked.txt"), "already changed");
    const before = status(repo);

    const result = run(repo, ["git", "add", "tracked.txt"]);

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("rewritten: tracked.txt");
    expect(status(repo)).toBe(before);
  });
  it("preserves a pre-existing untracked file when the command stages it", () => {
    const repo = createRepository();
    writeFileSync(join(repo, "report.txt"), "keep me");

    const result = run(repo, ["git", "add", "report.txt"]);

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(readFileSync(join(repo, "report.txt"), "utf8")).toBe("keep me");
    expect(status(repo)).toBe("?? report.txt");
  });
  it("preserves a pre-existing ignored file when the command force-stages it", () => {
    const repo = createRepository();
    writeFileSync(join(repo, ".gitignore"), "ignored/\n");
    git(repo, ["add", ".gitignore"]);
    git(repo, ["commit", "-m", "ignore"]);
    mkdirSync(join(repo, "ignored"));
    writeFileSync(join(repo, "ignored/cache.txt"), "keep me");

    const result = run(repo, ["git", "add", "-f", "ignored/cache.txt"]);

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(readFileSync(join(repo, "ignored/cache.txt"), "utf8")).toBe("keep me");
    expect(status(repo)).toBe("");
  });
  it("restores a tracked file replaced by a directory", () => {
    const repo = createRepository();
    const result = run(repo, [
      "node",
      "-e",
      "const fs=require('fs');fs.unlinkSync('tracked.txt');fs.mkdirSync('tracked.txt');fs.writeFileSync('tracked.txt/child','x')",
    ]);

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(readFileSync(join(repo, "tracked.txt"), "utf8")).toBe("original");
    expect(status(repo)).toBe("");
  });
  it("restores a corrupted index before returning", () => {
    const repo = createRepository();
    const result = run(repo, [
      "node",
      "-e",
      "const fs=require('fs'),cp=require('child_process');const p=cp.execFileSync('git',['rev-parse','--git-path','index'],{encoding:'utf8'}).trim();fs.writeFileSync(p,'bad')",
    ]);

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("final snapshot failed");
    expect(result.stderr).toContain("restored the tracked worktree and index baseline");
    expect(status(repo)).toBe("");
  });
  it("detects and restores tracked symlink target changes", () => {
    const repo = createRepository();
    symlinkSync("tracked.txt", join(repo, "link.txt"));
    git(repo, ["add", "link.txt"]);
    git(repo, ["commit", "-m", "link"]);

    const result = run(repo, [
      "node",
      "-e",
      "require('fs').unlinkSync('link.txt');require('fs').symlinkSync('other.txt','link.txt')",
    ]);

    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("rewritten: link.txt");
    expect(readlinkSync(join(repo, "link.txt"))).toBe("tracked.txt");
    expect(status(repo)).toBe("");
  });
  it("allows untracked and ignored output and pre-existing tracked changes", () => {
    const repo = createRepository();
    writeFileSync(join(repo, ".gitignore"), "ignored/\n");
    git(repo, ["add", ".gitignore"]);
    git(repo, ["commit", "-m", "ignore"]);
    expect(
      run(repo, [
        "node",
        "-e",
        "require('fs').mkdirSync('ignored',{recursive:true});require('fs').writeFileSync('ignored/a','x');require('fs').writeFileSync('report','x')",
      ]).status,
    ).toBe(0);
    writeFileSync(join(repo, "tracked.txt"), "already changed");
    expect(run(repo, ["node", "-e", "process.exit(0)"]).status).toBe(0);
  });
  it("re-emits signals unless mutation takes precedence", () => {
    expect(
      run(createRepository(), ["node", "-e", "process.kill(process.pid,'SIGTERM')"]).signal,
    ).toBe("SIGTERM");
    const result = run(createRepository(), [
      "node",
      "-e",
      "require('fs').writeFileSync('tracked.txt','changed');process.kill(process.pid,'SIGTERM')",
    ]);
    expect(result.status).toBe(TRACKED_FILE_MUTATION_EXIT_CODE);
    expect(result.stderr).toContain("wrapped command terminated by signal: SIGTERM");
  });
});

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), "tracked-file-guard-"));
  repositories.push(repo);
  git(repo, ["init", "--quiet"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test"]);
  writeFileSync(join(repo, "tracked.txt"), "original");
  chmodSync(join(repo, "tracked.txt"), 0o644);
  git(repo, ["add", "tracked.txt"]);
  git(repo, ["commit", "-m", "initial"]);
  return repo;
}
function run(repo: string, command: string[]) {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", script, "--recovery", "pnpm fixture:write", "--", ...command],
    { cwd: repo, encoding: "utf8" },
  );
}
function git(repo: string, args: string[]) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}
function status(repo: string): string {
  return spawnSync("git", ["status", "--short"], { cwd: repo, encoding: "utf8" }).stdout.trim();
}
