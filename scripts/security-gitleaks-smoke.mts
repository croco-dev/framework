#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";

type ScanResult = {
  readonly name: string;
  readonly report: string;
  readonly status: number | null;
  readonly text: string;
};

type SarifReport = {
  readonly runs: readonly {
    readonly results?: readonly { readonly ruleId?: string }[];
  }[];
  readonly version: string;
};

export const GITLEAKS_CORE_ARGS = [
  "detect",
  "--source",
  "/repo",
  "--redact",
  "--no-banner",
  "--log-opts=HEAD",
  "--report-format",
  "sarif",
  "--report-path",
  "/repo/gitleaks.sarif",
] as const;

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = resolve(rootDir, "ci-reports/security/gitleaks-smoke");
const metadataScript = resolve(rootDir, "scripts/security-allowlist-metadata-check.mts");
const marker = ["ghp", "_", "aB3dE5fG7hJ9kL2mN4pQ6rS8tU1vW3xY5zA7"].join("");

export function main(): number {
  const image = process.env.GITLEAKS_IMAGE?.trim();
  if (!image) {
    process.stderr.write(
      "security-gitleaks-smoke: GITLEAKS_IMAGE must contain the immutable scanner image.\n",
    );
    return 1;
  }

  rmSync(outputDir, { force: true, recursive: true });
  mkdirSync(outputDir, { recursive: true });
  const tempRoot = mkdtempSync(join(tmpdir(), "croco-gitleaks-smoke-"));
  const failures: string[] = [];

  try {
    const detectable = createRepository(tempRoot, "detectable", marker);
    const allowlisted = createRepository(tempRoot, "allowlisted", marker, true);
    const stale = createRepository(tempRoot, "stale-metadata", marker, true, "2020-01-01");
    const dotted = createRepository(tempRoot, "dotted-allowlist", marker, true);
    writeFileSync(
      join(dotted, ".gitleaks.toml"),
      [
        'title = "Croco Gitleaks smoke"',
        "",
        "allowlist.paths = ['''^.*\\.txt$''']",
        "",
        "[extend]",
        "useDefault = true",
        "",
      ].join("\n"),
    );
    runGit(dotted, "add", ".gitleaks.toml");
    runGit(dotted, "commit", "-qm", "fixture: dotted allowlist bypass attempt");
    const spacedDotted = createRepository(tempRoot, "spaced-dotted-allowlist", marker, true);
    writeFileSync(
      join(spacedDotted, ".gitleaks.toml"),
      [
        'title = "Croco Gitleaks smoke"',
        "",
        "allowlist . paths = ['''^.*\\.txt$''']",
        "",
        "[extend]",
        "useDefault = true",
        "",
      ].join("\n"),
    );
    runGit(spacedDotted, "add", ".gitleaks.toml");
    runGit(spacedDotted, "commit", "-qm", "fixture: spaced dotted allowlist bypass attempt");
    const quotedTable = createRepository(tempRoot, "quoted-table-allowlist", marker, true);
    writeFileSync(
      join(quotedTable, ".gitleaks.toml"),
      [
        'title = "Croco Gitleaks smoke"',
        "",
        '["allowlist"]',
        "paths = ['''^.*\\.txt$''']",
        "",
        "[extend]",
        "useDefault = true",
        "",
      ].join("\n"),
    );
    runGit(quotedTable, "add", ".gitleaks.toml");
    runGit(quotedTable, "commit", "-qm", "fixture: quoted allowlist bypass attempt");
    const ruleOverride = createRepository(tempRoot, "rule-override", marker, true);
    writeFileSync(
      join(ruleOverride, ".gitleaks.toml"),
      [
        'title = "Croco Gitleaks smoke"',
        "",
        "[extend]",
        "useDefault = true",
        "",
        "[[rules]]",
        'id = "github-pat"',
        "regex = '''a^'''",
        "",
      ].join("\n"),
    );
    runGit(ruleOverride, "add", ".gitleaks.toml");
    runGit(ruleOverride, "commit", "-qm", "fixture: default rule override attempt");
    const clean = createRepository(tempRoot, "clean", "documented fixture without a token");
    const invalidConfig = createRepository(
      tempRoot,
      "invalid-config",
      "operational failure fixture",
    );

    const detectableResult = scan(image, "detectable", detectable);
    const allowlistedResult = scan(image, "allowlisted", allowlisted);
    const staleResult = scan(image, "stale-metadata", stale);
    const dottedResult = scan(image, "dotted-allowlist", dotted);
    const spacedDottedResult = scan(image, "spaced-dotted-allowlist", spacedDotted);
    const quotedTableResult = scan(image, "quoted-table-allowlist", quotedTable);
    const ruleOverrideResult = scan(image, "rule-override", ruleOverride);
    const cleanResult = scan(image, "clean", clean);
    const invalidConfigResult = scan(image, "invalid-config", invalidConfig, [
      "--config",
      "/repo/missing-gitleaks.toml",
    ]);

    if (detectableResult.status === 0 || !reportHasRule(detectableResult.report, "github-pat")) {
      failures.push("detectable fixture must fail with a github-pat SARIF result");
    }
    if (allowlistedResult.status !== 0 || reportHasRule(allowlistedResult.report, "github-pat")) {
      failures.push("reviewed bounded-path fixture must pass without a github-pat SARIF result");
    }
    if (staleResult.status !== 0 || reportHasRule(staleResult.report, "github-pat")) {
      failures.push("stale-metadata fixture scan must pass through its bounded path allowlist");
    }
    if (dottedResult.status !== 0 || reportHasRule(dottedResult.report, "github-pat")) {
      failures.push("dotted allowlist bypass fixture must demonstrate scanner suppression");
    }
    if (spacedDottedResult.status !== 0 || reportHasRule(spacedDottedResult.report, "github-pat")) {
      failures.push("spaced dotted allowlist fixture must demonstrate scanner suppression");
    }
    if (quotedTableResult.status !== 0 || reportHasRule(quotedTableResult.report, "github-pat")) {
      failures.push("quoted table allowlist fixture must demonstrate scanner suppression");
    }
    if (ruleOverrideResult.status !== 0 || reportHasRule(ruleOverrideResult.report, "github-pat")) {
      failures.push("default rule override fixture must demonstrate scanner suppression");
    }
    if (cleanResult.status !== 0 || reportHasRule(cleanResult.report, "github-pat")) {
      failures.push("clean-history fixture must pass without a github-pat SARIF result");
    }
    if (
      invalidConfigResult.status === null ||
      invalidConfigResult.status === 0 ||
      !invalidConfigResult.text.includes("missing-gitleaks.toml") ||
      reportHasRule(invalidConfigResult.report, "github-pat")
    ) {
      failures.push(
        "invalid-config fixture must fail operationally without a github-pat SARIF result",
      );
    }

    const metadata = checkMetadata("allowlisted", allowlisted);
    if (metadata !== 0) {
      failures.push("reviewed bounded-path fixture metadata must pass validation");
    }

    const staleMetadata = checkMetadata("stale-metadata", stale);
    if (staleMetadata === 0) {
      failures.push("expired bounded-path fixture metadata must fail validation");
    }

    const dottedMetadata = checkMetadata("dotted-allowlist", dotted);
    if (dottedMetadata === 0) {
      failures.push("dotted allowlist bypass fixture metadata must fail validation");
    }
    const spacedDottedMetadata = checkMetadata("spaced-dotted-allowlist", spacedDotted);
    if (spacedDottedMetadata === 0) {
      failures.push("spaced dotted allowlist fixture metadata must fail validation");
    }
    const quotedTableMetadata = checkMetadata("quoted-table-allowlist", quotedTable);
    if (quotedTableMetadata === 0) {
      failures.push("quoted table allowlist fixture metadata must fail validation");
    }
    const ruleOverrideMetadata = checkMetadata("rule-override", ruleOverride);
    if (ruleOverrideMetadata === 0) {
      failures.push("default rule override fixture metadata must fail validation");
    }

    for (const result of [
      detectableResult,
      allowlistedResult,
      staleResult,
      dottedResult,
      spacedDottedResult,
      quotedTableResult,
      ruleOverrideResult,
      cleanResult,
      invalidConfigResult,
    ]) {
      if (!isValidSarif(result.report)) {
        failures.push(`${result.name} did not produce valid SARIF`);
      }
      if (result.report.includes(marker) || result.text.includes(marker)) {
        failures.push(`${result.name} diagnostics contain the raw marker`);
      }
    }
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }

  if (failures.length > 0) {
    process.stderr.write(
      `security-gitleaks-smoke: failed\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`,
    );
    return 1;
  }

  process.stdout.write(
    "security-gitleaks-smoke: passed (detectable, allowlisted, stale-metadata, policy-bypasses, clean-history, invalid-config).\n",
  );
  return 0;
}

