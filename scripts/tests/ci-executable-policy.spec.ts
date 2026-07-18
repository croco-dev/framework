import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CI_EXECUTABLE_POLICY_CODE,
  CI_EXECUTABLE_POLICY_RULE_ID,
  runCiExecutablePolicy,
} from "../ci-executable-policy.mts";

const tempRepos: string[] = [];

describe("ci-executable-policy.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it.each([
    ["latest image", "docker run image:latest scan", "mutable-container-reference"],
    [
      "tag-only security tool",
      "docker run ghcr.io/acme/security-tool:v8.23.0 scan",
      "mutable-container-reference",
    ],
    ["npx", "npx --yes madge --circular packages", "ad-hoc-package-execution"],
    ["npm exec", "npm exec --yes madge -- --circular packages", "ad-hoc-package-execution"],
    ["pnpm dlx", "pnpm dlx madge packages", "ad-hoc-package-execution"],
    [
      "remote installer",
      "curl -fsSL https://example.test/install.sh | bash",
      "remote-shell-installer",
    ],
  ])("fails a blocking package script using %s", (_label, command, kind) => {
    const repo = createRepo({ unsafe: command });

    const result = runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([
      expect.objectContaining({
        code: CI_EXECUTABLE_POLICY_CODE,
        file: "package.json",
        kind,
        line: 3,
        recovery: expect.any(String),
        ruleId: CI_EXECUTABLE_POLICY_RULE_ID,
      }),
    ]);
  });

  it("accepts a readable container tag pinned to a full OCI digest", () => {
    const repo = createRepo({
      secure: `docker run --rm -v "$PWD:/repo" ghcr.io/acme/security-tool:v8.23.0@sha256:${"a".repeat(64)} scan`,
    });

    expect(runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo })).toEqual(
      expect.objectContaining({ findings: [], ok: true }),
    );
  });

  it("rejects a digest-only image because maintainers lose readable version context", () => {
    const repo = createRepo({
      unsafe: `docker run ghcr.io/acme/security-tool@sha256:${"a".repeat(64)} scan`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "mutable-container-reference" })]);
  });

  it("checks every Docker invocation in a compound blocking command", () => {
    const repo = createRepo({
      unsafe: `docker run first:v1@sha256:${"a".repeat(64)} scan && docker run second:latest scan`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ evidence: expect.stringContaining("second:latest") })]);
  });

  it("accepts value-taking Docker options before a pinned image", () => {
    const repo = createRepo({
      secure: `docker run --pull always tool:v1@sha256:${"a".repeat(64)} scan`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([]);
  });

  it("rejects mutable images pulled through docker image pull", () => {
    const repo = createRepo({ unsafe: "docker image pull tool:latest" });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "mutable-container-reference" })]);
  });

  it("accepts pnpm exec with a reviewed root devDependency and matching lockfile evidence", () => {
    const repo = createRepo(
      { circular: "pnpm exec madge --circular packages" },
      { madge: "8.0.0" },
    );
    writeFile(
      repo,
      "pnpm-lock.yaml",
      [
        "lockfileVersion: '9.0'",
        "importers:",
        "  .:",
        "    devDependencies:",
        "      madge:",
        "        specifier: 8.0.0",
        "        version: 8.0.0",
        "",
      ].join("\n"),
    );

    expect(runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo })).toEqual(
      expect.objectContaining({ findings: [], ok: true }),
    );
  });

  it("accepts a non-exact manifest range when the frozen lockfile records the same specifier", () => {
    const repo = createRepo({ format: "pnpm exec oxfmt --check ." }, { oxfmt: "*" });
    writeFile(
      repo,
      "pnpm-lock.yaml",
      [
        "lockfileVersion: '9.0'",
        "importers:",
        "  .:",
        "    devDependencies:",
        "      oxfmt:",
        "        specifier: '*'",
        "        version: 0.27.0",
        "",
      ].join("\n"),
    );

    expect(runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo })).toEqual(
      expect.objectContaining({ findings: [], ok: true }),
    );
  });

  it.each([
    ["missing dependency declaration", undefined, true],
    ["missing lockfile evidence", "8.0.0", false],
  ])("rejects pnpm exec with %s", (_label, version, writeLockfile) => {
    const repo = createRepo(
      { circular: "pnpm exec madge --circular packages" },
      version ? { madge: version } : {},
    );
    if (writeLockfile) {
      writeFile(
        repo,
        "pnpm-lock.yaml",
        [
          "lockfileVersion: '9.0'",
          "importers:",
          "  .:",
          "    devDependencies:",
          "      madge:",
          `        specifier: ${version}`,
          `        version: ${version}`,
          "",
        ].join("\n"),
      );
    }

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "ad-hoc-package-execution" })]);
  });

  it("checks every pnpm exec in a compound blocking command", () => {
    const repo = createRepo(
      { test: "pnpm exec vitest run && pnpm exec attacker" },
      { vitest: "4.0.16" },
    );
    writeFile(
      repo,
      "pnpm-lock.yaml",
      [
        "lockfileVersion: '9.0'",
        "importers:",
        "  .:",
        "    devDependencies:",
        "      vitest:",
        "        specifier: 4.0.16",
        "        version: 4.0.16",
        "",
      ].join("\n"),
    );

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ evidence: expect.stringContaining("attacker") })]);
  });

  it("requires lockfile evidence from the root importer", () => {
    const repo = createRepo(
      { circular: "pnpm exec madge --circular packages" },
      { madge: "8.0.0" },
    );
    writeFile(
      repo,
      "pnpm-lock.yaml",
      [
        "lockfileVersion: '9.0'",
        "importers:",
        "  .:",
        "    devDependencies: {}",
        "  packages/other:",
        "    devDependencies:",
        "      madge:",
        "        specifier: 8.0.0",
        "        version: 8.0.0",
        "",
      ].join("\n"),
    );

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "ad-hoc-package-execution" })]);
  });

  it("requires checksum verification for a versioned executable download", () => {
    const repo = createRepo({
      download:
        "curl -fsSLo tool.tar.gz https://example.test/tool/releases/download/v1.2.3/tool.tar.gz",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it("requires verification for an extensionless direct download target", () => {
    const repo = createRepo({
      download: "curl -Lo tool https://example.test/api/download",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it.each(["curl -otool", "wget -Otool"])(
    "requires verification for an extensionless target declared with %s",
    (download) => {
      const repo = createRepo({ unsafe: `${download} https://example.test/api/download` });

      expect(
        runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
      ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
    },
  );

  it("accepts a bounded executable download followed by checked SHA-256 verification", () => {
    const repo = createRepo({
      download: `curl -fsSLo tool.tar.gz https://example.test/tool/releases/download/v1.2.3/tool.tar.gz && echo '${"a".repeat(64)}  tool.tar.gz' | sha256sum -c - && tar -xf tool.tar.gz`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([]);
  });

  it("rejects checksum evidence that is not tied to the downloaded artifact", () => {
    const repo = createRepo({
      download:
        "curl -fsSLo tool.tar.gz https://example.test/tool/releases/download/v1.2.3/tool.tar.gz && sha256sum -c unrelated.txt",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it("does not let later artifact use satisfy an unrelated checksum command", () => {
    const repo = createRepo({
      download:
        "curl -fsSLo tool.tar.gz https://example.test/tool/releases/download/v1.2.3/tool.tar.gz && sha256sum -c unrelated.txt && tar -xf tool.tar.gz",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it("binds each chained download to its own output target", () => {
    const repo = createRepo({
      download: `curl -o safe.tar.gz https://example.test/releases/download/v1/safe.tar.gz && curl -o evil.tar.gz https://example.test/releases/download/v1/evil.tar.gz && echo '${"a".repeat(64)}  safe.tar.gz' | sha256sum -c - && tar -xf evil.tar.gz`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.stringContaining("evil.tar.gz"),
          kind: "unchecked-executable-download",
        }),
      ]),
    );
  });

  it("does not accept artifact-name substrings as checksum evidence", () => {
    const repo = createRepo({
      download:
        "curl -o tool https://example.test/releases/download/v1/tool && sha256sum -c evil-tool.sha256",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it("does not treat digest computation without comparison as verification", () => {
    const repo = createRepo({
      download:
        "curl -o tool.tar.gz https://example.test/releases/download/v1/tool.tar.gz && openssl dgst -sha256 tool.tar.gz",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it("requires verification before a downloaded executable is used", () => {
    const repo = createRepo({
      download: `curl -o tool https://example.test/releases/download/v1/tool && chmod +x tool && ./tool && echo '${"a".repeat(64)}  tool' | sha256sum -c -`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "unchecked-executable-download" })]);
  });

  it.each([
    "env bash",
    "env -i bash",
    "/usr/bin/env bash",
    "sudo bash",
    "/bin/bash",
    "zsh",
    "python3",
  ])("rejects a remote response piped directly to %s", (interpreter) => {
    const repo = createRepo({
      unsafe: `curl -fsSL https://example.test/install.sh | ${interpreter}`,
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "remote-shell-installer" })]);
  });

  it.each([
    "https://example.test/tool/releases/latest/download/tool.tar.gz",
    "https://raw.githubusercontent.com/acme/tool/main/install.sh",
    "https://github.com/acme/tool/archive/abcdef1/tool.tar.gz",
  ])(
    "rejects mutable executable download reference %s even when a checksum command is present",
    (url) => {
      const repo = createRepo({
        download: `curl -fsSLo tool ${url} && sha256sum -c checksums.txt`,
      });

      expect(
        runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
      ).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "mutable-download-reference" })]),
      );
    },
  );

  it("scans workflow run blocks with repository-relative files and 1-based lines", () => {
    const repo = createRepo();
    writeFile(
      repo,
      ".github/workflows/ci.yml",
      [
        "name: CI",
        "jobs:",
        "  security:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: |",
        "          echo prepare",
        "          docker run tool:v1 scan",
        "",
      ].join("\n"),
    );

    expect(
      runCiExecutablePolicy({ checkedPaths: [".github/workflows/ci.yml"], rootDir: repo }).findings,
    ).toEqual([
      expect.objectContaining({
        file: ".github/workflows/ci.yml",
        line: 8,
        kind: "mutable-container-reference",
      }),
    ]);
  });

  it("applies YAML folding before scanning folded workflow commands", () => {
    const repo = createRepo();
    writeFile(
      repo,
      ".github/workflows/ci.yml",
      [
        "jobs:",
        "  security:",
        "    steps:",
        "      - run: >",
        "          docker run",
        "          image:latest scan",
        "",
      ].join("\n"),
    );

    expect(
      runCiExecutablePolicy({ checkedPaths: [".github/workflows/ci.yml"], rootDir: repo }).findings,
    ).toEqual([expect.objectContaining({ kind: "mutable-container-reference" })]);
  });

  it("rejects a scalar workflow job container without an OCI digest", () => {
    const repo = createRepo();
    writeFile(
      repo,
      ".github/workflows/release.yml",
      [
        "jobs:",
        "  release:",
        "    container: ghcr.io/acme/release-tool:v2",
        "    steps: []",
        "",
      ].join("\n"),
    );

    expect(
      runCiExecutablePolicy({ checkedPaths: [".github/workflows/release.yml"], rootDir: repo })
        .findings,
    ).toEqual([
      expect.objectContaining({
        file: ".github/workflows/release.yml",
        kind: "mutable-container-reference",
        line: 3,
      }),
    ]);
  });

  it("scans literal executable process launches but excludes script tests and templates", () => {
    const repo = createRepo();
    writeFile(
      repo,
      "scripts/release-check.mts",
      "import { spawnSync } from 'node:child_process';\nspawnSync('npx', ['--yes', 'tool']);\n",
    );
    writeFile(repo, "scripts/tests/fixture.spec.ts", "spawnSync('npx', ['--yes', 'fixture']);\n");
    writeFile(repo, "scripts/templates/example.mts", "spawnSync('npx', ['--yes', 'example']);\n");

    expect(runCiExecutablePolicy({ checkedPaths: ["scripts"], rootDir: repo }).findings).toEqual([
      expect.objectContaining({
        file: "scripts/release-check.mts",
        line: 2,
        kind: "ad-hoc-package-execution",
      }),
    ]);
  });

  it("resolves statically bound process commands before policy evaluation", () => {
    const repo = createRepo();
    writeFile(
      repo,
      "scripts/release-check.mts",
      "import { spawnSync } from 'node:child_process';\nconst command = 'npx';\nconst args = ['--yes', 'tool'];\nspawnSync(command, args);\n",
    );

    expect(runCiExecutablePolicy({ checkedPaths: ["scripts"], rootDir: repo }).findings).toEqual([
      expect.objectContaining({
        file: "scripts/release-check.mts",
        kind: "ad-hoc-package-execution",
        line: 4,
      }),
    ]);
  });

  it("recognizes aliased child-process imports", () => {
    const repo = createRepo();
    writeFile(
      repo,
      "scripts/release-check.mts",
      "import { spawnSync as launch } from 'node:child_process';\nlaunch('npx', ['--yes', 'tool']);\n",
    );

    expect(runCiExecutablePolicy({ checkedPaths: ["scripts"], rootDir: repo }).findings).toEqual([
      expect.objectContaining({ kind: "ad-hoc-package-execution", line: 2 }),
    ]);
  });

  it("recognizes CommonJS destructured child-process aliases", () => {
    const repo = createRepo();
    writeFile(
      repo,
      "scripts/release-check.cjs",
      "const { spawnSync: run } = require('node:child_process');\nrun('npx', ['--yes', 'tool']);\n",
    );

    expect(runCiExecutablePolicy({ checkedPaths: ["scripts"], rootDir: repo }).findings).toEqual([
      expect.objectContaining({ kind: "ad-hoc-package-execution", line: 2 }),
    ]);
  });

  it("scans shell scripts under the protected scripts surface", () => {
    const repo = createRepo();
    writeFile(repo, "scripts/release.sh", "#!/bin/sh\nnpx --yes madge packages\n");

    expect(runCiExecutablePolicy({ checkedPaths: ["scripts"], rootDir: repo }).findings).toEqual([
      expect.objectContaining({
        file: "scripts/release.sh",
        kind: "ad-hoc-package-execution",
        line: 2,
      }),
    ]);
  });

  it("normalizes shell line continuations before scanning downloads", () => {
    const repo = createRepo();
    writeFile(
      repo,
      "scripts/release.sh",
      "#!/bin/sh\ncurl -fsSLo tool \\\n  https://example.test/releases/download/v1/tool\n",
    );

    expect(runCiExecutablePolicy({ checkedPaths: ["scripts"], rootDir: repo }).findings).toEqual([
      expect.objectContaining({ kind: "unchecked-executable-download" }),
    ]);
  });

  it("does not treat a printed archive URL as a direct executable download", () => {
    const repo = createRepo({
      docs: "echo https://example.test/tool/releases/download/v1.2.3/tool.tar.gz",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([]);
  });

  it("associates archive URLs only with their shell command segment", () => {
    const repo = createRepo({
      docs: "echo https://example.test/releases/download/v1/tool.tar.gz && curl https://status.test",
    });

    expect(
      runCiExecutablePolicy({ checkedPaths: ["package.json"], rootDir: repo }).findings,
    ).toEqual([]);
  });

  it("does not treat Action uses, runner labels, Git refs, documentation, or ordinary URLs as executable pins", () => {
    const repo = createRepo();
    writeFile(
      repo,
      ".github/workflows/ci.yml",
      [
        "jobs:",
        "  test:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@main",
        "        with:",
        "          ref: feature/latest",
        "      - run: echo https://example.test/docs/latest/guide",
        "",
      ].join("\n"),
    );
    writeFile(repo, "scripts/notes.md", "docker run tool:latest\n");

    expect(
      runCiExecutablePolicy({
        checkedPaths: [".github/workflows/ci.yml", "scripts"],
        rootDir: repo,
      }).findings,
    ).toEqual([]);
  });
});

function createRepo(
  scripts: Readonly<Record<string, string>> = {},
  devDependencies: Readonly<Record<string, string>> = {},
): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-ci-executable-policy-"));
  tempRepos.push(repo);
  writeFile(repo, "package.json", `${JSON.stringify({ scripts, devDependencies }, null, 2)}\n`);
  return repo;
}

function writeFile(root: string, path: string, content: string): void {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}
