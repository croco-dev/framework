import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSecurityPhysicalResults } from "../ci-cacheable-security-evidence.mts";
import { parseSecurityPhysicalResults } from "../ci-synthesis-input.mts";

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

  it.each(["-1", "1.5", "not-a-number"])("rejects invalid CLI exit code %s", (exitCode) => {
    const output = join(mkdtempSync(join(tmpdir(), "croco-security-exit-code-")), "results.json");
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "scripts/ci-cacheable-security-evidence.mts",
        "--output",
        output,
        "--advisory-audit-exit-code",
        exitCode,
        "--gitleaks-smoke-exit-code",
        "0",
        "--secret-scan-exit-code",
        "0",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("INVALID_SECURITY_EXIT_CODE");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid programmatic exit code %s",
    (exitCode) => {
      expect(() =>
        createSecurityPhysicalResults({
          advisoryProductionAudit: exitCode,
          gitleaksAcceptanceSmoke: 0,
          blockingSecretScan: 0,
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_SECURITY_EXIT_CODE", category: "input" }));
    },
  );

  it("rejects a result outside coverage-security ownership", () => {
    const results = createSecurityPhysicalResults({
      advisoryProductionAudit: 0,
      gitleaksAcceptanceSmoke: 0,
      blockingSecretScan: 0,
    });

    expect(() =>
      parseSecurityPhysicalResults([
        { ...results[0], id: "security-policy-summary", semantics: "report-only" },
        ...results.slice(1),
      ]),
    ).toThrow(/ownership or semantics drifted/);
  });

  it("creates the exact set accepted by the physical security parser", () => {
    const results = createSecurityPhysicalResults({
      advisoryProductionAudit: 0,
      gitleaksAcceptanceSmoke: 2,
      blockingSecretScan: 0,
    });

    expect(parseSecurityPhysicalResults(results)).toEqual(results);
  });
});
