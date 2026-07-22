import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getVerificationCommand } from "../verification-manifest.mts";
import { ensureSarif, GITLEAKS_CORE_ARGS } from "../security-gitleaks-smoke.mts";
import {
  findTrustedGitleaksImageViolations,
  findWorkflowVerificationViolations,
  TRUSTED_GITLEAKS_IMAGE,
} from "../workflow-verification-contract.mts";

const ROOT_DIR = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(resolve(ROOT_DIR, ".github/workflows/ci.yml"), "utf8");
const RENOVATE_CONFIG = JSON.parse(
  readFileSync(resolve(ROOT_DIR, ".github/renovate.json"), "utf8"),
) as Record<string, unknown>;
const ROOT_PACKAGE_JSON = JSON.parse(
  readFileSync(resolve(ROOT_DIR, "package.json"), "utf8"),
) as Record<string, unknown>;
const PNPM_LOCK = readFileSync(resolve(ROOT_DIR, "pnpm-lock.yaml"), "utf8");
const GITLEAKS_SMOKE = readFileSync(
  resolve(ROOT_DIR, "scripts/security-gitleaks-smoke.mts"),
  "utf8",
);
const VALIDATE_JOB = WORKFLOW.slice(
  WORKFLOW.indexOf("  validate:"),
  WORKFLOW.indexOf("  changes:"),
);
const SECRET_SCAN = WORKFLOW.slice(
  WORKFLOW.indexOf("      - name: Secret scan blocking report"),
  WORKFLOW.indexOf("      - name: Assemble security policy summary"),
);

describe("CI executable supply chain", () => {
  it("pins Gitleaks to a readable version and immutable OCI digest", () => {
    expect(findTrustedGitleaksImageViolations(WORKFLOW)).toEqual([]);
    expect(WORKFLOW).toContain(
      "ghcr.io/gitleaks/gitleaks:v8.23.0@sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e",
    );
    expect(WORKFLOW).toContain("# renovate: datasource=docker depName=ghcr.io/gitleaks/gitleaks");
    expect(WORKFLOW).not.toContain("ghcr.io/gitleaks/gitleaks:v8.23.0 detect");
    expect(WORKFLOW.match(/ghcr\.io\/gitleaks\/gitleaks:v8\.23\.0@sha256:/g)).toHaveLength(1);
  });

  it("rejects moving the trusted image declaration to an inert job", () => {
    const trustedDeclaration = [
      "      # renovate: datasource=docker depName=ghcr.io/gitleaks/gitleaks",
      `      GITLEAKS_IMAGE: ${TRUSTED_GITLEAKS_IMAGE}`,
    ].join("\n");
    const mutant = WORKFLOW.replace(
      trustedDeclaration,
      `      "GITLEAKS_IMAGE": ghcr.io/gitleaks/gitleaks:v9@sha256:${"b".repeat(64)}`,
    ).replace(
      "  changes:",
      `  inert:\n    env:\n${trustedDeclaration}\n    steps: []\n\n  changes:`,
    );

    expect(mutant).not.toBe(WORKFLOW);
    expect(findTrustedGitleaksImageViolations(mutant)).not.toEqual([]);
  });

  it("keeps Madge inside the exact workspace dependency and authoritative manifest", () => {
    const scripts = ROOT_PACKAGE_JSON.scripts as Record<string, string>;
    const devDependencies = ROOT_PACKAGE_JSON.devDependencies as Record<string, string>;
    const circularCommand = getVerificationCommand("architecture-circular").command;

    expect(scripts["architecture:check:circular"]).toBe(
      "pnpm exec madge --circular --extensions ts packages",
    );
    expect(circularCommand.slice(-7)).toEqual([
      "pnpm",
      "exec",
      "madge",
      "--circular",
      "--extensions",
      "ts",
      "packages",
    ]);
    expect(circularCommand).not.toContain("npx");
    expect(devDependencies.madge).toBe("8.0.0");
    expect(PNPM_LOCK).toContain("madge:\n        specifier: 8.0.0\n        version: 8.0.0");
  });

  it("configures Renovate to rotate the Gitleaks tag and digest together", () => {
    const managers = RENOVATE_CONFIG.customManagers as Array<Record<string, unknown>>;
    const manager = managers[0];
    const matchString = String((manager?.matchStrings as string[])[0]);
    const match = new RegExp(matchString).exec(WORKFLOW);

    expect(RENOVATE_CONFIG.extends).toEqual(expect.arrayContaining(["docker:pinDigests"]));
    expect(manager?.customType).toBe("regex");
    expect(manager?.datasourceTemplate).toBe("docker");
    expect(manager?.depNameTemplate).toBe("ghcr.io/gitleaks/gitleaks");
    expect(match?.groups).toMatchObject({
      currentValue: "v8.23.0",
      currentDigest: "sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e",
    });
  });
});

