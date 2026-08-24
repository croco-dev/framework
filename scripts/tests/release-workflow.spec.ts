import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  readonly concurrency?: unknown;
  readonly jobs?: {
    readonly release_ref_guard?: {
      readonly outputs?: Record<string, unknown>;
      readonly permissions?: Record<string, unknown>;
      readonly steps?: unknown;
    };
    readonly release?: {
      readonly if?: unknown;
      readonly needs?: unknown;
      readonly steps?: unknown;
    };
  };
  readonly on?: unknown;
  readonly permissions?: unknown;
};

const releaseAuthorityCondition =
  "github.ref == 'refs/heads/trunk' && needs.release_ref_guard.outputs.verified_sha == github.sha";
const releaseActionCondition = `${releaseAuthorityCondition} && steps.release_execution.outputs.should_run_changesets_action == 'true'`;
const releaseMutationCondition = `${releaseActionCondition} && steps.current_trunk.outputs.is_current == 'true'`;

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

function releaseRefGuardSteps(parsedWorkflow: ReleaseWorkflow): WorkflowStep[] {
  const steps = parsedWorkflow.jobs?.release_ref_guard?.steps;
  if (!Array.isArray(steps)) {
    throw new Error("release ref guard job must define a steps array");
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
  expect(parsedWorkflow.concurrency).toEqual({
    group: "release",
    "cancel-in-progress": false,
    queue: "max",
  });

  const guardJob = parsedWorkflow.jobs?.release_ref_guard;
  expect(guardJob?.permissions).toEqual({ contents: "read" });
  expect(guardJob?.outputs).toEqual({
    verified_sha: "${{ steps.verify_ref.outputs.verified_sha }}",
  });
  expect(parsedWorkflow.jobs?.release?.needs).toBe("release_ref_guard");
  expect(parsedWorkflow.jobs?.release?.if).toBe(releaseAuthorityCondition);

  const guardSteps = releaseRefGuardSteps(parsedWorkflow);
  const guardStep = stepByName(guardSteps, "Verify protected release ref");
  expect(guardSteps).toHaveLength(1);
  expect(guardStep.id).toBe("verify_ref");
  expect(guardStep.run).toContain('if [ "$GITHUB_REF" != "refs/heads/trunk" ]; then');
  expect(guardStep.run).toContain("Unsupported Release ref");
  expect(guardStep.run).toContain("Re-run the workflow from the trunk branch");
  expect(guardStep.run).toContain('echo "verified_sha=$GITHUB_SHA" >> "$GITHUB_OUTPUT"');

  const steps = releaseSteps(parsedWorkflow);
  const checkoutStep = stepByName(steps, "Checkout");
  const checkoutIndex = steps.indexOf(checkoutStep);
  expect(checkoutStep.with?.ref).toBe("${{ needs.release_ref_guard.outputs.verified_sha }}");
  const releaseStateStep = stepByName(steps, "Inspect current trunk release state");
  const releaseStateIndex = steps.indexOf(releaseStateStep);
  const releaseWorkStep = stepByName(steps, "Select release work and verification profile");
  const releaseWorkIndex = steps.indexOf(releaseWorkStep);
  expect(releaseStateIndex).toBe(checkoutIndex + 1);
  expect(releaseWorkIndex).toBe(releaseStateIndex + 1);
  expect(releaseStateStep.id).toBe("release_state");
  expect(releaseStateStep.env).toEqual({
    GH_TOKEN: "${{ github.token }}",
    VERIFIED_SHA: "${{ needs.release_ref_guard.outputs.verified_sha }}",
  });
  expect(releaseStateStep.run).toContain('echo "is_current=false" >> "$GITHUB_OUTPUT"');
  expect(releaseWorkStep.if).toBe("steps.release_state.outputs.is_current == 'true'");
  const credentialStep = stepByName(steps, "Verify release PR automation credentials");
  const setupIndex = steps.findIndex((step) => step.name === "Setup pnpm");
  const releaseExecutionIndex = steps.findIndex(
    (step) => step.name === "Resolve cumulative release execution",
  );
  const credentialIndex = steps.indexOf(credentialStep);
  const installIndex = steps.findIndex((step) => step.name === "Install dependencies");
  expect(releaseExecutionIndex).toBeGreaterThan(setupIndex);
  expect(credentialIndex).toBeGreaterThan(releaseExecutionIndex);
  expect(credentialIndex).toBeLessThan(installIndex);
  expect(credentialStep.if).toBe(releaseActionCondition);
  expect(credentialStep.env).toEqual({
    RELEASE_APP_CLIENT_ID: "${{ vars.RELEASE_APP_CLIENT_ID }}",
    RELEASE_APP_PRIVATE_KEY: "${{ secrets.RELEASE_APP_PRIVATE_KEY }}",
  });
  expect(credentialStep.run).toContain("Release App credentials missing");
  expect(credentialStep.run).toContain("RELEASING.md");

  const uploadIndex = steps.findIndex((step) => step.name === "Upload release spine evidence");
  const npmSetupStep = stepByName(steps, "Configure Node.js for npm publishing");
  const npmSetupIndex = steps.indexOf(npmSetupStep);
  const tokenStep = stepByName(steps, "Mint release PR GitHub App token");
  const tokenIndex = steps.indexOf(tokenStep);
  const currentTrunkStep = stepByName(steps, "Revalidate current trunk revision");
  const currentTrunkIndex = steps.indexOf(currentTrunkStep);
  const changesetsStep = stepByName(steps, "Create Release Pull Request or Publish");
  const changesetsIndex = steps.indexOf(changesetsStep);
  expect(npmSetupIndex).toBeGreaterThan(uploadIndex);
  expect(tokenIndex).toBeGreaterThan(npmSetupIndex);
  expect(currentTrunkIndex).toBeGreaterThan(tokenIndex);
  expect(currentTrunkIndex).toBe(changesetsIndex - 1);
  expect(npmSetupStep.if).toBe(releaseActionCondition);
  expect(npmSetupStep.uses).toBe("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
  expect(tokenStep.id).toBe("release_app_token");
  expect(tokenStep.if).toBe(releaseActionCondition);
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
  expect(currentTrunkStep.id).toBe("current_trunk");
  expect(currentTrunkStep.if).toBe(releaseActionCondition);
  expect(currentTrunkStep.env).toEqual({
    GH_TOKEN: "${{ github.token }}",
    VERIFIED_SHA: "${{ needs.release_ref_guard.outputs.verified_sha }}",
  });
  expect(currentTrunkStep.run).toContain('"/repos/${GITHUB_REPOSITORY}/git/ref/heads/trunk"');
  expect(currentTrunkStep.run).toContain('if [ "$current_trunk_sha" != "$VERIFIED_SHA" ]; then');
  expect(currentTrunkStep.run).toContain('echo "is_current=false" >> "$GITHUB_OUTPUT"');
  expect(currentTrunkStep.run).toContain('echo "is_current=true" >> "$GITHUB_OUTPUT"');
  expect(changesetsStep.uses).toBe("changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d");
  expect(changesetsStep.if).toBe(releaseMutationCondition);
  expect(changesetsStep.env?.GITHUB_TOKEN).toBe("${{ steps.release_app_token.outputs.token }}");
  expect(changesetsStep.env?.NODE_AUTH_TOKEN).toBe("${{ secrets.NPM_TOKEN }}");
  expect(
    steps
      .slice(0, changesetsIndex)
      .some((step) => Object.values(step.env ?? {}).includes("${{ secrets.NPM_TOKEN }}")),
  ).toBe(false);
  expect(source).not.toContain("secrets.GITHUB_TOKEN");
  expect(source).not.toMatch(/permission-(?:actions|workflows):/);
}

function runReleaseRefGuard(ref: string | undefined, sha = "a".repeat(40)) {
  const guardStep = stepByName(
    releaseRefGuardSteps(parseWorkflow(workflow)),
    "Verify protected release ref",
  );
  const env = { ...process.env, GITHUB_OUTPUT: "/dev/null", GITHUB_SHA: sha };
  delete env.GITHUB_REF;
  if (ref !== undefined) env.GITHUB_REF = ref;

  return spawnSync("bash", ["-c", String(guardStep.run)], {
    encoding: "utf8",
    env,
  });
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

function runReleaseState(currentSha: string) {
  const fixtureDir = mkdtempSync(resolve(tmpdir(), "release-state-"));
  const output = resolve(fixtureDir, "github-output");
  const ghPath = resolve(fixtureDir, "gh");
  writeFileSync(ghPath, '#!/usr/bin/env bash\nprintf "%s\\n" "$CURRENT_TRUNK_SHA"\n');
  chmodSync(ghPath, 0o755);
  const stateStep = stepByName(
    releaseSteps(parseWorkflow(workflow)),
    "Inspect current trunk release state",
  );
  try {
    const result = spawnSync("bash", ["-c", String(stateStep.run)], {
      cwd: fixtureDir,
      encoding: "utf8",
      env: {
        ...process.env,
        CURRENT_TRUNK_SHA: currentSha,
        GH_TOKEN: "test-token",
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: "croco/framework",
        PATH: `${fixtureDir}:${process.env.PATH ?? ""}`,
        VERIFIED_SHA: "a".repeat(40),
      },
    });
    const githubOutput = result.status === 0 ? readFileSync(output, "utf8") : "";
    return { ...result, githubOutput };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function runCurrentTrunkGuard(currentSha: string, verifiedSha = "a".repeat(40)) {
  const fixtureDir = mkdtempSync(resolve(tmpdir(), "release-current-trunk-"));
  const output = resolve(fixtureDir, "github-output");
  const ghPath = resolve(fixtureDir, "gh");
  writeFileSync(ghPath, '#!/usr/bin/env bash\nprintf "%s\\n" "$CURRENT_TRUNK_SHA"\n');
  chmodSync(ghPath, 0o755);
  const guardStep = stepByName(
    releaseSteps(parseWorkflow(workflow)),
    "Revalidate current trunk revision",
  );
  const result = spawnSync("bash", ["-c", String(guardStep.run)], {
    encoding: "utf8",
    env: {
      ...process.env,
      CURRENT_TRUNK_SHA: currentSha,
      GH_TOKEN: "test-token",
      GITHUB_OUTPUT: output,
      GITHUB_REPOSITORY: "croco/framework",
      PATH: `${fixtureDir}:${process.env.PATH ?? ""}`,
      VERIFIED_SHA: verifiedSha,
    },
  });
  const githubOutput = result.status === 0 ? readFileSync(output, "utf8") : "";
  rmSync(fixtureDir, { recursive: true, force: true });
  return { ...result, githubOutput };
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

  it("accepts manual dispatch from trunk and exports its immutable SHA", () => {
    const fixtureDir = mkdtempSync(resolve(tmpdir(), "release-ref-guard-"));
    const output = resolve(fixtureDir, "github-output");
    const guardStep = stepByName(
      releaseRefGuardSteps(parseWorkflow(workflow)),
      "Verify protected release ref",
    );
    try {
      const result = spawnSync("bash", ["-c", String(guardStep.run)], {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          GITHUB_REF: "refs/heads/trunk",
          GITHUB_SHA: "a".repeat(40),
        },
      });

      expect(result.status).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(`verified_sha=${"a".repeat(40)}\n`);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it.each([
    { name: "feature branch", ref: "refs/heads/feature/release-test" },
    { name: "tag", ref: "refs/tags/v1.2.3" },
    { name: "detached ref", ref: undefined },
  ])("rejects manual dispatch from a $name before checkout", ({ ref }) => {
    const result = runReleaseRefGuard(ref);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unsupported Release ref");
    expect(result.stdout).toContain(ref ?? "<unset>");
    expect(result.stdout).toContain("Re-run the workflow from the trunk branch");
  });

  it("rejects trunk when GitHub does not provide an immutable commit SHA", () => {
    const result = runReleaseRefGuard("refs/heads/trunk", "detached");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Invalid Release SHA");
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

  it("skips superseded runs before setup and admits only the current trunk run", () => {
    const stale = runReleaseState("b".repeat(40));
    const current = runReleaseState("a".repeat(40));

    expect(stale.status).toBe(0);
    expect(stale.githubOutput).toBe("is_current=false\n");
    expect(current.status).toBe(0);
    expect(current.githubOutput).toBe("is_current=true\n");
  });

  it("allows only the release run for the current live trunk revision to mutate", () => {
    const current = runCurrentTrunkGuard("a".repeat(40));
    const stale = runCurrentTrunkGuard("b".repeat(40));

    expect(current.status).toBe(0);
    expect(current.githubOutput).toBe("is_current=true\n");
    expect(stale.status).toBe(0);
    expect(stale.githubOutput).toBe("is_current=false\n");
    expect(stale.stdout).toContain("Superseded Release run");
  });

  it("fails closed when the live trunk API does not return an immutable SHA", () => {
    const result = runCurrentTrunkGuard("not-a-sha");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Invalid live trunk SHA");
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
    {
      name: "initial ref guard removed",
      mutate: (source: string) =>
        source.replace(/  release_ref_guard:\n[\s\S]*?\n  release:\n/, "  release:\n"),
    },
    {
      name: "Changesets defensive ref guard removed",
      mutate: (source: string) =>
        source.replace(
          `if: ${releaseMutationCondition}\n        uses: changesets/action`,
          "if: steps.release_work.outputs.should_run_changesets_action == 'true'\n        uses: changesets/action",
        ),
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
    expect(workflow).toContain(
      'if [ "${{ steps.release_work.outputs.allow_pending_release_metadata }}" = "true" ]; then',
    );
    expect(workflow).toContain("args+=(--allow-pending-release-metadata)");
  });

  it("runs every strict publish gate on manual dispatch", () => {
    expect(
      workflow.match(/if \[ "\$GITHUB_EVENT_NAME" != "workflow_dispatch" \]; then/g),
    ).toHaveLength(2);
    expect(workflow).toContain("args=(--output-dir ci-reports/release)");
  });

  it("keeps provenance authority and Changesets publishing in Actions", () => {
    const steps = releaseSteps(parseWorkflow(workflow));
    const setupNodeStep = stepByName(steps, "Setup Node.js");
    const npmSetupStep = stepByName(steps, "Configure Node.js for npm publishing");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain('NPM_CONFIG_PROVENANCE: "true"');
    expect(setupNodeStep.with?.["registry-url"]).toBeUndefined();
    expect(npmSetupStep.with?.["registry-url"]).toBe("https://registry.npmjs.org");
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain(
      "uses: changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d # v1.9.0",
    );
    expect(workflow).toContain(`if: ${releaseMutationCondition}`);
  });

  it("installs the browser required by publish-profile docs integration before verification", () => {
    const steps = releaseSteps(parseWorkflow(workflow));
    const installDependenciesIndex = steps.findIndex(
      (step) => step.name === "Install dependencies",
    );
    const setupNodeIndex = steps.findIndex((step) => step.name === "Setup Node.js");
    const playwrightStep = stepByName(steps, "Install Playwright Chromium");
    const playwrightIndex = steps.indexOf(playwrightStep);
    const releaseExecutionStep = stepByName(steps, "Resolve cumulative release execution");
    const releaseExecutionIndex = steps.indexOf(releaseExecutionStep);
    const verificationStep = stepByName(steps, "Release publish verification");
    const verificationIndex = steps.indexOf(verificationStep);

    expect(playwrightStep.run).toBe("pnpm --dir packages/docs run playwright:install");
    expect(releaseExecutionStep.id).toBe("release_execution");
    expect(releaseExecutionStep.if).toBe("steps.release_state.outputs.is_current == 'true'");
    expect(releaseExecutionStep.run).toContain("scripts/release-reconciliation-state.mts");
    expect(releaseExecutionStep.run).toContain(
      '--classified-verification "${{ steps.release_work.outputs.should_run_verification }}"',
    );
    expect(releaseExecutionStep.run).toContain(
      '--classified-changesets-action "${{ steps.release_work.outputs.should_run_changesets_action }}"',
    );
    expect(playwrightStep.if).toBe(
      "steps.release_execution.outputs.should_run_verification == 'true'",
    );
    expect(verificationStep.if).toBe(
      "steps.release_execution.outputs.should_run_verification == 'true'",
    );
    expect(releaseExecutionIndex).toBeGreaterThan(setupNodeIndex);
    expect(releaseExecutionIndex).toBeLessThan(installDependenciesIndex);
    expect(playwrightIndex).toBeGreaterThan(releaseExecutionIndex);
    expect(playwrightIndex).toBeLessThan(verificationIndex);
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
