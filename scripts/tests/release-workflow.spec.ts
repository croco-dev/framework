import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

import { findWorkflowVerificationViolations } from "../workflow-verification-contract.mts";

const rootDir = resolve(__dirname, "../..");
const workflow = readFileSync(resolve(rootDir, ".github/workflows/release.yml"), "utf8");

type WorkflowStep = {
  readonly env?: Record<string, unknown>;
  readonly id?: unknown;
  readonly if?: unknown;
  readonly name?: unknown;
  readonly run?: unknown;
  readonly uses?: unknown;
  readonly with?: Record<string, unknown>;
};

type ReleaseWorkflow = {
  readonly jobs?: {
    readonly release?: {
      readonly steps?: unknown;
    };
  };
  readonly on?: unknown;
  readonly permissions?: unknown;
};

function parseWorkflow(source: string): ReleaseWorkflow {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  }

  return document.toJS() as ReleaseWorkflow;
}

function releaseSteps(parsedWorkflow: ReleaseWorkflow): WorkflowStep[] {
  const steps = parsedWorkflow.jobs?.release?.steps;
  if (!Array.isArray(steps)) {
    throw new Error("release job must define a steps array");
  }

  return steps as WorkflowStep[];
}

function stepByName(steps: readonly WorkflowStep[], name: string): WorkflowStep {
  const step = steps.find((candidate) => candidate.name === name);
  if (!step) {
    throw new Error(`missing release step: ${name}`);
  }

  return step;
}

function assertReleasePrAuthenticationContract(source: string): void {
  const parsedWorkflow = parseWorkflow(source);
  expect(parsedWorkflow.on).toEqual({
    push: { branches: ["trunk"] },
    workflow_dispatch: null,
  });
  expect(parsedWorkflow.permissions).toEqual({
    contents: "read",
    "id-token": "write",
  });

  const steps = releaseSteps(parsedWorkflow);
  const credentialStep = stepByName(steps, "Verify release PR automation credentials");
  const setupIndex = steps.findIndex((step) => step.name === "Setup pnpm");
  const credentialIndex = steps.indexOf(credentialStep);
  expect(credentialIndex).toBeGreaterThan(-1);
  expect(credentialIndex).toBeLessThan(setupIndex);
  expect(credentialStep.if).toBe(
    "steps.release_work.outputs.should_run_changesets_action == 'true'",
  );
  expect(credentialStep.env).toEqual({
    RELEASE_APP_CLIENT_ID: "${{ vars.RELEASE_APP_CLIENT_ID }}",
    RELEASE_APP_PRIVATE_KEY: "${{ secrets.RELEASE_APP_PRIVATE_KEY }}",
  });
  expect(credentialStep.run).toContain("Release App credentials missing");
  expect(credentialStep.run).toContain("RELEASING.md");

  const uploadIndex = steps.findIndex((step) => step.name === "Upload release spine evidence");
  const tokenStep = stepByName(steps, "Mint release PR GitHub App token");
  const tokenIndex = steps.indexOf(tokenStep);
  const changesetsStep = stepByName(steps, "Create Release Pull Request or Publish");
  const changesetsIndex = steps.indexOf(changesetsStep);
  expect(tokenIndex).toBeGreaterThan(uploadIndex);
  expect(tokenIndex).toBeLessThan(changesetsIndex);
  expect(tokenStep.id).toBe("release_app_token");
  expect(tokenStep.if).toBe("steps.release_work.outputs.should_run_changesets_action == 'true'");
  expect(tokenStep.uses).toBe(
    "actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1",
  );
  expect(tokenStep.with).toEqual({
    "client-id": "${{ vars.RELEASE_APP_CLIENT_ID }}",
    "private-key": "${{ secrets.RELEASE_APP_PRIVATE_KEY }}",
    owner: "${{ github.repository_owner }}",
    repositories: "${{ github.event.repository.name }}",
    "permission-contents": "write",
    "permission-pull-requests": "write",
  });
  expect(changesetsStep.uses).toBe("changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d");
  expect(changesetsStep.env?.GITHUB_TOKEN).toBe("${{ steps.release_app_token.outputs.token }}");
  expect(source).not.toContain("secrets.GITHUB_TOKEN");
  expect(source).not.toMatch(/permission-(?:actions|workflows):/);
}

