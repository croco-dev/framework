import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getVerificationCommand } from "../verification-manifest.mts";
import { findWorkflowVerificationViolations } from "../workflow-verification-contract.mts";

const ROOT_DIR = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(resolve(ROOT_DIR, ".github/workflows/ci.yml"), "utf8");
const RENOVATE_CONFIG = JSON.parse(
  readFileSync(resolve(ROOT_DIR, ".github/renovate.json"), "utf8"),
) as Record<string, unknown>;
const ROOT_PACKAGE_JSON = JSON.parse(
  readFileSync(resolve(ROOT_DIR, "package.json"), "utf8"),
) as Record<string, unknown>;
const PNPM_LOCK = readFileSync(resolve(ROOT_DIR, "pnpm-lock.yaml"), "utf8");
const VALIDATE_JOB = WORKFLOW.slice(
  WORKFLOW.indexOf("  validate:"),
  WORKFLOW.indexOf("  changes:"),
);

describe("CI executable supply chain", () => {
  it("pins Gitleaks to a readable version and immutable OCI digest", () => {
    expect(WORKFLOW).toContain(
      "ghcr.io/gitleaks/gitleaks:v8.23.0@sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e",
    );
    expect(WORKFLOW).toContain("# renovate: datasource=docker depName=ghcr.io/gitleaks/gitleaks");
    expect(WORKFLOW).not.toContain("ghcr.io/gitleaks/gitleaks:v8.23.0 detect");
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

  it("keeps advisory scans and ecosystem smoke outside blocking profiles", () => {
    expect(WORKFLOW).toContain("continue-on-error: true");
    expect(WORKFLOW).toContain("pnpm audit:prod > ci-reports/security/pnpm-audit-prod.txt");
    expect(WORKFLOW).toContain("ghcr.io/gitleaks/gitleaks:v8.23.0");
    expect(WORKFLOW).toContain("pnpm create-croco-app:smoke -- --tier ecosystem-advisory");
    expect(WORKFLOW).not.toContain("pnpm create-croco-app:smoke -- --tier spine-blocking");
  });

  it("allows only manifest entrypoints and explicit Actions-owned commands", () => {
    expect(findWorkflowVerificationViolations(VALIDATE_JOB, ROOT_DIR)).toEqual([]);
  });

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
