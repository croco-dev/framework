import type {
  OperationsTimelineEvent,
  RetryConsoleItem,
  RetryConsoleItemState,
  RetryConsoleRecoveryAction,
} from "./types";

export type WebhookOperationsFailureEvidence = {
  readonly deliveryId: string;
  readonly eventId: string;
  readonly endpointId: string;
  readonly tenantId: string;
  readonly eventName: string;
  readonly schemaVersion: string;
  readonly subject: string;
  readonly status:
    | "pending"
    | "accepted"
    | "delivered"
    | "retrying"
    | "dead"
    | "canceled"
    | "acceptance-unknown";
  readonly endpointStatus: "active" | "paused" | "disabled";
  readonly attemptCount: number;
  readonly maxAttempts?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly nextAttemptAt?: Date;
  readonly correlationId?: string;
  readonly problem?: {
    readonly code: string;
    readonly message: string;
    readonly retryable?: boolean;
  };
  readonly replay?: {
    readonly allowed: boolean;
    readonly reason: string;
  };
};

export function operationsTimelineEventFromWebhookDelivery(
  evidence: WebhookOperationsFailureEvidence,
): OperationsTimelineEvent<"webhook", { readonly source: "webhook"; readonly deliveryId: string }> {
  const problem = redactProblem(evidence.problem);
  return {
    id: `webhook:${evidence.deliveryId}:${evidence.updatedAt.toISOString()}`,
    source: "webhook",
    timestamp: evidence.updatedAt,
    severity: severityForStatus(evidence.status),
    title: `${evidence.eventName} delivery ${evidence.status}`,
    summary: `Endpoint ${evidence.endpointId}; schema ${evidence.schemaVersion}; subject ${evidence.subject}`,
    tenantId: evidence.tenantId,
    correlationId: evidence.correlationId,
    primaryEntity: {
      type: "webhook-delivery",
      id: evidence.deliveryId,
      label: evidence.eventName,
    },
    entities: [
      { type: "webhook-event", id: evidence.eventId, label: evidence.eventName },
      { type: "webhook-endpoint", id: evidence.endpointId },
    ],
    problem,
    retry: {
      attempt: evidence.attemptCount,
      maxAttempts: evidence.maxAttempts,
      retryable: evidence.status === "retrying",
      nextRetryAt: evidence.nextAttemptAt,
    },
    recoveryAction: isReplayAllowed(evidence) ? "replay-delivery" : undefined,
    extension: {
      source: "webhook",
      deliveryId: evidence.deliveryId,
    },
  };
}

export function retryConsoleItemFromWebhookDelivery(
  evidence: WebhookOperationsFailureEvidence,
): RetryConsoleItem {
  const state = retryStateForStatus(evidence.status);
  const recoveryAction = recoveryActionForWebhook(evidence);
  const problem = redactProblem(evidence.problem);

  return {
    id: evidence.deliveryId,
    source: {
      kind: "webhook",
      label: "Outbound webhook",
      target: `${evidence.eventName} → ${evidence.endpointId}`,
    },
    state,
    title: `${evidence.eventName} delivery`,
    retryable: evidence.status === "retrying",
    problem: problem
      ? {
          code: problem.code,
          message: problem.message,
          retryable: problem.retryable,
        }
      : undefined,
    attempts: {
      current: evidence.attemptCount,
      max: evidence.maxAttempts,
    },
    timestamps: {
      createdAt: evidence.createdAt.toISOString(),
      updatedAt: evidence.updatedAt.toISOString(),
    },
    correlationIds: {
      tenantId: evidence.tenantId,
      correlationId: evidence.correlationId,
      webhookDeliveryId: evidence.deliveryId,
      webhookEventId: evidence.eventId,
      webhookEndpointId: evidence.endpointId,
    },
    recoveryActions: [recoveryAction],
    details: {
      eventName: evidence.eventName,
      schemaVersion: evidence.schemaVersion,
      subject: evidence.subject,
      status: evidence.status,
    },
  };
}

function redactProblem(
  problem: WebhookOperationsFailureEvidence["problem"],
): WebhookOperationsFailureEvidence["problem"] {
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

function recoveryActionForWebhook(
  evidence: WebhookOperationsFailureEvidence,
): RetryConsoleRecoveryAction {
  const replayAllowed = isReplayAllowed(evidence);
  return {
    id: replayAllowed ? "replay-delivery" : "inspect-delivery",
    kind: replayAllowed ? "replay" : "inspect",
    label: replayAllowed ? "Replay delivery" : "Inspect delivery",
    allowed: replayAllowed || evidence.status !== "pending",
    reason:
      evidence.replay?.reason ??
      "Core webhook contract did not declare this delivery safe to replay",
    permission: {
      action: replayAllowed ? "webhooks:replay" : "webhooks:read",
      resource: `webhook-delivery:${evidence.deliveryId}`,
      scope: "tenant",
    },
    requiresAudit: replayAllowed,
    requiresIdempotencyKey: replayAllowed,
  };
}

function isReplayAllowed(evidence: WebhookOperationsFailureEvidence): boolean {
  const replayableStatus =
    evidence.status === "delivered" ||
    evidence.status === "dead" ||
    evidence.status === "canceled" ||
    evidence.status === "acceptance-unknown";
  return (
    evidence.endpointStatus === "active" && replayableStatus && evidence.replay?.allowed === true
  );
}

function retryStateForStatus(
  status: WebhookOperationsFailureEvidence["status"],
): RetryConsoleItemState {
  switch (status) {
    case "pending":
    case "retrying":
      return "running";
    case "accepted":
    case "delivered":
      return "succeeded";
    case "dead":
    case "canceled":
      return "terminal_failed";
    case "acceptance-unknown":
      return "non_retryable";
  }
}

function severityForStatus(
  status: WebhookOperationsFailureEvidence["status"],
): OperationsTimelineEvent["severity"] {
  switch (status) {
    case "dead":
      return "error";
    case "acceptance-unknown":
    case "retrying":
      return "warning";
    case "canceled":
      return "info";
    case "pending":
    case "accepted":
    case "delivered":
      return "info";
  }
}