function runCredentialPreflight(clientId?: string, privateKey?: string) {
  const credentialStep = stepByName(
    releaseSteps(parseWorkflow(workflow)),
    "Verify release PR automation credentials",
  );
  const env = { ...process.env };
  delete env.RELEASE_APP_CLIENT_ID;
  delete env.RELEASE_APP_PRIVATE_KEY;
  if (clientId !== undefined) env.RELEASE_APP_CLIENT_ID = clientId;
  if (privateKey !== undefined) env.RELEASE_APP_PRIVATE_KEY = privateKey;

  return spawnSync("bash", ["-c", String(credentialStep.run)], {
    encoding: "utf8",
    env,
  });
}

describe("Release PR authentication contract", () => {
  it("parses as YAML 1.2 and enforces the scoped GitHub App token flow", () => {
    assertReleasePrAuthenticationContract(workflow);
  });

  it("rejects malformed and duplicate-key YAML", () => {
    const malformed = workflow.replace("\njobs:\n", "\njobs\n");
    const duplicate = `${workflow}\npermissions:\n  contents: write\n`;

    expect(() => parseWorkflow(malformed)).toThrow();
    expect(() => parseWorkflow(duplicate)).toThrow(/Map keys must be unique/);
  });

  it.each([
    { clientId: undefined, privateKey: "private-key-value", missing: "RELEASE_APP_CLIENT_ID" },
    { clientId: "client-id-value", privateKey: undefined, missing: "RELEASE_APP_PRIVATE_KEY" },
    {
      clientId: undefined,
      privateKey: undefined,
      missing: "RELEASE_APP_CLIENT_ID RELEASE_APP_PRIVATE_KEY",
    },
  ])(
    "fails early without exposing values when $missing is missing",
    ({ clientId, privateKey, missing }) => {
      const result = runCredentialPreflight(clientId, privateKey);

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("Release App credentials missing");
      expect(result.stdout).toContain(`Configure ${missing} per RELEASING.md`);
      expect(result.stdout).not.toContain("client-id-value");
      expect(result.stdout).not.toContain("private-key-value");
    },
  );

  it("accepts configured credential names without printing their values", () => {
    const result = runCredentialPreflight("client-id-value", "private-key-value");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("rejects a token step moved after Changesets", () => {
    const tokenStart = workflow.indexOf("      - name: Mint release PR GitHub App token");
    const changesetsStart = workflow.indexOf(
      "      - name: Create Release Pull Request or Publish",
    );
    const tokenBlock = workflow.slice(tokenStart, changesetsStart);
    const mutant = `${workflow.slice(0, tokenStart)}${workflow.slice(changesetsStart)}${tokenBlock}`;

    expect(() => assertReleasePrAuthenticationContract(mutant)).toThrow();
  });

  it.each([
    {
      name: "missing client ID binding",
      mutate: (source: string) =>
        source.replaceAll("vars.RELEASE_APP_CLIENT_ID", "vars.MISSING_RELEASE_APP_CLIENT_ID"),
    },
    {
      name: "missing private key binding",
      mutate: (source: string) =>
        source.replaceAll(
          "secrets.RELEASE_APP_PRIVATE_KEY",
          "secrets.MISSING_RELEASE_APP_PRIVATE_KEY",
        ),
    },
    {
      name: "broadened workflow permissions",
      mutate: (source: string) =>
        source.replace("permissions:\n  contents: read", "permissions:\n  contents: write"),
    },
    {
      name: "Actions permission added to the App token",
      mutate: (source: string) =>
        source.replace(
          "permission-contents: write",
          "permission-actions: write\n          permission-contents: write",
        ),
    },
    {
      name: "GITHUB_TOKEN fallback",
      mutate: (source: string) =>
        source.replace("steps.release_app_token.outputs.token", "secrets.GITHUB_TOKEN"),
    },
    {
      name: "recursive pull request trigger",
      mutate: (source: string) =>
        source.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  pull_request:\n"),
    },
    {
      name: "token minted before verification",
      mutate: moveTokenBeforeVerification,
    },
  ])("rejects hostile authentication mutation: $name", ({ mutate }) => {
    expect(() => assertReleasePrAuthenticationContract(mutate(workflow))).toThrow();
  });
});

function moveTokenBeforeVerification(source: string): string {
  const tokenStart = source.indexOf("      - name: Mint release PR GitHub App token");
  const changesetsStart = source.indexOf("      - name: Create Release Pull Request or Publish");
  const tokenBlock = source.slice(tokenStart, changesetsStart);
  const withoutToken = `${source.slice(0, tokenStart)}${source.slice(changesetsStart)}`;
  const verificationStart = withoutToken.indexOf("      - name: Release publish verification");

  return `${withoutToken.slice(0, verificationStart)}${tokenBlock}${withoutToken.slice(verificationStart)}`;
}

describe("Release verification profile contract", () => {
  it("uses the shared classifier and one publish profile invocation", () => {
    expect(workflow).toContain("scripts/verification-change-classifier.mts");
    expect(workflow).toContain('--event "$GITHUB_EVENT_NAME"');
    expect(workflow).toContain("--workflow release");
    expect(workflow).toContain('echo "base=$base" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain(
      'if [ "$GITHUB_EVENT_NAME" != "workflow_dispatch" ]; then\n            args+=(--base "${{ steps.release_work.outputs.base }}" --head HEAD)',
    );
    expect(workflow).toContain('pnpm verify:publish -- "${args[@]}"');
    expect(workflow.match(/verify:publish/g)).toHaveLength(1);
    expect(workflow).not.toContain("test:release-gates");
    expect(workflow).not.toContain("--allow-pending-release-metadata");
  });

  it("runs every strict publish gate on manual dispatch", () => {
    expect(
      workflow.match(/if \[ "\$GITHUB_EVENT_NAME" != "workflow_dispatch" \]; then/g),
    ).toHaveLength(2);
    expect(workflow).toContain("args=(--output-dir ci-reports/release)");
  });

  it("keeps provenance authority and Changesets publishing in Actions", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain('NPM_CONFIG_PROVENANCE: "true"');
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain(
      "uses: changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d # v1.9.0",
    );
    expect(workflow).toContain(
      "if: steps.release_work.outputs.should_run_changesets_action == 'true'",
    );
  });

  it("preserves release report and artifact compatibility paths", () => {
    expect(workflow).toContain("ci-reports/release/spine-evidence.md");
    expect(workflow).toContain("name: release-spine-evidence");
    expect(workflow).toContain("path: ci-reports/release");
    expect(workflow).toContain("include-hidden-files: true");
  });

  it("contains no parallel or unknown verification commands", () => {
    expect(findWorkflowVerificationViolations(workflow, rootDir)).toEqual([]);
    expect(workflow).not.toContain("release_gate_maintenance_pattern");
  });

  it("rejects a manifest-owned alias inserted into Release", () => {
    const mutant = `${workflow}\n      - name: mutant\n        run: pnpm public-api:check\n`;
    expect(findWorkflowVerificationViolations(mutant, rootDir)).toMatchObject([
      { reason: "manifest-owned root alias: public-api:check" },
    ]);
  });

  it("rejects inline list-step profile overrides", () => {
    const mutant = `${workflow}\n  - run: pnpm verify:publish -- --profile repo\n`;
    expect(findWorkflowVerificationViolations(mutant, rootDir)).toMatchObject([
      { reason: "verification profile aliases cannot override --profile" },
    ]);
  });

  it.each([
    "pnpm install --frozen-lockfile && pnpm public-api:check",
    "pnpm verify:publish -- --profile repo",
    "pnpm verify:publish-extra",
    "node -e \"require('node:child_process').execSync('pnpm public-api:check')\"",
    "echo starting && pnpm public-api:check",
    "echo starting; pnpm public-api:check",
    "command pnpm public-api:check",
    "if pnpm public-api:check; then echo ok; fi",
  ])("rejects compound or prefix-bypass mutation %s", (command) => {
    const mutant = `${workflow}\n      - name: mutant\n        run: ${command}\n`;
    expect(findWorkflowVerificationViolations(mutant, rootDir)).not.toEqual([]);
  });
});