describe("CI verification profile contract", () => {
  it("classifies changes and invokes exactly one shared profile", () => {
    expect(WORKFLOW).toContain("scripts/verification-change-classifier.mts");
    expect(WORKFLOW).toContain('--event "$GITHUB_EVENT_NAME"');
    expect(WORKFLOW).toContain("--workflow ci");
    expect(WORKFLOW).toContain("- name: Run selected verification profile");
    expect(WORKFLOW.match(/scripts\/release-spine-evidence\.mts/g)).toHaveLength(1);
    expect(WORKFLOW).toContain('--profile "${{ steps.verification.outputs.profile }}"');
    expect(WORKFLOW).toContain(
      'if [ "${{ github.event_name }}" = "pull_request" ]; then\n            args+=(--allow-pending-release-metadata --base "${{ steps.verification.outputs.base }}" --head HEAD)',
    );
    expect(WORKFLOW).toContain('--base "${{ steps.verification.outputs.base }}" --head HEAD');
    expect(WORKFLOW).not.toContain("test:release-gates");
  });

  it("keeps the advisory audit and ecosystem smoke outside blocking profiles", () => {
    expect(WORKFLOW).toContain("continue-on-error: true");
    expect(WORKFLOW).toContain("pnpm audit:prod > ci-reports/security/pnpm-audit-prod.txt");
    expect(WORKFLOW).toContain("ghcr.io/gitleaks/gitleaks:v8.23.0");
    expect(WORKFLOW).toContain("pnpm create-croco-app:smoke -- --tier ecosystem-advisory");
    expect(WORKFLOW).not.toContain("pnpm create-croco-app:smoke -- --tier spine-blocking");
  });

  it("makes the Gitleaks result blocking while preserving redacted evidence", () => {
    const initializeText = SECRET_SCAN.indexOf(": > ci-reports/security/gitleaks.txt");
    const initializeSarif = SECRET_SCAN.indexOf("ci-reports/security/gitleaks.sarif");
    const scanner = SECRET_SCAN.indexOf(
      'docker run --rm -v "$PWD:/repo" "${{ env.GITLEAKS_IMAGE }}"',
    );

    expect(SECRET_SCAN).toContain("if: always()");
    expect(SECRET_SCAN).not.toContain("continue-on-error");
    expect(initializeText).toBeGreaterThan(-1);
    expect(initializeSarif).toBeGreaterThan(-1);
    expect(initializeText).toBeLessThan(scanner);
    expect(initializeSarif).toBeLessThan(scanner);
    expect(SECRET_SCAN).toContain("detect --source /repo --redact --no-banner");
    expect(SECRET_SCAN).toContain(
      "--report-format sarif --report-path /repo/ci-reports/security/gitleaks.sarif",
    );
    expect(SECRET_SCAN).toContain('exit "$exit_code"');
    expect(SECRET_SCAN).toContain("Scanner operational failures are also blocking.");
    expect(SECRET_SCAN).not.toContain("warning-only for PR");
  });

  it("runs the four-case Gitleaks smoke before the always-run production scan", () => {
    const install = WORKFLOW.indexOf("      - name: Install dependencies");
    const smoke = WORKFLOW.indexOf("      - name: Security Gitleaks acceptance smoke");
    const production = WORKFLOW.indexOf("      - name: Secret scan blocking report");

    expect(smoke).toBeGreaterThan(install);
    expect(production).toBeGreaterThan(smoke);
    expect(WORKFLOW.slice(smoke, production)).not.toContain("if: always()");
    expect(SECRET_SCAN).toContain(GITLEAKS_CORE_ARGS.slice(0, -1).join(" "));
    expect(SECRET_SCAN).toContain("--report-path /repo/ci-reports/security/gitleaks.sarif");
    expect(GITLEAKS_SMOKE).toContain('reportHasRule(detectableResult.report, "github-pat")');
    expect(GITLEAKS_SMOKE).toContain('reportHasRule(invalidConfigResult.report, "github-pat")');
    expect(GITLEAKS_SMOKE).toContain('"detectable", detectable');
    expect(GITLEAKS_SMOKE).toContain('"allowlisted", allowlisted');
    expect(GITLEAKS_SMOKE).toContain('"stale-metadata", stale');
    expect(GITLEAKS_SMOKE).toContain('"dotted-allowlist", dotted');
    expect(GITLEAKS_SMOKE).toContain('"spaced-dotted-allowlist", spacedDotted');
    expect(GITLEAKS_SMOKE).toContain('"quoted-table-allowlist", quotedTable');
    expect(GITLEAKS_SMOKE).toContain('"rule-override", ruleOverride');
    expect(GITLEAKS_SMOKE).toContain('"clean", clean');
    expect(GITLEAKS_SMOKE).toContain('"invalid-config", invalidConfig');
    expect(GITLEAKS_SMOKE).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
  });

  it("keeps the blocking Gitleaks summary and report upload observable", () => {
    const summary = WORKFLOW.indexOf("      - name: Assemble security policy summary");
    const upload = WORKFLOW.indexOf("      - name: Upload security report");

    expect(WORKFLOW).toContain(
      "\\`gitleaks\\` secret scanning: blocking on pull requests, trunk pushes, and manual runs",
    );
    expect(WORKFLOW).toContain("steps.security_gitleaks.outputs.exit_code");
    expect(upload).toBeGreaterThan(summary);
    expect(
      WORKFLOW.slice(upload, WORKFLOW.indexOf("      - name: Run selected verification profile")),
    ).toContain("if: always()");
    expect(WORKFLOW).toContain("path: ci-reports/security");
    expect(WORKFLOW).toContain('cat ci-reports/security/summary.md >> "$GITHUB_STEP_SUMMARY"');
    expect(SECRET_SCAN).toContain("--ensure-sarif ci-reports/security/gitleaks.sarif");
  });

  it("replaces malformed SARIF with a valid redacted upload artifact and fails closed", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-gitleaks-sarif-"));
    const report = join(directory, "gitleaks.sarif");
    try {
      writeFileSync(report, "not-json");

      expect(ensureSarif(report)).toBe(1);
      expect(JSON.parse(readFileSync(report, "utf8"))).toEqual({ version: "2.1.0", runs: [] });
      expect(readFileSync(`${report}.invalid.txt`, "utf8")).toBe("not-json");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("allows only manifest entrypoints and explicit Actions-owned commands", () => {
    expect(findWorkflowVerificationViolations(VALIDATE_JOB, ROOT_DIR)).toEqual([]);
  });

  it.each(["--log-opts=--max-count=0", "--no-git", "--redact=false"])(
    "rejects a production Gitleaks argv override: %s",
    (extraArgument) => {
      const mutant = VALIDATE_JOB.replace(
        "--report-path /repo/ci-reports/security/gitleaks.sarif >",
        `--report-path /repo/ci-reports/security/gitleaks.sarif ${extraArgument} >`,
      );

      expect(mutant).not.toBe(VALIDATE_JOB);
      expect(findWorkflowVerificationViolations(mutant, ROOT_DIR)).toEqual([
        expect.objectContaining({ reason: "command is not in the Actions-only allowlist" }),
      ]);
    },
  );

  it("rejects alias, direct-leaf, and unknown verifier mutations", () => {
    for (const mutation of [
      "      - name: mutant\n        run: pnpm public-api:check\n",
      "      - name: mutant\n        run: pnpm run public-api:check\n",
      "      - name: mutant\n        run: CI=true pnpm public-api:check\n",
      "      - name: mutant\n        run: |\n          if ! pnpm public-api:check; then\n            exit 1\n          fi\n",
      "      - name: mutant\n        run: node --experimental-strip-types scripts/public-api-surface.mts --check\n",
      "      - name: mutant\n        run: pnpm unknown-verifier\n",
      "      - name: mutant\n        run: pnpm install --frozen-lockfile && pnpm public-api:check\n",
      "      - name: mutant\n        run: pnpm verify:publish-extra\n",
      "      - name: mutant\n        run: node -e \"require('node:child_process').execSync('pnpm public-api:check')\"\n",
      "      - name: mutant\n        run: |\n          echo starting && pnpm public-api:check\n",
      "      - name: mutant\n        run: |\n          echo starting; pnpm public-api:check\n",
      "      - name: mutant\n        run: |\n          command pnpm public-api:check\n",
      "      - name: mutant\n        run: if pnpm public-api:check; then echo ok; fi\n",
    ]) {
      expect(
        findWorkflowVerificationViolations(`${VALIDATE_JOB}\n${mutation}`, ROOT_DIR),
      ).toHaveLength(1);
    }
  });

  it("publishes profile, package quality, generated-app, and coverage evidence", () => {
    expect(WORKFLOW).toContain("name: verification-${{ steps.verification.outputs.profile }}");
    expect(WORKFLOW).toContain("name: package-quality-dashboard");
    expect(WORKFLOW).toContain("name: generated-app-smoke-ecosystem-advisory");
    expect(WORKFLOW).toContain("name: core-coverage-warning-report");
  });

  it("reports whether the publish-only audit policy was selected", () => {
    expect(WORKFLOW).toContain('audit_policy_result="selected by the shared publish profile"');
    expect(WORKFLOW).toContain(
      'audit_policy_result="not selected by the ${{ steps.verification.outputs.profile }} profile"',
    );
  });

  it("preserves docs path routing, isolated API-doc checking, and link checks", () => {
    expect(WORKFLOW).toContain("- 'packages/*/README.md'");
    expect(WORKFLOW).toContain("run: pnpm docs:api:check");
    expect(WORKFLOW).toContain("--exclude-path '(^|/)packages/docs/README\\.md$'");
  });
});
