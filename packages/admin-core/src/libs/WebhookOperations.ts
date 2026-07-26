import { Problem, ProblemCategory } from "@croco/problems-core";

import type { AdminProblemContract } from "./types";

export type WebhookEndpointOperationalStatus = "active" | "paused" | "failing";

export type WebhookEventSubscription = {
  readonly name: string;
  readonly schemaVersion: string;
};

export type WebhookSecretVersionMetadata = {
  readonly activeVersion: string;
  readonly previousVersion?: string;
  readonly previousValidUntil?: Date;
};

export type WebhookEndpointOperationsRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly maskedUrl: string;
  readonly subscriptions: readonly WebhookEventSubscription[];
  readonly status: WebhookEndpointOperationalStatus;
  readonly successRate?: number;
  readonly lastSuccessAt?: Date;
  readonly lastFailureAt?: Date;
  readonly secret: WebhookSecretVersionMetadata;
};

export type WebhookDeliveryOperationsStatus =
  | "pending"
  | "accepted"
  | "delivered"
  | "retrying"
  | "dead"
  | "canceled"
  | "acceptance-unknown";

export type WebhookLogicalEventOperationsRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly schemaVersion: string;
  readonly subject: string;
  readonly occurredAt: Date;
  readonly committedAt: Date;
};

export type WebhookDeliveryOperationsRow = {
  readonly id: string;
  readonly eventId: string;
  readonly endpointId: string;
  readonly tenantId: string;
  readonly status: WebhookDeliveryOperationsStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly correlationId?: string;
  readonly problem?: AdminProblemContract;
  readonly replay?: {
    readonly allowed: boolean;
    readonly reason: string;
  };
};

export type WebhookAttemptRetryClassification =
  | "accepted"
  | "delivered"
  | "permanent"
  | "retryable"
  | "acceptance-unknown";

export type WebhookAttemptOperationsRow = {
  readonly id: string;
  readonly deliveryId: string;
  readonly number: number;
  readonly secretVersion: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly responseStatus?: number;
  readonly classification: WebhookAttemptRetryClassification;
  readonly nextRetryAt?: Date;
  readonly correlationId?: string;
  readonly redactedResponseExcerpt?: string;
  readonly problem?: AdminProblemContract;
};

export type WebhookDeliveryOperationsFilter = {
  readonly tenantId: string;
  readonly endpointId?: string;
  readonly eventName?: string;
  readonly schemaVersion?: string;
  readonly subject?: string;
  readonly states?: readonly WebhookDeliveryOperationsStatus[];
  readonly problemCode?: string;
  readonly from?: Date;
  readonly to?: Date;
};

export type WebhookOperationsActionKind =
  | "create-endpoint"
  | "update-subscriptions"
  | "pause-endpoint"
  | "resume-endpoint"
  | "rotate-secret"
  | "revoke-previous-secret"
  | "replay-delivery";

export type WebhookOperationsAction = {
  readonly kind: WebhookOperationsActionKind;
  readonly targetId: string;
  readonly permission: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly auditEvent: string;
};

export type WebhookOperationsWriteEvidence = {
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type WebhookOperationsActionRequest = WebhookOperationsWriteEvidence & {
  readonly tenantId: string;
  readonly action: WebhookOperationsActionKind;
  readonly targetId: string;
};

export type WebhookOperationsMutationExecutor<TResult> = {
  /**
   * Implementations must apply the mutation, idempotency claim, and audit append atomically.
   */
  execute(input: {
    readonly request: WebhookOperationsActionRequest;
    readonly action: WebhookOperationsAction;
  }): Promise<TResult>;
};

export type WebhookOperationsReadyState = {
  readonly kind: "ready";
  readonly tenantId: string;
  readonly generatedAt: Date;
  readonly endpoints: readonly WebhookEndpointOperationsRow[];
  readonly events: readonly WebhookLogicalEventOperationsRow[];
  readonly deliveries: readonly WebhookDeliveryOperationsRow[];
  readonly attempts: readonly WebhookAttemptOperationsRow[];
  readonly actions: readonly WebhookOperationsAction[];
};

export type WebhookOperationsState =
  | {
      readonly kind: "loading";
      readonly tenantId: string;
    }
  | {
      readonly kind: "empty";
      readonly tenantId: string;
      readonly message?: string;
    }
  | {
      readonly kind: "permission-denied";
      readonly tenantId: string;
      readonly problem: AdminProblemContract;
      readonly requiredPermissions: readonly string[];
    }
  | {
      readonly kind: "problem";
      readonly tenantId: string;
      readonly problem: AdminProblemContract;
      readonly partial?: WebhookOperationsReadyState;
    }
  | {
      readonly kind: "secret-created";
      readonly tenantId: string;
      readonly endpointId: string;
      readonly secretVersion: string;
      readonly oneTimeSecret: string;
      readonly expiresAt?: Date;
    }
  | WebhookOperationsReadyState;

export class WebhookOperationsActionValidationProblem extends Problem {
  constructor(field: keyof WebhookOperationsWriteEvidence) {
    super(
      "admin-core/webhook-action-validation-failed",
      ProblemCategory.ValidationError,
      `Outbound webhook operation requires a non-empty ${field}`,
      {
        extensions: { field },
      },
    );
  }
}

export function maskWebhookEndpointUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return "[invalid endpoint URL]";
  }
}

