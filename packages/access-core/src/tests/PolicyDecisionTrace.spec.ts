import * as telemetry from "@croco/telemetry-api";
import { describe, expect, it, vi } from "vitest";
import {
  POLICY_DECISION_REDACTED_VALUE,
  createPolicyDecisionTrace,
  recordPolicyDecisionTrace,
  toPolicyDecisionTelemetryAttributes,
} from "../libs/PolicyDecisionTrace";

describe("PolicyDecisionTrace", () => {
  it("creates stable decision ids from redacted decision evidence", () => {
    const input = {
      policyKind: "access",
      result: "deny" as const,
      ruleId: "access:document:editor",
      subjectRef: "user:user-1",
      resourceRef: "document:doc-1",
      tenantId: "tenant-1",
      sourceLocation: {
        file: "src/routes/documents.ts",
        line: 12,
        column: 3,
      },
      reason: "authorization=secret-token denied",
      inputs: {
        authorization: "Bearer secret-token",
        nested: {
          apiKey: "key-1",
          safe: "visible",
        },
      },
    };

    const first = createPolicyDecisionTrace(input);
    const second = createPolicyDecisionTrace(input);

    expect(first.decisionId).toBe(second.decisionId);
    expect(first.decisionId).toMatch(/^pdt_[a-z0-9]+$/);
    expect(first.inputs.authorization).toBe(POLICY_DECISION_REDACTED_VALUE);
    expect(first.inputs.nested).toEqual({
      apiKey: POLICY_DECISION_REDACTED_VALUE,
      safe: "visible",
    });
    expect(first.reason).toContain(POLICY_DECISION_REDACTED_VALUE);
    expect(first.redaction).toEqual({
      applied: true,
      paths: ["authorization", "nested.apiKey", "$"],
    });
  });

  it("records telemetry attributes and forwards the audit trace", async () => {
    const recordEventSpy = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => {});
    const auditSink = {
      recordPolicyDecisionTrace: vi.fn(async () => undefined),
    };
    const trace = createPolicyDecisionTrace({
      policyKind: "access",
      result: "allow",
      ruleId: "access:project:viewer",
      subjectRef: "user:user-1",
      resourceRef: "project:project-1",
      tenantId: "tenant-1",
      sourceLocation: {
        file: "src/routes/projects.ts",
        line: 24,
      },
    });

    await recordPolicyDecisionTrace(trace, { auditSink });

    expect(recordEventSpy).toHaveBeenCalledWith(
      "policy.decision",
      toPolicyDecisionTelemetryAttributes(trace),
    );
    expect(auditSink.recordPolicyDecisionTrace).toHaveBeenCalledWith(trace);
  });
});
