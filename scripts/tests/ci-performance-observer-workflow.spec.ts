import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

function runMetadataFixture(event: "pull_request" | "push" | "workflow_dispatch", forged = false) {
  const workspace = mkdtempSync(join(tmpdir(), "croco-ci-observer-history-"));
  const upstream = join(workspace, "upstream");
  const checkout = join(workspace, "observer");
  mkdirSync(upstream);
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: upstream,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  try {
    git("init", "-b", "trunk");
    git("config", "user.name", "Observer fixture");
    git("config", "user.email", "observer@example.test");
    writeFileSync(join(upstream, "base.txt"), "original base\n");
    git("add", ".");
    git("commit", "-m", "base");
    const baseSha = git("rev-parse", "HEAD");
    git("checkout", "-b", "pull-request");
    writeFileSync(join(upstream, "feature.txt"), "original PR head\n");
    git("add", ".");
    git("commit", "-m", "original PR head");
    const headSha = git("rev-parse", "HEAD");
    git("checkout", "trunk");
    git("merge", "--no-ff", "pull-request", "-m", "original candidate");
    let candidateSha = event === "pull_request" ? git("rev-parse", "HEAD") : headSha;
    if (forged) {
      candidateSha = git(
        "commit-tree",
        `${baseSha}^{tree}`,
        "-p",
        baseSha,
        "-p",
        headSha,
        "-m",
        "forged candidate tree",
      );
    }
    git("branch", "recorded-candidate", candidateSha);
    git("reset", "--hard", baseSha);
    writeFileSync(join(upstream, "later-trunk.txt"), "trunk advanced after the source run\n");
    git("add", ".");
    git("commit", "-m", "later trunk");
    const currentBaseSha = git("rev-parse", "HEAD");
    git("checkout", "pull-request");
    writeFileSync(join(upstream, "feature.txt"), "repushed PR head\n");
    git("add", ".");
    git("commit", "-m", "later PR head");
    const currentHeadSha = git("rev-parse", "HEAD");
    git("checkout", "trunk");
    git(
      "clone",
      "--depth=1",
      "--single-branch",
      "--branch",
      "trunk",
      pathToFileURL(upstream).href,
      checkout,
    );
    mkdirSync(join(checkout, "scripts"));
    for (const script of ["ci-verification-identity.mts", "verification-problem.mts"]) {
      copyFileSync(join(ROOT_DIR, "scripts", script), join(checkout, "scripts", script));
    }
    const inputDir = join(checkout, "ci-observer-input");
    mkdirSync(join(inputDir, "verification"), { recursive: true });
    const identity = {
      schemaVersion: "croco.ci-verification-identity/v1",
      eventName: event,
      baseSha,
      headSha: event === "pull_request" ? headSha : candidateSha,
      candidateSha,
    };
    writeFileSync(
      join(inputDir, "verification/spine-evidence.json"),
      JSON.stringify({ provenance: { verificationIdentity: identity } }),
    );
    const run = {
      event,
      head_sha: identity.headSha,
      pull_requests: [
        { number: 3047, base: { sha: currentBaseSha }, head: { sha: currentHeadSha } },
      ],
    };
    writeFileSync(join(workspace, "run.json"), JSON.stringify(run));
    writeFileSync(
      join(workspace, "source.txt"),
      Buffer.from("trusted source artifact\n").toString("base64"),
    );
    const ghPath = join(workspace, "gh");
    writeFileSync(
      ghPath,
      `#!/usr/bin/env bash
set -eo pipefail
printf '%s\\t' "$@" >> "$API_LOG"
printf '\\n' >> "$API_LOG"
[ "$1" = api ] || exit 91
endpoint=
matching_ref=false
for arg in "$@"; do
  case "$arg" in
    /repos/*) endpoint="$arg" ;;
    "ref=$EXPECTED_CANDIDATE") matching_ref=true ;;
  esac
done
case "$endpoint" in
  /repos/croco/framework/actions/runs/1)
    cat "$RUN_FIXTURE" ;;
  '/repos/croco/framework/actions/runs/1/jobs?filter=latest&per_page=100')
    printf '%s\\n' '{"jobs":[]}' ;;
  '/repos/croco/framework/actions/runs/1/artifacts?per_page=100')
    printf '%s\\n' '{"total_count":0,"artifacts":[]}' ;;
  /repos/croco/framework/contents/package.json | /repos/croco/framework/contents/test-inventory.json | /repos/croco/framework/contents/.github/workflows/ci.yml)
    [ "$matching_ref" = true ] || exit 92
    cat "$SOURCE_FIXTURE" ;;
  *) exit 93 ;;
esac
`,
    );
    chmodSync(ghPath, 0o755);
    const metadata = parsedWorkflow().jobs?.observe?.steps?.find(
      ({ name }) => name === "Read source run metadata",
    );
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", metadata?.run ?? ""], {
      cwd: checkout,
      encoding: "utf8",
      env: {
        ...process.env,
        DEFAULT_BRANCH: "trunk",
        GH_TOKEN: "test-token",
        GITHUB_REPOSITORY: "croco/framework",
        SOURCE_RUN_ID: "1",
        PATH: `${workspace}:${process.env.PATH ?? ""}`,
        RUN_FIXTURE: join(workspace, "run.json"),
        SOURCE_FIXTURE: join(workspace, "source.txt"),
        API_LOG: join(workspace, "api.log"),
        EXPECTED_CANDIDATE: candidateSha,
      },
    });
    const readOutput = (name: string) =>
      existsSync(join(inputDir, name)) ? readFileSync(join(inputDir, name), "utf8") : null;
    return {
      status: result.status,
      stderr: result.stderr,
      identity,
      currentBaseSha,
      currentHeadSha,
      executionSha: readOutput("execution-sha.txt")?.trim(),
      baseSha: readOutput("base-sha.txt")?.trim(),
      verifiedIdentity: readOutput("verification-identity.json"),
      sourcePackage: readOutput("source-package.json"),
      apiCalls: readFileSync(join(workspace, "api.log"), "utf8")
        .trim()
        .split("\n")
        .map((line) => line.trimEnd().split("\t")),
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
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
    expect(parsedWorkflow().jobs?.observe?.if).toBe(
      "${{ github.event.workflow_run.conclusion != 'cancelled' }}",
    );
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
    expect(run).toContain("source_event=$(jq -r '.event' ci-observer-input/run.json)");
    expect(run).toContain("source_head_sha=$(jq -r '.head_sha' ci-observer-input/run.json)");
    expect(run).toContain(
      "recorded_candidate_sha=$(jq -r '.provenance.verificationIdentity.candidateSha' \"$verification_report\")",
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

  it.each(["pull_request", "workflow_dispatch", "push"] as const)(
    "executes metadata verification for an old %s run after trunk advances and its open PR is repushed",
    (event) => {
      const result = runMetadataFixture(event);
      expect(result.status, result.stderr).toBe(0);
      expect(result.identity.baseSha).not.toBe(result.currentBaseSha);
      expect(result.identity.headSha).not.toBe(result.currentHeadSha);
      expect(result.executionSha).toBe(result.identity.candidateSha);
      expect(result.baseSha).toBe(result.identity.baseSha);
      expect(JSON.parse(result.verifiedIdentity ?? "null")).toEqual(result.identity);
      expect(result.sourcePackage).toBe("trusted source artifact\n");
      expect(result.apiCalls).toHaveLength(6);
      expect(
        result.apiCalls
          .flat()
          .some((arg) => arg.includes("/pulls/") || arg.includes("git/ref/pull/")),
      ).toBe(false);
    },
  );

  it("rejects a forged recorded candidate tree before reading source artifacts", () => {
    const result = runMetadataFixture("pull_request", true);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("VERIFICATION_CANDIDATE_TREE_MISMATCH");
    expect(result.executionSha).toBeUndefined();
    expect(result.verifiedIdentity).toBeNull();
    expect(result.sourcePackage).toBeNull();
    expect(result.apiCalls).toHaveLength(3);
  });

  it("rejects a recorded verification identity that is not a full commit OID before fetching it", () => {
    const metadata = parsedWorkflow().jobs?.observe?.steps?.find(
      ({ name }) => name === "Read source run metadata",
    );
    expect(metadata?.run).toContain("for recorded_field in baseSha headSha candidateSha; do");
    expect(metadata?.run).toContain('if [[ ! "$source_head_sha" =~ ^[0-9a-f]{40}$ ]]; then');
    expect(metadata?.run).toContain(
      "Recorded verification identity field ${recorded_field} is not a full commit OID.",
    );
    expect(metadata?.run).toContain("Source run head_sha is not a full commit OID.");
    expect(
      metadata?.run?.indexOf(
        "Recorded verification identity field ${recorded_field} is not a full commit OID.",
      ),
    ).toBeLessThan(metadata?.run?.indexOf('case "$source_event" in') ?? -1);
    expect(metadata?.run?.indexOf("Source run head_sha is not a full commit OID.")).toBeLessThan(
      metadata?.run?.indexOf('case "$source_event" in') ?? -1,
    );

    const workspace = mkdtempSync(join(tmpdir(), "croco-ci-observer-metadata-"));
    try {
      const verificationDir = join(workspace, "ci-observer-input/verification");
      mkdirSync(verificationDir, { recursive: true });
      writeFileSync(
        join(verificationDir, "spine-evidence.json"),
        JSON.stringify({
          provenance: {
            verificationIdentity: {
              baseSha: "1".repeat(40),
              headSha: "2".repeat(40),
              candidateSha: `${"3".repeat(40)}:refs/heads/malicious`,
            },
          },
        }),
      );
      const ghPath = join(workspace, "gh");
      writeFileSync(
        ghPath,
        `#!/usr/bin/env bash\nprintf '%s\\n' '{"event":"pull_request","head_sha":"${"4".repeat(40)}"}'\n`,
      );
      chmodSync(ghPath, 0o755);
      const result = spawnSync("bash", ["-eo", "pipefail", "-c", metadata?.run ?? ""], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEFAULT_BRANCH: "trunk",
          GH_TOKEN: "test-token",
          GITHUB_REPOSITORY: "croco/framework",
          PATH: `${workspace}:${process.env.PATH ?? ""}`,
          SOURCE_RUN_ID: "1",
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Recorded verification identity field candidateSha is not a full commit OID.",
      );
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });

  it("reports the source run head_sha check separately from the recorded identity", () => {
    const metadata = parsedWorkflow().jobs?.observe?.steps?.find(
      ({ name }) => name === "Read source run metadata",
    );
    const workspace = mkdtempSync(join(tmpdir(), "croco-ci-observer-metadata-"));
    try {
      const verificationDir = join(workspace, "ci-observer-input/verification");
      mkdirSync(verificationDir, { recursive: true });
      writeFileSync(
        join(verificationDir, "spine-evidence.json"),
        JSON.stringify({
          provenance: {
            verificationIdentity: {
              baseSha: "1".repeat(40),
              headSha: "2".repeat(40),
              candidateSha: "3".repeat(40),
            },
          },
        }),
      );
      const ghPath = join(workspace, "gh");
      writeFileSync(
        ghPath,
        '#!/usr/bin/env bash\nprintf \'%s\\n\' \'{"event":"pull_request","head_sha":"not-a-sha"}\'\n',
      );
      chmodSync(ghPath, 0o755);
      const result = spawnSync("bash", ["-eo", "pipefail", "-c", metadata?.run ?? ""], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEFAULT_BRANCH: "trunk",
          GH_TOKEN: "test-token",
          GITHUB_REPOSITORY: "croco/framework",
          PATH: `${workspace}:${process.env.PATH ?? ""}`,
          SOURCE_RUN_ID: "1",
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Source run head_sha is not a full commit OID.");
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });

  it("names the recorded field that is null instead of exiting silently", () => {
    const metadata = parsedWorkflow().jobs?.observe?.steps?.find(
      ({ name }) => name === "Read source run metadata",
    );
    const workspace = mkdtempSync(join(tmpdir(), "croco-ci-observer-metadata-"));
    try {
      const verificationDir = join(workspace, "ci-observer-input/verification");
      mkdirSync(verificationDir, { recursive: true });
      writeFileSync(
        join(verificationDir, "spine-evidence.json"),
        JSON.stringify({
          provenance: {
            verificationIdentity: {
              baseSha: "1".repeat(40),
              headSha: "2".repeat(40),
              candidateSha: null,
            },
          },
        }),
      );
      const ghPath = join(workspace, "gh");
      writeFileSync(
        ghPath,
        `#!/usr/bin/env bash\nprintf '%s\\n' '{"event":"pull_request","head_sha":"${"4".repeat(40)}"}'\n`,
      );
      chmodSync(ghPath, 0o755);
      const result = spawnSync("bash", ["-eo", "pipefail", "-c", metadata?.run ?? ""], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEFAULT_BRANCH: "trunk",
          GH_TOKEN: "test-token",
          GITHUB_REPOSITORY: "croco/framework",
          PATH: `${workspace}:${process.env.PATH ?? ""}`,
          SOURCE_RUN_ID: "1",
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Recorded verification identity field candidateSha is not a full commit OID.",
      );
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });

  describe("split evidence download selection", () => {
    const lanes = [
      "core-verification",
      "generated-apps",
      "package-artifacts",
      "coverage-security",
      "split-validation-shadow",
    ];
    const artifactSet = (attempt: number, run = 42) =>
      lanes.map((lane) => ({ name: `ci-lane-${lane}-${run}-${attempt}`, expired: false }));

    function runDownload(artifacts: readonly { name: string; expired: boolean }[]) {
      const splitDownload = parsedWorkflow().jobs?.observe?.steps?.find(
        ({ name }) => name === "Download exact split evidence when present",
      );
      expect(splitDownload?.run).toBeTruthy();
      const workspace = mkdtempSync(join(tmpdir(), "croco-ci-observer-split-"));
      try {
        mkdirSync(join(workspace, "ci-observer-input"), { recursive: true });
        writeFileSync(
          join(workspace, "ci-observer-input/artifacts.json"),
          JSON.stringify({ total_count: artifacts.length, artifacts }),
        );
        const logPath = join(workspace, "downloads.jsonl");
        writeFileSync(logPath, "");
        const ghPath = join(workspace, "gh");
        writeFileSync(
          ghPath,
          '#!/usr/bin/env bash\njq -cn --args \'$ARGS.positional\' -- "$@" >> "$DOWNLOAD_LOG"\n',
        );
        chmodSync(ghPath, 0o755);
        const result = spawnSync("bash", ["-eo", "pipefail", "-c", splitDownload?.run ?? ""], {
          cwd: workspace,
          encoding: "utf8",
          env: {
            ...process.env,
            DOWNLOAD_LOG: logPath,
            GH_TOKEN: "test-token",
            GITHUB_REPOSITORY: "croco-dev/framework",
            PATH: `${workspace}:${process.env.PATH ?? ""}`,
            SOURCE_RUN_ATTEMPT: "2",
            SOURCE_RUN_ID: "42",
          },
        });
        return {
          status: result.status,
          stderr: result.stderr,
          downloads: readFileSync(logPath, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as string[]),
        };
      } finally {
        rmSync(workspace, { force: true, recursive: true });
      }
    }

    const expectedDownloads = artifactSet(2).map(({ name }) => [
      "run",
      "download",
      "42",
      "--repo",
      "croco-dev/framework",
      "--name",
      name,
      "--dir",
      `ci-observer-input/split/${name}`,
    ]);

    it("downloads only the current attempt when both attempts have complete sets", () => {
      expect(runDownload([...artifactSet(1), ...artifactSet(2)])).toEqual({
        status: 0,
        stderr: "",
        downloads: expectedDownloads,
      });
    });

    it("does not download old-attempt evidence when the current attempt has none", () => {
      expect(runDownload(artifactSet(1))).toEqual({ status: 0, stderr: "", downloads: [] });
    });

    it("ignores artifacts for another run even when its attempt matches", () => {
      expect(runDownload([...artifactSet(2, 142), ...artifactSet(2)])).toEqual({
        status: 0,
        stderr: "",
        downloads: expectedDownloads,
      });
    });

    it.each([
      ["incomplete", artifactSet(2).slice(0, 4)],
      ["duplicate", [...artifactSet(2), artifactSet(2)[0]]],
      ["unknown lane", [...artifactSet(2), { name: "ci-lane-unknown-42-2", expired: false }]],
    ])(
      "rejects a current-attempt %s set even when an old complete set exists",
      (_kind, current) => {
        const result = runDownload([...artifactSet(1), ...current]);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          "Expected an exact five-artifact Phase B split evidence set.",
        );
        expect(result.downloads).toEqual([]);
      },
    );

    it("rejects an expired current artifact even when the old attempt is complete", () => {
      const current = artifactSet(2).map((artifact, index) => ({
        ...artifact,
        expired: index === 0,
      }));
      const result = runDownload([...artifactSet(1), ...current]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Expected one unexpired ci-lane-core-verification-42-2 artifact.",
      );
      expect(result.downloads).toEqual([]);
    });
  });
});
