import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  readonly jobs?: { readonly observe?: { readonly steps?: readonly Step[] } };
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
    expect(record?.run).toContain("--verification");
    expect(record?.run).toContain("--fast-lane");
    expect(record?.run).toContain("--inventory");
    expect(record?.run).toContain("--package-metadata ci-observer-input/source-package.json");
    expect(record?.run).toContain("--artifacts ci-observer-input/artifacts.json");
    expect(record?.run).toContain('observer_args+=(--producer-bundle "$report")');
    expect(record?.run).toContain(
      'observer_args+=(--split-validation-shadow "${shadow_reports[0]}")',
    );
    expect(record?.run).toContain("The source run did not emit normalized performance evidence.");
    expect(record?.run).toContain(
      'if [ "${#producer_reports[@]}" -ne 4 ] || [ "${#shadow_reports[@]}" -ne 1 ]',
    );
    expect(record?.run).not.toMatch(/(?:^|\n)\s*(?:source|eval|\.)\s/);
    expect(source).toContain("> ci-observer-input/source-package.json");
    expect(source).toContain("> ci-observer-input/source-test-inventory.json");
    expect(source).toContain("> ci-observer-input/artifacts.json");
  });
});
