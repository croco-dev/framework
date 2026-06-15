import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../verify-circular-allowlist.mts");
const tempRepos: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("verify-circular-allowlist.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("passes when detected cycle identities match the allowlist", () => {
    const repo = createTempRepo();
    writeFixture(repo, {
      allowlist: [
        "# Circular Dependency Allowlist",
        "packages/b/src/index.ts > packages/c/src/index.ts > packages/a/src/index.ts",
        "",
      ].join("\n"),
      madgeCycles: [
        ["packages/a/src/index.ts", "packages/b/src/index.ts", "packages/c/src/index.ts"],
      ],
    });

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "circular-allowlist: passed (1 detected cycles match allowlist).",
    );
  });

  it("fails when a new detected cycle is not allowlisted", () => {
    const repo = createTempRepo();
    writeFixture(repo, {
      allowlist: "packages/a/src/index.ts > packages/b/src/index.ts\n",
      madgeCycles: [
        ["packages/a/src/index.ts", "packages/b/src/index.ts"],
        ["packages/c/src/index.ts", "packages/d/src/index.ts"],
      ],
    });

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("New circular dependencies:");
    expect(result.stdout).toContain("packages/c/src/index.ts > packages/d/src/index.ts");
  });

  it("fails when a different cycle replaces an allowlisted cycle with the same count", () => {
    const repo = createTempRepo();
    writeFixture(repo, {
      allowlist: "packages/a/src/index.ts > packages/b/src/index.ts\n",
      madgeCycles: [["packages/c/src/index.ts", "packages/d/src/index.ts"]],
    });

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("New circular dependencies:");
    expect(result.stdout).toContain("packages/c/src/index.ts > packages/d/src/index.ts");
    expect(result.stdout).toContain("Stale allowlist entries:");
    expect(result.stdout).toContain("packages/a/src/index.ts > packages/b/src/index.ts");
  });

  it("fails when the allowlist contains a stale entry", () => {
    const repo = createTempRepo();
    writeFixture(repo, {
      allowlist: [
        "packages/a/src/index.ts > packages/b/src/index.ts",
        "packages/c/src/index.ts > packages/d/src/index.ts",
        "",
      ].join("\n"),
      madgeCycles: [["packages/a/src/index.ts", "packages/b/src/index.ts"]],
    });

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Stale allowlist entries:");
    expect(result.stdout).toContain("packages/c/src/index.ts > packages/d/src/index.ts");
  });

  it("passes when no cycles are detected and the allowlist has no entries", () => {
    const repo = createTempRepo();
    writeFixture(repo, {
      allowlist: "# Circular Dependency Allowlist\n\n",
      madgeCycles: [],
    });

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "circular-allowlist: passed (0 detected cycles match allowlist).",
    );
  });

  it("fails when an allowlist line does not use the documented cycle format", () => {
    const repo = createTempRepo();
    writeFixture(repo, {
      allowlist: "packages/a/src/index.ts\n",
      madgeCycles: [],
    });

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Invalid allowlist entries:");
    expect(result.stdout).toContain('must contain at least two paths separated by " > "');
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-circular-allowlist-"));
  tempRepos.push(repo);
  return repo;
}

function writeFixture(
  repo: string,
  fixture: {
    readonly allowlist: string;
    readonly madgeCycles: readonly (readonly string[])[];
  },
): void {
  writeFile(repo, ".madge-circular-allowlist.txt", fixture.allowlist);
  writeFile(repo, "madge-cycles.json", `${JSON.stringify(fixture.madgeCycles, null, 2)}\n`);
}

function writeFile(repo: string, fileName: string, content: string): void {
  const filePath = join(repo, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runScript(repo: string): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, "--root", repo, "--madge-json", "madge-cycles.json"],
    {
      encoding: "utf-8",
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
