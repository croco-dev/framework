import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runArchitecturePolicyCheck } from "../commands/architecturePolicy.js";

const tempRepos: string[] = [];

describe("architecturePolicyCheck", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("prints deterministic JSON failures", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runArchitecturePolicyCheck(["--manifest", "croco.arch.json", "--json"], {
      io: {
        cwd: "/workspace/app",
        readFile: () =>
          JSON.stringify({
            schemaVersion: "croco.architecture-policy/v1",
            packageRoots: ["packages"],
            include: ["packages/*/src/**/*.ts"],
            packageGroups: {
              framework: { packages: ["@croco/*-core"] },
            },
            rules: {
              forbiddenImports: [
                {
                  id: "core-to-drizzle",
                  from: { groups: ["framework"] },
                  to: { specifiers: ["drizzle-orm", "drizzle-orm/*"] },
                },
              ],
            },
          }),
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message),
      },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      status: "pass",
      packageCount: 0,
      diagnostics: [],
    });
  });

  it("prints text failures with evidence and recovery", async () => {
    const repo = createTempRepo();
    const stdout: string[] = [];
    writeFile(
      repo,
      "croco.arch.json",
      `${JSON.stringify(
        {
          schemaVersion: "croco.architecture-policy/v1",
          packageRoots: ["packages"],
          include: ["packages/*/src/**/*.ts"],
          packageGroups: {
            framework: { packages: ["@croco/*-core"] },
          },
          rules: {
            forbiddenImports: [
              {
                id: "core-to-provider",
                from: { groups: ["framework"] },
                to: { specifiers: ["drizzle-orm"] },
                recovery: "Move provider code out of core packages.",
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFile(
      repo,
      "packages/repository-core/package.json",
      `${JSON.stringify({ name: "@croco/repository-core" }, null, 2)}\n`,
    );
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      'import { drizzle } from "drizzle-orm";\nexport const value = drizzle;\n',
    );

    const exitCode = await runArchitecturePolicyCheck(["croco.arch.json"], {
      io: {
        cwd: repo,
        stdout: (message) => stdout.push(message),
      },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([
      expect.stringContaining(
        "ERROR architecture-policy/forbidden-import packages/repository-core/src/index.ts:1:26",
      ),
      "  action: Move provider code out of core packages.",
      '  evidence: import { drizzle } from "drizzle-orm";',
      "Architecture policy check failed with 1 error(s).",
    ]);
  });

  it("reports missing manifests as usage errors", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runArchitecturePolicyCheck([], {
      io: {
        cwd: "/workspace/app",
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message),
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(["Missing architecture policy manifest. Pass --manifest <path>."]);
    expect(stdout[0]).toContain("Usage: croco architecture-policy check");
  });

  it("does not treat --root values as positional manifests", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runArchitecturePolicyCheck(["--root", "/workspace/app"], {
      io: {
        cwd: "/workspace",
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message),
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(["Missing architecture policy manifest. Pass --manifest <path>."]);
    expect(stdout[0]).toContain("Usage: croco architecture-policy check");
  });

  it("does not treat duplicate --root values as positional manifests", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runArchitecturePolicyCheck(
      ["--root", "/workspace/first", "--root", "/workspace/second"],
      {
        io: {
          cwd: "/workspace",
          stdout: (message) => stdout.push(message),
          stderr: (message) => stderr.push(message),
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(["Missing architecture policy manifest. Pass --manifest <path>."]);
    expect(stdout[0]).toContain("Usage: croco architecture-policy check");
  });

  it("preserves Windows absolute paths", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const readPaths: string[] = [];

    const exitCode = await runArchitecturePolicyCheck(
      [
        "--manifest",
        "C:\\workspace\\app\\croco.arch.json",
        "--root",
        "C:\\workspace\\app",
        "--json",
      ],
      {
        io: {
          cwd: "/workspace",
          readFile: (path) => {
            readPaths.push(path);
            return JSON.stringify({
              schemaVersion: "croco.architecture-policy/v1",
              packageRoots: [],
              include: ["packages/*/src/**/*.ts"],
              rules: {},
            });
          },
          stdout: (message) => stdout.push(message),
          stderr: (message) => stderr.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(readPaths).toEqual(["C:\\workspace\\app\\croco.arch.json"]);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      packageCount: 0,
      status: "pass",
    });
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-cli-architecture-policy-"));
  tempRepos.push(repo);
  return repo;
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}
