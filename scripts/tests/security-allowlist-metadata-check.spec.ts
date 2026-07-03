import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../security-allowlist-metadata-check.mts");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("security-allowlist-metadata-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("passes effective audit and Gitleaks exceptions with review metadata", () => {
    const root = createTempRoot();
    writeRepo(root);

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "security-allowlist-metadata: passed (1 audit ignores, 1 gitleaks allowlist entries, 0 gitleaks ignore fingerprints).",
    );
  });

  it("fails effective audit ignores without metadata", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist GHSA-gv7w-rqvm-qjhr is missing owner/reason/review metadata",
    );
    expect(result.stdout).toContain("Recovery:");
  });

  it("fails effective CVE audit ignores without metadata", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
      workspace:
        "packages:\n  - packages/**/*\n\nauditConfig:\n  ignoreCves:\n    - CVE-2026-12345\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist CVE-2026-12345 is missing owner/reason/review metadata",
    );
    expect(result.stdout).toContain("scripts/security-allowlist-metadata.json#audit.ignoreCves");
  });

  it("passes effective CVE audit ignores with review metadata", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({
        audit: [],
        auditCves: [
          {
            id: "CVE-2026-12345",
            owner: "security",
            reason: "Test CVE audit advisory exception.",
            reviewBy: "2027-01-31",
          },
        ],
      }),
      workspace:
        "packages:\n  - packages/**/*\n\nauditConfig:\n  ignoreCves:\n    - CVE-2026-12345\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("security-allowlist-metadata: passed (1 audit ignores");
  });

  it("rejects package.json pnpm audit config as a stale audit exception source", () => {
    const root = createTempRoot();
    writeRepo(root, {
      packageJson: {
        name: "croco",
        private: true,
        pnpm: {
          auditConfig: {
            ignoreGhsas: ["GHSA-gv7w-rqvm-qjhr"],
          },
        },
        scripts: {
          "audit:prod": "pnpm audit --audit-level high --prod",
        },
      },
      workspace: "packages:\n  - packages/**/*\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("package.json#pnpm.auditConfig contains");
    expect(result.stdout).toContain(
      "documents GHSA-gv7w-rqvm-qjhr, but that vulnerability is not in the effective audit allowlist",
    );
  });

  it("rejects package.json pnpm CVE audit config as a stale audit exception source", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({
        audit: [],
        auditCves: [
          {
            id: "CVE-2026-12345",
            owner: "security",
            reason: "Test CVE audit advisory exception.",
            reviewBy: "2027-01-31",
          },
        ],
      }),
      packageJson: {
        name: "croco",
        private: true,
        pnpm: {
          auditConfig: {
            ignoreCves: ["CVE-2026-12345"],
          },
        },
        scripts: {
          "audit:prod": "pnpm audit --audit-level high --prod",
        },
      },
      workspace: "packages:\n  - packages/**/*\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("package.json#pnpm.auditConfig contains CVE-2026-12345");
    expect(result.stdout).toContain(
      "documents CVE-2026-12345, but that vulnerability is not in the effective audit allowlist",
    );
  });

  it("honors explicit audit command ignore flags as an effective source", () => {
    const root = createTempRoot();
    writeRepo(root, {
      packageJson: {
        name: "croco",
        private: true,
        scripts: {
          "audit:prod": "pnpm audit --audit-level high --prod --ignore GHSA-gv7w-rqvm-qjhr",
        },
      },
      workspace: "packages:\n  - packages/**/*\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
  });

  it("rejects broad audit command ignore-unfixable flags", () => {
    const root = createTempRoot();
    writeRepo(root, {
      packageJson: {
        name: "croco",
        private: true,
        scripts: {
          "audit:prod": "pnpm audit --audit-level high --prod --ignore-unfixable",
        },
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("package.json#scripts.audit:prod uses --ignore-unfixable");
    expect(result.stdout).toContain("suppresses unresolved CVEs without reviewed metadata");
  });

  it("fails Gitleaks allowlist entries without metadata", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ gitleaksAllowlists: [] }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Gitleaks path allowlist (^|/)packages/[^/]+/src/tests/.*\\.spec\\.ts$ is missing owner/reason/review metadata",
    );
  });

  it("parses TOML array brackets inside quoted Gitleaks regexes", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: [
        'title = "Croco gitleaks config"',
        "",
        "[extend]",
        "useDefault = true",
        "",
        "[allowlist]",
        "regexes = [",
        "  '''[A-Z]TOKEN''',",
        "  '''SECOND_TOKEN'''",
        "]",
        "",
      ].join("\n"),
      metadata: metadataFixture({
        gitleaksAllowlists: [
          {
            kind: "regex",
            value: "[A-Z]TOKEN",
            owner: "security",
            reason: "Test fixture exception.",
            reviewBy: "2027-01-31",
          },
        ],
      }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Gitleaks regex allowlist SECOND_TOKEN is missing owner/reason/review metadata",
    );
  });

  it("parses Gitleaks allowlist table headers with inline comments", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: [
        'title = "Croco gitleaks config"',
        "",
        "[extend]",
        "useDefault = true",
        "",
        "[allowlist] # test fixtures",
        "paths = ['''(^|/)fixtures/commented-header.env$''']",
        "",
        "[[rules.allowlists]] # package fixture rule",
        "regexes = ['''COMMENTED_RULE_TOKEN''']",
        "",
      ].join("\n"),
      metadata: metadataFixture({ gitleaksAllowlists: [] }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Gitleaks path allowlist (^|/)fixtures/commented-header.env$ is missing owner/reason/review metadata",
    );
    expect(result.stdout).toContain(
      "Gitleaks regex allowlist COMMENTED_RULE_TOKEN is missing owner/reason/review metadata",
    );
  });

  it("rejects Gitleaks configs without effective detection rules", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: 'title = "Croco gitleaks config"\n',
      metadata: metadataFixture({ gitleaksAllowlists: [] }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("has no effective detection rules");
  });

  it("accepts Gitleaks configs with custom detection rules", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: [
        'title = "Croco gitleaks config"',
        "",
        "[[rules]]",
        'id = "fixture-rule"',
        'description = "Fixture rule"',
        "regex = '''FIXTURE_TOKEN'''",
        "",
      ].join("\n"),
      metadata: metadataFixture({ gitleaksAllowlists: [] }),
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
  });

  it("requires metadata for Gitleaks allowlists from extended configs", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: [
        'title = "Croco gitleaks config"',
        "",
        "[extend]",
        'path = "security/gitleaks-base.toml"',
        "",
      ].join("\n"),
      metadata: metadataFixture({ gitleaksAllowlists: [] }),
    });
    mkdirSync(join(root, "security"), { recursive: true });
    writeFileSync(
      join(root, "security/gitleaks-base.toml"),
      [
        'title = "Base gitleaks config"',
        "",
        "[extend]",
        "useDefault = true",
        "",
        "[allowlist]",
        "paths = ['''(^|/)fixtures/.*\\.env$''']",
        "",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Gitleaks path allowlist (^|/)fixtures/.*\\.env$ is missing owner/reason/review metadata",
    );
  });

  it("resolves nested Gitleaks extend paths from the invocation root", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: [
        'title = "Croco gitleaks config"',
        "",
        "[extend]",
        'path = "security/gitleaks-base.toml"',
        "",
      ].join("\n"),
      metadata: metadataFixture({ gitleaksAllowlists: [] }),
    });
    mkdirSync(join(root, "security"), { recursive: true });
    writeFileSync(
      join(root, "security/gitleaks-base.toml"),
      ['title = "Base gitleaks config"', "", "[extend]", 'path = "second.toml"', ""].join("\n"),
    );
    writeFileSync(
      join(root, "second.toml"),
      [
        'title = "Repo-root extended config"',
        "",
        "[extend]",
        "useDefault = true",
        "",
        "[allowlist]",
        "regexes = ['''ROOT_EXTENDED_TOKEN''']",
        "",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Gitleaks regex allowlist ROOT_EXTENDED_TOKEN is missing owner/reason/review metadata",
    );
  });

  it("rejects metadata gitleaks configPath that differs from the CI-scanned default", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: 'title = "default gitleaks config"\n\n[extend]\nuseDefault = true\n',
      metadata: metadataFixture({
        configPath: "security/gitleaks.toml",
        gitleaksAllowlists: [],
      }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "secretScan.gitleaks.configPath points at security/gitleaks.toml",
    );
    expect(result.stdout).toContain("CI scans with .gitleaks.toml");
  });

  it("rejects inline Gitleaks suppression comments", () => {
    const root = createTempRoot();
    writeRepo(root);
    mkdirSync(join(root, "packages/app/src"), { recursive: true });
    writeFileSync(
      join(root, "packages/app/src/index.ts"),
      `const token = "dummy"; // ${"gitleaks"}${":allow"}\n`,
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "packages/app/src/index.ts:1 uses an inline Gitleaks suppression comment",
    );
  });

  it("rejects inline Gitleaks suppression comments from git history", () => {
    const root = createTempRoot();
    writeRepo(root);
    mkdirSync(join(root, "packages/app/src"), { recursive: true });
    runGit(root, "init");
    runGit(root, "config", "user.email", "security@example.com");
    runGit(root, "config", "user.name", "Security Tests");
    runGit(root, "add", ".");
    runGit(root, "commit", "-m", "initial fixture");
    writeFileSync(
      join(root, "packages/app/src/index.ts"),
      `const token = "dummy"; // ${"gitleaks"}${":allow"}\n`,
    );
    runGit(root, "add", ".");
    runGit(root, "commit", "-m", "add suppressed fixture");
    writeFileSync(join(root, "packages/app/src/index.ts"), 'const token = "dummy";\n');
    runGit(root, "add", ".");
    runGit(root, "commit", "-m", "remove suppressed fixture");

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "packages/app/src/index.ts:1 uses an inline Gitleaks suppression comment",
    );
  });

  it("fails missing owner, reason, and review dates", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: {
        schemaVersion: 1,
        audit: {
          ignoreGhsas: [
            {
              id: "GHSA-gv7w-rqvm-qjhr",
            },
          ],
        },
        secretScan: {
          gitleaks: {
            allowlists: [
              {
                kind: "path",
                value: "(^|/)packages/[^/]+/src/tests/.*\\.spec\\.ts$",
              },
            ],
            ignoreFingerprints: [],
          },
        },
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("audit.ignoreGhsas[0].owner must be a non-empty string");
    expect(result.stdout).toContain("audit.ignoreGhsas[0].reason must be a non-empty string");
    expect(result.stdout).toContain("audit.ignoreGhsas[0] must include reviewBy or expiresOn");
    expect(result.stdout).toContain(
      "secretScan.gitleaks.allowlists[0].owner must be a non-empty string",
    );
  });

  it("fails stale review dates", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ reviewBy: "2026-07-02" }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit.ignoreGhsas[0].reviewBy is stale (2026-07-02 is before 2026-07-03)",
    );
    expect(result.stdout).toContain(
      "secretScan.gitleaks.allowlists[0].reviewBy is stale (2026-07-02 is before 2026-07-03)",
    );
  });

  it("fails stale expiresOn even when reviewBy is still current", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({
        expiresOn: "2026-07-02",
        reviewBy: "2027-01-31",
      }),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit.ignoreGhsas[0].expiresOn is stale (2026-07-02 is before 2026-07-03)",
    );
    expect(result.stdout).toContain(
      "secretScan.gitleaks.allowlists[0].expiresOn is stale (2026-07-02 is before 2026-07-03)",
    );
  });

  it("parses flow-style pnpm-workspace auditConfig as an effective audit source", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
      workspace:
        "packages:\n  - packages/**/*\n\nauditConfig: { ignoreGhsas: [GHSA-gv7w-rqvm-qjhr] }\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist GHSA-gv7w-rqvm-qjhr is missing owner/reason/review metadata",
    );
  });

  it("parses multi-line flow-style pnpm-workspace auditConfig as an effective audit source", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
      workspace:
        "packages:\n  - packages/**/*\n\nauditConfig: {\n  ignoreGhsas: [GHSA-gv7w-rqvm-qjhr]\n}\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist GHSA-gv7w-rqvm-qjhr is missing owner/reason/review metadata",
    );
  });

  it("parses quoted inline pnpm-workspace auditConfig arrays", () => {
    const root = createTempRoot();
    writeRepo(root, {
      workspace:
        'packages:\n  - packages/**/*\n\nauditConfig:\n  ignoreGhsas: ["GHSA-gv7w-rqvm-qjhr"]\n',
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
  });

  it("parses multi-line flow arrays under pnpm-workspace auditConfig keys", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
      workspace:
        "packages:\n  - packages/**/*\n\nauditConfig:\n  ignoreGhsas: [\n    GHSA-gv7w-rqvm-qjhr\n  ]\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist GHSA-gv7w-rqvm-qjhr is missing owner/reason/review metadata",
    );
  });

  it("resolves YAML aliases in pnpm-workspace auditConfig keys", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
      workspace:
        "packages:\n  - packages/**/*\n\nignored: &audit_ignores\n  - GHSA-gv7w-rqvm-qjhr\n\nauditConfig:\n  ignoreGhsas: *audit_ignores\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist GHSA-gv7w-rqvm-qjhr is missing owner/reason/review metadata",
    );
  });

  it("parses anchored pnpm-workspace auditConfig block mappings", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({ audit: [] }),
      workspace:
        "packages:\n  - packages/**/*\n\nauditConfig: &audit_policy\n  ignoreGhsas:\n    - GHSA-gv7w-rqvm-qjhr\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "audit allowlist GHSA-gv7w-rqvm-qjhr is missing owner/reason/review metadata",
    );
  });

  it("fails metadata that no longer matches effective allowlists", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksConfig: 'title = "Croco gitleaks config"\n\n[extend]\nuseDefault = true\n',
      workspace: "packages:\n  - packages/**/*\n\nauditConfig:\n  ignoreGhsas: []\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "documents GHSA-gv7w-rqvm-qjhr, but that vulnerability is not in the effective audit allowlist",
    );
    expect(result.stdout).toContain(
      "documents Gitleaks path (^|/)packages/[^/]+/src/tests/.*\\.spec\\.ts$, but it is not in the effective Gitleaks allowlist",
    );
  });

  it("requires metadata for .gitleaksignore fingerprints", () => {
    const root = createTempRoot();
    writeRepo(root, {
      gitleaksIgnore: "example-fingerprint\n",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "Gitleaks fingerprint allowlist example-fingerprint is missing owner/reason/review metadata",
    );
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-security-allowlist-"));
  tempRoots.push(root);
  return root;
}

function writeRepo(
  root: string,
  options: {
    readonly gitleaksConfig?: string;
    readonly gitleaksIgnore?: string;
    readonly metadata?: Record<string, unknown>;
    readonly packageJson?: Record<string, unknown>;
    readonly workspace?: string;
  } = {},
): void {
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify(options.packageJson ?? packageJsonFixture(), null, 2)}\n`,
  );
  writeFileSync(join(root, "pnpm-workspace.yaml"), options.workspace ?? workspaceFixture());
  writeFileSync(join(root, ".gitleaks.toml"), options.gitleaksConfig ?? gitleaksConfigFixture());
  writeFileSync(
    join(root, "scripts/security-allowlist-metadata.json"),
    `${JSON.stringify(options.metadata ?? metadataFixture(), null, 2)}\n`,
  );

  if (options.gitleaksIgnore !== undefined) {
    writeFileSync(join(root, ".gitleaksignore"), options.gitleaksIgnore);
  }
}

function packageJsonFixture(): Record<string, unknown> {
  return {
    name: "croco",
    private: true,
    scripts: {
      "audit:prod": "pnpm audit --audit-level high --prod",
    },
  };
}

function workspaceFixture(): string {
  return [
    "packages:",
    "  - packages/**/*",
    "",
    "auditConfig:",
    "  ignoreGhsas:",
    "    - GHSA-gv7w-rqvm-qjhr",
    "",
  ].join("\n");
}

function gitleaksConfigFixture(): string {
  return [
    'title = "Croco gitleaks config"',
    "",
    "[extend]",
    "useDefault = true",
    "",
    "[allowlist]",
    'description = "Test fixture dummy keys"',
    "paths = ['''(^|/)packages/[^/]+/src/tests/.*\\.spec\\.ts$''']",
    "",
  ].join("\n");
}

function metadataFixture(
  options: {
    readonly audit?: readonly Record<string, unknown>[];
    readonly auditCves?: readonly Record<string, unknown>[];
    readonly configPath?: string;
    readonly expiresOn?: string;
    readonly gitleaksAllowlists?: readonly Record<string, unknown>[];
    readonly reviewBy?: string;
  } = {},
): Record<string, unknown> {
  const reviewBy = options.reviewBy ?? "2027-01-31";

  return {
    schemaVersion: 1,
    audit: {
      ignoreGhsas: options.audit ?? [
        {
          id: "GHSA-gv7w-rqvm-qjhr",
          owner: "security",
          reason: "Test audit advisory exception.",
          ...(options.expiresOn ? { expiresOn: options.expiresOn } : {}),
          reviewBy,
        },
      ],
      ignoreCves: options.auditCves ?? [],
    },
    secretScan: {
      gitleaks: {
        configPath: options.configPath ?? ".gitleaks.toml",
        allowlists: options.gitleaksAllowlists ?? [
          {
            kind: "path",
            value: "(^|/)packages/[^/]+/src/tests/.*\\.spec\\.ts$",
            owner: "security",
            reason: "Test fixture exception.",
            ...(options.expiresOn ? { expiresOn: options.expiresOn } : {}),
            reviewBy,
          },
        ],
        ignoreFingerprints: [],
      },
    },
  };
}

function runScript(root: string, ...args: string[]): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, "--root", root, "--today", "2026-07-03", ...args],
    {
      encoding: "utf-8",
      timeout: 10_000,
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function runGit(root: string, ...args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf-8",
  });

  expect(result.status, result.stderr).toBe(0);
}
