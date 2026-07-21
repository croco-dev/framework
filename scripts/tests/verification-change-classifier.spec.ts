import { describe, expect, it } from "vitest";

import { classifyVerificationChanges } from "../verification-change-classifier.mts";
import { verificationImplementationPaths } from "../verification-manifest.mts";
import { formatVerificationProblem, VerificationProblem } from "../verification-problem.mts";

describe("verification change classifier", () => {
  it.each([
    [["docs/guide.md"], "repo"],
    [["docs-backup/guide.md"], "spine"],
    [["packages/retry-core/README.md.bak"], "spine"],
    [["packages/retry-core/src/index.ts"], "spine"],
    [["scripts/release-spine-evidence.mts"], "publish"],
    [["scripts/ci-executable-policy.mts"], "publish"],
    [["scripts/tests/ci-executable-policy.spec.ts"], "publish"],
    [[".github/renovate.json"], "publish"],
    [[".github/workflows/ci.yml"], "publish"],
    [[".changeset/new.md"], "repo"],
    [["packages/retry-core/package.json"], "publish"],
    [["turbo.json"], "spine"],
    [["vitest.config.ts"], "spine"],
    [["tsconfig.json"], "spine"],
    [[".nvmrc"], "spine"],
    [[".gitignore"], "spine"],
  ] as const)("routes pull request files %j to %s", (files, profile) => {
    expect(classifyVerificationChanges("pull_request", files, "ci")).toMatchObject({
      profile,
      shouldRunVerification: true,
    });
  });

  it("routes trunk changesets, candidates, maintenance, and docs independently", () => {
    expect(classifyVerificationChanges("push", [".changeset/new.md"])).toMatchObject({
      profile: null,
      shouldUpdateReleasePr: true,
      shouldRunChangesetsAction: true,
    });
    expect(classifyVerificationChanges("push", ["packages/retry-core/package.json"])).toMatchObject(
      {
        profile: "publish",
        shouldRunVerification: true,
        shouldUpdateReleasePr: false,
        shouldRunChangesetsAction: true,
      },
    );
    expect(
      classifyVerificationChanges("push", ["scripts/release-spine-evidence.mts"]),
    ).toMatchObject({
      profile: "publish",
      shouldRunVerification: true,
      shouldRunChangesetsAction: false,
    });
    expect(classifyVerificationChanges("push", ["docs/guide.md"])).toMatchObject({
      profile: null,
      shouldRunVerification: false,
    });
  });

  it.each([
    [["packages/retry-core/src/index.ts"], "spine"],
    [[".changeset/new.md", "packages/retry-core/src/index.ts"], "spine"],
    [["docs/guide.md"], "repo"],
  ] as const)("routes CI push files %j to %s verification", (files, profile) => {
    expect(classifyVerificationChanges("push", files, "ci")).toMatchObject({
      profile,
      shouldRunVerification: true,
      shouldRunChangesetsAction: false,
      shouldUpdateReleasePr: false,
    });
  });

  it.each(verificationImplementationPaths())(
    "routes manifest-owned implementation maintenance %s through publish verification",
    (path) => {
      for (const event of ["pull_request", "push"] as const) {
        expect(classifyVerificationChanges(event, [path])).toMatchObject({
          profile: "publish",
          shouldRunVerification: true,
        });
      }
    },
  );

  it.each([
    "scripts/verification-manifest.mts",
    "scripts/verification-change-classifier.mts",
    "scripts/verification-command.mts",
    "scripts/verification-problem.mts",
    "scripts/workflow-verification-contract.mts",
  ])("routes verification control maintenance %s through publish verification", (path) => {
    expect(classifyVerificationChanges("push", [path])).toMatchObject({
      profile: "publish",
      shouldRunVerification: true,
    });
  });

  it("unions mixed release actions and maps dispatch explicitly", () => {
    expect(
      classifyVerificationChanges("push", [".changeset/new.md", "package.json"]),
    ).toMatchObject({
      profile: "publish",
      shouldUpdateReleasePr: true,
      shouldRunChangesetsAction: true,
    });
    expect(classifyVerificationChanges("workflow_dispatch", [])).toMatchObject({
      profile: "publish",
      shouldRunVerification: true,
      shouldUpdateReleasePr: true,
      shouldRunChangesetsAction: true,
    });
    expect(classifyVerificationChanges("workflow_dispatch", [], "ci")).toMatchObject({
      profile: "publish",
      shouldRunVerification: true,
      shouldUpdateReleasePr: false,
      shouldRunChangesetsAction: false,
    });
  });

  it("fails closed for unknown release-adjacent paths", () => {
    try {
      classifyVerificationChanges("pull_request", [".changeset/unknown.json"]);
      expect.unreachable("classification must fail closed");
    } catch (error) {
      expect(error).toBeInstanceOf(VerificationProblem);
      expect(error).toMatchObject({
        category: "contract",
        code: "UNCLASSIFIED_RELEASE_PATH",
        message: expect.stringContaining("Unclassified release-adjacent path"),
      });
      expect(formatVerificationProblem(error)).toContain("[UNCLASSIFIED_RELEASE_PATH/contract]");
    }
  });
});
