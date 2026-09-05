import { describe, expect, it } from "vitest";

import {
  operationsTimelineEventFromEngagementDispatch,
  retryConsoleItemFromEngagementDispatch,
  type EngagementOperationsFailureEvidence,
} from "../index";

const evidence: EngagementOperationsFailureEvidence = {
  dispatchId: "disp-100",
  tenantId: "tenant-1",
  recipientId: "rec-200",
  messageId: "msg-promo",
  campaignId: "camp-summer",
  channel: "email",
  status: "failed",
  providerAccepted: false,
  retryable: true,
  attemptCount: 1,
  maxAttempts: 3,
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  updatedAt: new Date("2026-08-01T10:00:15.000Z"),
  correlationId: "corr-xyz",
  failureReason: "503 Service Unavailable authorization: bearer secret-token-12345",
  problem: {
    code: "engagement/provider-error",
    message: "Upstream gateway returned 503 x-api-key: super-secret-key-abc",
    retryable: true,
  },
};

describe("engagement admin-ops adapters", () => {
  it("maps failed engagement dispatch to operations timeline structurally with sensitive text redacted", () => {
    const event = operationsTimelineEventFromEngagementDispatch(evidence);

    expect(event).toMatchObject({
      source: "engagement",
      severity: "error",
      tenantId: "tenant-1",
      correlationId: "corr-xyz",
      primaryEntity: {
        type: "engagement-dispatch",
        id: "disp-100",
        label: "msg-promo",
      },
      problem: {
        code: "engagement/provider-error",
      },
      recoveryAction: "retry-dispatch",
      extension: {
        source: "engagement",
        dispatchId: "disp-100",
      },
    });
    expect(event.problem?.message).not.toContain("super-secret-key-abc");
    expect(event.problem?.message).toContain("[redacted]");
  });

  it("maps retryable dispatch to retry console item with allowed recovery action", () => {
    const item = retryConsoleItemFromEngagementDispatch(evidence);

    expect(item).toMatchObject({
      id: "disp-100",
      source: { kind: "engagement" },
      state: "terminal_failed",
      retryable: true,
    });
    expect(item.recoveryActions).toHaveLength(1);
    expect(item.recoveryActions[0]?.allowed).toBe(true);
    expect(item.recoveryActions[0]?.id).toBe("retry-dispatch");
    expect(item.recoveryActions[0]?.requiresAudit).toBe(true);
    expect(item.details?.failureReason).not.toContain("secret-token-12345");
    expect(item.details?.failureReason).toContain("[redacted]");
  });

  it("disallows retry in retry console when dispatch is not declared retryable by contract", () => {
    const nonRetryable: EngagementOperationsFailureEvidence = {
      ...evidence,
      dispatchId: "disp-non-retry",
      status: "delivered",
      providerAccepted: true,
      retryable: false,
      problem: undefined,
      failureReason: undefined,
    };

    const item = retryConsoleItemFromEngagementDispatch(nonRetryable);
    expect(item.state).toBe("succeeded");
    expect(item.retryable).toBe(false);
    expect(item.recoveryActions[0]?.allowed).toBe(false);
    expect(item.recoveryActions[0]?.id).toBe("inspect-dispatch");
  });

  it("maps suppressed and queued dispatches to appropriate retry states and severities", () => {
    const suppressed: EngagementOperationsFailureEvidence = {
      ...evidence,
      dispatchId: "disp-supp",
      status: "suppressed",
      retryable: false,
      suppressionReason: "Topic marketing unsubscribed",
    };
    const timelineEvent = operationsTimelineEventFromEngagementDispatch(suppressed);
    expect(timelineEvent.severity).toBe("warning");

    const retryItem = retryConsoleItemFromEngagementDispatch(suppressed);
    expect(retryItem.state).toBe("non_retryable");
    expect(retryItem.details?.suppressionReason).toBe("Topic marketing unsubscribed");

    const queued: EngagementOperationsFailureEvidence = {
      ...evidence,
      dispatchId: "disp-queue",
      status: "queued",
      retryable: false,
    };
    expect(operationsTimelineEventFromEngagementDispatch(queued).severity).toBe("info");
    expect(retryConsoleItemFromEngagementDispatch(queued).state).toBe("running");
  });
});