function createRepository(
  tempRoot: string,
  name: string,
  content: string,
  allowlisted = false,
  reviewBy = "2099-12-31",
): string {
  const repository = join(tempRoot, name);
  const fixtureDir = join(repository, "fixtures");
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(join(fixtureDir, "github-token.txt"), `${content}\n`);
  writeFileSync(
    join(repository, ".gitleaks.toml"),
    allowlisted
      ? [
          'title = "Croco Gitleaks smoke"',
          "",
          "[extend]",
          "useDefault = true",
          "",
          "[allowlist]",
          "paths = ['''(^|/)fixtures/github-token\\.txt$''']",
          "",
        ].join("\n")
      : ['title = "Croco Gitleaks smoke"', "", "[extend]", "useDefault = true", ""].join("\n"),
  );

  if (allowlisted) {
    mkdirSync(join(repository, "scripts"), { recursive: true });
    writeFileSync(
      join(repository, "package.json"),
      `${JSON.stringify(
        {
          name: "croco-gitleaks-smoke",
          private: true,
          scripts: { "audit:prod": "pnpm audit --audit-level high --prod" },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(repository, "pnpm-workspace.yaml"), "packages: []\n\nauditConfig: {}\n");
    writeFileSync(
      join(repository, "scripts/security-allowlist-metadata.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          audit: { ignoreCves: [], ignoreGhsas: [] },
          secretScan: {
            gitleaks: {
              configPath: ".gitleaks.toml",
              allowlists: [
                {
                  kind: "path",
                  value: "(^|/)fixtures/github-token\\.txt$",
                  owner: "security",
                  reason: "Non-sensitive scanner acceptance fixture.",
                  reviewBy,
                },
              ],
              ignoreFingerprints: [],
            },
            generatedTemplates: { allowlists: [] },
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  runGit(repository, "init", "-q");
  runGit(repository, "config", "user.email", "security-smoke@croco.dev");
  runGit(repository, "config", "user.name", "Croco Security Smoke");
  runGit(repository, "add", ".");
  runGit(repository, "commit", "-qm", `fixture: ${name}`);
  return repository;
}

function checkMetadata(name: string, repository: string): number | null {
  const metadata = spawnSync(
    process.execPath,
    ["--experimental-strip-types", metadataScript, "--root", repository],
    { encoding: "utf-8" },
  );
  writeFileSync(join(outputDir, `${name}-metadata.txt`), `${metadata.stdout}${metadata.stderr}`);
  return metadata.status;
}

function runGit(repository: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd: repository, encoding: "utf-8" });
  if (result.status !== 0) {
    process.stderr.write(`security-gitleaks-smoke: git ${args[0]} failed: ${result.stderr}\n`);
    exit(1);
  }
}

function scan(
  image: string,
  name: string,
  repository: string,
  extraArgs: readonly string[] = [],
): ScanResult {
  const reportPath = join(repository, "gitleaks.sarif");
  writeFileSync(reportPath, '{"version":"2.1.0","runs":[]}\n');
  const result = spawnSync(
    "docker",
    ["run", "--rm", "-v", `${repository}:/repo`, image, ...GITLEAKS_CORE_ARGS, ...extraArgs],
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
  );
  const text = `${result.stdout}${result.stderr}`;
  const report = readFileSync(reportPath, "utf-8");
  copyFileSync(reportPath, join(outputDir, `${name}.sarif`));
  writeFileSync(join(outputDir, `${name}.txt`), text);
  return { name, report, status: result.status, text };
}

function parseSarif(report: string): SarifReport | null {
  try {
    const value = JSON.parse(report) as unknown;
    if (!value || typeof value !== "object") {
      return null;
    }
    const candidate = value as { readonly runs?: unknown; readonly version?: unknown };
    if (candidate.version !== "2.1.0" || !Array.isArray(candidate.runs)) {
      return null;
    }
    for (const run of candidate.runs) {
      if (!run || typeof run !== "object") {
        return null;
      }
      const results = (run as { readonly results?: unknown }).results;
      if (results !== undefined) {
        if (!Array.isArray(results)) {
          return null;
        }
        if (
          results.some(
            (result) =>
              !result ||
              typeof result !== "object" ||
              ("ruleId" in result && typeof result.ruleId !== "string"),
          )
        ) {
          return null;
        }
      }
    }
    return candidate as SarifReport;
  } catch {
    return null;
  }
}

function isValidSarif(report: string): boolean {
  return parseSarif(report) !== null;
}

function reportHasRule(report: string, ruleId: string): boolean {
  const sarif = parseSarif(report);
  if (!sarif) {
    return false;
  }
  return sarif.runs.some((run) => run.results?.some((result) => result.ruleId === ruleId) ?? false);
}

export function ensureSarif(path: string): number {
  const report = readFileSync(path, "utf-8");
  if (isValidSarif(report)) {
    return 0;
  }
  writeFileSync(`${path}.invalid.txt`, report);
  writeFileSync(path, '{"version":"2.1.0","runs":[]}\n');
  process.stderr.write(`security-gitleaks-smoke: replaced malformed SARIF at ${path}\n`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ensureIndex = process.argv.indexOf("--ensure-sarif");
  if (ensureIndex >= 0) {
    const path = process.argv[ensureIndex + 1];
    exit(path ? ensureSarif(resolve(path)) : 1);
  }
  exit(main());
}
