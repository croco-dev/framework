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

  it.each([
    ["Authorization: Bearer sample-credential", "Authorization: [Redacted]"],
    ["proxy-authorization=Basic sample-credential", "proxy-authorization=[Redacted]"],
    ["authorization: Custom sample-credential", "authorization: [Redacted]"],
    [
      'authorization: Digest username="sample;user", response="sample-proof"; request ID: sample-request',
      "authorization: [Redacted]; request ID: sample-request",
    ],
    ["authorization=sample-credential", "authorization=[Redacted]"],
    [
      "authorization=sample-credential; request ID: sample-request",
      "authorization=[Redacted]; request ID: sample-request",
    ],
    [
      '"Authorization: Bearer sample-credential" request ID: sample-request',
      '"Authorization: [Redacted]" request ID: sample-request',
    ],
    [
      'Authorization="Custom sample-credential" request ID: sample-request',
      'Authorization="[Redacted]" request ID: sample-request',
    ],
    [
      "Authorization='Custom sample;credential' request ID: sample-request",
      "Authorization='[Redacted]' request ID: sample-request",
    ],
    [
      "Authorization='sample-credential' request ID: sample-request",
      "Authorization='[Redacted]' request ID: sample-request",
    ],
    [
      "The provider's Authorization='Custom sample-credential'",
      "The provider's Authorization='[Redacted]'",
    ],
    ["Authorization='Custom sample;credential", "Authorization=[Redacted]"],
    [
      '{"authorization":"Custom sample-credential","requestId":"sample-request"}',
      '{"authorization":"[Redacted]","requestId":"sample-request"}',
    ],
    ["Authorization: Custom\r\n\tsample-credential", "Authorization: [Redacted]"],
    ["Authorization: Custom\r\n \r\n\tsample-credential", "Authorization: [Redacted]"],
    [
      "Headers:\r\n  Authorization: Bearer sample-credential\r\n  X-Request-Id: sample-request",
      "Headers:\r\n  Authorization: [Redacted]\r\n  X-Request-Id: sample-request",
    ],
    [
      'Authorization: Digest username="sample\r\n\t;user", response="sample-proof"',
      "Authorization: [Redacted]",
    ],
    [
      JSON.stringify({
        message: 'upstream Authorization: Digest username="sample;user", response="sample-proof"',
        operation: "list",
      }),
      '{"message":"upstream Authorization: [Redacted]","operation":"list"}',
    ],
    ["Bearer sample-credential", "Bearer [Redacted]"],
    ["password=sample-credential denied", "password=[Redacted] denied"],
  ])("redacts credentials in trace strings (%s)", (header, redactedHeader) => {
    const trace = createPolicyDecisionTrace({
      policyKind: "access",
      result: "deny",
      ruleId: "access:document:viewer",
      reason: `Request rejected: ${header}\nRequest ID: sample-request`,
      inputs: { diagnostic: header },
    });

    expect(trace.reason).toBe(`Request rejected: ${redactedHeader}\nRequest ID: sample-request`);
    expect(trace.inputs.diagnostic).toBe(redactedHeader);
    expect(trace.redaction).toEqual({ applied: true, paths: ["diagnostic", "$"] });
  });

  it("preserves independent diagnostic lines after an empty authorization field", () => {
    const reason = "Authorization: \r\nRequest ID: sample-request";
    const trace = createPolicyDecisionTrace({
      policyKind: "access",
      result: "deny",
      ruleId: "access:document:viewer",
      reason,
    });

    expect(trace.reason).toBe(reason);
    expect(trace.redaction.applied).toBe(false);
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
