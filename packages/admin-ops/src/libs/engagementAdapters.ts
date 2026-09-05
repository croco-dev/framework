import type {
  OperationsTimelineEvent,
  RetryConsoleItem,
  RetryConsoleItemState,
  RetryConsoleRecoveryAction,
} from "./types";

export type EngagementOperationsFailureEvidence = {
  readonly dispatchId: string;
  readonly tenantId: string;
  readonly recipientId: string;
  readonly messageId: string;
  readonly campaignId?: string;
  readonly channel: "email" | "push";
  readonly status: "queued" | "accepted" | "suppressed" | "failed" | "skipped" | "delivered";
  readonly providerAccepted: boolean;
  readonly retryable: boolean;
  readonly attemptCount?: number;
  readonly maxAttempts?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly nextAttemptAt?: Date;
  readonly correlationId?: string;
  readonly failureReason?: string;
  readonly suppressionReason?: string;
  readonly problem?: {
    readonly code: string;
    readonly message: string;
    readonly retryable?: boolean;
  };
};

export function operationsTimelineEventFromEngagementDispatch(
  evidence: EngagementOperationsFailureEvidence,
): OperationsTimelineEvent<
  "engagement",
  { readonly source: "engagement"; readonly dispatchId: string }
> {
  const problem = redactProblem(evidence.problem);
  return {
    id: `engagement:${evidence.dispatchId}:${evidence.updatedAt.toISOString()}`,
    source: "engagement",
    timestamp: evidence.updatedAt,
    severity: severityForStatus(evidence.status),
    title: `${evidence.channel} send ${evidence.status}`,
    summary: `Message ${evidence.messageId}; recipient ${evidence.recipientId}${evidence.campaignId ? `; campaign ${evidence.campaignId}` : ""}`,
    tenantId: evidence.tenantId,
    correlationId: evidence.correlationId,
    primaryEntity: {
      type: "engagement-dispatch",
      id: evidence.dispatchId,
      label: evidence.messageId,
    },
    entities: [
      { type: "engagement-recipient", id: evidence.recipientId },
      ...(evidence.campaignId ? [{ type: "engagement-campaign", id: evidence.campaignId }] : []),
    ],
    problem,
    retry: {
      attempt: evidence.attemptCount ?? 1,
      maxAttempts: evidence.maxAttempts,
      retryable: evidence.retryable && evidence.status === "failed",
      nextRetryAt: evidence.nextAttemptAt,
    },
    recoveryAction: isRetryAllowed(evidence) ? "retry-dispatch" : undefined,
    extension: {
      source: "engagement",
      dispatchId: evidence.dispatchId,
    },
  };
}

export function retryConsoleItemFromEngagementDispatch(
  evidence: EngagementOperationsFailureEvidence,
): RetryConsoleItem {
  const state = retryStateForStatus(evidence.status);
  const recoveryAction = recoveryActionForEngagement(evidence);
  const problem = redactProblem(evidence.problem);

  return {
    id: evidence.dispatchId,
    source: {
      kind: "engagement",
      label: "Engagement dispatch",
      target: `${evidence.messageId} → ${evidence.recipientId} (${evidence.channel})`,
    },
    state,
    title: `${evidence.messageId} dispatch`,
    retryable: evidence.retryable && evidence.status === "failed",
    problem: problem
      ? {
          code: problem.code,
          message: problem.message,
          retryable: problem.retryable,
        }
      : undefined,
    attempts: {
      current: evidence.attemptCount ?? 1,
      max: evidence.maxAttempts,
    },
    timestamps: {
      createdAt: evidence.createdAt.toISOString(),
      updatedAt: evidence.updatedAt.toISOString(),
    },
    correlationIds: {
      tenantId: evidence.tenantId,
      correlationId: evidence.correlationId,
      engagementDispatchId: evidence.dispatchId,
      engagementRecipientId: evidence.recipientId,
      engagementMessageId: evidence.messageId,
      ...(evidence.campaignId ? { engagementCampaignId: evidence.campaignId } : {}),
    },
    recoveryActions: [recoveryAction],
    details: {
      channel: evidence.channel,
      messageId: evidence.messageId,
      recipientId: evidence.recipientId,
      status: evidence.status,
      providerAccepted: evidence.providerAccepted,
      ...(evidence.failureReason
        ? { failureReason: redactSensitiveText(evidence.failureReason) }
        : {}),
      ...(evidence.suppressionReason ? { suppressionReason: evidence.suppressionReason } : {}),
    },
  };
}

function redactProblem(
  problem: EngagementOperationsFailureEvidence["problem"],
): EngagementOperationsFailureEvidence["problem"] {
  if (!problem) {
    return undefined;
  }
  return {
    ...problem,
    message: redactSensitiveText(problem.message),
  };
}

function redactSensitiveText(value: string): string {
  return value
    .replace(
      /(^|[\s,;])(?:authorization|proxy-authorization|cookie|set-cookie|webhook-signature|x-api-key)\s*:[^\r\n]*/gi,
      "$1[redacted]",
    )
    .replace(
      /(["']?(?:authorization|proxy-authorization|cookie|set-cookie|webhook-signature|x-api-key|password|secret|token)["']?\s*[=:]\s*)("[^"]*"|'[^']*'|[^,\s;]+)/gi,
      "[redacted]",
    )
    .replace(/\b(?:bearer|basic|digest|apikey)\s+[^\s,;]+/gi, "[redacted]");
}

function isRetryAllowed(evidence: EngagementOperationsFailureEvidence): boolean {
  return evidence.status === "failed" && evidence.retryable;
}

function recoveryActionForEngagement(
  evidence: EngagementOperationsFailureEvidence,
): RetryConsoleRecoveryAction {
  const retryAllowed = isRetryAllowed(evidence);
  return {
    id: retryAllowed ? "retry-dispatch" : "inspect-dispatch",
    kind: retryAllowed ? "retry" : "inspect",
    label: retryAllowed ? "Retry dispatch" : "Inspect dispatch",
    allowed: retryAllowed,
    reason: retryAllowed
      ? "Safe retryable failure declared by underlying execution contract"
      : "Underlying execution contract did not declare this dispatch safe to retry",
    permission: {
      action: retryAllowed ? "engagement:campaign:run" : "engagement:delivery:read",
      resource: `engagement-dispatch:${evidence.dispatchId}`,
      scope: "tenant",
    },
    requiresAudit: retryAllowed,
    requiresIdempotencyKey: retryAllowed,
  };
}

function retryStateForStatus(
  status: EngagementOperationsFailureEvidence["status"],
): RetryConsoleItemState {
  switch (status) {
    case "queued":
      return "running";
    case "accepted":
    case "delivered":
      return "succeeded";
    case "failed":
      return "terminal_failed";
    case "suppressed":
    case "skipped":
      return "non_retryable";
  }
}

function severityForStatus(
  status: EngagementOperationsFailureEvidence["status"],
): OperationsTimelineEvent["severity"] {
  switch (status) {
    case "failed":
      return "error";
    case "suppressed":
      return "warning";
    case "queued":
    case "accepted":
    case "delivered":
    case "skipped":
      return "info";
  }
}
