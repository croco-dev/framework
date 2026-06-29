import { describe, expect, it } from "vitest";
import {
  CROCO_DIAGNOSTIC_CODE_DEFINITIONS,
  DIAGNOSTIC_CODE_CHANGE_POLICY,
  createDiagnosticMessage,
  formatDiagnosticMessage,
  formatDiagnosticSourceLocation,
  getDiagnosticCodeDefinition,
  isDiagnosticCode,
} from "../libs/DiagnosticCodes";

describe("DiagnosticCodes", () => {
  it("defines stable CROCO diagnostic examples across at least three categories", () => {
    const categories = new Set(
      CROCO_DIAGNOSTIC_CODE_DEFINITIONS.map((definition) => definition.category),
    );
    const codes = new Set<string>();

    expect(categories.size).toBeGreaterThanOrEqual(3);

    for (const definition of CROCO_DIAGNOSTIC_CODE_DEFINITIONS) {
      expect(isDiagnosticCode(definition.code)).toBe(true);
      expect(codes.has(definition.code)).toBe(false);
      expect(definition.cause.length).toBeGreaterThan(0);
      expect(definition.action.length).toBeGreaterThan(0);
      expect(definition.searchKeywords).toContain(definition.code);
      expect(definition.fixExamples.length).toBeGreaterThan(0);
      const legacyCodes = "legacyCodes" in definition ? definition.legacyCodes : [];
      for (const legacyCode of legacyCodes ?? []) {
        expect(isDiagnosticCode(legacyCode)).toBe(false);
        expect(definition.searchKeywords).toContain(legacyCode);
      }
      codes.add(definition.code);
    }
  });

  it("formats diagnostic messages with cause, recovery action, source location, and search hints", () => {
    const definition = getDiagnosticCodeDefinition("CROCO_ROUTE_004");

    expect(definition).toBeDefined();
    if (!definition) {
      return;
    }

    const message = createDiagnosticMessage(definition, {
      location: {
        file: "packages/api/src/UsersController.ts",
        line: 12,
        column: 8,
        packageName: "@croco/example-api",
        symbol: "UsersController.getUser",
      },
    });

    expect(formatDiagnosticMessage(message)).toBe(
      [
        "ERROR CROCO_ROUTE_004 - Route path parameter is not bound",
        "Category: routing",
        "Cause: A route path declares a path parameter but the controller method metadata does not bind that parameter.",
        "Location: packages/api/src/UsersController.ts:12:8#UsersController.getUser (@croco/example-api)",
        "Action: Add the matching path parameter decorator or rename the path token so generated contracts and runtime routing agree.",
        "Docs: docs/troubleshooting/diagnostics.md#croco_route_004",
        "Search: CROCO_ROUTE_004, missing path param, @Param, route contract",
      ].join("\n"),
    );
  });

  it("rejects unstable local code shapes while keeping definitions discoverable", () => {
    expect(isDiagnosticCode("doctor/workspace-not-found")).toBe(false);
    expect(isDiagnosticCode("CROCO_ROUTE_4")).toBe(false);
    expect(isDiagnosticCode("CROCO_ROUTE_004")).toBe(true);
    expect(getDiagnosticCodeDefinition("CROCO_DI_001")?.category).toBe("dependency-injection");
    expect(getDiagnosticCodeDefinition("CROCO_CLI_DOCTOR_001")?.legacyCodes).toEqual([
      "doctor/workspace-not-found",
    ]);
    expect(getDiagnosticCodeDefinition("CROCO_CLI_USAGE_DASHBOARD_004")?.legacyCodes).toEqual([
      "usage-dashboard/provider-unavailable",
    ]);
    expect(getDiagnosticCodeDefinition("CROCO_UNKNOWN_999")).toBeUndefined();
  });

  it("formats absent and partial source locations without dropping evidence", () => {
    expect(formatDiagnosticSourceLocation()).toBe("unknown");
    expect(formatDiagnosticSourceLocation({ packageName: "@croco/api" })).toBe(
      "unknown (@croco/api)",
    );
    expect(formatDiagnosticSourceLocation({ file: "src/app.ts", line: 4 })).toBe("src/app.ts:4");
  });

  it("documents append-only code maintenance policy", () => {
    expect(DIAGNOSTIC_CODE_CHANGE_POLICY.stability).toBe("append-only");
    expect(DIAGNOSTIC_CODE_CHANGE_POLICY.allowedChanges).toContain("add-code");
    expect(DIAGNOSTIC_CODE_CHANGE_POLICY.breakingChanges).toContain("reuse-code");
    expect(DIAGNOSTIC_CODE_CHANGE_POLICY.breakingChanges).toContain("rename-code");
  });
});
