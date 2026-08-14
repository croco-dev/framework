import { describe, expect, it } from "vitest";

import { createSecurityPhysicalResults } from "../ci-cacheable-security-evidence.mts";

describe("cacheable CI physical security evidence", () => {
  it("keeps advisory audit failure visible without weakening blocking security outcomes", () => {
    const results = createSecurityPhysicalResults({
      advisoryProductionAudit: 1,
      gitleaksAcceptanceSmoke: 0,
      blockingSecretScan: 0,
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: "advisory-production-audit",
        semantics: "advisory-report",
        outcome: "failed",
      }),
      expect.objectContaining({ id: "gitleaks-acceptance-smoke", outcome: "passed" }),
      expect.objectContaining({ id: "blocking-secret-scan", outcome: "passed" }),
    ]);
  });

  it("records stable exit-code diagnostics for blocking failures", () => {
    const results = createSecurityPhysicalResults({
      advisoryProductionAudit: 0,
      gitleaksAcceptanceSmoke: 2,
      blockingSecretScan: 3,
    });

    expect(results[1]?.diagnostics).toEqual(["gitleaks-acceptance-smoke:exit-code=2"]);
    expect(results[2]?.diagnostics).toEqual(["blocking-secret-scan:exit-code=3"]);
  });
});
