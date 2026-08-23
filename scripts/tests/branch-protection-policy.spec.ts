import { describe, expect, it } from "vitest";

import { findBranchProtectionPolicyViolations } from "../branch-protection-policy.mts";

const REQUIRED_CHECKS = [
  { context: "docs-sync-check", app_id: 15368 },
  { context: "validate", app_id: 15368 },
];

describe("branch-protection-policy.mts", () => {
  it("accepts strict current-base validation with app-bound required checks", () => {
    expect(findBranchProtectionPolicyViolations({ strict: true, checks: REQUIRED_CHECKS })).toEqual(
      [],
    );
  });

  it("rejects required checks that remain valid after trunk advances", () => {
    expect(
      findBranchProtectionPolicyViolations({ strict: false, checks: REQUIRED_CHECKS }),
    ).toContain("trunk required status checks must require the branch to be up to date");
  });

  it("rejects required contexts that are not bound to GitHub Actions", () => {
    expect(
      findBranchProtectionPolicyViolations({
        strict: true,
        checks: [
          { context: "docs-sync-check", app_id: null },
          { context: "validate", app_id: 15368 },
        ],
      }),
    ).toContain("trunk must require the GitHub Actions docs-sync-check check (app_id 15368)");
  });
});