export function redactWebhookOperationsText(value: string): string {
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

export function createWebhookEndpointActions(
  endpoint: WebhookEndpointOperationsRow,
  grantedPermissions: readonly string[],
  now: Date = new Date(),
): readonly WebhookOperationsAction[] {
  const writeAllowed = grantedPermissions.includes("webhooks:write");
  const rotateAllowed = grantedPermissions.includes("webhooks:secrets:rotate");
  const previousSecretActive =
    endpoint.secret.previousVersion !== undefined &&
    (endpoint.secret.previousValidUntil === undefined || endpoint.secret.previousValidUntil > now);

  return [
    createAction(
      "update-subscriptions",
      endpoint.id,
      "webhooks:write",
      writeAllowed,
      writeAllowed ? "Subscriptions can be updated" : "Missing webhooks:write permission",
    ),
    createAction(
      endpoint.status === "paused" ? "resume-endpoint" : "pause-endpoint",
      endpoint.id,
      "webhooks:write",
      writeAllowed,
      writeAllowed
        ? endpoint.status === "paused"
          ? "New delivery dispatch can resume; already accepted work is unchanged"
          : "New delivery dispatch can be paused; already accepted work is not canceled"
        : "Missing webhooks:write permission",
    ),
    createAction(
      "rotate-secret",
      endpoint.id,
      "webhooks:secrets:rotate",
      rotateAllowed,
      rotateAllowed
        ? "A new secret can be presented once; existing secret values remain unavailable"
        : "Missing webhooks:secrets:rotate permission",
    ),
    createAction(
      "revoke-previous-secret",
      endpoint.id,
      "webhooks:secrets:rotate",
      rotateAllowed && previousSecretActive,
      !rotateAllowed
        ? "Missing webhooks:secrets:rotate permission"
        : previousSecretActive
          ? "The previous secret version can be revoked"
          : "No active previous secret version exists",
    ),
  ];
}

export function createWebhookEndpointCreationAction(
  tenantId: string,
  grantedPermissions: readonly string[],
): WebhookOperationsAction {
  const permission = "webhooks:write";
  const allowed = grantedPermissions.includes(permission);
  return createAction(
    "create-endpoint",
    tenantId,
    permission,
    allowed,
    allowed
      ? "An endpoint can be created with one-time secret presentation"
      : `Missing ${permission} permission`,
  );
}

export function createWebhookDeliveryAction(
  delivery: WebhookDeliveryOperationsRow,
  endpoint: WebhookEndpointOperationsRow | undefined,
  grantedPermissions: readonly string[],
): WebhookOperationsAction {
  const permission = "webhooks:replay";
  const replayableStatuses: readonly WebhookDeliveryOperationsStatus[] = [
    "delivered",
    "dead",
    "canceled",
    "acceptance-unknown",
  ];
  const replayable =
    replayableStatuses.includes(delivery.status) && delivery.replay?.allowed === true;
  const allowed =
    grantedPermissions.includes(permission) && endpoint?.status === "active" && replayable;
  const reason = !grantedPermissions.includes(permission)
    ? `Missing ${permission} permission`
    : endpoint?.status !== "active"
      ? "Endpoint must be active before replay"
      : !replayableStatuses.includes(delivery.status)
        ? `Delivery state ${delivery.status} is not replayable`
        : replayable
          ? "Core delivery state allows replay of the existing logical event"
          : (delivery.replay?.reason ??
            "Core webhook contract did not declare this delivery safe to replay");

  return createAction("replay-delivery", delivery.id, permission, allowed, reason);
}

export function assertWebhookOperationsActionRequest(
  request: WebhookOperationsActionRequest,
): WebhookOperationsActionRequest {
  for (const field of ["actorId", "reason", "idempotencyKey"] as const) {
    if (request[field].trim() === "") {
      throw new WebhookOperationsActionValidationProblem(field);
    }
  }
  return request;
}

export async function executeWebhookOperationsAction<TResult>(input: {
  readonly request: WebhookOperationsActionRequest;
  readonly action: WebhookOperationsAction;
  readonly expectedTenantId: string;
  readonly grantedPermissions: readonly string[];
  readonly executor: WebhookOperationsMutationExecutor<TResult>;
}): Promise<TResult> {
  const request = assertWebhookOperationsActionRequest(input.request);
  const matchesAction =
    request.action === input.action.kind && request.targetId === input.action.targetId;
  if (
    request.tenantId !== input.expectedTenantId ||
    !matchesAction ||
    !input.action.allowed ||
    !input.grantedPermissions.includes(input.action.permission)
  ) {
    throw new WebhookOperationsActionValidationProblem("reason");
  }
  return input.executor.execute({ action: input.action, request });
}

export function filterWebhookDeliveries(
  state: WebhookOperationsReadyState,
  filter: WebhookDeliveryOperationsFilter,
): readonly WebhookDeliveryOperationsRow[] {
  const events = new Map(state.events.map((event) => [event.id, event]));
  return state.deliveries.filter((delivery) => {
    const event = events.get(delivery.eventId);
    return (
      delivery.tenantId === filter.tenantId &&
      (filter.endpointId === undefined || delivery.endpointId === filter.endpointId) &&
      (filter.eventName === undefined || event?.name === filter.eventName) &&
      (filter.schemaVersion === undefined || event?.schemaVersion === filter.schemaVersion) &&
      (filter.subject === undefined || event?.subject === filter.subject) &&
      (filter.states === undefined || filter.states.includes(delivery.status)) &&
      (filter.problemCode === undefined || delivery.problem?.code === filter.problemCode) &&
      (filter.from === undefined || delivery.updatedAt >= filter.from) &&
      (filter.to === undefined || delivery.updatedAt <= filter.to)
    );
  });
}

function createAction(
  kind: WebhookOperationsActionKind,
  targetId: string,
  permission: string,
  allowed: boolean,
  reason: string,
): WebhookOperationsAction {
  return {
    allowed,
    auditEvent: `webhook.${kind}`,
    kind,
    permission,
    reason,
    targetId,
  };
}
