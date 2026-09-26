import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

import {
  findWorkflowPermissionViolations,
  findWorkflowVerificationViolations,
} from "../workflow-verification-contract.mts";

const WORKFLOW_PATH = resolve(
  import.meta.dirname,
  "../../.github/workflows/ci-performance-observer.yml",
);
const ROOT_DIR = resolve(import.meta.dirname, "../..");
const source = readFileSync(WORKFLOW_PATH, "utf8");

type Step = {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly id?: string;
  readonly if?: string;
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly "continue-on-error"?: boolean;
};

type Workflow = {
  readonly on?: {
    readonly workflow_run?: {
      readonly workflows?: readonly string[];
      readonly types?: readonly string[];
    };
  };
  readonly permissions?: Readonly<Record<string, unknown>>;
  readonly jobs?: {
    readonly observe?: { readonly if?: string; readonly steps?: readonly Step[] };
  };
};

function parsedWorkflow(): Workflow {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0)
    throw new Error(document.errors.map(({ message }) => message).join("\n"));
  return document.toJS() as Workflow;
}

describe("CI performance observer workflow", () => {
  it("runs only after CI completes with read-only permissions", () => {
    const workflow = parsedWorkflow();
    expect(workflow.on?.workflow_run).toEqual({ workflows: ["CI"], types: ["completed"] });
    expect(workflow.permissions).toEqual({ actions: "read", contents: "read" });
    expect(findWorkflowPermissionViolations({ "ci-performance-observer.yml": source })).toEqual([]);
    expect(findWorkflowVerificationViolations(source, ROOT_DIR)).toEqual([]);
  });

  it("skips the whole job without failing when the source run was cancelled", () => {
    const observeJob = parsedWorkflow().jobs?.observe;
    expect(observeJob?.if).toBe("${{ github.event.workflow_run.conclusion != 'cancelled' }}");
    const jobIfIndex = source.indexOf(
      "if: ${{ github.event.workflow_run.conclusion != 'cancelled' }}",
    );
    expect(jobIfIndex).toBeGreaterThan(-1);
    expect(jobIfIndex).toBeLessThan(source.indexOf("Download untrusted performance data"));
    expect(jobIfIndex).toBeLessThan(source.indexOf("Read source run metadata"));
    expect(jobIfIndex).toBeLessThan(source.indexOf("Download exact split evidence when present"));
  });

  it("checks out only the trusted default branch and never executes downloaded PR code", () => {
    const steps = parsedWorkflow().jobs?.observe?.steps ?? [];
    const checkout = steps.find(({ name }) => name === "Checkout trusted observer");
    expect(checkout?.with).toMatchObject({
      ref: "${{ github.event.repository.default_branch }}",
      "persist-credentials": false,
    });
    expect(source).not.toContain("workflow_run.head_sha");
    expect(source).not.toContain("pull_request.head");
    expect(source).not.toContain("pnpm install");
  });

  it("requires exact source artifacts and binds output to the exact run attempt", () => {
    const steps = parsedWorkflow().jobs?.observe?.steps ?? [];
    const download = steps.find(({ name }) => name === "Download untrusted performance data");
    expect(download?.["continue-on-error"]).toBeUndefined();
    expect(download?.with).toMatchObject({
      name: "ci-performance-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}",
      "github-token": "${{ github.token }}",
      "run-id": "${{ github.event.workflow_run.id }}",
    });
    const verification = steps.find(({ name }) => name === "Download untrusted verification data");
    expect(verification?.with).toMatchObject({
      pattern: "verification-*",
      "merge-multiple": true,
      "github-token": "${{ github.token }}",
      "run-id": "${{ github.event.workflow_run.id }}",
    });
    const upload = steps.find(({ name }) => name === "Upload immutable observation");
    expect(upload?.if).toBe(
      "${{ !cancelled() && hashFiles('ci-observation/observation.json') != '' }}",
    );
    expect(upload?.with).toMatchObject({
      name: "ci-observation-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}",
      "if-no-files-found": "error",
      "retention-days": 90,
    });
    const splitDownload = steps.find(
      ({ name }) => name === "Download exact split evidence when present",
    );
    expect(splitDownload?.run).toContain(
      '"ci-lane-core-verification-${SOURCE_RUN_ID}-${SOURCE_RUN_ATTEMPT}"',
    );
    expect(splitDownload?.run).toContain(
      '"ci-lane-split-validation-shadow-${SOURCE_RUN_ID}-${SOURCE_RUN_ATTEMPT}"',
    );
    expect(splitDownload?.run).toContain('gh run download "$SOURCE_RUN_ID"');
    expect(splitDownload?.run).toContain('--repo "$GITHUB_REPOSITORY"');
    expect(splitDownload?.run).toContain('--name "$artifact_name"');
    expect(splitDownload?.run).toContain('if [ "$split_artifact_count" -eq 0 ]');
  });

  it("uses the trusted parser for API metadata and artifact bytes without sourcing either input", () => {
    const record = parsedWorkflow().jobs?.observe?.steps?.find(
      ({ name }) => name === "Record immutable observation",
    );
    expect(record?.run).toContain("scripts/ci-performance-observer.mts");
    expect(record?.run).toContain('--execution-sha "$(cat ci-observer-input/execution-sha.txt)"');
    expect(record?.run).toContain('--base-sha "$(cat ci-observer-input/base-sha.txt)"');
    expect(record?.run).toContain("if [ ! -s ci-observer-input/base-sha.txt ]; then");
    expect(record?.run).toContain("Split observation requires a non-empty trusted base SHA.");
    expect(record?.run).toContain("--source-workflow ci-observer-input/source-ci.yml");
    expect(record?.run).toContain('observer_args+=(--synthesis-input "${synthesis_inputs[0]}")');
    expect(record?.run).toContain("--verification");
    expect(record?.run).toContain("--fast-lane");
    expect(record?.run).toContain("--inventory");
    expect(record?.run).toContain("--package-metadata ci-observer-input/source-package.json");
    expect(record?.run).toContain("--artifacts ci-observer-input/artifacts.json");
    expect(record?.run).toContain('observer_args+=(--producer-bundle "$report")');
    expect(record?.run).toContain(
      'observer_args+=(--split-validation-shadow "${shadow_reports[0]}")',
    );
    expect(record?.run).toContain(
      'observer_args+=(--split-security-summary "${split_security_summaries[0]}")',
    );
    expect(record?.run).toContain("-name split-validation-shadow.json");
    expect(record?.run).toContain("-name split-security-policy-summary.json");
    expect(record?.run).toContain("-name synthesis-input.json");
    expect(record?.run).toContain(
      'if [ "${#producer_reports[@]}" -ne 4 ] || [ "${#shadow_reports[@]}" -ne 1 ]',
    );
    expect(record?.run).not.toMatch(/(?:^|\n)\s*(?:source|eval|\.)\s/);
    expect(source).toContain("> ci-observer-input/source-package.json");
    expect(source).toContain("> ci-observer-input/source-test-inventory.json");
    expect(source).toContain("> ci-observer-input/source-ci.yml");
    expect(source).toContain("> ci-observer-input/artifacts.json");
  });

  it("ends non-publish runs before downloading verification data or re-verifying the source identity", () => {
    const steps = parsedWorkflow().jobs?.observe?.steps ?? [];
    const names = steps.map(({ name }) => name);
    const cohort = steps.find(({ name }) => name === "Select publish observation cohort");
    expect(cohort?.id).toBe("cohort");
    expect(names.indexOf("Select publish observation cohort")).toBe(
      names.indexOf("Download untrusted performance data") + 1,
    );
    for (const name of [
      "Download untrusted verification data",
      "Read source run metadata",
      "Download exact split evidence when present",
      "Record immutable observation",
    ]) {
      const step = steps.find((candidate) => candidate.name === name);
      expect(step?.if, name).toBe("${{ steps.cohort.outputs.publish == 'true' }}");
    }

    const runCohort = (profile: string | null) => {
      const workspace = mkdtempSync(join(tmpdir(), "croco-ci-observer-cohort-"));
      try {
        if (profile) {
          mkdirSync(join(workspace, "ci-observer-input/performance"), { recursive: true });
          writeFileSync(
            join(workspace, "ci-observer-input/performance/raw-sample.json"),
            JSON.stringify({ currentSamples: [{ profile }] }),
          );
        }
        const outputPath = join(workspace, "github-output");
        const summaryPath = join(workspace, "step-summary");
        writeFileSync(outputPath, "");
        writeFileSync(summaryPath, "");
        const result = spawnSync("bash", ["-eo", "pipefail", "-c", cohort?.run ?? ""], {
          cwd: workspace,
          encoding: "utf8",
          env: { ...process.env, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath },
        });
        return {
          status: result.status,
          stderr: result.stderr,
          output: readFileSync(outputPath, "utf8"),
          summary: readFileSync(summaryPath, "utf8"),
        };
      } finally {
        rmSync(workspace, { force: true, recursive: true });
      }
    };

    expect(runCohort("repo")).toEqual({
      status: 0,
      stderr: "",
      output: "publish=false\n",
      summary: "Non-publish CI run is outside the cacheable-lanes observation cohort.\n",
    });
    expect(runCohort("publish")).toEqual({
      status: 0,
      stderr: "",
      output: "publish=true\n",
      summary: "",
    });
    expect(runCohort(null)).toMatchObject({
      status: 1,
      stderr: "The source run did not emit normalized performance evidence.\n",
      output: "",
    });
  });

  it("re-verifies the recorded identity after a tree-less unshallow fetch without reading pull-request state", () => {
    const metadata = parsedWorkflow().jobs?.observe?.steps?.find(
      ({ name }) => name === "Read source run metadata",
    );
    const run = metadata?.run ?? "";
    const normalizedRun = run.replace(/^\s+/gm, "");

    expect(metadata?.env).toMatchObject({
      DEFAULT_BRANCH: "${{ github.event.repository.default_branch }}",
    });
    expect(run).toContain("source_event=$(jq -er '.event' ci-observer-input/run.json)");
    expect(run).toContain("source_head_sha=$(jq -er '.head_sha' ci-observer-input/run.json)");
    expect(run).toContain(
      "recorded_candidate_sha=$(jq -er '.provenance.verificationIdentity.candidateSha' \"$verification_report\")",
    );
    const candidateSelection = [
      'case "$source_event" in',
      'pull_request) candidate_sha="$recorded_candidate_sha" ;;',
      'push | workflow_dispatch) candidate_sha="$source_head_sha" ;;',
      "*)",
      'echo "Unsupported source event for cacheable CI observation." >&2',
    ].join("\n");
    expect(normalizedRun).toContain(candidateSelection);

    const fetch =
      'git fetch --no-tags --filter=tree:0 --unshallow origin "$candidate_sha" "$DEFAULT_BRANCH"';
    const eventBranch = [
      'if [ "$source_event" = "pull_request" ]; then',
      'identity_args+=(--event-base "$recorded_base_sha")',
      "fi",
    ].join("\n");
    const verification =
      'node --experimental-strip-types scripts/ci-verification-identity.mts verify-recorded "${identity_args[@]}"';
    expect(run.match(/\bgit fetch\b/g)).toEqual(["git fetch"]);
    expect(normalizedRun.indexOf(candidateSelection)).toBeLessThan(normalizedRun.indexOf(fetch));
    expect(normalizedRun.indexOf(fetch)).toBeLessThan(normalizedRun.indexOf(eventBranch));
    expect(normalizedRun.indexOf(eventBranch)).toBeLessThan(normalizedRun.indexOf(verification));
    expect(normalizedRun).toContain(
      [
        "identity_args=(",
        '--event "$source_event"',
        '--event-head "$source_head_sha"',
        '--candidate "$candidate_sha"',
        '--checkout "$candidate_sha"',
        '--recorded-base "$recorded_base_sha"',
        '--recorded-head "$recorded_head_sha"',
        '--recorded-candidate "$recorded_candidate_sha"',
        '--default-branch "refs/remotes/origin/${DEFAULT_BRANCH}"',
        "--output ci-observer-input/verification-identity.json",
        ")",
      ].join("\n"),
    );
    expect(run).toContain(
      "jq -er '.candidateSha' ci-observer-input/verification-identity.json > ci-observer-input/execution-sha.txt",
    );
    expect(run).toContain(
      "jq -er '.baseSha' ci-observer-input/verification-identity.json > ci-observer-input/base-sha.txt",
    );

    const identityGuard = '.provenance.verificationIdentity | type == "object"';
    expect(run).toContain(`if ! jq -e '${identityGuard}' "$verification_report" >/dev/null; then`);
    expect(run).toContain("Source verification evidence does not record a verification identity.");
    const guardStatus = (evidence: unknown) =>
      spawnSync("jq", ["-e", identityGuard], { input: JSON.stringify(evidence) }).status;
    expect(
      spawnSync("jq", ["--version"]).status,
      "jq is required to validate the workflow expression",
    ).toBe(0);
    expect(
      guardStatus({
        provenance: { verificationIdentity: { baseSha: "b", headSha: "h", candidateSha: "c" } },
      }),
    ).toBe(0);
    expect(guardStatus({ provenance: {} })).toBe(1);

    for (const forbidden of [
      "git/ref/pull/",
      "SOURCE_PULL_NUMBER",
      "pull_requests",
      "--depth=1",
      "execution-commit.json",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
